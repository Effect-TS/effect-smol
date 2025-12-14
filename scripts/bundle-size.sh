#!/usr/bin/env bash
# Calculate the gzipped bundle size for a single bundle file
#
# Usage: ./scripts/bundle-size.sh <bundle-name> <workspace-dir>
# Example: ./scripts/bundle-size.sh basic ./current
#
# Output: prints the gzipped size in bytes to stdout

set -euo pipefail

BUNDLE_NAME="${1:?Usage: $0 <bundle-name> <workspace-dir>}"
WORKSPACE_DIR="${2:?Usage: $0 <bundle-name> <workspace-dir>}"

cd "$WORKSPACE_DIR"

# Run rollup and measure gzipped size
pnpm rollup -c rollup.config.js "bundle/${BUNDLE_NAME}.ts" 2>/dev/null | gzip | wc -c | tr -d ' '
