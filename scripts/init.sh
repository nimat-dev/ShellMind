#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== ShellMind init: Verifying clean baseline ==="

# 1. Check working tree
DIRTY=$(git status --porcelain || true)
if [ -n "$DIRTY" ]; then
  echo "⚠️  Working tree has uncommitted modifications:"
  echo "$DIRTY"
else
  echo "✔ Working tree is clean."
fi

# 2. Install dependencies
echo "--- Checking dependencies ---"
pnpm install --prefer-offline

# 3. Typecheck
echo "--- Running typecheck (tsc -b) ---"
pnpm typecheck

# 4. Lint
echo "--- Running linter (eslint) ---"
pnpm lint

# 5. Full test suite
echo "--- Running test suite (vitest) ---"
pnpm test

# 6. Check architecture
echo "--- Running architecture boundary checks ---"
./scripts/check-architecture.sh

# 7. Secret scan (basic check for .env or private key files tracked in git)
echo "--- Checking for committed secrets ---"
if git ls-files | grep -E "(\.env|\.pem|\.key|id_rsa)" >/dev/null; then
  echo "❌ Dangerous secret files found tracked in git!" >&2
  exit 1
fi
echo "✔ No secret files tracked."

# 8. Check ROADMAP.md well-formedness
echo "--- Validating ROADMAP.md state ---"
ROADMAP_FILE=".harness/ROADMAP.md"
if [ -f "$ROADMAP_FILE" ]; then
  IN_PROGRESS_COUNT=$(grep -E "^\- \[ \] \*\*F[0-9]+\*\*.*— \`IN PROGRESS\`" "$ROADMAP_FILE" | wc -l | tr -d ' ' || true)
  if [ "$IN_PROGRESS_COUNT" -ne 1 ]; then
    echo "❌ ROADMAP.md invariant violated: expected exactly 1 IN PROGRESS feature, found $IN_PROGRESS_COUNT" >&2
    exit 1
  fi
  ACTIVE_FEATURE=$(grep -E "^\- \[ \] \*\*F[0-9]+\*\*.*— \`IN PROGRESS\`" "$ROADMAP_FILE" | head -n 1)
  echo "✔ ROADMAP.md verified. Active feature: $ACTIVE_FEATURE"
fi

# 9. Print current task
if [ -f ".harness/CURRENT_TASK.md" ]; then
  echo "--- Current Task ---"
  grep -E "^\*\*Feature\*\*|^\*\*Phase\*\*|^\*\*Status\*\*" .harness/CURRENT_TASK.md
fi

echo "============================================="
echo "✔ Baseline is clean, verified, and buildable."
echo "============================================="
exit 0
