import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import {
  Array,
  DateTime,
  Effect,
  Equal,
  FileSystem,
  Layer,
  Redacted,
  Ref,
  Schema,
  SchemaGetter,
  SchemaTransformation,
  ServiceMap,
  Stream,
  Struct
} from "effect"
import {
  Cookies,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  type HttpClientResponse,
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
  Multipart
} from "effect/unstable/http"
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiClient,
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
  OpenApi
} from "effect/unstable/httpapi"
import OpenApiFixture from "./fixtures/openapi.json" with { type: "json" }

function* assertServerText(res: HttpClientResponse.HttpClientResponse, status: number, text: string) {
  assert.strictEqual(res.status, status)
  assert.strictEqual(yield* res.text, text)
}

function* assertServerJson(res: HttpClientResponse.HttpClientResponse, status: number, json: unknown) {
  assert.strictEqual(res.status, status)
  assert.deepStrictEqual(yield* res.json, json)
}

function* assertServerSchemaError(res: HttpClientResponse.HttpClientResponse, status: number, message: string) {
  yield* assertServerJson(res, status, {
    _tag: "HttpApiSchemaError",
    message
  })
}

function* assertClientText<E, R>(res: Effect.Effect<string, E, R>, text: string) {
  assert.strictEqual(yield* res, text)
}

function* assertClientJson<E, R>(res: Effect.Effect<unknown, E, R>, json: unknown) {
  assert.deepStrictEqual(yield* res, json)
}

function* assertClientError<A, E, R>(res: Effect.Effect<A, E, R>, error: E) {
  assert.ok(Equal.equals(yield* Effect.flip(res), error))
}

