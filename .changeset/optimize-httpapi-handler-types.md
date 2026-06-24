---
"effect": patch
---

Optimize type-level performance for `HttpApiBuilder` handler chains:

- store group endpoints in a type-level map keyed by endpoint name instead of repeatedly searching endpoint unions
- track handled endpoint names and validate missing handlers at the end of the group builder
- avoid duplicating endpoint error types when deriving handler error channels
- allow duplicate handler registrations, matching the existing runtime behavior where the latest handler replaces the previous one

Type instantiations for the handler-chain stress test improved as follows:

| endpoints | before | after |
| ---: | ---: | ---: |
| 10 | 32,523 | 14,459 |
| 50 | 560,763 | 86,779 |
| 100 | 2,139,063 | 235,679 |
| 500 | OOM / SIGKILL | 3,766,879 |
| 1000 | OOM / SIGKILL | 14,030,879 |
