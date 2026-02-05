import { Effect, Schema } from "effect"
import { FetchHttpClient, type HttpClientError, type HttpClientResponse } from "effect/unstable/http"
import {
  HttpApi,
  HttpApiClient,
  HttpApiEndpoint,
  type HttpApiError,
  HttpApiGroup,
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
})
