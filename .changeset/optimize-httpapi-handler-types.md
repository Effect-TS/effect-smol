---
"effect": patch
---

Optimize type-level performance for unstable `HttpApi` types:

- store group endpoints in a type-level map keyed by endpoint name instead of repeatedly searching endpoint unions
- track handled endpoint names and validate missing handlers at the end of the group builder
- avoid duplicating endpoint error types when deriving handler error channels
- derive endpoint names from the lightweight endpoint name property instead of re-inferring endpoint type parameters
- use lightweight schema constraints for widened endpoint success and error metadata
- normalize `makeWith` client errors so `HttpClientError` is not duplicated in generated client types
- cache `urlBuilder` params and query request types instead of re-instantiating them while deriving method arguments
- allow duplicate handler registrations, matching the existing runtime behavior where the latest handler replaces the previous one

Type instantiations for the handler-chain stress test improved as follows:

| endpoints |        before |      after |
| --------: | ------------: | ---------: |
|        10 |        32,523 |     13,320 |
|        50 |       560,763 |     83,400 |
|       100 |     2,139,063 |    229,500 |
|       500 | OOM / SIGKILL |  3,738,300 |
|      1000 | OOM / SIGKILL | 13,974,300 |

Type instantiations for generated client stress tests are now covered separately:

| fixture                  |  before |   after |
| ------------------------ | ------: | ------: |
| client methods, 1000 eps | 429,906 | 429,906 |
| url builder, 1000 eps    | 306,024 | 183,064 |
