---
"effect": patch
---

Optimize TypeScript type-level performance for unstable `HttpApi` declarations
with large endpoint sets. The implementation now uses name-keyed maps and
lighter structural constraints in several hot type-level paths.

## New Features

- Add `HttpApiBuilder.Handlers.handleAll`, which registers a name-keyed batch of endpoint handlers for a group. Each entry can be either a handler function or `{ handler, options }`, and the object can be supplied in multiple partial batches.
- `HttpApi.groups` now preserves the concrete group type for each group name. For example, `Api.groups.users` is typed as the `users` group instead of the full group union.
- `HttpApiGroup.endpoints` now preserves the concrete endpoint type for each endpoint name. For example, `Group.endpoints.getUser` is typed as the `getUser` endpoint instead of the full endpoint union.

## Type-Level Performance

Type instantiations for the fluent handler-chain stress test improved as
follows:

| endpoints |        before |     after |
| --------: | ------------: | --------: |
|        10 |        32,523 |     9,054 |
|        50 |       560,763 |    63,254 |
|       100 |     2,139,063 |   185,004 |
|       500 | OOM / SIGKILL | 3,319,004 |

For complete handler registration, the new `handleAll` API is measured against
the equivalent fluent `handle` chain on the same endpoint set:

| fixture                      | fluent chain | `handleAll` |
| ---------------------------- | -----------: | ----------: |
| handlers, 10 eps             |        9,054 |       6,675 |
| handlers, 50 eps             |       63,254 |      25,395 |
| handlers, 100 eps            |      185,004 |      48,795 |
| handlers, 500 eps            |    3,319,004 |     235,995 |
| two handler batches, 500 eps |    3,319,004 |     253,657 |

## Breaking Changes

These changes affect unstable `HttpApi` type-level APIs and structural API,
group, and endpoint types.

### Renamed Constraint Types

- Broad structural constraint exports have been renamed to align with
  `Schema.Constraint` terminology: `HttpApi.Any` to `HttpApi.Constraint`,
  `HttpApi.AnyWithProps` to `HttpApi.Top`, `HttpApiGroup.Any` to
  `HttpApiGroup.Constraint`, `HttpApiGroup.AnyWithProps` to `HttpApiGroup.Top`,
  and `HttpApiEndpoint.Any` to `HttpApiEndpoint.Constraint`.
- `HttpApiEndpoint.AnyWithProps` has been replaced by `HttpApiEndpoint.Top`, whose
  schema parameters are constrained to `Schema.Top`, including success and error
  schemas.
- Type guards now expose the widened runtime-prop shapes: `HttpApi.isHttpApi`
  returns `HttpApi.Top`, `HttpApiGroup.isHttpApiGroup` returns
  `HttpApiGroup.Top`, and `HttpApiEndpoint.isHttpApiEndpoint` returns
  `HttpApiEndpoint.Top`.

### API And Group Maps

- `HttpApi.groups` is now typed as a name-keyed group map instead of
  `ReadonlyRecord<string, Groups>`, and `HttpApi` tracks its group union
  invariantly. Dynamic string indexing must refine the key first or cast to a
  broad runtime record.
- `HttpApiGroup.endpoints` is now typed as a name-keyed endpoint map instead of
  `ReadonlyRecord<string, Endpoints>`, and `HttpApiGroup` tracks its endpoint
  union invariantly. Dynamic string indexing must refine the key first or cast to
  a broad runtime record.
- `HttpApiGroup.Name` now reads the group identifier from
  `HttpApiGroup.Constraint`; group-like structural types must satisfy that
  lightweight group constraint.

### Builder Handler Types

- `HttpApiBuilder.Handlers` now tracks endpoints through a name-keyed endpoint map and a set of handled names, instead of tracking the remaining endpoint union. Its public type parameters changed from `Handlers<R, Endpoints>` to `Handlers<R, EndpointsByName, HandledNames>`, and its phantom fields changed from `_Endpoints` to `~EndpointsByName` / `~HandledNames`.
- The unused `HttpApiBuilder.Handlers.Any` helper type has been removed. The internal handler item shape moved from `HttpApiBuilder.Handlers.Item` to the `@internal` `HttpApiBuilder.HandlerItem` export.
- Duplicate `handle` / `handleRaw` registrations for the same endpoint are no longer rejected at the call site. Missing endpoint handlers are still rejected by the final `HttpApiBuilder.group` return validation.

### Client Types

- `HttpApiClient.Client.Group` now derives a client from a concrete group type: `Client.Group<Group, E, R>`. The previous group-union plus group-name form is no longer supported.
- `HttpApiClient.Client.TopLevelMethods` now returns a name-keyed method record instead of a union of `[name, method]` tuples.
- `HttpApiClient.makeWith` removes the default `HttpClientError.HttpClientError` from custom client error types in the returned `Client`, while preserving any additional custom client errors.

### Endpoint Helper Types

- `HttpApiEndpoint.HttpApiEndpoint` now stores lightweight phantom metadata for middleware and request shapes: `~Middleware`, `~MiddlewareServices`, `~Request`, and `~RequestRaw`. Its type identifier field is now `readonly [TypeId]: typeof TypeId`.
- `HttpApiEndpoint.Constraint` is now a lightweight structural endpoint constraint and does not extend `Pipeable`; values typed only as `HttpApiEndpoint.Constraint` do not expose `.pipe`.
- Endpoint helper types now read metadata fields directly instead of re-inferring all type parameters from the full `HttpApiEndpoint` interface. This affects helpers such as `Name`, `Success`, `Error`, `Params`, `Query`, `Payload`, `Headers`, `Middleware`, `MiddlewareServices`, `Errors`, `ErrorServicesEncode`, `ErrorServicesDecode`, `Request`, `RequestRaw`, `ServerServices`, and `ClientServices`.
- `HttpApiClient.Client.Method` and related generated-client helpers now require endpoint types that satisfy `HttpApiEndpoint.ConstraintRequest`. Endpoint-like structural types must include the lightweight request metadata fields to be accepted.
