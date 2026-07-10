// Measures HttpApiBuilder.endpoint selection from one declared group with 500 same-shaped endpoints.
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { api } from "./_grouped-api-500.ts"

export const httpApp = HttpApiBuilder.endpoint(
  api,
  "users",
  "getUser0500",
  ({ params }) => Effect.succeed({ id: String(params.id), name: "Ada" })
)

export type BuilderEndpoint = typeof httpApp
