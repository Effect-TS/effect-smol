import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { FetchHttpClient, HttpClient } from "effect/unstable/http"

Effect.gen(function*() {
  const client = yield* HttpClient.HttpClient

  const res = yield* client.get("https://jsonplaceholder.typicode.com/posts/1")
  const json = yield* res.json

  yield* Effect.log(json)
}).pipe(
  Effect.provide(FetchHttpClient.layer),
  NodeRuntime.runMain
)
