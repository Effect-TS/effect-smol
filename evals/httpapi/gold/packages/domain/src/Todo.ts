import { Schema, SchemaTransformation } from "effect"
import { Model } from "effect/unstable/schema"

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"))
export type TodoId = typeof TodoId.Type

const BooleanFromNumber = Schema.Literals([0, 1]).pipe(
  Schema.decodeTo(Schema.Boolean, SchemaTransformation.transform({
    decode: (n) => n === 1,
    encode: (b) => (b ? 1 : 0)
  }))
)

const Boolean = Model.Field({
  select: BooleanFromNumber,
  insert: BooleanFromNumber,
  update: BooleanFromNumber,
  json: Schema.Boolean,
  jsonCreate: Schema.Boolean,
  jsonUpdate: Schema.Boolean,
})

export class Todo extends Model.Class<Todo>("domain/Todo")({
  id: Model.GeneratedByApp(TodoId),
  title: Schema.String,
  completed: Boolean,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}
