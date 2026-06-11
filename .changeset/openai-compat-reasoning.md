---
"@effect/ai-openai-compat": patch
---

Surface reasoning tokens from OpenAI-compatible chat completion responses.

Previously, reasoning tokens streamed by OpenAI-compatible providers were silently discarded because the chat completion message and delta schemas only parsed `role` / `content` / `tool_calls`.

The schemas now accept the optional `reasoning` field (e.g. Baseten, OpenRouter-style APIs) as well as the DeepSeek-style `reasoning_content` field. Streamed reasoning tokens are emitted as `reasoning-start` / `reasoning-delta` / `reasoning-end` stream parts, with an open reasoning part closed when text content begins or the stream ends. Non-streaming responses surface reasoning as a `reasoning` response part.
