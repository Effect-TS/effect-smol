---
"effect": patch
---

Fix `Clock.currentTimeNanos` returning timestamps near the Unix epoch on Cloudflare Workers `wrangler dev` / Miniflare with the `nodejs_compat` flag. The default clock's `performanceNowNanos` helper trusted `performance.timeOrigin === 0` as the signal that `performance.now()` already returns wall-clock ms, but on Miniflare `timeOrigin === 0` while `performance.now()` is unanchored from wall clock (it starts at 0 and grows). Spans then carried 1970 start/end times and were invisible to time-windowed trace backends. The helper now confirms `performance.now() > 86_400_000` before trusting the optimized path; when it doesn't look like wall-clock ms (the Miniflare case), it falls through to the `Date.now()`-anchored path. Fixes #2416.
