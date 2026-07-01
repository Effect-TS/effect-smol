// Measures only the middleware requirement side of HttpApiClient.group's return type for one 1000-endpoint group.
import { Effect } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { UsersGroup } from "./_client-methods-1000.ts"

HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type GroupClientEffect = Effect.Effect<
  unknown,
  never,
  HttpApiGroup.MiddlewareClient<UsersGroup>
>

export type GeneratedGroupClient = GroupClientEffect
export type GroupClientRequirements = HttpApiGroup.MiddlewareClient<UsersGroup>
