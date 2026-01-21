/**
 * @since 4.0.0
 */
import * as HttpApi from "./HttpApi.ts"
import * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
import * as HttpApiGroup from "./HttpApiGroup.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <
  Api extends HttpApi.Any
>(): HttpApiClientFetch<Api extends HttpApi.HttpApi<infer _Id, infer Groups> ? Groups : never> => {
  return {} as any
}

/**
 * @since 4.0.0
 * @category Models
 */
export type HttpApiClientFetch<Groups extends HttpApiGroup.Any> = <
  const GroupName extends HttpApiGroup.Name<Groups>,
  const MethodAndUrl extends keyof Endpoints,
  Endpoints = GroupEndpoints<HttpApiGroup.WithName<Groups, GroupName>>,
  Endpoint = Endpoints[MethodAndUrl]
>(
  groupName: GroupName,
  methodAndUrl: MethodAndUrl
) => Endpoint

/**
 * @since 4.0.0
 * @category Models
 */
export type GroupEndpoints<Group extends HttpApiGroup.Any> = {
  readonly [Endpoint in HttpApiGroup.Endpoints<Group> as `${Endpoint["method"]} ${Endpoint["path"]}`]: Endpoint
}

const api = HttpApi.make("api").add(HttpApiGroup.make("users").add(HttpApiEndpoint.get("list", "/users")))

const client = make<typeof api>()

const endpoint = client("users", "GET /users")
