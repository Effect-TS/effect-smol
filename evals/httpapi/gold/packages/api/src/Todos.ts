import { Todo, TodoId } from "@todos/domain/Todo"
import { TodoNotFound } from "@todos/domain/TodosError"
import { Schema } from "effect"
import {
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiSchema,
} from "effect/unstable/httpapi"

export class TodosApiGroup extends HttpApiGroup.make("todos")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: Schema.Array(Todo.json),
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Todo.jsonCreate,
      success: Todo.json,
    }),
    HttpApiEndpoint.get("get", "/:id", {
      params: {
        id: TodoId,
      },
      error: TodoNotFound.pipe(HttpApiSchema.status(404)),
      success: Todo.json,
    }),
    HttpApiEndpoint.put("update", "/:id", {
      params: {
        id: TodoId,
      },
      payload: Todo.jsonUpdate,
      error: TodoNotFound.pipe(HttpApiSchema.status(404)),
      success: Todo.json,
    }),
    HttpApiEndpoint.delete("delete", "/:id", {
      params: {
        id: TodoId,
      },
      error: TodoNotFound.pipe(HttpApiSchema.status(404)),
    }),
  )
  .prefix("/todos") {}
