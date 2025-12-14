#!/usr/bin/env bash
# Generate a JSON array of bundle file names for GitHub Actions matrix
#
# Usage: ./scripts/bundle-matrix.sh [bundle-dir]
# Example: ./scripts/bundle-matrix.sh ./bundle
#
# Output: JSON array like ["basic","logger","schema",...]

set -euo pipefail

BUNDLE_DIR="${1:-bundle}"

ls "$BUNDLE_DIR"/*.ts 2>/dev/null \
  | xargs -n1 basename \
  | sed 's/\.ts$//' \
  | jq -R -s -c 'split("\n") | map(select(length > 0))'
