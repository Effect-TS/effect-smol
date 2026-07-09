---
"@effect/ai-anthropic": patch
---

Stop narrowing the Anthropic `Model` schema to the known literal model ids.

`Model` is an open enum in Anthropic's OpenAPI spec (`anyOf: [{ type: "string" }, ...consts]`), and it is `$ref`'d by response schemas such as `Message`, `BetaMessage` (nested in `message_start`, the first event of every stream), and `ResponseFallbackHopInfo`. The codegen config removed the `string` branch, so any request made with a model id newer than the generated literals failed to decode with `Expected "claude-opus-4-6" | ... , got "claude-opus-4-8"` — after the request had already been sent and billed.

`Model` now generates as `Schema.Union([Schema.String, Schema.Literals([...])])`, matching how `@effect/ai-openai` already generates `ModelIdsShared`, and `AnthropicLanguageModel.Model` reads the literal branch back out of that union so the known ids are still offered for autocomplete. Requests were unaffected and remain so: `AnthropicLanguageModel.layer`/`.model` already accepted any string.
