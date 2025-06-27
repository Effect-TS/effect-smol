import * as Effect from "#dist/effect/Effect"
import * as FetchHttpClient from "#dist/effect/unstable/http/FetchHttpClient"
import * as HttpClient from "#dist/effect/unstable/http/HttpClient"

Effect.gen(function*() {
  const client = yield* HttpClient.HttpClient

  const res = yield* client.get("https://jsonplaceholder.typicode.com/posts/1")
  yield* res.json
}).pipe(
  Effect.provide(FetchHttpClient.layer),
  Effect.runPromise
)