describe("HttpApi", () => {
  it.effect("catch all path", () => {
    const Api = HttpApi.make("api")
      .add(
        HttpApiGroup.make("group")
          .add(
            HttpApiEndpoint.get("catchAll", "*", {
              success: Schema.String
            })
          )
      )
    const GroupLive = HttpApiBuilder.group(
      Api,
      "group",
      (handlers) => handlers.handle("catchAll", (ctx) => Effect.succeed(ctx.request.url))
    )
    const ApiLive = HttpRouter.serve(
      HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
      { disableListenLog: true, disableLogger: true }
    ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

    return Effect.gen(function*() {
      // server side
      yield* assertServerText(yield* HttpClient.get(""), 200, `"/"`)
      yield* assertServerText(yield* HttpClient.get("/"), 200, `"/"`)
      yield* assertServerText(yield* HttpClient.get("/a/b/c"), 200, `"/a/b/c"`)

      // client side
      const client = yield* HttpApiClient.make(Api)
      yield* assertClientText(client.group.catchAll(), "/*")
    }).pipe(Effect.provide(ApiLive))
  })

  describe("middleware", () => {
    it.effect("error", () => {
      class M extends HttpApiMiddleware.Service<M>()("Http/Logger", {
        error: Schema.String
          .pipe(
            HttpApiSchema.status(405),
            HttpApiSchema.asText()
          )
      }) {}

      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                success: Schema.Finite
              })
            ).middleware(M)
        )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) => handlers.handle("a", () => Effect.succeed(1))
      )
      const MLive = Layer.succeed(
        M,
        () => Effect.fail("error")
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive), Layer.provide(MLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        // server side
        yield* assertServerText(yield* HttpClient.get("/a"), 405, "error")

        // client side
        const client = yield* HttpApiClient.make(Api)
        yield* assertClientError(client.group.a(), "error")
      }).pipe(Effect.provide(ApiLive))
    })
  })

  describe("payload option", () => {
    describe("GET", () => {
      it.effect("query parameters", () => {
        const Api = HttpApi.make("api")
          .add(
            HttpApiGroup.make("group")
              .add(
                HttpApiEndpoint.get("a", "/a", {
                  payload: {
                    required: Schema.FiniteFromString,
                    optionalKey: Schema.optionalKey(Schema.FiniteFromString),
                    optional: Schema.optional(Schema.FiniteFromString)
                  },
                  success: Schema.Any
                })
              )
          )
        const GroupLive = HttpApiBuilder.group(
          Api,
          "group",
          (handlers) => handlers.handle("a", (ctx) => Effect.succeed(ctx.payload))
        )
        const ApiLive = HttpRouter.serve(
          HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
          { disableListenLog: true, disableLogger: true }
        ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

        return Effect.gen(function*() {
          // server side
          yield* assertServerSchemaError(
            yield* HttpClient.get("/a"),
            400,
            `Missing key
  at ["required"]`
          )
          yield* assertServerJson(yield* HttpClient.get("/a?required=1"), 200, { required: 1 })
          yield* assertServerJson(yield* HttpClient.get("/a?required=1&optionalKey=1"), 200, {
            required: 1,
            optionalKey: 1
          })
          yield* assertServerJson(yield* HttpClient.get("/a?required=1&optional=1"), 200, { required: 1, optional: 1 })
          yield* assertServerJson(yield* HttpClient.get("/a?required=1"), 200, { required: 1 })
          // TODO: fix this test
          yield* assertServerJson(yield* HttpClient.get("/a?required=1&optional="), 200, { required: 1, optional: 0 })

          // client side
          const client = yield* HttpApiClient.make(Api)
          yield* assertClientJson(client.group.a({ payload: { required: 1 } }), { required: 1 })
          yield* assertClientJson(client.group.a({ payload: { required: 1, optionalKey: 1 } }), {
            required: 1,
            optionalKey: 1
          })
          yield* assertClientJson(client.group.a({ payload: { required: 1, optional: 1 } }), {
            required: 1,
            optional: 1
          })
          yield* assertClientJson(client.group.a({ payload: { required: 1, optional: undefined } }), { required: 1 })
        }).pipe(Effect.provide(ApiLive))
      })
    })

    it.effect("array of schemas with different encodings", () => {
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("group").add(
          HttpApiEndpoint.post("a", "/a", {
            payload: [
              Schema.Struct({ a: Schema.String }), // application/json
              Schema.String.pipe(HttpApiSchema.asText()), // text/plain
              Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()) // application/octet-stream
            ],
            success: Schema.Any
          })
        )
      )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) => handlers.handle("a", (ctx) => Effect.succeed(ctx.payload))
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        // server side
        yield* assertServerSchemaError(
          yield* HttpClient.post("/a"),
          400,
          `Expected object, got null`
        )
        yield* assertServerJson(yield* HttpClient.post("/a", { body: HttpBody.jsonUnsafe({ a: "text" }) }), 200, {
          a: "text"
        })
        yield* assertServerJson(yield* HttpClient.post("/a", { body: HttpBody.text("text") }), 200, "text")
        yield* assertServerJson(
          yield* HttpClient.post("/a", { body: HttpBody.uint8Array(new Uint8Array([1, 2, 3])) }),
          200,
          { 0: 1, 1: 2, 2: 3 }
        )

        // client side
        const client = yield* HttpApiClient.make(Api)
        yield* assertClientJson(client.group.a({ payload: { a: "text" } }), { a: "text" })
        yield* assertClientJson(client.group.a({ payload: "text" }), "text")
        yield* assertClientJson(client.group.a({ payload: new Uint8Array([1, 2, 3]) }), { 0: 1, 1: 2, 2: 3 })
      }).pipe(Effect.provide(ApiLive))
    })
  })

  describe("params option", () => {
    it.effect("should accept a record of schemas", () => {
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("group").add(
          HttpApiEndpoint.get("get", "/:id", {
            params: {
              id: Schema.FiniteFromString
            },
            success: Schema.String
          })
        )
      )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) => handlers.handle("get", (ctx) => Effect.succeed(`User ${ctx.params.id}`))
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        // server side
        yield* assertServerJson(yield* HttpClient.get("/1"), 200, "User 1")

        // client side
        const client = yield* HttpApiClient.make(Api)
        yield* assertClientJson(client.group.get({ params: { id: 1 } }), "User 1")
      }).pipe(Effect.provide(ApiLive))
    })
  })

  describe("query option", () => {
    it.effect("should accept a record of schemas", () => {
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("group").add(
          HttpApiEndpoint.get("get", "/", {
            query: {
              id: Schema.FiniteFromString
            },
            success: Schema.String
          })
        )
      )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) => handlers.handle("get", (ctx) => Effect.succeed(`User ${ctx.query.id}`))
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        // server side
        yield* assertServerJson(yield* HttpClient.get("/?id=1"), 200, "User 1")

        // client side
        const client = yield* HttpApiClient.make(Api)
        yield* assertClientJson(client.group.get({ query: { id: 1 } }), "User 1")
      }).pipe(Effect.provide(ApiLive))
    })
  })

  describe("success option", () => {
    it.effect("no content", () => {
      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                success: Schema.Void
              }),
              HttpApiEndpoint.get("b", "/b", {
                success: HttpApiSchema.NoContent
              }),
              HttpApiEndpoint.get("c", "/c", {
                success: Schema.String.pipe(HttpApiSchema.asNoContent({ decode: () => "c" }))
              })
            )
        )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) =>
          handlers
            .handle("a", () => Effect.void)
            .handle("b", () => Effect.succeed(HttpApiSchema.NoContent.makeUnsafe()))
            .handle("c", () => Effect.succeed("-"))
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        // server side
        yield* assertServerText(yield* HttpClient.get("/a"), 200, "")
        yield* assertServerText(yield* HttpClient.get("/b"), 204, "")
        yield* assertServerText(yield* HttpClient.get("/c"), 200, "")

        // client side
        const client = yield* HttpApiClient.make(Api)
        yield* assertClientJson(client.group.a(), undefined)
        yield* assertClientJson(client.group.b(), undefined)
        yield* assertClientJson(client.group.c(), "c")
      }).pipe(Effect.provide(ApiLive))
    })

    describe("encodings", () => {
      describe("asJson", () => {
        it.effect("custom contentType", () => {
          const Api = HttpApi.make("api").add(
            HttpApiGroup.make("group").add(
              HttpApiEndpoint.get("a", "/a", {
                success: Schema.String.pipe(HttpApiSchema.asJson({ contentType: "application/scim+json" }))
              })
            )
          )
          const GroupLive = HttpApiBuilder.group(
            Api,
            "group",
            (handlers) => handlers.handle("a", () => Effect.succeed("a"))
          )

          const ApiLive = HttpRouter.serve(
            HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
            { disableListenLog: true, disableLogger: true }
          ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

          return Effect.gen(function*() {
            // server side
            const res = yield* HttpClient.get("/a")
            yield* assertServerJson(res, 200, "a")
            assert.strictEqual(res.headers["content-type"], "application/scim+json")

            // client side
            const client = yield* HttpApiClient.make(Api)
            yield* assertClientJson(client.group.a(), "a")
          }).pipe(Effect.provide(ApiLive))
        })
      })
    })
  })

  describe("error option", () => {
    it.effect("no content", () => {
      const Api = HttpApi.make("api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                error: Schema.Void.pipe(HttpApiSchema.status(403))
              }),
              HttpApiEndpoint.get("b", "/b", {
                error: HttpApiSchema.NoContent,
                success: Schema.String
              }),
              HttpApiEndpoint.get("c", "/c", {
                error: Schema.String.pipe(
                  HttpApiSchema.asNoContent({ decode: () => "c" }),
                  HttpApiSchema.status(403)
                )
              }),
              HttpApiEndpoint.get("d", "/d", {
                error: HttpApiSchema.Empty(400)
              }),
              HttpApiEndpoint.get("e", "/e", {
                error: HttpApiError.UnauthorizedNoContent
              }),
              HttpApiEndpoint.get("f", "/f", {
                error: HttpApiError.BadRequestNoContent
              })
            )
        )
      const GroupLive = HttpApiBuilder.group(
        Api,
        "group",
        (handlers) =>
          handlers
            .handle("a", () => Effect.fail(undefined))
            .handle("b", () => Effect.fail(HttpApiSchema.NoContent.makeUnsafe()))
            .handle("c", () => Effect.fail(""))
            .handle("d", () => Effect.fail(void 0))
            .handle("e", () => Effect.fail(new HttpApiError.Unauthorized({})))
            .handle("f", () => Effect.fail(new HttpApiError.BadRequest({})))
      )

      const ApiLive = HttpRouter.serve(
        HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
        { disableListenLog: true, disableLogger: true }
      ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

      return Effect.gen(function*() {
        // server side
        yield* assertServerText(yield* HttpClient.get("/a"), 403, "")
        yield* assertServerText(yield* HttpClient.get("/b"), 204, "")
        yield* assertServerText(yield* HttpClient.get("/c"), 403, "")
        yield* assertServerText(yield* HttpClient.get("/d"), 400, "")
        yield* assertServerText(yield* HttpClient.get("/e"), 401, "")
        yield* assertServerText(yield* HttpClient.get("/f"), 400, "")

        // client side
        const client = yield* HttpApiClient.make(Api)
        yield* assertClientError(client.group.a(), undefined)
        yield* assertClientError(client.group.b(), undefined)
        yield* assertClientError(client.group.c(), "c")
        yield* assertClientError(client.group.d(), undefined)
        yield* assertClientError(client.group.e(), new HttpApiError.Unauthorized({}))
        yield* assertClientError(client.group.f(), new HttpApiError.BadRequest({}))
      }).pipe(Effect.provide(ApiLive))
    })
  })

  describe("original tests", () => {
    describe("payload", () => {
      it.effect("is decoded / encoded", () =>
        Effect.gen(function*() {
          const expected = new User({
            id: 123,
            name: "Joe",
            createdAt: DateTime.makeUnsafe(0)
          })
          const client = yield* HttpApiClient.make(Api)
          const clientUsersGroup = yield* HttpApiClient.group(Api, {
            httpClient: yield* HttpClient.HttpClient,
            group: "users"
          })
          const clientUsersEndpointCreate = yield* HttpApiClient.endpoint(Api, {
            httpClient: yield* HttpClient.HttpClient,
            group: "users",
            endpoint: "create"
          })

          const apiClientUser = yield* client.users.create({
            query: { id: 123 },
            payload: { name: "Joe" }
          })
          assert.deepStrictEqual(
            apiClientUser,
            expected
          )
          const groupClientUser = yield* clientUsersGroup.create({
            query: { id: 123 },
            payload: { name: "Joe" }
          })
          assert.deepStrictEqual(
            groupClientUser,
            expected
          )
          const endpointClientUser = yield* clientUsersEndpointCreate({
            query: { id: 123 },
            payload: { name: "Joe" }
          })
          assert.deepStrictEqual(
            endpointClientUser,
            expected
          )
        }).pipe(Effect.provide(HttpLive)))

      it.live("multipart", () =>
        Effect.gen(function*() {
          const client = yield* HttpApiClient.make(Api)
          const data = new FormData()
          data.append("file", new Blob(["hello"], { type: "text/plain" }), "hello.txt")
          const result = yield* client.users.upload({ payload: data, params: {} })
          assert.deepStrictEqual(result, {
            contentType: "text/plain",
            length: 5
          })
        }).pipe(Effect.provide(HttpLive)))

      it.live("multipart stream", () =>
        Effect.gen(function*() {
          const client = yield* HttpApiClient.make(Api)
          const data = new FormData()
          data.append("file", new Blob(["hello"], { type: "text/plain" }), "hello.txt")
          const result = yield* client.users.uploadStream({ payload: data })
          assert.deepStrictEqual(result, {
            contentType: "text/plain",
            length: 5
          })
        }).pipe(Effect.provide(HttpLive)))
    })

    describe("headers", () => {
      it.effect("should accept a record of schemas", () => {
        const Api = HttpApi.make("api").add(
          HttpApiGroup.make("group").add(
            HttpApiEndpoint.get("get", "/:id", {
              headers: {
                id: Schema.FiniteFromString
              },
              success: Schema.String
            })
          )
        )
        const GroupLive = HttpApiBuilder.group(
          Api,
          "group",
          (handlers) => handlers.handle("get", (ctx) => Effect.succeed(`User ${ctx.headers.id}`))
        )

        const ApiLive = HttpRouter.serve(
          HttpApiBuilder.layer(Api).pipe(Layer.provide(GroupLive)),
          { disableListenLog: true, disableLogger: true }
        ).pipe(Layer.provideMerge(NodeHttpServer.layerTest))

        return Effect.gen(function*() {
          const client = yield* HttpApiClient.make(Api)
          const result = yield* client.group.get({ headers: { id: 1 } })
          assert.strictEqual(result, "User 1")
        }).pipe(Effect.provide(ApiLive))
      })

      it.effect("is decoded / encoded", () =>
        Effect.gen(function*() {
          const client = yield* HttpApiClient.make(Api)
          const users = yield* client.users.list({
            headers: { page: 1 },
            query: {}
          })
          const user = users[0]
          assert.deepStrictEqual(
            user,
            new User({
              id: 1,
              name: "page 1",
              createdAt: DateTime.makeUnsafe(0)
            })
          )
        }).pipe(Effect.provide(HttpLive)))
    })

    describe("errors", () => {
      it.effect("empty errors have no body", () =>
        Effect.gen(function*() {
          const response = yield* HttpClient.get("/groups/0")
          assert.strictEqual(response.status, 418)
          const text = yield* response.text
          assert.strictEqual(text, "")
        }).pipe(Effect.provide(HttpLive)))

      it.effect("empty errors decode", () =>
        Effect.gen(function*() {
          const client = yield* HttpApiClient.make(Api)
          const error = yield* client.groups.findById({ params: { id: 0 } }).pipe(
            Effect.flip
          )
          assert.deepStrictEqual(error, new GroupError({}))
        }).pipe(Effect.provide(HttpLive)))

      it.effect("default to 500 status code", () =>
        Effect.gen(function*() {
          const response = yield* HttpClientRequest.get("/users").pipe(
            HttpClientRequest.setHeaders({ page: "0" }),
            HttpClient.execute
          )
          assert.strictEqual(response.status, 500)
          const body = yield* response.json
          assert.deepStrictEqual(body, {
            _tag: "NoStatusError"
          })
        }).pipe(Effect.provide(HttpLive)))

      it.effect("class level annotations", () =>
        Effect.gen(function*() {
          const response = yield* HttpClientRequest.post("/users").pipe(
            HttpClientRequest.setUrlParams({ id: "0" }),
            HttpClientRequest.bodyJsonUnsafe({ name: "boom" }),
            HttpClient.execute
          )
          assert.strictEqual(response.status, 400)
        }).pipe(Effect.provide(HttpLive)))

      it.effect("HttpApiSchemaError", () =>
        Effect.gen(function*() {
          const client = yield* HttpApiClient.make(Api)
          const error = yield* client.users.upload({ params: {}, payload: new FormData() }).pipe(
            Effect.flip
          )
          assert.strictEqual(error._tag, "HttpApiSchemaError")
          // TODO: add back issues
          // assert.deepStrictEqual(error.issues[0].path, ["file"])
        }).pipe(Effect.provide(HttpLive)))
    })

    it.effect("handler level context", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const users = yield* client.users.list({ headers: { page: 1 }, query: {} })
        const user = users[0]
        assert.strictEqual(user.name, "page 1")
        assert.deepStrictEqual(user.createdAt, DateTime.makeUnsafe(0))
      }).pipe(Effect.provide(HttpLive)))

    it.effect("custom client context", () =>
      Effect.gen(function*() {
        let tapped = false
        const client = yield* HttpApiClient.makeWith(Api, {
          httpClient: (yield* HttpClient.HttpClient).pipe(
            HttpClient.tapRequest(Effect.fnUntraced(function*(_request) {
              tapped = true
              yield* CurrentUser
            }))
          )
        })
        const users = yield* client.users.list({ headers: { page: 1 }, query: {} }).pipe(
          Effect.provideService(
            CurrentUser,
            new User({
              id: 1,
              name: "foo",
              createdAt: DateTime.makeUnsafe(0)
            })
          )
        )
        const user = users[0]
        assert.strictEqual(user.name, "page 1")
        assert.isTrue(tapped)
      }).pipe(Effect.provide(HttpLive)))

    describe("security", () => {
      it.effect("security middleware sets current user", () =>
        Effect.gen(function*() {
          const ref = yield* Ref.make(Cookies.empty.pipe(
            Cookies.setUnsafe("token", "foo")
          ))
          const client = yield* HttpApiClient.makeWith(Api, {
            httpClient: HttpClient.withCookiesRef(yield* HttpClient.HttpClient, ref)
          })
          const user = yield* client.users.findById({ params: { id: -1 } })
          assert.strictEqual(user.name, "foo")
        }).pipe(Effect.provide(HttpLive)))

      it.effect("apiKey header security", () =>
        Effect.gen(function*() {
          const decode = HttpApiBuilder.securityDecode(securityHeader).pipe(
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              HttpServerRequest.fromWeb(
                new Request("http://localhost:3000/", {
                  headers: {
                    "x-api-key": "foo"
                  }
                })
              )
            ),
            Effect.provideService(HttpServerRequest.ParsedSearchParams, {})
          )
          const redacted = yield* decode
          assert.strictEqual(Redacted.value(redacted), "foo")
        }).pipe(Effect.provide(HttpLive)))

      it.effect("apiKey query security", () =>
        Effect.gen(function*() {
          const redacted = yield* HttpApiBuilder.securityDecode(securityQuery).pipe(
            Effect.provideService(
              HttpServerRequest.HttpServerRequest,
              HttpServerRequest.fromWeb(new Request("http://localhost:3000/"))
            ),
            Effect.provideService(HttpServerRequest.ParsedSearchParams, {
              api_key: "foo"
            })
          )
          assert.strictEqual(Redacted.value(redacted), "foo")
        }).pipe(Effect.provide(HttpLive)))
    })

    it.effect("client withResponse", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const [users, response] = yield* client.users.list({ headers: { page: 1 }, query: {}, withResponse: true })
        assert.strictEqual(users[0].name, "page 1")
        assert.strictEqual(response.status, 200)
      }).pipe(Effect.provide(HttpLive)))

    it.effect("multiple payload types", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        let [group, response] = yield* client.groups.create({
          payload: { name: "Some group" },
          withResponse: true
        })
        assert.deepStrictEqual(group, new Group({ id: 1, name: "Some group" }))
        assert.strictEqual(response.status, 200)

        const data = new FormData()
        data.set("name", "Some group")
        ;[group, response] = yield* client.groups.create({
          payload: data,
          withResponse: true
        })
        assert.deepStrictEqual(group, new Group({ id: 1, name: "Some group" }))
        assert.strictEqual(response.status, 200)

        group = yield* client.groups.create({
          payload: { foo: "Some group" }
        })
        assert.deepStrictEqual(group, new Group({ id: 1, name: "Some group" }))
      }).pipe(Effect.provide(HttpLive)))

    it.effect(".handle can return HttpServerResponse", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const response = yield* client.groups.handle({
          params: { id: 1 },
          payload: { name: "Some group" }
        })
        assert.deepStrictEqual(response, {
          id: 1,
          name: "Some group"
        })
      }).pipe(Effect.provide(HttpLive)))

    it.effect(".handleRaw can manually process body", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const response = yield* client.groups.handleRaw({
          params: { id: 1 },
          payload: { name: "Some group" }
        })
        assert.deepStrictEqual(response, {
          id: 1,
          name: "Some group"
        })
      }).pipe(Effect.provide(HttpLive)))

    describe("OpenAPI spec", () => {
      it("fixture", () => {
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec, OpenApiFixture as any)
      })
    })

    it.effect("error from plain text", () => {
      class RateLimitError extends Schema.ErrorClass<RateLimitError>("RateLimitError")({
        _tag: Schema.tag("RateLimitError"),
        message: Schema.String
      }) {}

      const RateLimitErrorSchema = Schema.String.pipe(
        Schema.decodeTo(
          RateLimitError,
          SchemaTransformation.transform({
            encode: ({ message }) => message,
            decode: (message) => new RateLimitError({ message })
          })
        ),
        HttpApiSchema.status(429),
        HttpApiSchema.asText()
      )

      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("group").add(
          HttpApiEndpoint.get("error", "/error", {
            error: RateLimitErrorSchema
          })
        )
      )
      const ApiLive = HttpApiBuilder.layer(Api).pipe(
        Layer.provide(
          HttpApiBuilder.group(
            Api,
            "group",
            (handlers) =>
              handlers.handle("error", () => new RateLimitError({ message: "Rate limit exceeded" }).asEffect())
          )
        ),
        HttpRouter.serve,
        Layer.provideMerge(NodeHttpServer.layerTest)
      )
      return Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const response = yield* client.group.error().pipe(Effect.flip)
        assert.deepStrictEqual(response, new RateLimitError({ message: "Rate limit exceeded" }))
      }).pipe(Effect.provide(ApiLive))
    })
  })
})

