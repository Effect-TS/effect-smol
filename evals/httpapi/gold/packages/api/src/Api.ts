import { HttpApi, OpenApi } from "effect/unstable/httpapi"
import { TodosApiGroup } from "./Todos.ts"

export class Api extends HttpApi.make("api")
  .add(TodosApiGroup)
  .annotateMerge(
    OpenApi.annotations({
      title: "Todos API",
      version: "1.0.0",
      description: "An API for managing todos",
    }),
  ) {}
