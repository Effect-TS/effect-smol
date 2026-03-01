import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Schema } from "effect"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

describe("HttpApiClient", () => {
  describe("urlBuilder", () => {
    const Api = HttpApi.make("Api")
      .add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.String
              },
              query: {
                page: Schema.String,
                tags: Schema.Array(Schema.String)
              }
            }),
            HttpApiEndpoint.get("health", "/health")
          )
      )

    it("builds urls from endpoint method/path", () => {
      const builder = HttpApiClient.urlBuilder<typeof Api>({
        baseUrl: "https://api.example.com"
      })

      strictEqual(
        builder("users", "GET /users/:id", {
          params: {
            id: "123"
          },
          query: {
            page: "1",
            tags: ["a", "b"]
          }
        }),
        "https://api.example.com/users/123?page=1&tags=a&tags=b"
      )
    })

    it("returns relative urls when baseUrl is omitted", () => {
      const builder = HttpApiClient.urlBuilder<typeof Api>()

      strictEqual(builder("users", "GET /health"), "/health")
    })
  })
})
