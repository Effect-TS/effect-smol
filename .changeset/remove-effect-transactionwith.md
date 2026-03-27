---
"effect": patch
---

Rename `Effect.transaction` to `Effect.tx` and `Effect.retryTransaction` to `Effect.txRetry`, and remove `Effect.transactionWith` / `Effect.withTxState`, inlining the transaction logic and using `Effect.Transaction.asEffect()` internally.
