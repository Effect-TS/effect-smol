---
"@effect/ai-anthropic": patch
"@effect/ai-openai": patch
"@effect/ai-openai-compat": patch
"@effect/ai-openrouter": patch
"@effect/atom-react": patch
"@effect/atom-solid": patch
"@effect/atom-vue": patch
"effect": patch
"@effect/openapi-generator": patch
"@effect/opentelemetry": patch
"@effect/platform-browser": patch
"@effect/platform-bun": patch
"@effect/platform-node": patch
"@effect/platform-node-shared": patch
"@effect/sql-clickhouse": patch
"@effect/sql-d1": patch
"@effect/sql-libsql": patch
"@effect/sql-mssql": patch
"@effect/sql-mysql2": patch
"@effect/sql-pg": patch
"@effect/sql-sqlite-bun": patch
"@effect/sql-sqlite-do": patch
"@effect/sql-sqlite-node": patch
"@effect/sql-sqlite-react-native": patch
"@effect/sql-sqlite-wasm": patch
"@effect/vitest": patch
---

Replace Babel with an OXC-parser-based post-compile pass that adds `@__PURE__` annotations to published dist output. Source maps are now composed via `magic-string` + `@jridgewell/remapping` so debugger mappings remain accurate through to the original `.ts` source.
