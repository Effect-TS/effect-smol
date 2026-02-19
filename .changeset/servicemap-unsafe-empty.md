---
"effect": patch
---

Add `ServiceMap.unsafeEmpty()` which returns `ServiceMap<any>`, working around the contravariance issue where `ServiceMap.empty()` (`ServiceMap<never>`) is not assignable to `ServiceMap<any>`.
