import { Schema } from "effect"
import { TodoId } from "./Todo.ts"

export class TodoNotFound extends Schema.TaggedErrorClass<TodoNotFound>()(
  "TodoNotFound",
  {
    id: TodoId,
  },
) {}

export class UnknownTodoError extends Schema.TaggedErrorClass<UnknownTodoError>()(
  "UnknownTodoError",
  {
    cause: Schema.Defect,
  },
) {}

export class TodosError extends Schema.TaggedErrorClass<TodosError>()(
  "TodosError",
  {
    reason: Schema.Union([TodoNotFound, UnknownTodoError]),
  },
) {}
