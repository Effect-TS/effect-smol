import { Schema } from "effect"
import { TodoId } from "./Todo.ts"

export class TodoNotFound extends Schema.TaggedErrorClass<TodoNotFound>()(
  "TodoNotFound",
  {
    id: TodoId,
  },
) {
  readonly message = `Todo with id ${this.id} not found`
}

export class UnknownTodoError extends Schema.TaggedErrorClass<UnknownTodoError>()(
  "UnknownTodoError",
  {
    cause: Schema.Defect,
  },
) {
  readonly message = `An unknown error occurred`
}

export class TodosError extends Schema.TaggedErrorClass<TodosError>()(
  "TodosError",
  {
    reason: Schema.Union([TodoNotFound, UnknownTodoError]),
  },
) {
  readonly cause = this.reason
  readonly message = this.reason.message
}
