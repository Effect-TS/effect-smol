// Measures HttpApiGroup.Endpoints extraction from one type-only group with 50 endpoints.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import type { Group } from "./_grouped-api-types.ts"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

type Assert<T extends true> = T
type Endpoints = HttpApiGroup.Endpoints<Group<50>>

export type HasLastEndpoint = Assert<"getUser0050" extends HttpApiEndpoint.Identifier<Endpoints> ? true : false>
