#!/usr/bin/env bash
# import/commit-batch.sh - commit the AMSA stations written since the last commit, only if the bank is green:
# rebuild the index, run npm test (unit tests + validator), then commit the stations, index, exam findings and the
# ledger to main and push. Usage: bash scripts/import/commit-batch.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
node scripts/build-index.mjs >/dev/null
if ! npm test --silent >/tmp/amsa-test.out 2>&1; then
  echo "tests failed; nothing committed"; grep -E "✖|not ok|errors" /tmp/amsa-test.out | head -20; exit 1
fi
git add public/osce/amsa-*.json public/osce/index.json public/exam.json scripts/import/amsa-ledger.json
if git diff --cached --quiet; then echo "nothing new to commit"; exit 0; fi
n=$(git diff --cached --name-only -- 'public/osce/amsa-*.json' | wc -l | tr -d ' ')
total=$(ls public/osce/amsa-*.json | wc -l | tr -d ' ')
git commit -q -m "AMSA import: ${n} more station(s), ${total} so far

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git pull --rebase -q origin main
git push -q origin main
git log --oneline -1
