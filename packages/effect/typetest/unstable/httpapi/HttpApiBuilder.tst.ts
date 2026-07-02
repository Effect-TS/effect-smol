import { Context, Effect, type Layer, Schema } from "effect"
import type { FileSystem } from "effect/FileSystem"
import type { Path } from "effect/Path"
import type { Generator } from "effect/unstable/http/Etag"
import type { HttpPlatform } from "effect/unstable/http/HttpPlatform"
import type { RouteContext } from "effect/unstable/http/HttpRouter"
import type { HttpServerRequest, ParsedSearchParams } from "effect/unstable/http/HttpServerRequest"
import type { HttpServerResponse } from "effect/unstable/http/HttpServerResponse"
import {
  HttpApi,
  HttpApiBuilder,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity
} from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiBuilder", () => {
  describe("group", () => {
    it("does not require unknown services for status annotations piped onto errors", () => {
      class NotFound extends Schema.TaggedErrorClass<NotFound>()("NotFound", {}) {}
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("group").add(
          HttpApiEndpoint.get("get", "/", {
            success: Schema.String,
            error: NotFound.pipe(HttpApiSchema.status(404))
          })
        )
      )

      const handlers = HttpApiBuilder.group(
        Api,
        "group",
        Effect.fn(function*(handlers) {
          return handlers.handle("get", () => Effect.succeed("ok"))
        })
      )

      expect(handlers).type.toBe<Layer.Layer<HttpApiGroup.ApiGroup<"api", "group">>>()
    })

    it("tracks handled endpoints and preserves handler request inference", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const CreateUser = Schema.Struct({
        name: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.post("createUser", "/users", {
              payload: CreateUser,
              success: User
            })
          )
      )

      const handlers = HttpApiBuilder.group(
        Api,
        "users",
        (handlers) =>
          handlers
            .handle("getUser", ({ params }) => {
              expect(params.id).type.toBe<string>()
              return Effect.succeed({ id: params.id })
            })
            .handle("createUser", ({ payload }) => {
              expect(payload.name).type.toBe<string>()
              return Effect.succeed({ id: payload.name })
            })
      )

      expect(handlers).type.toBe<Layer.Layer<HttpApiGroup.ApiGroup<"api", "users">>>()
    })

    it("handleAll tracks handled endpoints and preserves handler request inference", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const CreateUser = Schema.Struct({
        name: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.post("createUser", "/users", {
              payload: CreateUser,
              success: User
            })
          )
      )

      const handlers = HttpApiBuilder.group(
        Api,
        "users",
        (handlers) =>
          handlers.handleAll({
            getUser: ({ params }) => {
              expect(params.id).type.toBe<string>()
              return Effect.succeed({ id: params.id })
            },
            createUser: {
              handler: ({ payload }) => {
                expect(payload.name).type.toBe<string>()
                return Effect.succeed({ id: payload.name })
              },
              options: { uninterruptible: true }
            }
          })
      )

      expect(handlers).type.toBe<Layer.Layer<HttpApiGroup.ApiGroup<"api", "users">>>()
    })

    it("handleAll supports partial handler objects and rejects unknown endpoint names", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.get("listUsers", "/users", {
              success: Schema.Array(User)
            })
          )
      )

      HttpApiBuilder.group(
        Api,
        "users",
        (handlers) => {
          expect(handlers.handleAll).type.not.toBeCallableWith({
            getUser: () => Effect.succeed({ id: "id" }),
            listUsers: () => Effect.succeed([]),
            missing: () => Effect.succeed({ id: "id" })
          })

          return handlers.handleAll({
            getUser: ({ params }) => Effect.succeed({ id: params.id }),
            listUsers: () => Effect.succeed([])
          })
        }
      )

      const incomplete = (handlers: HttpApiBuilder.Handlers.FromGroup<NonNullable<typeof Api.groups.users>>) =>
        handlers.handleAll({
          getUser: ({ params }) => Effect.succeed({ id: params.id })
        })

      expect(HttpApiBuilder.group).type.not.toBeCallableWith(
        Api,
        "users",
        incomplete
      )

      const completeInTwoSteps = (handlers: HttpApiBuilder.Handlers.FromGroup<NonNullable<typeof Api.groups.users>>) =>
        handlers
          .handleAll({
            getUser: ({ params }) => Effect.succeed({ id: params.id })
          })
          .handleAll({
            listUsers: () => Effect.succeed([])
          })

      expect(HttpApiBuilder.group).type.toBeCallableWith(
        Api,
        "users",
        completeInTwoSteps
      )
    })

    it("rejects incomplete handler collections", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.get("listUsers", "/users", {
              success: Schema.Array(User)
            })
          )
      )
      const build = (handlers: HttpApiBuilder.Handlers.FromGroup<NonNullable<typeof Api.groups.users>>) =>
        handlers.handle("getUser", ({ params }) => Effect.succeed({ id: params.id }))

      expect(HttpApiBuilder.group).type.not.toBeCallableWith(
        Api,
        "users",
        build
      )
    })

    it("does not count duplicate handlers as handling missing endpoints", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.get("listUsers", "/users", {
              success: Schema.Array(User)
            })
          )
      )
      const build = (handlers: HttpApiBuilder.Handlers.FromGroup<NonNullable<typeof Api.groups.users>>) =>
        handlers
          .handle("getUser", ({ params }) => Effect.succeed({ id: params.id }))
          .handle("getUser", ({ params }) => Effect.succeed({ id: params.id }))

      expect(HttpApiBuilder.group).type.not.toBeCallableWith(
        Api,
        "users",
        build
      )
    })

    it("rejects incomplete effectful handler collections", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.get("listUsers", "/users", {
              success: Schema.Array(User)
            })
          )
      )
      const build = (handlers: HttpApiBuilder.Handlers.FromGroup<NonNullable<typeof Api.groups.users>>) =>
        Effect.succeed(handlers.handle("getUser", ({ params }) => Effect.succeed({ id: params.id })))

      expect(HttpApiBuilder.group).type.not.toBeCallableWith(
        Api,
        "users",
        build
      )
    })

    it("accepts complete effectful handler collections", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.get("listUsers", "/users", {
              success: Schema.Array(User)
            })
          )
      )
      const build = (handlers: HttpApiBuilder.Handlers.FromGroup<NonNullable<typeof Api.groups.users>>) =>
        Effect.succeed(
          handlers
            .handle("getUser", ({ params }) => Effect.succeed({ id: params.id }))
            .handle("listUsers", () => Effect.succeed([]))
        )

      expect(HttpApiBuilder.group).type.toBeCallableWith(
        Api,
        "users",
        build
      )
    })

    it("rejects unknown endpoint names and allows duplicate handlers", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              success: User
            })
          )
          .add(
            HttpApiEndpoint.get("listUsers", "/users", {
              success: Schema.Array(User)
            })
          )
      )

      HttpApiBuilder.group(
        Api,
        "users",
        (handlers) => {
          expect(handlers.handle).type.not.toBeCallableWith(
            "missing",
            () => Effect.succeed({ id: "id" })
          )

          const remaining = handlers.handle(
            "getUser",
            ({ params }) => Effect.succeed({ id: params.id })
          )

          expect(remaining.handle).type.toBeCallableWith(
            "getUser",
            () => Effect.succeed({ id: "id" })
          )

          return remaining
            .handle("getUser", () => Effect.succeed({ id: "id" }))
            .handle("listUsers", () => Effect.succeed([]))
        }
      )
    })

    it("preserves raw handler request inference", () => {
      const Api = HttpApi.make("api").add(
        HttpApiGroup.make("files").add(
          HttpApiEndpoint.post("upload", "/files/:id", {
            params: {
              id: Schema.String
            },
            payload: Schema.String,
            success: Schema.String
          })
        )
      )

      const handlers = HttpApiBuilder.group(
        Api,
        "files",
        (handlers) =>
          handlers.handleRaw("upload", (request) => {
            expect(request.params.id).type.toBe<string>()
            expect(request.request).type.toBe<HttpServerRequest>()
            expect(request).type.not.toHaveProperty("payload")
            return Effect.succeed("ok")
          })
      )

      expect(handlers).type.toBe<Layer.Layer<HttpApiGroup.ApiGroup<"api", "files">>>()
    })
  })

  describe("endpoint", () => {
    it("middleware & services", () => {
      const api = HttpApi.make("api").add(
        HttpApiGroup.make("group").add(
          HttpApiEndpoint.get("getUser", "/users/:id", {
            params: {
              id: Schema.String
            },
            success: Schema.Struct({
              id: Schema.String
            })
          }).middleware(M)
        )
      )
      const handler = HttpApiBuilder.endpoint(
        api,
        "group",
        "getUser",
        Effect.fnUntraced(function*(ctx) {
          yield* CurrentUser
          return { id: ctx.params.id }
        })
      )
      expect(handler).type.toBe<
        Effect.Effect<
          Effect.Effect<HttpServerResponse, never, HttpServerRequest | ParsedSearchParams | RouteContext>,
          never,
          M | Token | Generator | FileSystem | HttpPlatform | Path
        >
      >()
    })
  })
})

class Token extends Context.Service<Token, {
  readonly token: string
}>()("Token") {}

class CurrentUser extends Context.Service<CurrentUser, {
  readonly userId: string
}>()("CurrentUser") {}

class M extends HttpApiMiddleware.Service<M, {
  requires: Token
  provides: CurrentUser
}>()("Http/Logger", {
  error: Schema.String,
  security: {
    cookie: HttpApiSecurity.apiKey({
      in: "cookie",
      key: "token"
    })
  }
}) {}
