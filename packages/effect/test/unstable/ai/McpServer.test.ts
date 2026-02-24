import { describe, it } from "@effect/vitest"
import { deepStrictEqual } from "@effect/vitest/utils"
import { Effect, Layer, Schema } from "effect"
import { Tool, Toolkit } from "effect/unstable/ai"
import * as McpSchema from "effect/unstable/ai/McpSchema"
import * as McpServer from "effect/unstable/ai/McpServer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"

describe("McpServer", () => {
  it.effect("includes Tool.Meta in tools/list response", () =>
    Effect.gen(function*() {
      const UiTool = Tool.make("UiTool", {
        description: "A test tool",
        parameters: Schema.Struct({ input: Schema.String }),
        success: Schema.Struct({ ok: Schema.Boolean })
      }).annotate(Tool.Meta, { ui: { resourceUri: "ui://example/ui" } })

      const toolkit = Toolkit.make(UiTool)
      const handlers = toolkit.toLayer({
        UiTool: () => Effect.succeed({ ok: true })
      })
      const serverLayer = McpServer.layerHttp({
        name: "TestServer",
        version: "1.0.0",
        path: "/mcp"
      }).pipe(
        Layer.provideMerge(handlers),
        Layer.provideMerge(RpcSerialization.layerJsonRpc())
      )
      const registerLayer = Layer.effectDiscard(McpServer.registerToolkit(toolkit)).pipe(
        Layer.provide(serverLayer)
      )
      const appLayer = serverLayer.pipe(
        Layer.merge(registerLayer)
      )

      const { handler, dispose } = HttpRouter.toWebHandler(appLayer as any, { disableLogger: true })

      const customFetch: typeof fetch = (input, init) => {
        const request = input instanceof Request ? input : new Request(input, init)
        return handler(request)
      }

      const client = yield* RpcClient.make(McpSchema.ClientRpcs).pipe(
        Effect.provide(RpcClient.layerProtocolHttp({ url: "http://localhost/mcp" })),
        Effect.provide(RpcSerialization.layerJsonRpc()),
        Effect.provide(FetchHttpClient.layer),
        Effect.provideService(FetchHttpClient.Fetch, customFetch)
      )

      const result = yield* client["tools/list"]({})
      const tools = result.tools as ReadonlyArray<{ name: string; _meta?: unknown }>
      const tool = tools.find((item) => item.name === "UiTool")

      deepStrictEqual(tool?._meta, { ui: { resourceUri: "ui://example/ui" } })
      yield* Effect.promise(() => dispose())
    }).pipe(Effect.scoped))
})
