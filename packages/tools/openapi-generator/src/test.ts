import * as Data from "effect/data/Data"
import * as Effect from "effect/Effect"
import type * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientError from "effect/unstable/http/HttpClientError"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse"

export interface ProductsParams {
  readonly "category"?: string | undefined
  readonly "search"?: string | undefined
  readonly "min_price"?: number | undefined
  readonly "max_price"?: number | undefined
}

export interface Product {
  readonly "id": string
  readonly "name": string
  readonly "description"?: string | undefined
  readonly "price": number
  readonly "category": string
  readonly "image_url"?: string | undefined
  readonly "stock": number
  readonly "created_at"?: string | undefined
  readonly "updated_at"?: string | undefined
}

export type Products200 = ReadonlyArray<Product>

export interface CartItem {
  readonly "product_id": string
  readonly "quantity": number
}

export type Cart200 = ReadonlyArray<CartItem>

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered"

export interface Order {
  readonly "id": string
  readonly "items": ReadonlyArray<CartItem>
  readonly "total_amount": number
  readonly "status": OrderStatus
  readonly "created_at": string
}

export type Orders200 = ReadonlyArray<Order>

export interface Address {
  readonly "line1": string
  readonly "line2"?: string | undefined
  readonly "city": string
  readonly "state": string
  readonly "postal_code": string
  readonly "country": string
}

export type Addresses200 = ReadonlyArray<Address>

export const make = (
  httpClient: HttpClient.HttpClient,
  options: {
    readonly transformClient?: ((client: HttpClient.HttpClient) => Effect.Effect<HttpClient.HttpClient>) | undefined
  } = {}
): Client => {
  const unexpectedStatus = (response: HttpClientResponse.HttpClientResponse) =>
    Effect.flatMap(
      Effect.orElseSucceed(response.json, () => "Unexpected status code"),
      (description) =>
        Effect.fail(
          new HttpClientError.ResponseError({
            request: response.request,
            response,
            reason: "StatusCode",
            description: typeof description === "string" ? description : JSON.stringify(description)
          })
        )
    )
  const withResponse: <A, E>(
    f: (response: HttpClientResponse.HttpClientResponse) => Effect.Effect<A, E>
  ) => (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<any, any> = options.transformClient
    ? (f) => (request) =>
      Effect.flatMap(
        Effect.flatMap(options.transformClient!(httpClient), (client) => client.execute(request)),
        f
      )
    : (f) => (request) => Effect.flatMap(httpClient.execute(request), f)
  const decodeSuccess = <A>(response: HttpClientResponse.HttpClientResponse) =>
    response.json as Effect.Effect<A, HttpClientError.ResponseError>
  const decodeVoid = (_response: HttpClientResponse.HttpClientResponse) => Effect.void
  const decodeError = <Tag extends string, E>(tag: Tag) =>
  (
    response: HttpClientResponse.HttpClientResponse
  ): Effect.Effect<
    never,
    ClientError<Tag, E> | HttpClientError.ResponseError
  > =>
    Effect.flatMap(
      response.json as Effect.Effect<E, HttpClientError.ResponseError>,
      (cause) => Effect.fail(ClientError(tag, cause, response))
    )
  const onRequest = (
    successCodes: ReadonlyArray<string>,
    errorCodes?: Record<string, string>
  ) => {
    const cases: any = { orElse: unexpectedStatus }
    for (const code of successCodes) {
      cases[code] = decodeSuccess
    }
    if (errorCodes) {
      for (const [code, tag] of Object.entries(errorCodes)) {
        cases[code] = decodeError(tag)
      }
    }
    if (successCodes.length === 0) {
      cases["2xx"] = decodeVoid
    }
    return withResponse(HttpClientResponse.matchStatus(cases) as any)
  }
  return {
    httpClient,
    "GET/products": (options) =>
      HttpClientRequest.get(`/products`).pipe(
        HttpClientRequest.setUrlParams({
          "category": options?.["category"] as any,
          "search": options?.["search"] as any,
          "min_price": options?.["min_price"] as any,
          "max_price": options?.["max_price"] as any
        }),
        onRequest(["2xx"])
      ),
    "GET/products/{id}": (id) =>
      HttpClientRequest.get(`/products/${id}`).pipe(
        onRequest(["2xx"])
      ),
    "GET/cart": () =>
      HttpClientRequest.get(`/cart`).pipe(
        onRequest(["2xx"])
      ),
    "GET/orders": () =>
      HttpClientRequest.get(`/orders`).pipe(
        onRequest(["2xx"])
      ),
    "GET/orders/{orderId}": (orderId) =>
      HttpClientRequest.get(`/orders/${orderId}`).pipe(
        onRequest(["2xx"])
      ),
    "GET/addresses": () =>
      HttpClientRequest.get(`/addresses`).pipe(
        onRequest(["2xx"])
      )
  }
}

export interface Client {
  readonly httpClient: HttpClient.HttpClient
  /**
   * List all products with filters
   */
  readonly "GET/products": (
    options?: ProductsParams | undefined
  ) => Effect.Effect<Products200, HttpClientError.HttpClientError>
  /**
   * Get product details by ID
   */
  readonly "GET/products/{id}": (id: string) => Effect.Effect<Product, HttpClientError.HttpClientError>
  /**
   * Get current user's cart
   */
  readonly "GET/cart": () => Effect.Effect<Cart200, HttpClientError.HttpClientError>
  /**
   * List your past orders
   */
  readonly "GET/orders": () => Effect.Effect<Orders200, HttpClientError.HttpClientError>
  /**
   * Get order details
   */
  readonly "GET/orders/{orderId}": (orderId: string) => Effect.Effect<Order, HttpClientError.HttpClientError>
  /**
   * Get your saved addresses
   */
  readonly "GET/addresses": () => Effect.Effect<Addresses200, HttpClientError.HttpClientError>
}

export interface ClientError<Tag extends string, E> {
  readonly _tag: Tag
  readonly request: HttpClientRequest.HttpClientRequest
  readonly response: HttpClientResponse.HttpClientResponse
  readonly cause: E
}

class ClientErrorImpl extends Data.Error<{
  _tag: string
  cause: any
  request: HttpClientRequest.HttpClientRequest
  response: HttpClientResponse.HttpClientResponse
}> {}

export const ClientError = <Tag extends string, E>(
  tag: Tag,
  cause: E,
  response: HttpClientResponse.HttpClientResponse
): ClientError<Tag, E> =>
  new ClientErrorImpl({
    _tag: tag,
    cause,
    response,
    request: response.request
  }) as any
