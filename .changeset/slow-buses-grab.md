---
"effect": patch
"@effect/platform-node": patch
"@effect/platform-node-shared": patch
"@effect/platform-bun": patch
---

Revert unboxed optional API surfaces from `| undefined` back to `Option` in terminal, CLI params, cluster/workflow models, and align cluster platform integrations with the restored `Option` config/message contracts.
