/**
 * @since 4.0.0
 */
import * as Schema from "../../Schema.ts"
import type { Simplify } from "../../Types.ts"
import * as HttpApi from "./HttpApi.ts"
import * as HttpApiEndpoint from "./HttpApiEndpoint.ts"
import * as HttpApiGroup from "./HttpApiGroup.ts"
import type * as HttpApiSchema from "./HttpApiSchema.ts"

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
  const MethodAndUrl extends keyof Endpoints,
  Endpoints = EndpointMap<Groups>,
  Options extends {
    readonly options: any
    readonly return: any
  } = Endpoints[MethodAndUrl] extends { readonly options: infer O; readonly return: infer R } ? {
      readonly options: O
      readonly return: R
    } :
    { readonly options: {}; readonly return: Promise<never> }
>(
  methodAndUrl: MethodAndUrl,
  options: Options["options"]
) => Options["return"]

/**
 * @since 4.0.0
 * @category Models
 */
export type EndpointMap<Group extends HttpApiGroup.Any> = {
  readonly [Endpoint in HttpApiGroup.Endpoints<Group> as `${Endpoint["method"]} ${Endpoint["path"]}`]: {
    readonly options: EndpointOptions<
      Endpoint
    >
    readonly return: Promise<{
      readonly response: Response
      readonly json: () => Promise<
        Endpoint["successSchema"] extends undefined ? void : Endpoint["successSchema"]["Encoded"]
      >
    }>
  }
}

/**
 * @since 4.0.0
 * @category Models
 */
export type EndpointOptions<Endpoint extends HttpApiEndpoint.Any> = Endpoint extends HttpApiEndpoint.HttpApiEndpoint<
  infer _Name,
  infer _Method,
  infer _Path,
  infer _PathSchema,
  infer _UrlParams,
  infer _Payload,
  infer _Headers,
  infer _Success,
  infer _Error,
  infer _M,
  infer _MR
> ? Simplify<
    & (Endpoint["pathSchema"] extends undefined ? {} : {
      readonly path: _PathSchema["Encoded"]
    })
    & (Endpoint["urlParamsSchema"] extends undefined ? {} : {
      readonly urlParams: _UrlParams["Encoded"]
    })
    & (Endpoint["headersSchema"] extends undefined ? {} : {
      readonly headers: _Headers["Encoded"]
    })
    & (
      Endpoint["payloadSchema"] extends undefined ? {} : _Payload extends HttpApiSchema.Multipart<infer S> ? {
          // TODO: convert to string | Blob | File etc.
          readonly formData: S["Encoded"]
        } :
      {
        readonly json: _Payload["Encoded"]
      }
    )
  > :
  {}

const api = HttpApi.make("api").add(
  HttpApiGroup.make("users").add(HttpApiEndpoint.get("list", "/users", {
    urlParams: {
      foo: Schema.String
    }
  }))
).add(
  HttpApiGroup.make("posts").add(HttpApiEndpoint.post("create", "/posts", {
    urlParams: {
      draft: Schema.String
    },
    payload: Schema.Struct({
      title: Schema.String,
      content: Schema.String
    }),
    success: Schema.Struct({
      id: Schema.Number,
      title: Schema.String,
      content: Schema.String
    })
  })).add(HttpApiEndpoint.get("get", "/posts/:id", {
    path: {
      id: Schema.NumberFromString
    }
  }))
)

const client = make<typeof api>()

export const endpoint = client("POST /posts", {
  urlParams: { draft: "true" },
  json: {
    title: "My Post",
    content: "This is the content"
  }
})
