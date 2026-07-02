---
"effect": patch
---

Optimize type-level performance for unstable `HttpApi` types, especially for
large APIs with many endpoints, handlers, and generated client methods.

## New Features

- Add `HttpApiBuilder.Handlers.handleAll`, which registers a name-keyed batch of endpoint handlers for a group. Each entry can be either a handler function or `{ handler, options }`, and the object can be supplied in multiple partial batches.
- `HttpApi.groups` now preserves the concrete group type for each group name. For example, `Api.groups.users` is typed as the `users` group instead of the full group union.

## Breaking Changes

These changes affect unstable `HttpApi` type-level APIs and structural endpoint
types.

- `HttpApiBuilder.Handlers` now tracks endpoints through a name-keyed endpoint map and a set of handled names, instead of tracking the remaining endpoint union. Its public type parameters changed from `Handlers<R, Endpoints>` to `Handlers<R, EndpointsByName, HandledNames>`, and its phantom fields changed from `_Endpoints` to `~EndpointsByName` / `~HandledNames`.
- The unused `HttpApiBuilder.Handlers.Any` helper type has been removed. The internal handler item shape moved from `HttpApiBuilder.Handlers.Item` to the `@internal` `HttpApiBuilder.HandlerItem` export.
- Duplicate `handle` / `handleRaw` registrations for the same endpoint are no longer rejected at the call site. Missing endpoint handlers are still rejected by the final `HttpApiBuilder.group` return validation.
- `HttpApiClient.Client.Group` now derives a client from a concrete group type: `Client.Group<Group, E, R>`. The previous group-union plus group-name form is no longer supported.
- `HttpApiClient.Client.TopLevelMethods` now returns a name-keyed method record instead of a union of `[name, method]` tuples.
- `HttpApiClient.makeWith` removes the default `HttpClientError.HttpClientError` from custom client error types in the returned `Client`, while preserving any additional custom client errors.
- `HttpApiEndpoint.HttpApiEndpoint` now stores lightweight phantom metadata for middleware and request shapes: `~Middleware`, `~MiddlewareServices`, `~Request`, and `~RequestRaw`. Its type identifier field is now `readonly [TypeId]: typeof TypeId`.
- `HttpApiEndpoint.Any` is now a lightweight structural endpoint constraint and no longer extends `Pipeable`; values typed only as `HttpApiEndpoint.Any` no longer expose `.pipe`.
- Endpoint helper types now read metadata fields directly instead of re-inferring all type parameters from the full `HttpApiEndpoint` interface. This affects helpers such as `Name`, `Success`, `Error`, `Params`, `Query`, `Payload`, `Headers`, `Middleware`, `Request`, `RequestRaw`, `ServerServices`, and `ClientServices`.
- `HttpApiClient.Client.Method` and related generated-client helpers now require endpoint types that satisfy `HttpApiEndpoint.ConstraintRequest`. Endpoint-like structural types must include the lightweight request metadata fields to be accepted.
- `HttpApiGroup.Name` now reads the group identifier from `HttpApiGroup.Any`; group-like structural types must satisfy that lightweight group constraint.
- `HttpApi.groups` is now typed as a name-keyed group map instead of `ReadonlyRecord<string, Groups>`, and `HttpApi` tracks its group union invariantly. Dynamic string indexing must refine the key first or cast to a broad runtime record.

## Type-Level Performance

Type instantiations for the handler-chain stress test improved as follows:

| endpoints |        before |     after |
| --------: | ------------: | --------: |
|        10 |        32,523 |     8,996 |
|        50 |       560,763 |    62,996 |
|       100 |     2,139,063 |   184,496 |
|       500 | OOM / SIGKILL | 3,316,496 |

Retained generated client and URL builder guardrails now focus on 500-endpoint
stress tests:

| fixture                        | current |
| ------------------------------ | ------: |
| client methods, 500 eps        | 179,349 |
| client groups, 100x5 eps       |  65,336 |
| top-level methods, 500 eps     | 178,751 |
| endpoint method, 500 eps       |  56,507 |
| url builder, 500 eps           |  95,154 |
| top-level URL builder, 500 eps |  93,038 |

Additional retained server guardrails:

| fixture                    |   current |
| -------------------------- | --------: |
| builder endpoint, 500 eps  |    53,381 |
| raw handler chain, 500 eps | 3,314,994 |

For handler groups, `handleAll` avoids the fluent-chain handled-name growth:

| fixture                      | fluent chain | `handleAll` |
| ---------------------------- | -----------: | ----------: |
| handlers, 10 eps             |        8,996 |       6,617 |
| handlers, 50 eps             |       62,996 |      25,137 |
| handlers, 100 eps            |      184,496 |      48,287 |
| handlers, 500 eps            |    3,316,496 |     233,487 |
| two handler batches, 500 eps |    3,316,496 |     251,149 |
