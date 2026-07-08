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

## Measured Type-Level Performance

All numbers are fixture deltas, measured as type instantiations over the shared
`httpapi` suite baseline.

Endpoint declaration costs now grow with a lower slope:

| endpoints |  before |  after |
| --------: | ------: | -----: |
|        10 |   4,815 |  2,970 |
|        50 |  16,975 |  9,570 |
|       100 |  32,175 | 17,820 |
|       500 | 153,775 | 83,820 |

`HttpApiBuilder` handler registration avoids the previous non-linear blow-up.
For complete handler registration, `handleAll` is measured against the
equivalent fluent `handle` chain on the same endpoint set:

| endpoints | before fluent | after fluent | `handleAll` |
| --------: | ------------: | -----------: | ----------: |
|        10 |        32,523 |        8,473 |       6,154 |
|        50 |       560,763 |       60,313 |      22,754 |
|       100 |     2,139,063 |      179,113 |      43,504 |
|       500 | OOM / SIGKILL |    3,289,513 |     209,504 |

Generated-client type production also improves for the hot method-building
paths:

| fixture                                 |  before |   after |
| --------------------------------------- | ------: | ------: |
| client methods, 500 endpoints           | 248,788 | 181,843 |
| top-level client methods, 500 endpoints | 243,047 | 185,754 |
| client endpoint method, 500 endpoints   |  67,890 |  61,001 |
| client groups, 100 groups x 5 endpoints |  70,725 |  71,844 |

URL builder types now avoid repeatedly expanding the full API/group shape:

| fixture                              |  before |  after |
| ------------------------------------ | ------: | -----: |
| URL builder, 500 endpoints           | 213,329 | 95,070 |
| top-level URL builder, 500 endpoints | 209,118 | 97,039 |
| builder endpoint, 500 endpoints      |  66,894 | 57,845 |

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
- The unused `HttpApiBuilder.Handlers.Any` helper type has been removed.
- The exported `HttpApiBuilder.HandlersTypeId` symbol has been removed; `Handlers`
  now uses a private string type id.
- Duplicate `handle` / `handleRaw` registrations for the same endpoint are no longer rejected at the call site. Missing endpoint handlers are still rejected by the final `HttpApiBuilder.group` return validation.

### Client Types

- `HttpApiClient.Client.Group` now derives a client from a concrete group type: `Client.Group<Group, E, R>`. The previous group-union plus group-name form is no longer supported.
- `HttpApiClient.Client.TopLevelMethods` now returns a name-keyed method record instead of a union of `[name, method]` tuples.
- `HttpApiClient.makeWith` removes the default `HttpClientError.HttpClientError` from custom client error types in the returned `Client`, while preserving any additional custom client errors.

### Endpoint Helper Types

- `HttpApiEndpoint.HttpApiEndpoint` now stores lightweight phantom metadata for middleware and request shapes: `~Middleware`, `~MiddlewareServices`, `~Request`, and `~RequestRaw`. Its type identifier field is now `readonly [TypeId]: typeof TypeId`.
- `HttpApiEndpoint.Constraint` is now a lightweight structural endpoint constraint and does not extend `Pipeable`; values typed only as `HttpApiEndpoint.Constraint` do not expose `.pipe`.
- `HttpApiEndpoint.AddError` has been removed; it was not used internally by the `HttpApi` implementation.
- `HttpApiEndpoint.Json` and `HttpApiEndpoint.StringTree` have been renamed to `HttpApiEndpoint.CodecJson` and `HttpApiEndpoint.CodecStringTree`.
- Handler request parts are now flattened with `Struct.Simplify`, improving
  displayed request types while reducing handler instantiations.
- Endpoint helper types now read metadata fields directly instead of re-inferring all type parameters from the full `HttpApiEndpoint` interface. This affects helpers such as `Name`, `Success`, `Error`, `Params`, `Query`, `Payload`, `Headers`, `Middleware`, `MiddlewareServices`, `Errors`, `ErrorServicesEncode`, `ErrorServicesDecode`, `Request`, `RequestRaw`, `ServerServices`, and `ClientServices`.
- `HttpApiClient.Client.Method` and related generated-client helpers now require endpoint types that satisfy `HttpApiEndpoint.ConstraintRequest`. Endpoint-like structural types must include the lightweight request metadata fields to be accepted.
