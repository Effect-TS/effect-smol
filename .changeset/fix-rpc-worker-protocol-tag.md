---
"effect": patch
---

Fix `RpcWorker.initialMessage` looking up the wrong service identity.

The internal `ProtocolTag` in `RpcWorker` was created with the v3 package-name string `"@effect/rpc/RpcServer/Protocol"`, while `RpcServer.Protocol` is keyed by the v4 canonical `"effect/rpc/RpcServer/Protocol"`. At runtime Effect's `ServiceMap` keys by tag string, so the two tags resolved to distinct service identities and any call to `RpcWorker.initialMessage(schema)` failed with `Service not found: @effect/rpc/RpcServer/Protocol` even when a properly-provided `RpcServer.Protocol` was in context.

The `as any` cast on the same line erased the string-literal type, hiding the mismatch from the type-checker. The cast has been removed in favour of the canonical typed `Context.Service<Self, Shape>(key)` form, restoring compile-time detection of this class of error.
