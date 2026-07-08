import { describe, it } from "@effect/vitest"
import { deepStrictEqual, strictEqual } from "@effect/vitest/utils"
import { Effect, Layer, Option, Schema } from "effect"
import * as McpSchema from "effect/unstable/ai/McpSchema"
import * as McpServer from "effect/unstable/ai/McpServer"
import * as Tool from "effect/unstable/ai/Tool"
import * as Toolkit from "effect/unstable/ai/Toolkit"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import { RpcSerialization } from "effect/unstable/rpc"
import * as RpcClient from "effect/unstable/rpc/RpcClient"

const EchoTool = Tool.make("echo", {
  parameters: Schema.Struct({
    message: Schema.String
  }),
  success: Schema.String
})

const EchoToolkit = Toolkit.make(EchoTool)

const EchoLayer = McpServer.toolkit(EchoToolkit).pipe(
  Layer.provideMerge(
    EchoToolkit.toLayer({
      echo: ({ message }) => Effect.succeed(message)
    })
  )
)

const makeTestClient = (
  serverParts: Layer.Layer<never, never, never> = Layer.empty
) =>
Effect.gen(function*() {
  const responses: Array<Response> = []

  const serverLayer = serverParts.pipe(Layer.provide(McpServer.layerHttp({
    name: "TestServer",
    version: "1.0.0",
    path: "/mcp"
  })))
  const { handler, dispose } = HttpRouter.toWebHandler(serverLayer, { disableLogger: true })
  yield* Effect.addFinalizer(() => Effect.promise(() => dispose()))

  let sessionId: string | null = null
  const customFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    if (sessionId) {
      request.headers.set("Mcp-Session-Id", sessionId)
    }
    const response = await handler(request)
    sessionId = response.headers.get("Mcp-Session-Id") ?? sessionId
    responses.push(response.clone())
    return response
  }

  const clientLayer = RpcClient.layerProtocolHttp({ url: "http://localhost/mcp" }).pipe(
    Layer.provideMerge([FetchHttpClient.layer, RpcSerialization.layerJsonRpc()]),
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, customFetch))
  )
  const client = yield* RpcClient.make(McpSchema.ClientRpcs).pipe(
    Effect.provide(clientLayer)
  )

  const httpClient = yield* HttpClient.HttpClient.pipe(
    Effect.provide(clientLayer)
  )

  return { client, responses, httpClient }
})

