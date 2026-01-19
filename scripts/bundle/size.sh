#!/bin/bash
function compute_bundle_size() {
  local filename="${1}"
  pnpm rollup -c scripts/bundle/rollup.config.js "${filename}" | gzip | wc -c
}
output="| File Name | Current Size | Previous Size | Difference |"
output+="\n|:----------|:------------:|:-------------:|:----------:|"
files=${1:-"bundle/*.ts"}
for filename in ${files}; do
  current=$(compute_bundle_size "${filename}")
  previous=$([[ -f "head/bundle/${filename}" ]] && compute_bundle_size "head/bundle/${filename}" || echo "0")
  line=$(awk -v filename=${filename} -v current="${current}" -v previous="${previous}" '
    BEGIN {
      if (previous == 0) previous = current
      diff = current - previous
      diff_pct = (diff / previous) * 100
      current_kb = sprintf("%\047.2f", current / 1000)
      previous_kb = sprintf("%\047.2f", previous / 1000)
      diff_kb = sprintf("%\047.2f", diff / 1000)
      printf "| `%s` | %s KB | %s KB | %s%s KB (%s%.2f%%) |\n",
        filename,
        current_kb,
        previous_kb,
        (diff > 0 ? "+" : ""), diff_kb,
        (diff_pct > 0 ? "+" : ""), diff_pct
  }')
  output+="\n${line}"
done
echo -e $output
