import * as NodeClient from "@effect/platform-node/NodeHttpClient"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Layer, ServiceMap } from "effect"
import { Struct } from "effect/data"
import { Schema } from "effect/schema"
import { Stream } from "effect/stream"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

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
const JsonPlaceholder = ServiceMap.Key<JsonPlaceholder>("test/JsonPlaceholder")
const JsonPlaceholderLive = Layer.effect(JsonPlaceholder)(makeJsonPlaceholder)
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
      }).pipe(Effect.provide(layer)))

    it.effect("google followRedirects", () =>
      Effect.gen(function*() {
        const client = (yield* HttpClient.HttpClient).pipe(
          HttpClient.followRedirects()
        )
        const response = yield* client.get("http://google.com/").pipe(
          Effect.flatMap((_) => _.text)
        )
        expect(response).toContain("Google")
      }).pipe(Effect.provide(layer)))

    it.effect("google stream", () =>
      Effect.gen(function*() {
        const client = yield* HttpClient.HttpClient
        const response = yield* client.get("https://www.google.com/").pipe(
          Effect.map((_) => _.stream),
          Stream.unwrap,
          Stream.decodeText(),
          Stream.mkString
        )
        expect(response).toContain("Google")
      }).pipe(Effect.provide(layer)))

    it.effect("jsonplaceholder", () =>
      Effect.gen(function*() {
        const jp = yield* JsonPlaceholder
        const response = yield* jp.client.get("/todos/1").pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo))
        )
        expect(response.id).toBe(1)
      }).pipe(Effect.provide(JsonPlaceholderLive.pipe(
        Layer.provide(layer)
      ))))

    it.effect("jsonplaceholder schemaBodyJson", () =>
      Effect.gen(function*() {
        const jp = yield* JsonPlaceholder
        const response = yield* jp.createTodo({
          userId: 1,
          title: "test",
          completed: false
        })
        expect(response.title).toBe("test")
      }).pipe(Effect.provide(JsonPlaceholderLive.pipe(
        Layer.provide(layer)
      ))))

    it.effect("head request with schemaJson", () =>
      Effect.gen(function*() {
        const client = yield* HttpClient.HttpClient
        const response = yield* client.head("https://jsonplaceholder.typicode.com/todos").pipe(
          Effect.flatMap(
            HttpClientResponse.schemaJson(Schema.Struct({ status: Schema.Literal(200) }))
          )
        )
        expect(response).toEqual({ status: 200 })
      }).pipe(Effect.provide(layer)))

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
      }).pipe(Effect.provide(layer)))

    it.effect("close early", () =>
      Effect.gen(function*() {
        const response = yield* HttpClient.get("https://www.google.com/")
        expect(response.status).toBe(200)
      }).pipe(Effect.provide(layer)))
  })
})
