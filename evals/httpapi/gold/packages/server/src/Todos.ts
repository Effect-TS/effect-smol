import { Todo, TodoId } from "@todos/domain/Todo"
import { TodosError, UnknownTodoError } from "@todos/domain/TodosError"
import { Effect, ServiceMap, Layer, pipe } from "effect"
import { TodosRepo, type TodosRepoError } from "./Todos/TodosRepo.ts"

export class Todos extends ServiceMap.Service<
  Todos,
  {
    list: Effect.Effect<ReadonlyArray<Todo>, TodosError>
    create(todo: typeof Todo.jsonCreate.Type): Effect.Effect<Todo, TodosError>
    findById(id: TodoId): Effect.Effect<Todo, TodosError>
    update(
      id: TodoId,
      todo: typeof Todo.jsonUpdate.Type,
    ): Effect.Effect<Todo, TodosError>
    delete(id: TodoId): Effect.Effect<void, TodosError>
  }
>()("@todos/server/Todos") {
  static readonly layerNoDeps = Layer.effect(
    Todos,
    Effect.gen(function* () {
      const repo = yield* TodosRepo

      const repoErrorToTodosError = (error: TodosRepoError): TodosError => {
        switch (error.reason._tag) {
          case "TodoNotFound":
            return new TodosError({ reason: error.reason })
          case "SqlError":
            return new TodosError({
              reason: new UnknownTodoError({ cause: error.reason }),
            })
        }
      }

      return Todos.of({
        list: repo.list.pipe(
          Effect.mapError(repoErrorToTodosError),
          Effect.withSpan("Todos.list"),
        ),
        findById: Effect.fn("Todos.findById")(function* (id) {
          yield* Effect.annotateCurrentSpan({ id })
          return yield* pipe(
            repo.findById(id),
            Effect.mapError(repoErrorToTodosError),
          )
        }),
        create: Effect.fn("Todos.create")(function* (todo) {
          return yield* pipe(
            repo.insert(
              Todo.insert.makeUnsafe({
                ...todo,
                id: TodoId.makeUnsafe(crypto.randomUUID()),
              }),
            ),
            Effect.mapError(repoErrorToTodosError),
          )
        }),
        update: Effect.fn("Todos.update")(function* (id, todo) {
          yield* Effect.annotateCurrentSpan({ id })
          return yield* pipe(
            repo.update(
              Todo.update.makeUnsafe({
                ...todo,
                id,
              }),
            ),
            Effect.mapError(repoErrorToTodosError),
          )
        }),
        delete: Effect.fn("Todos.delete")(function* (id) {
          yield* Effect.annotateCurrentSpan({ id })
          return yield* pipe(
            repo.delete(id),
            Effect.mapError(repoErrorToTodosError),
          )
        }),
      })
    }),
  )

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(TodosRepo.layer))
}
