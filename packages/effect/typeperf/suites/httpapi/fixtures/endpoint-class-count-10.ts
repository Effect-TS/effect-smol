// Measures class-like endpoint declaration for 10 same-shaped endpoints.
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"

Schema.String
HttpApi.make("Api")
HttpApiGroup.make("users")
HttpApiEndpoint.get("warmup", "/warmup")

const Params = Schema.Struct({
  id: Schema.FiniteFromString
})

const User = Schema.Struct({
  id: Schema.String,
  name: Schema.String
})

class GetUser0001 extends HttpApiEndpoint.get("getUser0001", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0002 extends HttpApiEndpoint.get("getUser0002", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0003 extends HttpApiEndpoint.get("getUser0003", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0004 extends HttpApiEndpoint.get("getUser0004", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0005 extends HttpApiEndpoint.get("getUser0005", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0006 extends HttpApiEndpoint.get("getUser0006", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0007 extends HttpApiEndpoint.get("getUser0007", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0008 extends HttpApiEndpoint.get("getUser0008", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0009 extends HttpApiEndpoint.get("getUser0009", "/users/:id", {
  params: Params,
  success: User
}) {}

class GetUser0010 extends HttpApiEndpoint.get("getUser0010", "/users/:id", {
  params: Params,
  success: User
}) {}

const api = HttpApi.make("Api").add(
  HttpApiGroup.make("users").add(
    GetUser0001,
    GetUser0002,
    GetUser0003,
    GetUser0004,
    GetUser0005,
    GetUser0006,
    GetUser0007,
    GetUser0008,
    GetUser0009,
    GetUser0010
  )
)

type Groups = typeof api extends HttpApi.HttpApi<string, infer Groups> ? Groups : never
type Endpoints = HttpApiGroup.Endpoints<Groups>

export type Api = typeof api
export type EndpointIdentifiers = HttpApiEndpoint.Identifier<Endpoints>
export type EndpointRequests = HttpApiEndpoint.Request<Endpoints>
export type ServerServices = HttpApiEndpoint.ServerServices<Endpoints>
export type ClientServices = HttpApiEndpoint.ClientServices<Endpoints>
