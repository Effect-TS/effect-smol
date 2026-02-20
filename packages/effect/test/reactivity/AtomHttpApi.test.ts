import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Ref, Schema } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"
import type * as HttpClientError from "effect/unstable/http/HttpClientError"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { AtomHttpApi, AtomRegistry } from "effect/unstable/reactivity"

const Api = HttpApi.make("api").add(
  HttpApiGroup.make("group").add(
    HttpApiEndpoint.get("get", "/users/:id", {
      params: {
        id: Schema.FiniteFromString
      },
      query: {
        page: Schema.FiniteFromString
      }
    })
  )
)

describe("AtomHttpApi", () => {
  it.effect("query forwards params and query to HttpApiClient", () =>
    Effect.gen(function*() {
      const requestRef = yield* Ref.make<
        {
          readonly url: string
          readonly urlParams: ReadonlyArray<readonly [string, string]>
        } | undefined
      >(undefined)

      const httpClient = HttpClient.makeWith(
        Effect.fnUntraced(function*(requestEffect) {
          const request = yield* requestEffect
          yield* Ref.set(requestRef, {
            url: request.url,
            urlParams: request.urlParams.params
          })
          return HttpClientResponse.fromWeb(request, new Response(null, { status: 204 }))
        }),
        Effect.succeed as HttpClient.HttpClient.Preprocess<HttpClientError.HttpClientError, never>
      )

      const Client = AtomHttpApi.Service()("Client", {
        api: Api,
        httpClient: Layer.succeed(HttpClient.HttpClient, httpClient)
      })

      const atom = Client.query("group", "get", {
        params: { id: 1 },
        query: { page: 2 }
      })

      const registry = AtomRegistry.make()
      registry.get(atom)
      yield* Effect.yieldNow
      yield* Effect.yieldNow
      yield* Effect.yieldNow

      const request = yield* Ref.get(requestRef)
      if (request === undefined) {
        assert.fail("expected query request to execute")
      }
      assert.strictEqual(request.url, "/users/1")
      assert.deepStrictEqual(request.urlParams, [["page", "2"]])
    }))
})