describe("McpServer", () => {
  it.effect("replays MCP session and negotiated protocol headers after initialize", () =>
    Effect.gen(function*() {
      const { client, responses } = yield* makeTestClient()

      yield* client.initialize({
        protocolVersion: "9999-01-01",
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      })

      yield* client.ping({})

      strictEqual(responses.length, 2)
      strictEqual(responses[0].headers.get("Mcp-Protocol-Version"), "2025-06-18")
    }))

  it.effect("returns 404 when a non-initialize request omits the MCP session id", () =>
    Effect.gen(function*() {
      const { httpClient } = yield* makeTestClient()

      const response = yield* HttpClientRequest.post("http://locahost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe({ jsonrpc: "2.0", method: "ping", params: {}, id: 0 }),
        httpClient.execute
      )

      strictEqual(response.status, 404)
    }))

  it.effect("runs middleware with MCP request metadata", () =>
    Effect.gen(function*() {
      const seen: Array<{
        readonly method: string
        readonly clientId: number
        readonly requestId: string
        readonly serverName: string
        readonly mcpSessionId: string | undefined
        readonly initializedClientName: string | undefined
      }> = []

      const { client } = yield* makeTestClient(McpServer.middleware((request) =>
        Effect.gen(function*() {
          seen.push({
            method: request.method,
            clientId: request.clientId,
            requestId: request.requestId.toString(),
            serverName: request.serverInfo.name,
            mcpSessionId: Option.getOrUndefined(request.mcpSessionId),
            initializedClientName: Option.getOrUndefined(request.initializedClient)?.clientInfo.name
          })
          return yield* request.next()
        })
      ))

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      })
      yield* client.ping({})

      strictEqual(seen[0]?.method, "initialize")
      strictEqual(seen[0]?.serverName, "TestServer")
      strictEqual(seen[0]?.initializedClientName, undefined)
      strictEqual(seen[1]?.method, "ping")
      strictEqual(seen[1]?.initializedClientName, "TestClient")
      strictEqual(typeof seen[1]?.mcpSessionId, "string")
    }))

  it.effect("allows middleware to transform initialize and tools/list results", () =>
    Effect.gen(function*() {
      const { client } = yield* makeTestClient(
        Layer.mergeAll(
          EchoLayer,
          McpServer.middleware((request) =>
            Effect.gen(function*() {
              const result = yield* request.next()
              if (request.method === "initialize") {
                return {
                  ...result,
                  capabilities: {
                    ...result.capabilities,
                    tools: { listChanged: true }
                  }
                }
              }
              if (request.method === "tools/list") {
                return new McpSchema.ListToolsResult({
                  ...result,
                  tools: [
                    ...result.tools,
                    new McpSchema.Tool({
                      name: "synthetic",
                      description: "Synthetic tool",
                      inputSchema: {
                        type: "object",
                        properties: {}
                      }
                    })
                  ]
                })
              }
              return result
            })
          )
        )
      )

      const initialized = yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      })
      const listed = yield* client["tools/list"](undefined)

      deepStrictEqual(initialized.capabilities.tools, { listChanged: true })
      deepStrictEqual(listed.tools.map((tool) => tool.name), ["echo", "synthetic"])
    }))

  it.effect("allows middleware to rewrite and short-circuit tool calls", () =>
    Effect.gen(function*() {
      const { client } = yield* makeTestClient(
        Layer.mergeAll(
          EchoLayer,
          McpServer.middleware((request) => {
            if (request.method !== "tools/call") {
              return request.next()
            }
            if (request.payload.name === "synthetic") {
              return Effect.succeed(new McpSchema.CallToolResult({
                content: [{
                  type: "text",
                  text: "handled by middleware"
                }]
              }))
            }
            return request.next({
              ...request.payload,
              arguments: {
                ...request.payload.arguments,
                message: "rewritten"
              }
            })
          })
        )
      )

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      })

      const rewritten = yield* client["tools/call"]({
        name: "echo",
        arguments: {
          message: "original"
        }
      })
      const synthetic = yield* client["tools/call"]({
        name: "synthetic",
        arguments: {}
      })

      strictEqual(rewritten.content[0]?.type, "text")
      strictEqual(rewritten.content[0]?.text, "\"rewritten\"")
      strictEqual(synthetic.content[0]?.type, "text")
      strictEqual(synthetic.content[0]?.text, "handled by middleware")
    }))

  it.effect("runs multiple middlewares in registration order", () =>
    Effect.gen(function*() {
      const order: Array<string> = []
      const { client } = yield* makeTestClient(
        Layer.mergeAll(
          McpServer.middleware((request) =>
            Effect.gen(function*() {
              order.push("a-before")
              const result = yield* request.next()
              order.push("a-after")
              return result
            })
          ),
          McpServer.middleware((request) =>
            Effect.gen(function*() {
              order.push("b-before")
              const result = yield* request.next()
              order.push("b-after")
              return result
            })
          )
        )
      )

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      })

      deepStrictEqual(order, ["a-before", "b-before", "b-after", "a-after"])
    }))

  it.effect("does not run middleware for client notifications", () =>
    Effect.gen(function*() {
      const methods: Array<string> = []
      const { client, httpClient } = yield* makeTestClient(McpServer.middleware((request) =>
        Effect.sync(() => methods.push(request.method)).pipe(
          Effect.andThen(request.next())
        )
      ))

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      })
      yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {}
        }),
        httpClient.execute
      )

      deepStrictEqual(methods, ["initialize"])
    }))

  it.effect("allows middleware to reject requests with MCP errors", () =>
    Effect.gen(function*() {
      const { client } = yield* makeTestClient(
        McpServer.middleware((request) => {
          if (request.method === "tools/call") {
            return Effect.fail(new McpSchema.InvalidParams({ message: "Rate limit exceeded" }))
          }
          return request.next()
        })
      )

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "TestClient", version: "1.0.0" }
      })

      const result = yield* client["tools/call"]({ name: "echo", arguments: { message: "test" } }).pipe(
        Effect.flip
      )

      strictEqual(result._tag, "InvalidParams")
      strictEqual(result.message, "Rate limit exceeded")
    }))

  it.effect("allows middleware to observe tool execution failures and time execution", () =>
    Effect.gen(function*() {
      let observedError = false
      let durationObserved = false

      const ErrorToolLayer = McpServer.toolkit(Toolkit.make(Tool.make("error_tool", {
        parameters: Schema.Struct({}),
        success: Schema.String
      }))).pipe(
        Layer.provideMerge(
          Toolkit.make(Tool.make("error_tool", {
            parameters: Schema.Struct({}),
            success: Schema.String
          })).toLayer({
            error_tool: () => Effect.fail(new Error("Downstream failure"))
          })
        )
      )

      const { client } = yield* makeTestClient(
        Layer.mergeAll(
          ErrorToolLayer,
          McpServer.middleware((request) => 
            Effect.gen(function*() {
              const [duration, result] = yield* Effect.timed(request.next())
              if (request.method === "tools/call" && "isError" in result && result.isError === true) {
                observedError = true
              }
              durationObserved = true
              return result
            })
          )
        )
      )

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "TestClient", version: "1.0.0" }
      })

      const result = yield* client["tools/call"]({ name: "error_tool", arguments: {} })

      strictEqual(observedError, true)
      strictEqual(durationObserved, true)
      strictEqual(result.isError, true)
    }))

  it.effect("allows middleware to access the McpServer service from context", () =>
    Effect.gen(function*() {
      let toolsCount = -1

      const { client } = yield* makeTestClient(
        Layer.mergeAll(
          EchoLayer,
          McpServer.middleware((request) =>
            Effect.gen(function*() {
              const server = yield* McpServer.McpServer
              if (request.method === "tools/list") {
                toolsCount = server.tools.length
              }
              return yield* request.next()
            })
          )
        )
      )

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "TestClient", version: "1.0.0" }
      })
      yield* client["tools/list"](undefined)

      strictEqual(toolsCount, 1) // EchoTool is registered
    }))

  it.effect("intercepts prompts and resources", () =>
    Effect.gen(function*() {
      const intercepted: Array<string> = []

      const TestPrompt = McpServer.prompt({
        name: "test_prompt",
        description: "A test prompt",
        content: () => Effect.succeed("Prompt content")
      })

      const TestResource = McpServer.resource({
        uri: "file:///test.txt",
        name: "test_resource",
        content: Effect.succeed("Resource content")
      })

      const { client } = yield* makeTestClient(
        Layer.mergeAll(
          TestPrompt,
          TestResource,
          McpServer.middleware((request) => {
            intercepted.push(request.method)
            return request.next()
          })
        )
      )

      yield* client.initialize({
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "TestClient", version: "1.0.0" }
      })

      yield* client["prompts/list"](undefined)
      yield* client["prompts/get"]({ name: "test_prompt", arguments: {} })
      yield* client["resources/list"](undefined)
      yield* client["resources/read"]({ uri: "file:///test.txt" })

      deepStrictEqual(intercepted, [
        "initialize",
        "prompts/list",
        "prompts/get",
        "resources/list",
        "resources/read"
      ])
    }))
})
