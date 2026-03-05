---
"effect": patch
---

Persist MCP client capability context across HTTP requests by tagging RPC HTTP clients with a stable ID header and restoring the initialized payload per session in `McpServer`.

Adds a regression test that initializes an MCP HTTP client, then verifies a later tool call can still read `McpServer.clientCapabilities`.
