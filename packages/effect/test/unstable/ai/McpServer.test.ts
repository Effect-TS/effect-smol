import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Layer } from "effect"
import * as McpSchema from "effect/unstable/ai/McpSchema"
import * as McpServer from "effect/unstable/ai/McpServer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import { RpcSerialization } from "effect/unstable/rpc"
import * as RpcClient from "effect/unstable/rpc/RpcClient"

const initializePayload = {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: {
    name: "TestClient",
    version: "1.0.0"
  }
}

const pingBody = {
  jsonrpc: "2.0",
  method: "ping",
  params: {},
  id: 0
}

const makeTestClient = Effect.gen(function*() {
  const responses: Array<Response> = []

  const serverLayer = McpServer.layerHttp({
    name: "TestServer",
    version: "1.0.0",
    path: "/mcp"
  })
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
      const { client, responses } = yield* makeTestClient

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
      strictEqual(responses[1].headers.get("Mcp-Protocol-Version"), "2025-06-18")
    }))

  it.effect("returns 404 when a non-initialize request omits the MCP session id", () =>
    Effect.gen(function*() {
      const { httpClient } = yield* makeTestClient

      const response = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe({ jsonrpc: "2.0", method: "ping", params: {}, id: 0 }),
        httpClient.execute
      )

      strictEqual(response.status, 404)
    }))

  it.effect("rejects unsupported HTTP methods without disturbing an initialized session", () =>
    Effect.gen(function*() {
      const { client, httpClient } = yield* makeTestClient

      yield* client.initialize(initializePayload)

      for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD"] as const) {
        const response = yield* HttpClientRequest.make(method)("http://localhost/mcp").pipe(
          httpClient.execute
        )
        strictEqual(response.status, 405)
        strictEqual(response.headers["allow"], "POST")
      }

      yield* client.ping({})
    }))

  it.effect("returns an empty 202 for notifications and responses and remains successful for request POSTs", () =>
    Effect.gen(function*() {
      const { client, httpClient } = yield* makeTestClient

      yield* client.initialize(initializePayload)

      const notificationResponse = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {}
        }),
        httpClient.execute
      )
      strictEqual(notificationResponse.status, 202)
      strictEqual(yield* notificationResponse.text, "")

      const responseOnly = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe({ jsonrpc: "2.0", id: 1, result: {} }),
        httpClient.execute
      )
      strictEqual(responseOnly.status, 202)
      strictEqual(yield* responseOnly.text, "")

      const pingResponse = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe(pingBody),
        httpClient.execute
      )
      strictEqual(pingResponse.status, 200)
      const pingResponseBody = yield* pingResponse.text
      strictEqual(pingResponseBody.length > 0, true)
    }))

  it.effect("validates supplied protocol versions on POST", () =>
    Effect.gen(function*() {
      const { client, httpClient } = yield* makeTestClient

      yield* client.initialize(initializePayload)

      const unsupportedResponse = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe(pingBody),
        HttpClientRequest.setHeader("Mcp-Protocol-Version", "9999-01-01"),
        httpClient.execute
      )
      strictEqual(unsupportedResponse.status, 400)
      strictEqual(yield* unsupportedResponse.text, "")

      const responseOnly = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe({ jsonrpc: "2.0", id: 1, result: {} }),
        HttpClientRequest.setHeader("Mcp-Protocol-Version", "9999-01-01"),
        httpClient.execute
      )
      strictEqual(responseOnly.status, 400)
      strictEqual(yield* responseOnly.text, "")

      const absentVersionResponse = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe(pingBody),
        httpClient.execute
      )
      strictEqual(absentVersionResponse.status, 200)

      for (const protocolVersion of ["2025-06-18", "2025-03-26", "2024-11-05", "2024-10-07"]) {
        const response = yield* HttpClientRequest.post("http://localhost/mcp").pipe(
          HttpClientRequest.bodyJsonUnsafe(pingBody),
          HttpClientRequest.setHeader("Mcp-Protocol-Version", protocolVersion),
          httpClient.execute
        )
        strictEqual(response.status, 200)
      }
    }))
})
