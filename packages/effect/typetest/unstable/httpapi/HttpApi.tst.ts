import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApi", () => {
  describe("groups", () => {
    it("preserves group types by name", () => {
      const User = Schema.Struct({
        id: Schema.String
      })
      const Users = HttpApiGroup.make("users").add(
        HttpApiEndpoint.get("getUser", "/users/:id", {
          params: {
            id: Schema.String
          },
          success: User
        })
      )
      const Admin = HttpApiGroup.make("admin").add(
        HttpApiEndpoint.get("getAdmin", "/admin/:id", {
          params: {
            id: Schema.String
          },
          success: User
        })
      )
      const Api = HttpApi.make("api").add(Users, Admin)

      expect(Api.groups.users).type.toBe<typeof Users>()
      expect(Api.groups.admin).type.toBe<typeof Admin>()
      expect(Api).type.not.toBeAssignableTo<HttpApi.HttpApi<"api", typeof Users>>()
    })
  })
})
