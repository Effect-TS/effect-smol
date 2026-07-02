## Working with Schema

`Schema` lets you describe the shape of data once and use that description for
both TypeScript types and runtime validation. Use it at boundaries where data is
unknown, such as HTTP requests, environment variables, database rows, messages,
or AI/tool outputs.

For a comprehensive guide, see [packages/effect/SCHEMA.md](./packages/effect/SCHEMA.md).

Essentials:

- Use `Schema.Class`, `Schema.TaggedClass`, `Schema.ErrorClass`, and
  `Schema.TaggedErrorClass` when you want schema-backed classes for domain
  models, tagged unions, or typed errors.
- Decode untrusted data with `Schema.decodeUnknownEffect` inside Effect code,
  or `Schema.decodeUnknownSync` / `Schema.decodeUnknownPromise` at sync or
  Promise-based application boundaries.
- Encode typed values with `Schema.encodeEffect`, `Schema.encodeSync`, or
  `Schema.encodePromise` before returning them to external systems.
- Prefer creating reusable decoders and encoders once, then call those functions
  wherever the boundary is crossed.
