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

const makeTestHandler = Effect.gen(function*() {
  const serverLayer = McpServer.layerHttp({
    name: "TestServer",
    version: "1.0.0",
    path: "/mcp"
  })
  const { handler, dispose } = HttpRouter.toWebHandler(serverLayer, { disableLogger: true })
  yield* Effect.addFinalizer(() => Effect.promise(() => dispose()))
  return handler
})

const postJson = (
  handler: (request: Request) => Promise<Response>,
  body: unknown,
  sessionId?: string | null | undefined
) =>
  Effect.promise(() => {
    const headers = new Headers({ "content-type": "application/json" })
    if (sessionId) {
      headers.set("Mcp-Session-Id", sessionId)
    }
    return handler(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      })
    )
  })

const responseJson = (response: Response) => Effect.promise(() => response.json() as Promise<any>)

const makeTestClient = Effect.gen(function*() {
  const responses: Array<Response> = []

  const handler = yield* makeTestHandler

  let sessionId: string | null = null
  const customFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init)
    if (sessionId) {
      request.headers.set("Mcp-Session-Id", sessionId)
    }
    const response = await handler(request)
    sessionId = response.headers.get("Mcp-Session-Id")
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
    }))

  it.effect("returns 404 when a non-initialize request omits the MCP session id", () =>
    Effect.gen(function*() {
      const { httpClient } = yield* makeTestClient

      const response = yield* HttpClientRequest.post("http://locahost/mcp").pipe(
        HttpClientRequest.bodyJsonUnsafe({ jsonrpc: "2.0", method: "ping", params: {}, id: 0 }),
        httpClient.execute
      )

      strictEqual(response.status, 404)
    }))

  it.effect("preserves JSON-RPC request ids from raw HTTP clients", () =>
    Effect.gen(function*() {
      const handler = yield* makeTestHandler

      const initializeResponse = yield* postJson(handler, {
        jsonrpc: "2.0",
        id: "14f40ee1b859ee70",
        method: "initialize",
        params: {
          protocolVersion: "9999-01-01",
          capabilities: {},
          clientInfo: {
            name: "RawClient",
            version: "1.0.0"
          }
        }
      })
      const initializeJson = yield* responseJson(initializeResponse)
      strictEqual(initializeResponse.status, 200)
      strictEqual(initializeJson.id, "14f40ee1b859ee70")

      const sessionId = initializeResponse.headers.get("Mcp-Session-Id")
      strictEqual(typeof sessionId, "string")

      const numberResponse = yield* postJson(handler, {
        jsonrpc: "2.0",
        id: 123,
        method: "ping",
        params: {}
      }, sessionId)
      const numberJson = yield* responseJson(numberResponse)
      strictEqual(numberJson.id, 123)

      const nullResponse = yield* postJson(handler, {
        jsonrpc: "2.0",
        id: null,
        method: "ping",
        params: {}
      }, sessionId)
      const nullJson = yield* responseJson(nullResponse)
      strictEqual(nullJson.id, null)

      const omittedResponse = yield* postJson(handler, {
        jsonrpc: "2.0",
        method: "ping",
        params: {}
      }, sessionId)
      const omittedJson = yield* responseJson(omittedResponse)
      strictEqual("id" in omittedJson, false)
    }))
})
