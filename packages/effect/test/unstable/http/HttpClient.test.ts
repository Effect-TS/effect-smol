import { describe, it } from "@effect/vitest"
import { strictEqual } from "@effect/vitest/utils"
import { Effect, Ref } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"

const makeStatusClient = Effect.fnUntraced(function*(status: number) {
  const attempts = yield* Ref.make(0)
  const client = HttpClient.make((request) =>
    Effect.gen(function*() {
      yield* Ref.update(attempts, (n) => n + 1)
      return HttpClientResponse.fromWeb(request, new Response(null, { status }))
    })
  )
  return { attempts, client } as const
})

describe("HttpClient", () => {
  describe("retryTransient", () => {
    it.effect("retries transient responses with retryOn errors-and-responses", () =>
      Effect.gen(function*() {
        const { attempts, client } = yield* makeStatusClient(503)
        const retryClient = client.pipe(HttpClient.retryTransient({ retryOn: "errors-and-responses", times: 2 }))
        yield* retryClient.get("http://test/").pipe(Effect.ignore)
        strictEqual(yield* Ref.get(attempts), 3)
      }))

    it.effect("does not retry transient responses with retryOn errors-only", () =>
      Effect.gen(function*() {
        const { attempts, client } = yield* makeStatusClient(503)
        const retryClient = client.pipe(HttpClient.retryTransient({ retryOn: "errors-only", times: 2 }))
        yield* retryClient.get("http://test/").pipe(Effect.ignore)
        strictEqual(yield* Ref.get(attempts), 1)
      }))
  })
})
