import { NodeHttpServer } from "@effect/platform-node"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Ref, ServiceMap } from "effect"
import { Array } from "effect/collections"
import { DateTime, Filter, Redacted, Struct } from "effect/data"
import { FileSystem } from "effect/platform"
import { Check, Getter, Schema, Transformation } from "effect/schema"
import { Stream } from "effect/stream"
import {
  Cookies,
  HttpClient,
  HttpClientRequest,
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
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
  OpenApi
} from "effect/unstable/httpapi"
import OpenApiFixture from "./fixtures/openapi.json" with { type: "json" }

describe("HttpApi", () => {
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
          urlParams: { id: 123 },
          payload: { name: "Joe" }
        })
        assert.deepStrictEqual(
          apiClientUser,
          expected
        )
        const groupClientUser = yield* clientUsersGroup.create({
          urlParams: { id: 123 },
          payload: { name: "Joe" }
        })
        assert.deepStrictEqual(
          groupClientUser,
          expected
        )
        const endpointClientUser = yield* clientUsersEndpointCreate({
          urlParams: { id: 123 },
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
        const result = yield* client.users.upload({ payload: data, path: {} })
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
    it.effect("is decoded / encoded", () =>
      Effect.gen(function*() {
        const client = yield* HttpApiClient.make(Api)
        const users = yield* client.users.list({
          headers: { page: 1 },
          urlParams: {}
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
        const error = yield* client.groups.findById({ path: { id: 0 } }).pipe(
          Effect.flip
        )
        assert.deepStrictEqual(error, new GroupError())
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
        const error = yield* client.users.upload({ path: {}, payload: new FormData() }).pipe(
          Effect.flip
        )
        assert(error._tag === "HttpApiSchemaError")
        // TODO: add back issues
        // assert.deepStrictEqual(error.issues[0].path, ["file"])
      }).pipe(Effect.provide(HttpLive)))
  })

  it.effect("handler level context", () =>
    Effect.gen(function*() {
      const client = yield* HttpApiClient.make(Api)
      const users = yield* client.users.list({ headers: { page: 1 }, urlParams: {} })
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
      const users = yield* client.users.list({ headers: { page: 1 }, urlParams: {} }).pipe(
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
        const user = yield* client.users.findById({ path: { id: -1 } })
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
      const [users, response] = yield* client.users.list({ headers: { page: 1 }, urlParams: {}, withResponse: true })
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
        path: { id: 1 },
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
        path: { id: 1 },
        payload: { name: "Some group" }
      })
      assert.deepStrictEqual(response, {
        id: 1,
        name: "Some group"
      })
    }).pipe(Effect.provide(HttpLive)))

  describe("OpenAPI spec", () => {
    describe("error", () => {
      it("check & httpApiStatus annotation", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("create", "/", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.Int.annotate({ httpApiStatus: 400 })
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/"].post?.responses["400"], {
          "description": "The request or response did not match the expected schema",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "anyOf": [
                  { "$ref": "#/components/schemas/effect~1HttpApiSchemaError" },
                  {
                    "type": "integer",
                    "title": "int",
                    "description": "an integer"
                  }
                ]
              }
            }
          }
        })
      })

      it("union & httpApiStatus annotation", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("create", "/", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.Union([Schema.String, Schema.Number]).annotate({ httpApiStatus: 400 })
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/"].post?.responses["400"], {
          "description": "The request or response did not match the expected schema",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "anyOf": [
                  { "$ref": "#/components/schemas/effect~1HttpApiSchemaError" },
                  {
                    "anyOf": [
                      { "type": "string" },
                      { "type": "number" }
                    ]
                  }
                ]
              }
            }
          }
        })
      })

      it("union & identifier annotation", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("create", "/", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.Union([Schema.String, Schema.Number]).annotate({ identifier: "ID" })
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/"].post?.responses["500"], {
          "description": "ID",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "$ref": "#/components/schemas/ID"
              }
            }
          }
        })
      })

      it("union & identifier annotation with a member with httpApiStatus", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("create", "/", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.Union([Schema.NonEmptyString.annotate({ httpApiStatus: 400 }), Schema.Number]).annotate({
              id: "ID"
            })
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/"].post?.responses["400"], {
          "description": "The request or response did not match the expected schema",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "anyOf": [
                  { "$ref": "#/components/schemas/effect~1HttpApiSchemaError" },
                  {
                    "type": "string",
                    "description": "a value with a length of at least 1",
                    "minLength": 1,
                    "title": "minLength(1)"
                  }
                ]
              }
            }
          }
        })
        assert.deepStrictEqual(spec.paths["/"].post?.responses["500"], {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "number"
              }
            }
          }
        })
      })

      it("union & jsonSchema annotation", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("create", "/", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.Union([Schema.String, Schema.Number]).annotate({
              jsonSchema: {
                _tag: "Override",
                override: () => ({
                  type: "string"
                })
              }
            })
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/"].post?.responses["500"], {
          "description": "Error",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "type": "string"
              }
            }
          }
        })
      })

      it("Union & check & httpApiStatus annotation", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("create", "/", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.Union([Schema.String, Schema.Number]).check(Check.make(() => true)).annotate({
              httpApiStatus: 400
            })
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/"].post?.responses["400"], {
          "description": "The request or response did not match the expected schema",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "anyOf": [
                  { "$ref": "#/components/schemas/effect~1HttpApiSchemaError" },
                  {
                    "anyOf": [
                      { "type": "string" },
                      { "type": "number" }
                    ]
                  }
                ]
              }
            }
          }
        })
      })

      it("Union with encoding", () => {
        class Group extends HttpApiGroup.make("users")
          .add(HttpApiEndpoint.post("create", "/", {
            payload: Schema.String,
            success: Schema.String,
            error: Schema.Union([Schema.String, Schema.Number.annotate({ httpApiStatus: 400 })]).pipe(
              Schema.encodeTo(Schema.String, {
                decode: Getter.passthrough(),
                encode: Getter.transform(String)
              })
            ).annotate({ httpApiStatus: 400 })
          }))
        {}

        class Api extends HttpApi.make("api").add(Group) {}
        const spec = OpenApi.fromApi(Api)
        assert.deepStrictEqual(spec.paths["/"].post?.responses["400"], {
          "description": "The request or response did not match the expected schema",
          "content": {
            "application/json": {
              "schema": {
                "$schema": "https://json-schema.org/draft/2020-12/schema",
                "anyOf": [
                  { "$ref": "#/components/schemas/effect~1HttpApiSchemaError" },
                  { "type": "string" }
                ]
              }
            }
          }
        })
      })
    })

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

    const RateLimitErrorSchema = HttpApiSchema.withEncoding(
      Schema.String.pipe(
        Schema.decodeTo(
          RateLimitError,
          Transformation.transform({
            encode: ({ message }) => message,
            decode: (message) => new RateLimitError({ message })
          })
        )
      ),
      { kind: "Text" }
    ).annotate({ httpApiStatus: 429 })

    const Api = HttpApi.make("api").add(
      HttpApiGroup.make("group").add(
        HttpApiEndpoint.get("error", "/error").addError(RateLimitErrorSchema)
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

class UserError extends Schema.ErrorClass<UserError>("UserError")({
  _tag: Schema.tag("UserError")
}, {
  httpApiStatus: 400
}) {}
class GroupError extends HttpApiSchema.EmptyError<GroupError>()({
  tag: "GroupError",
  status: 418
}) {}
class NoStatusError extends Schema.ErrorClass<NoStatusError>("NoStatusError")({
  _tag: Schema.tag("NoStatusError")
}) {}

const DateTimeFromSelf = Schema.declare((u) => DateTime.isDateTime(u) && DateTime.isUtc(u))

const DateTimeFromString = Schema.String.pipe(
  Schema.decodeTo(
    DateTimeFromSelf,
    Transformation.transform({
      decode: DateTime.makeUnsafe,
      encode: DateTime.formatIso
    })
  )
)

class User extends Schema.Class<User>("User")({
  id: Schema.Int,
  uuid: Schema.optional(Schema.String),
  name: Schema.String,
  createdAt: DateTimeFromString
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

class CurrentUser extends ServiceMap.Key<CurrentUser, User>()("CurrentUser") {}

class Authorization extends HttpApiMiddleware.Key<Authorization, {
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
    path: {
      id: Schema.FiniteFromString
    },
    success: Group,
    error: GroupError
  }),
  HttpApiEndpoint.post("create", "/", {
    payload: Schema.Union([
      Schema.Struct(Struct.pick(Group.fields, ["name"])),
      Schema.Struct({ foo: Schema.String }).pipe(
        HttpApiSchema.withEncoding({ kind: "UrlParams" })
      ),
      HttpApiSchema.Multipart(
        Schema.Struct(Struct.pick(Group.fields, ["name"]))
      )
    ]),
    success: Group
  }),
  HttpApiEndpoint.post("handle", "/handle/:id", {
    path: {
      id: Schema.FiniteFromString
    },
    payload: Schema.Struct({
      name: Schema.String
    }),
    success: {
      id: Schema.Number,
      name: Schema.String
    }
  }),
  HttpApiEndpoint.post("handleRaw", "/handleraw/:id", {
    path: {
      id: Schema.FiniteFromString
    },
    payload: {
      name: Schema.String
    },
    success: {
      id: Schema.Number,
      name: Schema.String
    }
  })
).prefix("/groups") {}

class UsersApi extends HttpApiGroup.make("users")
  .add(
    HttpApiEndpoint.get("findById", "/:id", {
      path: {
        id: Schema.FiniteFromString
      },
      success: User,
      error: UserError
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Struct.omit(User.fields, ["id", "createdAt"]),
      urlParams: {
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
            decode: Getter.withDefault(() => 1),
            encode: Getter.passthrough()
          })
        )
      },
      urlParams: {
        query: Schema.optional(Schema.String).annotate({ description: "search query" })
      },
      success: Schema.Array(User),
      error: NoStatusError
    })
      .annotate(OpenApi.Deprecated, true)
      .annotate(OpenApi.Summary, "test summary")
      .annotateMerge(OpenApi.annotations({ identifier: "listUsers" })),
    HttpApiEndpoint.post("upload", "/upload/:0?", {
      path: {
        0: Schema.optional(Schema.String)
      },
      payload: HttpApiSchema.Multipart(Schema.Struct({
        file: Multipart.SingleFileSchema
      })),
      success: {
        contentType: Schema.String,
        length: Schema.Int
      }
    }),
    HttpApiEndpoint.post("uploadStream", `/uploadstream`, {
      payload: HttpApiSchema.MultipartStream(Schema.Struct({
        file: Multipart.SingleFileSchema
      })),
      success: {
        contentType: Schema.String,
        length: Schema.Int
      }
    })
  )
  .middleware(Authorization)
  .annotateMerge(OpenApi.annotations({ title: "Users API" }))
{}

