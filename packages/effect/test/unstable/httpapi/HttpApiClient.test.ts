import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Schema } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import { HttpApi, HttpApiClient, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

describe("HttpApiClient", () => {
  describe("urlBuilder", () => {
    const Api = HttpApi.make("Api")
      .add(
        HttpApiGroup.make("users")
          .add(
            HttpApiEndpoint.get("getUser", "/users/:id", {
              params: {
                id: Schema.Finite
              },
              query: {
                page: Schema.Finite,
                tags: Schema.Array(Schema.Finite)
              }
            }),
            HttpApiEndpoint.get("health", "/health")
          )
      )

    it("builds urls using endpoint schemas", () => {
      const builder = HttpApiClient.urlBuilder(Api, {
        baseUrl: "https://api.example.com"
      })

      strictEqual(
        builder.users.getUser({
          params: {
            id: 123
          },
          query: {
            page: 1,
            tags: [1, 2]
          }
        }),
        "https://api.example.com/users/123?page=1&tags=1&tags=2"
      )
    })

    it("encodes path parameters", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("stacks")
            .add(
              HttpApiEndpoint.get("listResources", "/state/stacks/:stack/stages/:stage/resources", {
                params: {
                  stack: Schema.String,
                  stage: Schema.String
                }
              })
            )
        )
      const builder = HttpApiClient.urlBuilder(Api, {
        baseUrl: "https://api.example.com"
      })

      strictEqual(
        builder.stacks.listResources({
          params: {
            stack: "a/b",
            stage: "prod/blue"
          }
        }),
        "https://api.example.com/state/stacks/a%2Fb/stages/prod%2Fblue/resources"
      )
    })

    it("returns relative urls when baseUrl is omitted", () => {
      const builder = HttpApiClient.urlBuilder(Api)

      strictEqual(builder.users.health(), "/health")
    })

    it("supports top-level endpoints", () => {
      const TopLevelApi = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("top", { topLevel: true })
            .add(
              HttpApiEndpoint.get("health", "/health")
            )
        )
        .prefix("/v1")

      const builder = HttpApiClient.urlBuilder(TopLevelApi, {
        baseUrl: "https://api.example.com"
      })

      strictEqual(builder.health(), "https://api.example.com/v1/health")
    })
  })

  it.effect("encodes path parameters when executing requests", () =>
    Effect.gen(function*() {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("stacks")
            .add(
              HttpApiEndpoint.get("listResources", "/state/stacks/:stack/stages/:stage/resources", {
                params: {
                  stack: Schema.String,
                  stage: Schema.String
                }
              })
            )
        )
      const httpClient = HttpClient.make((request, url) =>
        Effect.sync(() => {
          strictEqual(url.toString(), "https://api.example.com/state/stacks/a%2Fb/stages/prod%2Fblue/resources")
          return HttpClientResponse.fromWeb(request, new Response(null, { status: 204 }))
        })
      )
      const client = yield* HttpApiClient.makeWith(Api, {
        httpClient,
        baseUrl: "https://api.example.com"
      })

      yield* client.stacks.listResources({
        params: {
          stack: "a/b",
          stage: "prod/blue"
        },
        responseMode: "response-only"
      })
    }))
})
