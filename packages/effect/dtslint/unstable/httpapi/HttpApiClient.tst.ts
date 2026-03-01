import { Effect, Schema } from "effect"
import { FetchHttpClient, HttpClient, type HttpClientError, type HttpClientResponse } from "effect/unstable/http"
import {
  HttpApi,
  HttpApiClient,
  HttpApiEndpoint,
  type HttpApiError,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema
} from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiClient", () => {
  describe("path option", () => {
    it("should accept a record of fields", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                params: {
                  id: Schema.FiniteFromString
                }
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<Parameters<typeof f>[0]>().type.toBe<
        { readonly params: { readonly id: number }; readonly withResponse?: boolean }
      >()
    })
  })

  describe("query option", () => {
    it("should accept a record of fields", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                query: {
                  id: Schema.FiniteFromString
                }
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<Parameters<typeof f>[0]>().type.toBe<
        { readonly query: { readonly id: number }; readonly withResponse?: boolean }
      >()
    })
  })

  describe("urlBuilder", () => {
    it("should use method/path keys with encoded params and query", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("users")
            .add(
              HttpApiEndpoint.get("getUser", "/users/:id", {
                params: {
                  id: Schema.FiniteFromString
                },
                query: {
                  page: Schema.FiniteFromString
                }
              }),
              HttpApiEndpoint.get("health", "/health")
            )
        )

      const builder = HttpApiClient.urlBuilder<typeof Api>({
        baseUrl: "https://api.example.com"
      })

      const getUserUrl = builder("users", "GET /users/:id", {
        params: { id: "123" },
        query: { page: "1" }
      })

      expect<typeof getUserUrl>().type.toBe<string>()

      const healthUrl = builder("users", "GET /health")

      expect<typeof healthUrl>().type.toBe<string>()

      // @ts-expect-error!
      builder("users", "GET /users/:id", { params: { id: 123 }, query: { page: "1" } })

      // @ts-expect-error!
      builder("users", "GET /users/:id", { params: { id: "123" }, query: { page: 1 } })

      // @ts-expect-error!
      builder("users", "POST /users/:id", { params: { id: "123" }, query: { page: "1" } })
    })
  })

  describe("headers option", () => {
    it("should accept a record of fields", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                headers: {
                  id: Schema.FiniteFromString
                }
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<Parameters<typeof f>[0]>().type.toBe<
        { readonly headers: { readonly id: number }; readonly withResponse?: boolean }
      >()
    })
  })

  describe("payload option", () => {
    it("should default to void", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a")
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<Parameters<typeof f>[0]>().type.toBe<void | { readonly withResponse?: boolean } | undefined>()
    })

    it("should accept a record of fields", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                payload: {
                  id: Schema.FiniteFromString
                }
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<Parameters<typeof f>[0]>().type.toBe<
        { readonly payload: { readonly id: number }; readonly withResponse?: boolean }
      >()
    })

    it("should accept a multipart", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.post("a", "/a", {
                payload: Schema.String.pipe(HttpApiSchema.asMultipart())
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<Parameters<typeof f>[0]>().type.toBe<
        { readonly payload: FormData; readonly withResponse?: boolean }
      >()
    })

    it("should accept a multipart stream", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.post("a", "/a", {
                payload: Schema.String.pipe(HttpApiSchema.asMultipartStream())
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<Parameters<typeof f>[0]>().type.toBe<
        { readonly payload: FormData; readonly withResponse?: boolean }
      >()
    })
  })

  describe("success option", () => {
    it("should accept a schema", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                success: Schema.Struct({ a: Schema.FiniteFromString })
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<ReturnType<typeof f>>().type.toBe<
        Effect.Effect<
          { readonly a: number } | [{ readonly a: number }, HttpClientResponse.HttpClientResponse],
          HttpApiError.HttpApiSchemaError | HttpClientError.HttpClientError | Schema.SchemaError
        >
      >()
    })

    it("should accept an array of schemas", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                success: [
                  Schema.Struct({ a: Schema.FiniteFromString }), // application/json
                  Schema.String.pipe(HttpApiSchema.asText()), // text/plain
                  Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()) // application/octet-stream
                ]
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<ReturnType<typeof f>>().type.toBe<
        Effect.Effect<
          string | { readonly a: number } | Uint8Array<ArrayBufferLike> | [
            string | { readonly a: number } | Uint8Array<ArrayBufferLike>,
            HttpClientResponse.HttpClientResponse
          ],
          HttpApiError.HttpApiSchemaError | HttpClientError.HttpClientError | Schema.SchemaError
        >
      >()
    })
  })

  describe("error option", () => {
    it("should default to HttpApiSchemaError", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a")
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<ReturnType<typeof f>>().type.toBe<
        Effect.Effect<
          void | [void, HttpClientResponse.HttpClientResponse],
          | HttpApiError.HttpApiSchemaError
          | HttpClientError.HttpClientError
          | Schema.SchemaError
        >
      >()
    })

    it("should accept a schema", () => {
      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                error: Schema.Struct({ a: Schema.FiniteFromString })
              })
            )
        )
      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer))
      )
      const f = client.group.a
      expect<ReturnType<typeof f>>().type.toBe<
        Effect.Effect<
          void | [void, HttpClientResponse.HttpClientResponse],
          | { readonly a: number }
          | HttpApiError.HttpApiSchemaError
          | HttpClientError.HttpClientError
          | Schema.SchemaError
        >
      >()
    })
  })

  describe("client middleware", () => {
    it("requiredForClient requires layer and includes required client errors", () => {
      class RequiredClientError extends Schema.ErrorClass<RequiredClientError>("RequiredClientError")({
        _tag: Schema.tag("RequiredClientError")
      }) {}

      class OptionalClientError extends Schema.ErrorClass<OptionalClientError>("OptionalClientError")({
        _tag: Schema.tag("OptionalClientError")
      }) {}

      class RequiredMiddleware extends HttpApiMiddleware.Service<RequiredMiddleware, {
        clientError: RequiredClientError
      }>()("RequiredMiddleware", {
        requiredForClient: true
      }) {}

      class OptionalMiddleware extends HttpApiMiddleware.Service<OptionalMiddleware, {
        clientError: OptionalClientError
      }>()("OptionalMiddleware") {}

      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                success: Schema.String
              })
                .middleware(RequiredMiddleware)
                .middleware(OptionalMiddleware)
            )
        )

      // @ts-expect-error!
      Effect.runSync(HttpApiClient.make(Api).pipe(Effect.provide(FetchHttpClient.layer)))

      const client = Effect.runSync(
        HttpApiClient.make(Api).pipe(
          Effect.provide([
            FetchHttpClient.layer,
            HttpApiMiddleware.layerClient(RequiredMiddleware, ({ next, request }) => next(request))
          ])
        )
      )
      const f = client.group.a
      expect<ReturnType<typeof f>>().type.toBe<
        Effect.Effect<
          string | [string, HttpClientResponse.HttpClientResponse],
          | RequiredClientError
          | HttpApiError.HttpApiSchemaError
          | HttpClientError.HttpClientError
          | Schema.SchemaError
        >
      >()
    })

    it("requiredForClient is enforced for makeWith, group, and endpoint", () => {
      class RequiredClientError extends Schema.ErrorClass<RequiredClientError>("RequiredClientError")({
        _tag: Schema.tag("RequiredClientError")
      }) {}

      class RequiredMiddleware extends HttpApiMiddleware.Service<RequiredMiddleware, {
        clientError: RequiredClientError
      }>()("RequiredMiddleware", {
        requiredForClient: true
      }) {}

      const Api = HttpApi.make("Api")
        .add(
          HttpApiGroup.make("group")
            .add(
              HttpApiEndpoint.get("a", "/a", {
                success: Schema.String
              })
                .middleware(RequiredMiddleware)
            )
        )

      const TestHttpClient = HttpClient.make(() => Effect.die("not used in dtslint"))

      // @ts-expect-error!
      Effect.runSync(HttpApiClient.makeWith(Api, { httpClient: TestHttpClient }))

      // @ts-expect-error!
      Effect.runSync(HttpApiClient.group(Api, { group: "group", httpClient: TestHttpClient }))

      // @ts-expect-error!
      Effect.runSync(HttpApiClient.endpoint(Api, { group: "group", endpoint: "a", httpClient: TestHttpClient }))

      const middlewareLayer = HttpApiMiddleware.layerClient(
        RequiredMiddleware,
        ({ next, request }) => next(request)
      )

      const withClient = Effect.runSync(
        HttpApiClient.makeWith(Api, { httpClient: TestHttpClient }).pipe(
          Effect.provide(middlewareLayer)
        )
      )
      const fromClient = withClient.group.a

      const withGroup = Effect.runSync(
        HttpApiClient.group(Api, { group: "group", httpClient: TestHttpClient }).pipe(
          Effect.provide(middlewareLayer)
        )
      )
      const fromGroup = withGroup.a

      const fromEndpoint = Effect.runSync(
        HttpApiClient.endpoint(Api, { group: "group", endpoint: "a", httpClient: TestHttpClient }).pipe(
          Effect.provide(middlewareLayer)
        )
      )

      expect<ReturnType<typeof fromClient>>().type.toBe<
        Effect.Effect<
          string | [string, HttpClientResponse.HttpClientResponse],
          | RequiredClientError
          | HttpApiError.HttpApiSchemaError
          | HttpClientError.HttpClientError
          | Schema.SchemaError
        >
      >()

      expect<ReturnType<typeof fromGroup>>().type.toBe<
        Effect.Effect<
          string | [string, HttpClientResponse.HttpClientResponse],
          | RequiredClientError
          | HttpApiError.HttpApiSchemaError
          | HttpClientError.HttpClientError
          | Schema.SchemaError
        >
      >()

      expect<ReturnType<typeof fromEndpoint>>().type.toBe<
        Effect.Effect<
          string | [string, HttpClientResponse.HttpClientResponse],
          | RequiredClientError
          | HttpApiError.HttpApiSchemaError
          | HttpClientError.HttpClientError
          | Schema.SchemaError
        >
      >()
    })
  })
})
