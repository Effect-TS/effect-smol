import { Schema } from "effect"
import { HttpApiEndpoint } from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiEndpoint", () => {
  describe("path option", () => {
    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        path: {
          id: Schema.FiniteFromString
        }
      })
      type T = typeof endpoint["pathSchema"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a", {
        // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'PathSchemaContraint'.
        path: Schema.Struct({ id: Schema.String })
      })
    })
  })

  describe("setPath", () => {
    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a").setPath({
        id: Schema.FiniteFromString
      })
      type T = typeof endpoint["pathSchema"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a")
        // @ts-expect-error Argument of type 'Struct<{ readonly id: String; }>' is not assignable to parameter of type 'PathSchemaContraint'.
        .setPath(Schema.Struct({ id: Schema.String }))
    })
  })

  describe("urlParams option", () => {
    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        urlParams: {
          id: Schema.FiniteFromString
        }
      })
      type T = typeof endpoint["urlParamsSchema"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a", {
        // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'UrlParamsSchemaContraint'.
        urlParams: Schema.Struct({ id: Schema.String })
      })
    })
  })

  describe("setUrlParams", () => {
    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a").setUrlParams({
        id: Schema.FiniteFromString
      })
      type T = typeof endpoint["urlParamsSchema"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a")
        // @ts-expect-error Argument of type 'Struct<{ readonly id: String; }>' is not assignable to parameter of type 'UrlParamsSchemaContraint'.
        .setUrlParams(Schema.Struct({ id: Schema.String }))
    })
  })

  describe("headers option", () => {
    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        headers: {
          id: Schema.FiniteFromString
        }
      })
      type T = typeof endpoint["headersSchema"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a", {
        // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'HeadersSchemaContraint'.
        headers: Schema.Struct({ id: Schema.String })
      })
    })
  })

  describe("setHeaders", () => {
    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a").setHeaders({
        id: Schema.FiniteFromString
      })
      type T = typeof endpoint["headersSchema"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a")
        // @ts-expect-error Argument of type 'Struct<{ readonly id: String; }>' is not assignable to parameter of type 'HeadersSchemaContraint'.
        .setHeaders(Schema.Struct({ id: Schema.String }))
    })
  })

  describe("payload option", () => {
    describe("GET", () => {
      it("should accept a record of fields", () => {
        const endpoint = HttpApiEndpoint.get("a", "/a", {
          payload: {
            id: Schema.FiniteFromString
          }
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.get("a", "/a", {
          // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'Record<string, Codec<unknown, string | readonly string[] | undefined, unknown, unknown>>'.
          payload: Schema.Struct({ id: Schema.String })
        })
      })
    })

    describe("HEAD", () => {
      it("should accept a record of fields", () => {
        const endpoint = HttpApiEndpoint.head("a", "/a", {
          payload: {
            id: Schema.FiniteFromString
          }
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.head("a", "/a", {
          // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'Record<string, Codec<unknown, string | readonly string[] | undefined, unknown, unknown>>'.
          payload: Schema.Struct({ id: Schema.String })
        })
      })
    })

    describe("OPTIONS", () => {
      it("should accept a record of fields", () => {
        const endpoint = HttpApiEndpoint.options("a", "/a", {
          payload: {
            id: Schema.FiniteFromString
          }
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.options("a", "/a", {
          // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'Record<string, Codec<unknown, string | readonly string[] | undefined, unknown, unknown>>'.
          payload: Schema.Struct({ id: Schema.String })
        })
      })
    })
  })

  describe("setPayload", () => {
    describe("GET", () => {
      it("should accept a record of fields", () => {
        const endpoint = HttpApiEndpoint.get("a", "/a").setPayload({
          id: Schema.FiniteFromString
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.get("a", "/a")
          // @ts-expect-error Argument of type 'Struct<{ readonly id: String; }>' is not assignable to parameter of type 'Record<string, Codec<unknown, string | readonly string[] | undefined, unknown, unknown>>'.
          .setPayload(Schema.Struct({ id: Schema.String }))
      })
    })

    describe("HEAD", () => {
      it("should accept a record of fields", () => {
        const endpoint = HttpApiEndpoint.head("a", "/a").setPayload({
          id: Schema.FiniteFromString
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.head("a", "/a")
          // @ts-expect-error Argument of type 'Struct<{ readonly id: String; }>' is not assignable to parameter of type 'Record<string, Codec<unknown, string | readonly string[] | undefined, unknown, unknown>>'.
          .setPayload(Schema.Struct({ id: Schema.String }))
      })
    })

    describe("OPTIONS", () => {
      it("should accept a record of fields", () => {
        const endpoint = HttpApiEndpoint.options("a", "/a").setPayload({
          id: Schema.FiniteFromString
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }> | undefined>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.options("a", "/a")
          // @ts-expect-error Argument of type 'Struct<{ readonly id: String; }>' is not assignable to parameter of type 'Record<string, Codec<unknown, string | readonly string[] | undefined, unknown, unknown>>'.
          .setPayload(Schema.Struct({ id: Schema.String }))
      })
    })
  })
})
