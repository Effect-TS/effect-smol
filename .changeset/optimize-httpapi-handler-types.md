---
"effect": patch
---

Improve unstable `HttpApi` type-level performance.

The implementation now uses identifier-keyed maps and lighter structural
constraints in several hot type-level paths. Generated group clients consume the
concrete endpoint map directly instead of rebuilding it from the endpoint union.

## New Features

- Add `HttpApiBuilder.Handlers.handleAll`, which registers an identifier-keyed batch of endpoint handlers for a group. Each entry can be either a handler function or `{ handler, options }`, and the object can be supplied in multiple partial batches. Endpoint identifiers that were already handled are rejected across batches.
- `HttpApi.groups` now preserves the concrete group type for each group identifier. For example, `Api.groups.users` is typed as the `users` group instead of the full group union.
- `HttpApiGroup.endpoints` now preserves the concrete endpoint type for each endpoint identifier. For example, `Group.endpoints.getUser` is typed as the `getUser` endpoint instead of the full endpoint union.
- `HttpApiEndpoint` values can now be extended as classes, matching the class-like
  runtime shape already used by `HttpApi` and `HttpApiGroup`.

## Measured Type-Level Performance

All numbers are fixture deltas, measured as type instantiations over the shared
`httpapi` suite baseline.

Endpoint declaration costs now grow with a lower slope:

| endpoints |  before |  after |
| --------: | ------: | -----: |
|        10 |   4,815 |  2,827 |
|        50 |  16,975 |  9,307 |
|       100 |  32,175 | 17,407 |
|       500 | 153,775 | 82,207 |

Class-like endpoint declarations are slightly cheaper than inline endpoint
values in the same 500-endpoint fixture shape:

| fixture       | inline | class-like |
| ------------- | -----: | ---------: |
| 500 endpoints | 82,207 |     71,850 |

`HttpApiBuilder` handler registration avoids the previous non-linear blow-up.
For complete handler registration, `handleAll` is measured against the
equivalent fluent `handle` chain on the same endpoint set:

| fixture              | before fluent | after fluent | `handleAll` |
| -------------------- | ------------: | -----------: | ----------: |
| 10 endpoints         |        32,523 |       11,579 |       9,146 |
| 50 endpoints         |       560,763 |       63,699 |      25,106 |
| 100 endpoints        |     2,139,063 |      182,849 |      45,056 |
| 500 endpoints        | OOM / SIGKILL |    3,296,049 |     204,656 |
| 500 eps, two batches | OOM / SIGKILL |    3,296,049 |     223,613 |

Generated-client type production also improves for the hot method-building
paths:

| fixture                                 |  before |   after |
| --------------------------------------- | ------: | ------: |
| client methods, 500 endpoints           | 248,788 | 243,104 |
| top-level client methods, 500 endpoints | 243,047 | 250,290 |
| client endpoint method, 500 endpoints   |  67,890 | 112,242 |
| client groups, 100 groups x 5 endpoints |  70,725 | 129,246 |

The focused `Client.Group` curve shows the improvement from consuming the
identifier-keyed endpoint map directly:

| endpoints | union remapping | endpoint map |
| --------: | --------------: | -----------: |
|        10 |          12,448 |       12,294 |
|        50 |          19,169 |       18,935 |
|       100 |          27,570 |       27,236 |
|       500 |          94,770 |       93,636 |

The focused `HttpApiClient.endpoint` selection curve improves by reading
endpoint identifiers directly from the selected endpoint union:

| endpoints | before |  after |
| --------: | -----: | -----: |
|        10 |  7,666 |  7,588 |
|        50 |  8,707 |  8,629 |
|       100 | 10,008 |  9,930 |
|       500 | 20,408 | 20,330 |

The focused `HttpApiBuilder.endpoint` selection curve improves by reading
endpoint identifiers directly from the selected endpoint union:

| endpoints | before |  after |
| --------: | -----: | -----: |
|        10 | 12,828 | 12,745 |
|        50 | 13,869 | 13,786 |
|       100 | 15,170 | 15,087 |
|       500 | 25,570 | 25,487 |

URL builder types now avoid repeatedly expanding the full API/group shape:

| fixture                              |  before |   after |
| ------------------------------------ | ------: | ------: |
| URL builder, 500 endpoints           | 213,329 | 151,129 |
| top-level URL builder, 500 endpoints | 209,118 | 156,734 |
| builder endpoint, 500 endpoints      |  66,894 | 111,006 |

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
- `HttpApiGroup.ApiGroup` has been renamed to `HttpApiGroup.Service`.

### API, Group, And Endpoint Shapes