class UserError extends Schema.ErrorClass<UserError>("UserError")({
  _tag: Schema.tag("UserError")
}, {
  httpApiStatus: 400
}) {}
class GroupError extends Schema.ErrorClass<GroupError>("GroupError")({
  _tag: Schema.tag("GroupError")
}, {
  httpApiStatus: 418
}) {}
class NoStatusError extends Schema.ErrorClass<NoStatusError>("NoStatusError")({
  _tag: Schema.tag("NoStatusError")
}) {}

class User extends Schema.Class<User>("User")({
  id: Schema.Int,
  uuid: Schema.optional(Schema.String),
  name: Schema.String,
  createdAt: Schema.DateTimeUtcFromString
}, {
  description: "Some description for User"
}) {}

class Group extends Schema.Class<Group>("Group")({
  id: Schema.Int,
  name: Schema.String
}) {}

const securityHeader = HttpApiSecurity.apiKey({
  in: "header",
  key: "x-api-key"
})

const securityQuery = HttpApiSecurity.apiKey({
  in: "query",
  key: "api_key"
})

class CurrentUser extends ServiceMap.Service<CurrentUser, User>()("CurrentUser") {}

class Authorization extends HttpApiMiddleware.Service<Authorization, {
  provides: CurrentUser
  requires: never
}>()("Authorization", {
  security: {
    cookie: HttpApiSecurity.apiKey({
      in: "cookie",
      key: "token"
    })
  }
}) {}

