// Collectors decide which jobs to take, and trust what they are told they
// earn, from what this app shows. So the app shows the database's figures,
// never made-up ones (docs/COLLECTOR_PAYOUTS.md in the household repository:
// "the app shows the database's figure everywhere, never more").
//
// Found 2026-11-14: a job card's "points" was Math.random() 50-99, its bag
// count a default 1 instead of bag_count, and completing a pickup announced a
// 10% "completion bonus" nothing paid, with random environmental figures.
// This test reads the source so a random number can't come back into what a
// collector sees: Math.random() may only make ids, retry jitter or log
// sampling, in the places listed here.
import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..', '..');

// file -> the kinds of use allowed there (each Math.random line must match one)
const ALLOWED = {
  'components/NavigationQRModal.jsx': [/Math\.random\(\) < 0\.\d+ && logger\./], // log sampling
  'components/AssignmentNavigationModal.jsx': [/if \(Math\.random\(\) < 0\.\d+\) \{/], // log sampling
  'services/realtimeNotificationService.js': [/const jitter = Math\.random\(\) \* \d+/], // reconnect jitter
  'services/locationBroadcast.js': [/if \(Math\.random\(\) < 0\.\d+\) \{/], // log sampling
  'utils/currencyUtils.js': [/if \(Math\.random\(\) < 0\.\d+\)/], // log sampling
  'context/CurrencyContext.jsx': [/if \(Math\.random\(\) < 0\.\d+\) \{/], // log sampling
  'pages/Request.jsx': [/key=\{request\.id \|\| Math\.random\(\)\.toString\(\)\}/], // React list key fallback
};

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'tests' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) out.push(full);
  }
  return out;
};

describe('no made-up figures in what a collector sees', () => {
  const files = walk(SRC).map((f) => ({ rel: path.relative(SRC, f).split(path.sep).join('/'), text: fs.readFileSync(f, 'utf8') }));

  it('Math.random() is used only for ids, jitter and log sampling, where listed', () => {
    const unexpected = [];
    for (const { rel, text } of files) {
      text.split('\n').forEach((line, i) => {
        if (!line.includes('Math.random')) return;
        const allowed = (ALLOWED[rel] || []).some((pattern) => pattern.test(line));
        if (!allowed) unexpected.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(unexpected).toEqual([]);
  });

  it('no "completion bonus" is announced: the database pays bags and tips only', () => {
    const request = files.find((f) => f.rel === 'pages/Request.jsx').text;
    expect(request).not.toMatch(/completionBonus|completion_bonus\s*[:=]|type: 'completion_bonus'/);
    expect(request).not.toMatch(/bonus for \$\{/);
    expect(request).not.toMatch(/environmental_impact:\s*environmentalImpact/);
  });

  it('money in a toast is in cedis, not dollars', () => {
    const request = files.find((f) => f.rel === 'pages/Request.jsx').text;
    expect(request).not.toMatch(/\$\$\{total/);
  });

  it('every allowed place still exists (the list only shrinks)', () => {
    for (const [rel, patterns] of Object.entries(ALLOWED)) {
      const file = files.find((f) => f.rel === rel);
      expect(file).toBeDefined();
      for (const pattern of patterns) expect(file.text).toMatch(pattern);
    }
  });
});
