import { Schema } from "effect"
import { Model } from "effect/unstable/schema"

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"))
export type TodoId = typeof TodoId.Type

export class Todo extends Model.Class<Todo>("domain/Todo")({
  id: Model.GeneratedByApp(TodoId),
  title: Schema.String,
  completed: Schema.Boolean,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}
