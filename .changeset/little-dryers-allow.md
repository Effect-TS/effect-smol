---
"effect": patch
---

Persist MCP client capability context across HTTP requests by restoring initialized payloads using the standard `Mcp-Session-Id` HTTP header in `McpServer`.

Adds a regression test that initializes an MCP HTTP client, then verifies a later tool call can still read `McpServer.clientCapabilities`.
