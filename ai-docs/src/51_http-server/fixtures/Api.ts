import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { UsersApiGroup } from "./Users/api.ts"

// Top level groups are added to the root of the derived HttpApiClient.
//
// `client.health()`
export class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", {
    success: HttpApiSchema.NoContent
  })
) {}

// Defined the root API, which combines all of the groups together. This is the
// API that you will serve and generate clients for. You can also annotate the
// API with OpenAPI metadata.
export class Api extends HttpApi.make("user-api")
  .add(UsersApiGroup)
  .add(SystemApi)
  .annotateMerge(OpenApi.annotations({
    title: "Acme User API"
  }))
{}
