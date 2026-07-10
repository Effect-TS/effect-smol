import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiMiddleware } from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiGroup", () => {
  describe("isHttpApiGroup", () => {
    it("narrows to Top", () => {
      const value: unknown = HttpApiGroup.make("users")

      if (HttpApiGroup.isHttpApiGroup(value)) {
        expect(value).type.toBe<HttpApiGroup.Top>()
      }
    })
  })

  describe("Service", () => {
    it("tracks the group identifier", () => {
      type Users = HttpApiGroup.Service<"api", "users">

      expect<Users["identifier"]>().type.toBe<"users">()
      expect<Users>().type.not.toHaveProperty("name")
    })
  })

  describe("endpoints", () => {
    it("preserves endpoint types by identifier", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const GetUser = HttpApiEndpoint.get("getUser", "/users/:id", {
        params: {
          id: Schema.String
        },
        success: User
      })
      const CreateUser = HttpApiEndpoint.post("createUser", "/users", {
        payload: User,
        success: User
      })
      const Group = HttpApiGroup.make("users").add(GetUser, CreateUser)

      expect(Group.endpoints.getUser).type.toBe<typeof GetUser>()
      expect(Group.endpoints.createUser).type.toBe<typeof CreateUser>()
      expect(Group.endpoints).type.not.toHaveProperty("deleteUser")
    })

    it("preserves endpoint types by identifier after group transformations", () => {
      class M extends HttpApiMiddleware.Service<M>()("M") {}

      const GetUser = HttpApiEndpoint.get("getUser", "/users/:id", {
        params: {
          id: Schema.String
        }
      })
      const CreateUser = HttpApiEndpoint.post("createUser", "/users")
      const Group = HttpApiGroup.make("users").add(GetUser, CreateUser)

      const Prefixed = Group.prefix("/v1")
      const WithMiddleware = Group.middleware(M)

      expect(Prefixed.endpoints.getUser).type.toBe<HttpApiEndpoint.AddPrefix<typeof GetUser, "/v1">>()
      expect(Prefixed.endpoints.createUser).type.toBe<HttpApiEndpoint.AddPrefix<typeof CreateUser, "/v1">>()
      expect(WithMiddleware.endpoints.getUser).type.toBe<HttpApiEndpoint.AddMiddleware<typeof GetUser, M>>()
      expect(WithMiddleware.endpoints.createUser).type.toBe<HttpApiEndpoint.AddMiddleware<typeof CreateUser, M>>()
    })

    it("preserves class-like endpoints by identifier", () => {
      class GetUser extends HttpApiEndpoint.get("getUser", "/users/:id", {
        params: {
          id: Schema.String
        },
        success: Schema.Struct({ id: Schema.String })
      }) {}

      const Group = HttpApiGroup.make("users").add(GetUser)

      expect(Group.endpoints.getUser).type.toBe<typeof GetUser>()
      expect<HttpApiGroup.Endpoints<typeof Group>>().type.toBe<typeof GetUser>()
    })
  })
})
