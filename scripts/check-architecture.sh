#!/usr/bin/env bash
set -euo pipefail

echo "=== Running check-architecture (dependency-cruiser) ==="

# Check packages directory against .dependency-cruiser.cjs
if pnpm exec depcruise packages/ --config .dependency-cruiser.cjs --output-type err; then
  echo "✔ Layer boundaries respected. Architecture clean."
  exit 0
else
  echo "❌ Layer boundary violations detected!" >&2
  exit 1
fi