class TopLevelApi extends HttpApiGroup.make("root", { topLevel: true })
  .add(
    HttpApiEndpoint.get("healthz", `/healthz`)
      .addSuccess(HttpApiSchema.NoContent.annotate({ description: "Empty" }))
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

class UserRepo extends ServiceMap.Key<UserRepo, {
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
      .handle("findById", (_) => _.path.id === -1 ? CurrentUser.asEffect() : repo.findById(_.path.id))
      .handle("create", (_) =>
        _.payload.name === "boom"
          ? Effect.fail(new UserError({}))
          : Effect.map(DateTime.now, (now) =>
            new User({
              id: _.urlParams.id,
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
            Stream.filter((part) => part._tag === "File" ? part : Filter.fail(part)),
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
      .handle("findById", ({ path }) =>
        path.id === 0
          ? Effect.fail(new GroupError())
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
        Effect.fnUntraced(function*({ path, payload }) {
          return HttpServerResponse.jsonUnsafe({
            id: path.id,
            name: payload.name
          })
        })
      )
      .handleRaw(
        "handleRaw",
        Effect.fnUntraced(function*({ path, request }) {
          const body = (yield* Effect.orDie(request.json)) as { name: string }
          return HttpServerResponse.jsonUnsafe({
            id: path.id,
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
