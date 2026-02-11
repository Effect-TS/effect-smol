import { OpenAiClient, OpenAiLanguageModel } from "@effect/ai-openai-compat"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Redacted, Stream } from "effect"
import { LanguageModel } from "effect/unstable/ai"
import { HttpClient, type HttpClientError, HttpClientResponse } from "effect/unstable/http"

describe("OpenAiLanguageModel", () => {
  describe("streamText", () => {
    it.effect("ignores malformed known-type events decoded via unknown fallback", () =>
      Effect.gen(function*() {
        const partsChunk = yield* LanguageModel.streamText({ prompt: "test" }).pipe(
          Stream.runCollect,
          Effect.provide(OpenAiLanguageModel.model("gpt-4o-mini"))
        )

        const parts = Array.from(partsChunk)

        assert.isFalse(parts.some((part) => part.type === "response-metadata"))

        const finish = parts.find((part) => part.type === "finish")
        assert.isDefined(finish)
        if (finish?.type === "finish") {
          assert.strictEqual(finish.reason, "stop")
        }
      }).pipe(
        Effect.provide(makeTestLayer([
          { type: "response.created" },
          {
            type: "response.completed",
            sequence_number: 2,
            response: {
              id: "resp_test123",
              model: "gpt-4o-mini",
              created_at: 1,
              output: []
            }
          }
        ]))
      ))
  })
})

const makeTestLayer = (events: ReadonlyArray<unknown>) =>
  OpenAiClient.layer({ apiKey: Redacted.make("sk-test-key") }).pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, makeHttpClient(events)))
  )

const makeHttpClient = (events: ReadonlyArray<unknown>) =>
  HttpClient.makeWith(
    Effect.fnUntraced(function*(requestEffect) {
      const request = yield* requestEffect
      return HttpClientResponse.fromWeb(
        request,
        new Response(toSseBody(events), {
          status: 200,
          headers: { "content-type": "text/event-stream" }
        })
      )
    }),
    Effect.succeed as HttpClient.HttpClient.Preprocess<HttpClientError.HttpClientError, never>
  )

const toSseBody = (events: ReadonlyArray<unknown>): string =>
  events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("")