class GroupsApi extends HttpApiGroup.make("groups").add(
  HttpApiEndpoint.get("findById", "/:id", {
    params: {
      id: Schema.FiniteFromString
    },
    success: Group,
    error: GroupError.pipe(HttpApiSchema.asNoContent({
      decode: () => new GroupError({})
    }))
  }),
  HttpApiEndpoint.post("create", "/", {
    payload: [
      Schema.Struct(Struct.pick(Group.fields, ["name"])),
      Schema.Struct({ foo: Schema.String }).pipe(
        HttpApiSchema.asFormUrlEncoded()
      ),
      Schema.Struct(Struct.pick(Group.fields, ["name"])).pipe(
        HttpApiSchema.asMultipart()
      )
    ],
    success: Group
  }),
  HttpApiEndpoint.post("handle", "/handle/:id", {
    params: {
      id: Schema.FiniteFromString
    },
    payload: Schema.Struct({
      name: Schema.String
    }),
    success: Schema.Struct({
      id: Schema.Finite,
      name: Schema.String
    })
  }),
  HttpApiEndpoint.post("handleRaw", "/handleraw/:id", {
    params: {
      id: Schema.FiniteFromString
    },
    payload: Schema.Struct({
      name: Schema.String
    }),
    success: Schema.Struct({
      id: Schema.Finite,
      name: Schema.String
    })
  })
).prefix("/groups") {}

