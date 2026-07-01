// Measures building a single HttpApiBuilder endpoint from a group with 1000 endpoints.
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { api } from "./_client-methods-1000.ts"

export const httpApp = HttpApiBuilder.endpoint(
  api,
  "users",
  "getUser1000",
  ({ params }) => Effect.succeed({ id: String(params.id), name: "Ada" })
)

export type BuilderEndpoint = typeof httpApp
