---
"effect": patch
---

Optimize type-level performance for unstable `HttpApi` types.

Previously, several helper types repeatedly searched endpoint unions by name,
re-inferred full endpoint parameters, and rebuilt request/client/handler
component types. Large APIs could therefore grow very quickly in type
instantiations.

This change makes the type model more direct:

- store group endpoints in a name-keyed type map and track handled endpoint names directly
- read endpoint names, schemas, middleware, and request constraints from lightweight metadata
- derive handler, client method, and URL builder types from cached request/response parts
- remove duplicated error/client-error contributions while keeping cache helpers internal
- align duplicate handler registration typing with the existing runtime last-write-wins behavior
- add `HttpApiBuilder.Handlers.handleAll` to register name-keyed handler batches

Type instantiations for the handler-chain stress test improved as follows:

| endpoints |        before |      after |
| --------: | ------------: | ---------: |
|        10 |        32,523 |     10,679 |
|        50 |       560,763 |     68,279 |
|       100 |     2,139,063 |    194,279 |
|       500 | OOM / SIGKILL |  3,362,279 |
|      1000 | OOM / SIGKILL | 12,722,279 |

Type instantiations for generated client stress tests are now covered separately:

| fixture                   |  before |   after |
| ------------------------- | ------: | ------: |
| client methods, 1000 eps  | 429,906 | 396,592 |
| endpoint method, 1000 eps |  95,340 |  96,012 |
| url builder, 1000 eps     | 306,024 | 182,039 |

Additional targeted stress tests:

| fixture                     |     before |      after |
| --------------------------- | ---------: | ---------: |
| raw handler chain, 1000 eps | 13,959,380 | 12,720,277 |

For large groups, `handleAll` avoids the fluent-chain handled-name growth:

| fixture                       | fluent chain | `handleAll` |
| ----------------------------- | -----------: | ----------: |
| handlers, 1000 eps            |   12,722,279 |     516,770 |
| erased handler, 1000 eps      |    7,351,811 |     291,964 |
| two handler batches, 1000 eps |   12,722,279 |     551,932 |