class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("findById", "/:id", {
      params: {
        id: Schema.FiniteFromString
      },
      success: User,
      error: UserError
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct(Struct.omit(User.fields, ["id", "createdAt"])),
      query: {
        id: Schema.FiniteFromString
      },
      success: User,
      error: [UserError, UserError]
    }),
    HttpApiEndpoint.get("list", "/", {
      headers: {
        page: Schema.FiniteFromString.pipe(
          Schema.optionalKey,
          Schema.decode({
            decode: SchemaGetter.withDefault(() => 1),
            encode: SchemaGetter.passthrough()
          })
        )
      },
      query: {
        query: Schema.optional(Schema.String).annotate({ description: "search query" })
      },
      success: Schema.Array(User),
      error: NoStatusError
    })
      .annotate(OpenApi.Deprecated, true)
      .annotate(OpenApi.Summary, "test summary")
      .annotateMerge(OpenApi.annotations({ identifier: "listUsers" })),
    HttpApiEndpoint.post("upload", "/upload/:0?", {
      params: {
        0: Schema.optional(Schema.String)
      },
      payload: Schema.Struct({
        file: Multipart.SingleFileSchema
      }).pipe(HttpApiSchema.asMultipart()),
      success: Schema.Struct({
        contentType: Schema.String,
        length: Schema.Int
      })
    }),
    HttpApiEndpoint.post("uploadStream", `/uploadstream`, {
      payload: Schema.Struct({
        file: Multipart.SingleFileSchema
      }).pipe(HttpApiSchema.asMultipartStream()),
      success: Schema.Struct({
        contentType: Schema.String,
        length: Schema.Int
      })
    })
  )
  .middleware(Authorization)
  .annotateMerge(OpenApi.annotations({ title: "Users API" }))
{}

