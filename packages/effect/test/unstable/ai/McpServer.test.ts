import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Layer } from "effect"
import * as McpSchema from "effect/unstable/ai/McpSchema"
import * as McpServer from "effect/unstable/ai/McpServer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as RpcClient from "effect/unstable/rpc/RpcClient"

const makeTestClient = Effect.gen(function*() {
  const requests: Array<{
    readonly mcpSessionId: string | null
    readonly mcpProtocolVersion: string | null
  }> = []
  const responseSessionIds: Array<string | null> = []

  const serverLayer = McpServer.layerHttp({
    name: "TestServer",
    version: "1.0.0",
    path: "/mcp"
  })
  const { handler, dispose } = HttpRouter.toWebHandler(serverLayer, { disableLogger: true })
  yield* Effect.addFinalizer(() => Effect.promise(() => dispose()))

  const customFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    requests.push({
      mcpSessionId: request.headers.get("Mcp-Session-Id"),
      mcpProtocolVersion: request.headers.get("MCP-Protocol-Version")
    })
    const response = await handler(request)
    responseSessionIds.push(response.headers.get("Mcp-Session-Id"))
    return response
  }

  const clientLayer = McpServer.layerClientProtocolHttp({ url: "http://localhost/mcp" }).pipe(
    Layer.provideMerge(FetchHttpClient.layer),
    Layer.provideMerge(Layer.succeed(FetchHttpClient.Fetch, customFetch))
  )
  const client = yield* RpcClient.make(McpSchema.ClientRpcs).pipe(
    Effect.provide(clientLayer)
  )

  return { client, requests, responseSessionIds }
})

describe("McpServer", () => {
  it.effect("replays MCP session and negotiated protocol headers after initialize", () =>
    Effect.gen(function*() {
      const { client, requests, responseSessionIds } = yield* makeTestClient

      const initializeResult = yield* client.initialize({
        protocolVersion: "9999-01-01",
        capabilities: {},
        clientInfo: {
          name: "TestClient",
          version: "1.0.0"
        }
      })

      yield* client.ping({})

      strictEqual(requests.length, 2)
      strictEqual(requests[0].mcpSessionId, null)
      strictEqual(requests[0].mcpProtocolVersion, null)
      strictEqual(typeof responseSessionIds[0], "string")
      strictEqual(requests[1].mcpSessionId, responseSessionIds[0])
      strictEqual(requests[1].mcpProtocolVersion, initializeResult.protocolVersion)
    }).pipe(Effect.scoped))
})
