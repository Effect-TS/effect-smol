---
"effect": patch
---

Allow Schema constructor and decoding defaults to fail with `SchemaIssue.Issue`.

The `Effect` passed to `Schema.withConstructorDefault`, `Schema.withDecodingDefaultKey`, `Schema.withDecodingDefault`, `Schema.withDecodingDefaultTypeKey`, and `Schema.withDecodingDefaultType` (as well as the underlying `SchemaGetter.withDefault`) now accepts `SchemaIssue.Issue` in its error channel. When a default fails with an `Issue`, the parser propagates it as a parse failure with the surrounding path attached.
