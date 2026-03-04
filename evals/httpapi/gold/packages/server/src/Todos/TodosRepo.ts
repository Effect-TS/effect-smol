import { Todo, type TodoId } from "@todos/domain/Todo"
import { TodoNotFound } from "@todos/domain/TodosError"
import { Effect, Layer, Schema, ServiceMap } from "effect"
import { SqlClient, SqlError, SqlModel, SqlSchema } from "effect/unstable/sql"
import { SqlClientLayer } from "../Sql.ts"

export class TodosRepoError extends Schema.TaggedErrorClass<TodosRepoError>()(
  "TodosRepoError",
  {
    reason: Schema.Union([TodoNotFound, SqlError.SqlError]),
  },
) {}

export class TodosRepo extends ServiceMap.Service<
  TodosRepo,
  {
    readonly list: Effect.Effect<ReadonlyArray<Todo>, TodosRepoError>
    findById(id: TodoId): Effect.Effect<Todo, TodosRepoError>
    insert(todo: typeof Todo.insert.Type): Effect.Effect<Todo, TodosRepoError>
    update(todo: typeof Todo.update.Type): Effect.Effect<Todo, TodosRepoError>
    delete(id: TodoId): Effect.Effect<void, TodosRepoError>
  }
>()("@todos/server/Todos/TodosRepo") {
  static readonly layer = Layer.effect(
    TodosRepo,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const repo = yield* SqlModel.makeRepository(Todo, {
        tableName: "todos",
        idColumn: "id",
        spanPrefix: "TodosRepo",
      })

      const list = SqlSchema.findAll({
        Request: Schema.Void,
        Result: Todo,
        execute: () => sql`select * from todos`,
      })().pipe(
        Effect.catchTags(
          {
            SqlError: (reason) => Effect.fail(new TodosRepoError({ reason })),
          },
          (e) => Effect.die(e),
        ),
        Effect.withSpan("TodosRepo.list"),
      )

      return TodosRepo.of({
        list,
        findById: (id) =>
          repo.findById(id).pipe(
            Effect.catchTags(
              {
                NoSuchElementError: () =>
                  Effect.fail(
                    new TodosRepoError({ reason: new TodoNotFound({ id }) }),
                  ),
                SqlError: (reason) =>
                  Effect.fail(new TodosRepoError({ reason })),
              },
              (e) => Effect.die(e),
            ),
          ),
        insert: (todo) =>
          repo.insert(todo).pipe(
            Effect.catchTag(
              "SqlError",
              (reason) => Effect.fail(new TodosRepoError({ reason })),
              (e) => Effect.die(e),
            ),
          ),
        update: (todo) =>
          repo.update(todo).pipe(
            Effect.catchTag(
              "SqlError",
              (reason) => Effect.fail(new TodosRepoError({ reason })),
              (e) => Effect.die(e),
            ),
          ),
        delete: (id) =>
          repo.delete(id).pipe(
            Effect.catchTag(
              "SqlError",
              (reason) => Effect.fail(new TodosRepoError({ reason })),
              (e) => Effect.die(e),
            ),
          ),
      })
    }),
  ).pipe(Layer.provide(SqlClientLayer))
}
