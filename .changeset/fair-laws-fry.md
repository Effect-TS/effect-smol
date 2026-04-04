---
"effect": patch
---

`unstable/eventlog`: switch `EventLog.Identity` to a two-field shape (`publicKey`, `privateKey`), remove public identity serialization of `signingPublicKey` / `signingPrivateKey`, and derive session-auth signing material internally from the root secret.
