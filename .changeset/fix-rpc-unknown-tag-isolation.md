---
"effect": patch
---

Fix `RpcServer` tearing down unrelated in-flight requests when a single request used an unknown tag. Previously an unrecognized request tag was rejected with a connection-level defect, which the client turned into `clearEntries` and failed every concurrent request and stream sharing the multiplexed connection. The unknown tag now fails only its own request, leaving other live requests and streams on the connection untouched.
