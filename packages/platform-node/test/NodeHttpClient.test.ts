import * as NodeClient from "@effect/platform-node/NodeHttpClient"
import { assert, describe, expect, it } from "@effect/vitest"
import { Struct } from "effect"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"
import * as Http from "node:http"

const Todo = Schema.Struct({
  userId: Schema.Number,
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean
})
const TodoWithoutId = Schema.Struct({
  ...Struct.omit(Todo.fields, ["id"])
})

const makeJsonPlaceholder = Effect.gen(function*() {
  const defaultClient = yield* HttpClient.HttpClient
  const client = defaultClient.pipe(
    HttpClient.mapRequest(HttpClientRequest.prependUrl("https://jsonplaceholder.typicode.com"))
  )
  const createTodo = (todo: typeof TodoWithoutId.Type) =>
    HttpClientRequest.post("/todos").pipe(
      HttpClientRequest.schemaBodyJson(TodoWithoutId)(todo),
      Effect.flatMap(client.execute),
      Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
    )
  return {
    client,
    createTodo
  } as const
})
interface JsonPlaceholder extends Effect.Success<typeof makeJsonPlaceholder> {}
const JsonPlaceholder = Context.Service<JsonPlaceholder>("test/JsonPlaceholder")
const JsonPlaceholderLive = Layer.effect(JsonPlaceholder)(makeJsonPlaceholder)

const makeServer = Effect.acquireRelease(
  Effect.tryPromise({
    try: () =>
      new Promise<{
        readonly body: Promise<Buffer>
        readonly server: Http.Server
        readonly url: string
      }>((resolve, reject) => {
        let resolveBody: (body: Buffer) => void = () => {}
        const body = new Promise<Buffer>((resolve) => {
          resolveBody = resolve
        })
        const server = Http.createServer((request, response) => {
          const chunks: Array<Buffer> = []
          request.on("data", (chunk) => chunks.push(Buffer.from(chunk)))
          request.once("end", () => {
            resolveBody(Buffer.concat(chunks))
            response.end("ok")
          })
        })
        server.once("error", reject)
        server.listen(0, "127.0.0.1", () => {
          const address = server.address()
          if (address === null || typeof address === "string") {
            reject(new Error("Expected the test server to listen on a TCP port"))
            return
          }
          resolve({ body, server, url: `http://127.0.0.1:${address.port}` })
        })
      }),
    catch: (cause) => cause
  }),
  ({ server }) =>
    Effect.promise(() =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      })
    )
)
;[
  {
    name: "fetch",
    layer: NodeClient.layerFetch
  },
  {
    name: "node:http",
    layer: NodeClient.layerNodeHttp
  },
  {
    name: "undici",
    layer: NodeClient.layerUndici
  }
].forEach(({ layer, name }) => {
  describe(`NodeHttpClient - ${name}`, () => {
    it.effect("google", () =>
      Effect.gen(function*() {
        const response = yield* HttpClient.get("https://www.google.com/").pipe(
          Effect.flatMap((_) => _.text)
        )
        expect(response).toContain("Google")
      }).pipe(Effect.provide(layer), flaky))

    it.effect("google followRedirects", () =>
      flaky(
        Effect.gen(function*() {
          const client = (yield* HttpClient.HttpClient).pipe(
            HttpClient.followRedirects()
          )
          const response = yield* client.get("http://google.com/").pipe(
            Effect.flatMap((_) => _.text)
          )
          expect(response).toContain("Google")
        }).pipe(Effect.provide(layer))
      ))

    it.effect("google stream", () =>
      flaky(
        Effect.gen(function*() {
          const client = yield* HttpClient.HttpClient
          const response = yield* client.get("https://www.google.com/").pipe(
            Effect.map((_) => _.stream),
            Stream.unwrap,
            Stream.decodeText(),
            Stream.mkString
          )
          expect(response).toContain("Google")
        }).pipe(Effect.provide(layer))
      ))

    it.effect("jsonplaceholder", () =>
      Effect.gen(function*() {
        const jp = yield* JsonPlaceholder
        const response = yield* jp.client.get("/todos/1").pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
        )
        expect(response.id).toBe(1)
      }).pipe(
        Effect.provide(JsonPlaceholderLive.pipe(
          Layer.provide(layer)
        )),
        flaky
      ))

    it.effect("jsonplaceholder schemaBodyJson", () =>
      Effect.gen(function*() {
        const jp = yield* JsonPlaceholder
        const response = yield* jp.createTodo({
          userId: 1,
          title: "test",
          completed: false
        })
        expect(response.title).toBe("test")
      }).pipe(
        Effect.provide(JsonPlaceholderLive.pipe(
          Layer.provide(layer)
        )),
        flaky
      ))

    it.effect("head request with schemaJson", () =>
      Effect.gen(function*() {
        const client = yield* HttpClient.HttpClient
        const response = yield* client.head("https://jsonplaceholder.typicode.com/todos").pipe(
          Effect.flatMap(
            HttpClientResponse.schemaJson(Schema.Struct({ status: Schema.Literal(200) }))
          )
        )
        expect(response).toEqual({ status: 200 })
      }).pipe(Effect.provide(layer), flaky))

    it.live("interrupt", () =>
      Effect.gen(function*() {
        const client = yield* HttpClient.HttpClient
        const response = yield* client.get("https://www.google.com/").pipe(
          Effect.flatMap((_) => _.text),
          Effect.timeout(1),
          Effect.asSome,
          Effect.catchTag("TimeoutError", () => Effect.succeedNone)
        )
        expect(response._tag).toEqual("None")
      }).pipe(Effect.provide(layer), flaky))

    it.effect("close early", () =>
      Effect.gen(function*() {
        const response = yield* HttpClient.get("https://www.google.com/")
        expect(response.status).toBe(200)
      }).pipe(Effect.provide(layer), flaky))
  })
})
it.effect("Undici responses do not retain uploaded request bodies", () =>
  Effect.gen(function*() {
    const { body, url } = yield* makeServer
    const client = yield* HttpClient.HttpClient
    const payload = "x".repeat(1024 * 1024)
    const request = HttpClientRequest.post(`${url}/upload?test=true`).pipe(
      HttpClientRequest.setHeader("x-test", "retained"),
      HttpClientRequest.bodyText(payload, "text/plain")
    )
    const response = yield* client.execute(request)
    yield* response.text

    assert.strictEqual(request.body._tag, "Uint8Array")
    assert.strictEqual(response.request.body._tag, "Empty")
    assert.strictEqual(response.request.method, request.method)
    assert.strictEqual(response.request.url, request.url)
    assert.deepStrictEqual(response.request.urlParams, request.urlParams)
    assert.deepStrictEqual(response.request.hash, request.hash)
    assert.strictEqual(response.request.headers["x-test"], request.headers["x-test"])
    assert.strictEqual(response.request.headers["content-type"], request.headers["content-type"])
    assert.strictEqual(response.request.headers["content-length"], request.headers["content-length"])
    assert.strictEqual((yield* Effect.promise(() => body)).toString("utf8"), payload)
  }).pipe(Effect.provide(NodeClient.layerUndici), Effect.scoped))

const flaky = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.timeoutOrElse({
      duration: "10 seconds",
      orElse: () => Effect.void
    })
  )
