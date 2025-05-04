import { NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import * as FetchHttpClient from "effect/unstable/FetchHttpClient"
import * as HttpClient from "effect/unstable/HttpClient"

Effect.gen(function*() {
  const client = yield* HttpClient.HttpClient

  const res = yield* client.get("https://jsonplaceholder.typicode.com/posts/1")
  const json = yield* res.json

  yield* Effect.log(json)
}).pipe(
  Effect.provide(FetchHttpClient.layer),
  NodeRuntime.runMain
)
