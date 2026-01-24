import { OpenAiClient } from "@effect/ai-openai"
import { NodeHttpClient, NodeRuntime } from "@effect/platform-node"
import { Console, Effect, Layer, Stream } from "effect"

const program = Effect.gen(function*() {
  const client = yield* OpenAiClient.OpenAiClient

  const stream = client.createResponseStream({
    model: "gpt-4o-mini",
    input: [
      {
        role: "user",
        content: "What is the current weather in San Francisco?"
      }
    ],
    tools: [
      {
        type: "web_search_preview"
      }
    ]
  })

  yield* stream.pipe(
    Stream.runForEach(Effect.fnUntraced(function*(event) {
      switch (event.type) {
        case "response.output_text.delta": {
          process.stdout.write(event.delta)
          break
        }
        case "response.completed": {
          yield* Console.log("\n--- Response completed ---")
          break
        }
      }
    }))
  )
})

const MainLayer = OpenAiClient.layerConfig().pipe(
  Layer.provide(NodeHttpClient.layerUndici)
)

program.pipe(
  Effect.provide(MainLayer),
  NodeRuntime.runMain
)
