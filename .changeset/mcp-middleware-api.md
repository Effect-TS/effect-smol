---
"effect": minor
---

Add robust, transforming Middleware support for Effect MCP servers. 

The new Middleware API (`McpServer.middleware`) allows intercepting, modifying, short-circuiting, and observing MCP requests and responses seamlessly. It provides full access to request metadata (headers, `mcpSessionId`, `clientInfo`) and seamlessly supports 3rd-party integration needs like advanced telemetry, and schema modification.