class TopLevelApi extends HttpApiGroup.make("root", { topLevel: true })
  .add(
    HttpApiEndpoint.get("healthz", `/healthz`, {
      success: HttpApiSchema.NoContent.annotate({ description: "Empty" })
    })
  )
{}

class AnotherApi extends HttpApi.make("another").add(GroupsApi) {}

class Api extends HttpApi.make("api")
  .addHttpApi(AnotherApi)
  .add(UsersApi.prefix("/users"))
  .add(TopLevelApi)
  .annotateMerge(OpenApi.annotations({
    title: "API",
    summary: "test api summary",
    transform: (openApiSpec) => ({
      ...openApiSpec,
      tags: [...openApiSpec.tags ?? [], {
        name: "Tag from OpenApi.Transform annotation"
      }]
    })
  }))
  .annotate(
    HttpApi.AdditionalSchemas,
    [
      Schema.Struct({
        contentType: Schema.String,
        length: Schema.Int
      }).annotate({
        identifier: "ComponentsSchema"
      })
    ]
  )
{}

// impl

class UserRepo extends ServiceMap.Service<UserRepo, {
  readonly findById: (id: number) => Effect.Effect<User>
}>()("UserRepo") {
  static Live = Layer.succeed(this)({
    findById: (id) => Effect.map(DateTime.now, (now) => ({ id, name: "foo", createdAt: now }))
  })
}

