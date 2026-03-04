import { Api } from "@todos/api/Api"
import { Effect, Layer, pipe } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Todos } from "../Todos.ts"

export const TodoHandlersNoDeps = HttpApiBuilder.group(
  Api,
  "todos",
  Effect.fn(function* (handlers) {
    const todos = yield* Todos

    return handlers
      .handle("list", () => Effect.orDie(todos.list))
      .handle("create", ({ payload }) => Effect.orDie(todos.create(payload)))
      .handle("get", ({ params: { id } }) =>
        pipe(
          todos.findById(id),
          Effect.catchReason(
            "TodosError",
            "TodoNotFound",
            (e) => Effect.fail(e),
            Effect.die,
          ),
        ),
      )
      .handle("update", ({ params, payload }) =>
        pipe(
          todos.update(params.id, payload),
          Effect.catchReason(
            "TodosError",
            "TodoNotFound",
            (e) => Effect.fail(e),
            Effect.die,
          ),
        ),
      )
      .handle("delete", ({ params }) =>
        pipe(
          todos.delete(params.id),
          Effect.catchReason(
            "TodosError",
            "TodoNotFound",
            (e) => Effect.fail(e),
            Effect.die,
          ),
        ),
      )
  }),
)

export const TodoHandlers = TodoHandlersNoDeps.pipe(
  Layer.provide(Todos.layer),
)
