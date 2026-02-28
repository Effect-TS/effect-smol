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

const makeTestClient = (resourceLayer: Layer.Layer<never, never, any>) =>
  Effect.gen(function*() {
    const serverLayer = McpServer.layerHttp({
      name: "TestServer",
      version: "1.0.0",
      path: "/mcp"
    }).pipe(
      Layer.provideMerge(RpcSerialization.layerJsonRpc())
    )
    const appLayer = serverLayer.pipe(
      Layer.merge(Layer.provide(resourceLayer, serverLayer))
    )
    const { handler, dispose } = HttpRouter.toWebHandler(appLayer as any, { disableLogger: true })

    const customFetch: typeof fetch = (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      return handler(request)
    }

    const clientLayer = Layer.mergeAll(
      RpcClient.layerProtocolHttp({ url: "http://localhost/mcp" }),
      RpcSerialization.layerJsonRpc(),
      FetchHttpClient.layer,
      Layer.succeed(FetchHttpClient.Fetch, customFetch)
    )
    const client = yield* RpcClient.make(McpSchema.ClientRpcs).pipe(
      Effect.provide(clientLayer)
    )

    return { client, dispose }
  })

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

  it.effect("resource template uses McpSchema.param names in URI template", () =>
    Effect.gen(function*() {
      const idParam = McpSchema.param("id", Schema.Number)

      const TestTemplate = McpServer.resource`file://readme/${idParam}`({
        name: "README Template",
        content: Effect.fn(function*(_uri, id) {
          return `# README ID: ${id}`
        })
      })

      const { client, dispose } = yield* makeTestClient(TestTemplate)

      const result = yield* client["resources/templates/list"]({})
      const templates = result.resourceTemplates as ReadonlyArray<{ uriTemplate: string; name: string }>
      const template = templates.find((t) => t.name === "README Template")

      // The URI template must contain {id}, not {param0}
      deepStrictEqual(template?.uriTemplate, "file://readme/{id}")
      yield* Effect.promise(() => dispose())
    }).pipe(Effect.scoped))

  it.effect("resource template completion resolves named param", () =>
    Effect.gen(function*() {
      const idParam = McpSchema.param("id", Schema.Number)

      const TestTemplate = McpServer.resource`file://readme/${idParam}`({
        name: "Completable Template",
        completion: {
          id: (_input) => Effect.succeed([1, 2, 3])
        },
        content: Effect.fn(function*(_uri, id) {
          return `# ID: ${id}`
        })
      })

      const { client, dispose } = yield* makeTestClient(TestTemplate)

      const templates = (yield* client["resources/templates/list"]({}))
        .resourceTemplates as ReadonlyArray<{ uriTemplate: string }>
      const uriTemplate = templates[0].uriTemplate

      // Completions use the param name from the URI template
      const completeResult = yield* client["completion/complete"]({
        ref: { type: "ref/resource" as const, uri: uriTemplate },
        argument: { name: "id", value: "" }
      })

      deepStrictEqual(completeResult.completion.values, ["1", "2", "3"])
      yield* Effect.promise(() => dispose())
    }).pipe(Effect.scoped))
})
