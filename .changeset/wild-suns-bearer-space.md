---
"effect": patch
---

Fix `HttpApiSecurity` bearer/http credential gaining a leading space

`securityDecode` sliced `schemeLength` off the `Authorization` header, but the header is `"<scheme> <credential>"`, so it left the delimiter space attached to the credential (e.g. `Bearer abc123` decoded to `" abc123"`). It now slices `schemeLength + 1` to skip the space.