const AuthorizationLive = Layer.succeed(
  Authorization
)({
  cookie: (effect, opts) =>
    Effect.provideService(
      effect,
      CurrentUser,
      new User({
        id: 1,
        name: Redacted.value(opts.credential),
        createdAt: DateTime.nowUnsafe()
      })
    )
})

const HttpUsersLive = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fnUntraced(function*(handlers) {
    const fs = yield* FileSystem.FileSystem
    const repo = yield* UserRepo
    return handlers
      .handle("findById", (_) => _.params.id === -1 ? CurrentUser.asEffect() : repo.findById(_.params.id))
      .handle("create", (_) =>
        _.payload.name === "boom"
          ? Effect.fail(new UserError({}))
          : Effect.map(DateTime.now, (now) =>
            new User({
              id: _.query.id,
              name: _.payload.name,
              createdAt: now
            })))
      .handle("list", (_) =>
        _.headers.page === 0
          ? Effect.fail(new NoStatusError({}))
          // test handler level context
          : Effect.map(DateTime.nowInCurrentZone, (now) => [
            new User({
              id: 1,
              name: `page ${_.headers.page}`,
              createdAt: DateTime.toUtc(now)
            })
          ]))
      .handle("upload", (_) =>
        Effect.gen(function*() {
          const stat = yield* fs.stat(_.payload.file.path).pipe(Effect.orDie)
          return {
            contentType: _.payload.file.contentType,
            length: Number(stat.size)
          }
        }))
      .handle("uploadStream", (_) =>
        Effect.gen(function*() {
          const { content, file } = yield* _.payload.pipe(
            Stream.filter(Multipart.isFile),
            Stream.mapEffect((file) =>
              file.contentEffect.pipe(
                Effect.map((content) => ({ file, content }))
              )
            ),
            Stream.runCollect,
            Effect.flatMap((_) => Array.head(_).asEffect()),
            Effect.orDie
          )
          return {
            contentType: file.contentType,
            length: content.length
          }
        }))
  })
).pipe(
  Layer.provide([
    DateTime.layerCurrentZoneOffset(0),
    UserRepo.Live,
    AuthorizationLive
  ])
)

