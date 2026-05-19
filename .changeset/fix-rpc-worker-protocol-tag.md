---
"effect": patch
---

Fix `RpcWorker.initialMessage` looking up the wrong service identity, and add a lint rule preventing reintroduction of the bug class.

The internal `ProtocolTag` in `RpcWorker` was created with the v3 package-name string `"@effect/rpc/RpcServer/Protocol"`, while `RpcServer.Protocol` is keyed by the v4 canonical `"effect/rpc/RpcServer/Protocol"`. At runtime Effect's `ServiceMap` keys by tag string, so the two tags resolved to distinct service identities and any call to `RpcWorker.initialMessage(schema)` failed with `Service not found: @effect/rpc/RpcServer/Protocol` even when a properly-provided `RpcServer.Protocol` was in context.

The `as any` cast on the same line erased the string-literal type, hiding the mismatch from the type-checker. The cast has been removed in favour of the canonical typed `Context.Service<Self, Shape>(key)` form, restoring compile-time detection of this class of error.

A new oxlint rule, `effect/no-at-prefix-in-tag-string`, flags any `Context.{Service,Tag,Key,GenericTag}` or `ServiceMap.{Service,Tag,Key,GenericTag}` constructor (call form and class-extends form) whose tag string starts with `@effect/`, with an auto-fix that drops the leading `@`. The rule is scoped to `packages/effect/src/**` via `.oxlintrc.json` overrides (other packages in the monorepo still use the legacy `@<pkg>/...` convention and are out of scope for this fix). Applying the rule produced three additional auto-fixes in `packages/effect/src/`:

- `unstable/socket/Socket.ts` (`WebSocketConstructor` tag)
- `unstable/socket/SocketServer.ts` (`SocketServer` tag)
- `unstable/ai/IdGenerator.ts` (`IdGenerator` tag)

These were latent landmines: the tags are currently accessed by class identity rather than by string lookup, so no consumer was observing a service-identity mismatch yet. Aligning them with the canonical convention removes the hazard and matches the rest of `packages/effect/src/`, where the canonical `"effect/..."` prefix outnumbers the legacy form by ~40:1.
