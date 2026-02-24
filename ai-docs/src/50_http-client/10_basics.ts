/**
 * @title Getting started with HttpClient
 *
 * Define a service that uses the HttpClient module to fetch data from an external API
 */
import { Effect, flow, Layer, Schedule, Schema, ServiceMap } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http"

class Todo extends Schema.Class<Todo>("Todo")({
  userId: Schema.Number,
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean
}) {}

class JsonPlaceholder extends ServiceMap.Service<JsonPlaceholder, {
  readonly getTodo: (id: number) => Effect.Effect<Todo, JsonPlaceholderError>
  readonly createTodo: (todo: Omit<Todo, "id">) => Effect.Effect<Todo, JsonPlaceholderError>
}>()("app/JsonPlaceholder") {
  static readonly layer = Layer.effect(
    JsonPlaceholder,
    Effect.gen(function*() {
      // Access the HttpClient service, and apply some common middleware to all
      // requests:
      const client = (yield* HttpClient.HttpClient).pipe(
        // Add a base URL to all requests made with this client, and set the
        // Accept header to expect JSON responses
        HttpClient.mapRequest(flow(
          HttpClientRequest.prependUrl("https://jsonplaceholder.typicode.com"),
          HttpClientRequest.acceptJson
        )),
        // Fail if the response status is not 2xx
        HttpClient.filterStatusOk,
        // Retry transient errors (network issues, 5xx responses) with an
        // exponential backoff
        HttpClient.retryTransient({
          schedule: Schedule.exponential(100).pipe(
            Schedule.either(Schedule.spaced(1000))
          ),
          times: 5
        })
      )

      // Use the HttpClient to fetch a todo item by id, and decode the response
      // using the Todo schema.
      const getTodo = (id: number) =>
        client.get(`/todos/${id}`).pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo)),
          // Map errors to our service-specific error type
          Effect.mapError((cause) => new JsonPlaceholderError({ cause })),
          // Add a span to trace the getTodo operation, including the id as an
          // attribute
          Effect.withSpan("JsonPlaceholder.getTodo", { attributes: { id } })
        )

      // You can use the HttpClientRequest module to build up more complex
      // requests:
      const createTodo = (todo: Omit<Todo, "id">) =>
        HttpClientRequest.post("/todos").pipe(
          HttpClientRequest.bodyJsonUnsafe(todo),
          client.execute,
          Effect.flatMap(HttpClientResponse.schemaBodyJson(Todo)),
          Effect.mapError((cause) => new JsonPlaceholderError({ cause })),
          Effect.withSpan("JsonPlaceholder.createTodo", { attributes: { title: todo.title } })
        )

      return JsonPlaceholder.of({ getTodo, createTodo })
    })
  ).pipe(
    // Provide the fetch-based HttpClient implementation
    Layer.provide(FetchHttpClient.layer)
  )
}

export class JsonPlaceholderError extends Schema.TaggedErrorClass<JsonPlaceholderError>()("JsonPlaceholderError", {
  cause: Schema.Defect
}) {}

// You can then use the JsonPlaceholder service elsewhere
export const program = Effect.gen(function*() {
  const api = yield* JsonPlaceholder
  const todo = yield* api.getTodo(1)

  yield* Effect.log(`Loaded todo #${todo.id}: ${todo.title}`)
})