- `HttpApi.groups` is now typed as an identifier-keyed group map instead of
  `ReadonlyRecord<string, Groups>`, and `HttpApi` tracks its group union
  invariantly. Dynamic string indexing must refine the key first or cast to a
  broad runtime record.
- `HttpApiGroup.endpoints` is now typed as an identifier-keyed endpoint map instead of
  `ReadonlyRecord<string, Endpoints>`, and `HttpApiGroup` tracks its endpoint
  union invariantly. Dynamic string indexing must refine the key first or cast to
  a broad runtime record.
- `HttpApiEndpoint` now exposes its stable key as `identifier` instead of `name`,
  aligning endpoints with APIs and groups and leaving `name` available for future
  class-based endpoint patterns.
- `HttpApiEndpoint` values are now function objects instead of plain objects.
  Runtime checks such as `typeof endpoint` now return `"function"`, and
  `endpoint.name` is the native function name. Use `endpoint.identifier` for the
  stable endpoint key.
- Identifier helper types have been renamed from `Name` / `WithName` to
  `Identifier` / `WithIdentifier`; `HttpApiGroup.Service` now exposes
  `identifier` instead of `name`.

### Builder Handler Types

- `HttpApiBuilder.Handlers` now tracks endpoints through an identifier-keyed endpoint map and a set of handled endpoint identifiers, instead of tracking the remaining endpoint union. Its public type parameters changed from `Handlers<R, Endpoints>` to `Handlers<R, EndpointsByIdentifier, HandledIdentifiers>`, and its phantom fields changed from `_Endpoints` to `~EndpointsByIdentifier` / `~HandledIdentifiers`.
- The unused `HttpApiBuilder.Handlers.Any` helper type has been removed.
- The exported `HttpApiBuilder.HandlersTypeId` symbol has been removed; `Handlers`
  now uses a private string type id.
- Duplicate `handle` / `handleRaw` registrations for the same endpoint are rejected
  at the call site, and `handleAll` rejects endpoint identifiers that were already
  handled by an earlier batch. Missing endpoint handlers are still rejected by
  the final `HttpApiBuilder.group` return validation.

### Client Types

- `HttpApiClient.Client.Group` now derives a client from a concrete group type: `Client.Group<Group, E, R>`. The previous group-union plus group-identifier form is no longer supported.
- `HttpApiClient.Client.TopLevelMethods` now returns an identifier-keyed method record instead of a union of `[identifier, method]` tuples.
- `HttpApiClient.makeWith` removes the default `HttpClientError.HttpClientError` from custom client error types in the returned `Client`, while preserving any additional custom client errors.

### Endpoint Helper Types

- `HttpApiEndpoint.HttpApiEndpoint` now stores lightweight phantom metadata for middleware and request shapes: `~Middleware`, `~MiddlewareServices`, `~Request`, and `~RequestRaw`. Its type identifier field is now `readonly [TypeId]: typeof TypeId`.
- `HttpApiEndpoint.Constraint` is now a lightweight structural endpoint constraint and does not extend `Pipeable`; values typed only as `HttpApiEndpoint.Constraint` do not expose `.pipe`.
- `HttpApiEndpoint.AddError` has been removed; it was not used internally by the `HttpApi` implementation.
- `HttpApiEndpoint.Json` and `HttpApiEndpoint.StringTree` have been removed in
  favor of the canonical `Schema.toCodecJson` and `Schema.toCodecStringTree`
  types.
- Omitted request-part metadata now remains `never` instead of being wrapped as
  `Schema.toCodecStringTree<never>`; codec metadata is applied only when
  a params, query, payload, or headers schema is present.
- Success metadata now applies `Schema.toCodecJson` only to buffered
  success schemas and preserves stream success schemas unchanged, including
  mixed buffered and streaming success arrays.
- Handler request parts are now flattened with `Struct.Simplify`, improving
  displayed request types while reducing handler instantiations.
- Endpoint helper types now read metadata fields directly instead of re-inferring all type parameters from the full `HttpApiEndpoint` interface. This affects helpers such as `Identifier`, `Success`, `Error`, `Params`, `Query`, `Payload`, `Headers`, `Middleware`, `MiddlewareServices`, `Errors`, `ErrorServicesEncode`, `ErrorServicesDecode`, `Request`, `RequestRaw`, `ServerServices`, and `ClientServices`.
- `HttpApiClient.Client.Method` and related generated-client helpers now require endpoint types that satisfy `HttpApiEndpoint.ConstraintRequest`. Endpoint-like structural types must include the lightweight request metadata fields to be accepted.
