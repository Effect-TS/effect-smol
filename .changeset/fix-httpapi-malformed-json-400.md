---
"effect": patch
---

HttpApiBuilder: respond with `400 Bad Request` instead of a `500` defect when a JSON request body is syntactically invalid. `JSON.parse` failures are now caught and surfaced as a `SchemaError`, matching the behavior of schema validation errors and `HttpServerRequest.json`. Closes #2491.
