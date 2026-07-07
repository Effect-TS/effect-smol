---
"effect": patch
---

Isolate a cluster entity's handler context from the fiber that first wakes it, so a caller/request-scoped service (such as an in-flight SQL transaction) present on that fiber is no longer frozen into the entity's long-lived `RpcServer` and reused by every later request.