const HttpGroupsLive = HttpApiBuilder.group(
  Api,
  "groups",
  (handlers) =>
    handlers
      .handle("findById", ({ params }) =>
        params.id === 0
          ? Effect.fail(new GroupError({}))
          : Effect.succeed(new Group({ id: 1, name: "foo" })))
      .handle("create", ({ payload }) =>
        Effect.succeed(
          new Group({
            id: 1,
            name: "foo" in payload ? payload.foo : payload.name
          })
        ))
      .handle(
        "handle",
        Effect.fnUntraced(function*({ params, payload }) {
          return HttpServerResponse.jsonUnsafe({
            id: params.id,
            name: payload.name
          })
        })
      )
      .handleRaw(
        "handleRaw",
        Effect.fnUntraced(function*({ params, request }) {
          const body = (yield* Effect.orDie(request.json)) as { name: string }
          return HttpServerResponse.jsonUnsafe({
            id: params.id,
            name: body.name
          })
        })
      )
)

const TopLevelLive = HttpApiBuilder.group(
  Api,
  "root",
  (handlers) => handlers.handle("healthz", (_) => Effect.void)
)

const HttpApiLive = Layer.provide(HttpApiBuilder.layer(Api), [
  HttpGroupsLive,
  HttpUsersLive,
  TopLevelLive
])

const HttpLive = HttpRouter.serve(HttpApiLive, {
  disableListenLog: true,
  disableLogger: true
}).pipe(
  Layer.provideMerge(NodeHttpServer.layerTest)
)
