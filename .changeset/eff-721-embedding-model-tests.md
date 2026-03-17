---
"effect": patch
---

Add and align unstable EmbeddingModel behavior tests for embed, embedMany ordering/usage, resolver batching, provider error propagation, and empty-input embedMany fast path.

For empty input, embedMany now returns usage with `inputTokens: undefined` and does not call the provider.
