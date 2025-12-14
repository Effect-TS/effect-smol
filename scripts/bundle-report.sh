#!/usr/bin/env bash
# Generate a markdown bundle size report from CSV files
#
# Usage: ./scripts/bundle-report.sh <results-dir> [base-sha] [cache-hit]
# Example: ./scripts/bundle-report.sh ./results abc123 true
#
# Input: Directory containing CSV files with format: name,current_size,base_size
# Output: Markdown report written to stdout

set -euo pipefail

RESULTS_DIR="${1:?Usage: $0 <results-dir> [base-sha] [cache-hit]}"
BASE_SHA="${2:-unknown}"
CACHE_HIT="${3:-unknown}"

# Start building the report
echo "## 📦 Bundle Size Report"
echo ""
echo "| File | Current | Base | Diff |"
echo "|:-----|--------:|-----:|-----:|"

total_current=0
total_base=0

# Process all CSV files, sorted by filename
for file in $(ls "$RESULTS_DIR"/*.csv 2>/dev/null | sort); do
  while IFS=',' read -r name current base; do
    # Skip empty lines
    [[ -z "$name" ]] && continue

    total_current=$((total_current + current))
    total_base=$((total_base + base))

    # Generate table row with awk
    awk -v name="$name" -v current="$current" -v base="$base" '
      BEGIN {
        if (base == 0) base = current
        diff = current - base
        diff_pct = (base > 0) ? (diff / base) * 100 : 0
        current_kb = sprintf("%.2f", current / 1000)
        base_kb = sprintf("%.2f", base / 1000)
        diff_kb = sprintf("%.2f", diff / 1000)
        sign = (diff > 0) ? "+" : ""
        sign_pct = (diff_pct > 0) ? "+" : ""
        emoji = (diff > 100) ? " 🔴" : (diff < -100) ? " 🟢" : ""
        printf "| %s | %s KB | %s KB | %s%s KB (%s%.1f%%)%s |\n",
          name, current_kb, base_kb, sign, diff_kb, sign_pct, diff_pct, emoji
      }'
  done < "$file"
done

# Add totals row
total_diff=$((total_current - total_base))
awk -v current="$total_current" -v base="$total_base" -v diff="$total_diff" '
  BEGIN {
    diff_pct = (base > 0) ? (diff / base) * 100 : 0
    current_kb = sprintf("%.2f", current / 1000)
    base_kb = sprintf("%.2f", base / 1000)
    diff_kb = sprintf("%.2f", diff / 1000)
    sign = (diff > 0) ? "+" : ""
    sign_pct = (diff_pct > 0) ? "+" : ""
    emoji = (diff > 500) ? " 🔴" : (diff < -500) ? " 🟢" : ""
    printf "| **Total** | **%s KB** | **%s KB** | **%s%s KB (%s%.1f%%)**%s |\n",
      current_kb, base_kb, sign, diff_kb, sign_pct, diff_pct, emoji
  }'

# Add details section
echo ""
echo "<details><summary>Details</summary>"
echo ""
echo "- Base commit: \`$BASE_SHA\`"
echo "- Build cache hit: \`$CACHE_HIT\`"
echo "- Bundle files: \`$(ls "$RESULTS_DIR"/*.csv 2>/dev/null | wc -l | tr -d ' ')\`"
echo ""
echo "</details>"
