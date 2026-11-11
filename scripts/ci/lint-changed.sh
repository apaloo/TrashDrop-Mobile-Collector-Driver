#!/usr/bin/env bash
# Lint only the JavaScript files a pull request adds or changes.
# The codebase has a lint backlog (tracked in the engineering handbook); this
# keeps every new or edited file clean so the backlog only shrinks.
set -euo pipefail
base="${1:?usage: lint-changed.sh <base-sha>}"
mapfile -t files < <(git diff --name-only --diff-filter=ACMR "$base"...HEAD -- '*.js' '*.jsx' '*.mjs' '*.cjs')
if [ "${#files[@]}" -eq 0 ]; then echo "No JavaScript files changed."; exit 0; fi
printf 'Linting %s changed file(s):\n' "${#files[@]}"; printf '  %s\n' "${files[@]}"
npx eslint --no-warn-ignored --max-warnings=-1 "${files[@]}"
