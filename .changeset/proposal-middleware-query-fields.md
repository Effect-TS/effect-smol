---
"effect": minor
---

**Proposal**: `HttpApiMiddleware.Service` can now declare `query: Schema.Struct.Fields` — query parameters that the middleware reads off the request URL. The framework merges these field schemas into the runtime query schema of every endpoint that applies the middleware, so requests carrying these params do not 400 just because the endpoint did not list them.

```ts
class WorkspaceRoutingMiddleware extends HttpApiMiddleware.Service<WorkspaceRoutingMiddleware>()(
  "WorkspaceRouting",
  {
    query: {
      directory: Schema.optional(Schema.String),
      workspace: Schema.optional(Schema.String)
    }
  }
) {}
```

The merge mirrors the existing `error` pattern: lazy walk over `endpoint.middlewares` in `HttpApiEndpoint.getQuerySchema`, no eager mutation at `.middleware()` time. Conflicts (same field name with non-equivalent schemas) throw at HttpApi materialisation time.

Scope of this PR is intentionally narrow as a design proposal — open questions for maintainer feedback are listed in the PR description (type-level threading, `headers` symmetry, OpenAPI emission, whether endpoint queries that aren't `Schema.Struct.Fields` literals should be supported).
