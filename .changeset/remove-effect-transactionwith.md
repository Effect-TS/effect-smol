---
"effect": patch
---

Rename `Effect.transaction` to `Effect.tx` and `Effect.retryTransaction` to `Effect.txRetry`, remove `Effect.transactionWith` / `Effect.withTxState`, and make nested `Effect.tx` calls compose into the active transaction.
