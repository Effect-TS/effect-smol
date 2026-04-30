---
"effect": patch
---

Fix `EntityProxyServer.layerHttpApi` using `path.entityId` instead of `params.entityId`

`HttpApiEndpoint.Request` provides parsed path parameters under the `params` key,
but `EntityProxyServer.layerHttpApi` was destructuring `path` — causing
`TypeError: undefined is not an object (evaluating 'path.entityId')` on every
entity HTTP call.

This bug has existed since `EntityProxyServer.layerHttpApi` was introduced in #433.
