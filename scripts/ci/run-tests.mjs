#!/usr/bin/env node
// CI test runner: every Jest suite except the known-failing list (blocking),
// then the known-failing ones on their own (information only).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const listFile = path.join(root, 'scripts', 'ci', 'known-failing-tests.txt');
const known = fs.readFileSync(listFile, 'utf8').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

if (known.some((k) => k.includes('promotionalPayout'))) {
  console.error('promotionalPayout.test.js is protected and must never be listed as known-failing.');
  process.exit(1);
}

const escape = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const jest = path.join(root, 'node_modules', '.bin', 'jest');

console.log(`Running all suites except ${known.length} known-failing ones…`);
const main = spawnSync(jest, ['--ci', '--testPathIgnorePatterns', '/node_modules/', ...known.map(escape)], { cwd: root, stdio: 'inherit' });

if (known.length) {
  console.log('\nChecking known-failing suites (information only)…');
  const out = path.join(root, '.known-failing-results.json');
  spawnSync(jest, ['--ci', '--json', `--outputFile=${out}`, ...known.map(escape)], { cwd: root, stdio: 'ignore' });
  try {
    const r = JSON.parse(fs.readFileSync(out, 'utf8'));
    const nowPassing = r.testResults.filter((t) => t.status === 'passed').map((t) => path.relative(root, t.name));
    console.log(`${known.length - nowPassing.length} still failing, ${nowPassing.length} now passing.`);
    for (const f of nowPassing) console.log(`::warning file=scripts/ci/known-failing-tests.txt::${f} passes now. Delete it from known-failing-tests.txt.`);
  } catch (e) {
    console.log('Could not read known-failing results:', e.message);
  } finally {
    fs.rmSync(out, { force: true });
  }
}
process.exit(main.status ?? 1);
