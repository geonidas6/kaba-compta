#!/usr/bin/env bash
set -euo pipefail

# Copy every .env.example to .env in the project tree.
# Default: do not overwrite existing .env files.
# Use --force to overwrite existing .env files.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=0

if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

copied=0
skipped=0

while IFS= read -r -d '' example; do
  target="${example%.example}"

  if [[ -f "$target" && "$FORCE" -eq 0 ]]; then
    echo "Skip (exists): $target"
    skipped=$((skipped + 1))
    continue
  fi

  cp "$example" "$target"
  echo "Copied: $example -> $target"
  copied=$((copied + 1))
done < <(find "$ROOT_DIR" -type f -name ".env.example" -print0)

echo ""
echo "Done. Copied: $copied | Skipped: $skipped"
