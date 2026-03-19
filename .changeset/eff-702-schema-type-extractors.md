---
"effect": patch
---

Move Schema type extractors to top-level exports: `Schema.Type`, `Schema.Encoded`, `Schema.DecodingServices`, `Schema.EncodingServices`, and `Schema.ToAsserts`.

### Breaking changes

Removed the old nested extractor aliases `Schema.Schema.Type` and `Schema.Codec.{Encoded,DecodingServices,EncodingServices,ToAsserts}`.
