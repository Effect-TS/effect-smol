import { Api } from "@todos/api/Api"
import { Effect, Layer } from "effect"
import { HttpApiBuilder, HttpApiGroup } from "effect/unstable/httpapi"
import { Todos } from "../Todos.ts"

export const TodoHandlersLayer = HttpApiBuilder.group(
  Api,
  "todos",
  Effect.fn(function* (handlers) {
    const todos = yield* Todos
    return handlers
      .handle("list", () => Effect.orDie(todos.list))
      .handle("create", ({ payload }) => Effect.orDie(todos.create(payload)))
      .handle("get", ({ payload: { id } }) =>
        todos
          .findById(id)
          .pipe(
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
