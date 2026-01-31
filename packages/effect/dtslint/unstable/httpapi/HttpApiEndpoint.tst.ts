import { Schema } from "effect"
import { HttpApiEndpoint, type HttpApiError, HttpApiSchema } from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiEndpoint", () => {
  describe("path option", () => {
    it("should default to undefined", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["pathSchema"]
      expect<T>().type.toBe<undefined>()
    })

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

  describe("urlParams option", () => {
    it("should default to undefined", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["urlParamsSchema"]
      expect<T>().type.toBe<undefined>()
    })

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

  describe("headers option", () => {
    it("should default to undefined", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["headersSchema"]
      expect<T>().type.toBe<undefined>()
    })

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

  describe("payload option", () => {
    it("should default to undefined", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["payloadSchema"]
      expect<T>().type.toBe<undefined>()
    })

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

    describe("POST", () => {
      it("should accept a schema", () => {
        const endpoint = HttpApiEndpoint.post("a", "/a", {
          payload: Schema.Struct({ a: Schema.String })
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<Schema.Struct<{ readonly a: Schema.String }> | undefined>()
      })

      it("should accept an array of schemas", () => {
        const endpoint = HttpApiEndpoint.post("a", "/a", {
          payload: [
            Schema.Struct({ a: Schema.String }), // application/json
            HttpApiSchema.Text(), // text/plain
            HttpApiSchema.Uint8Array() // application/octet-stream
          ]
        })
        type T = typeof endpoint["payloadSchema"]
        expect<T>().type.toBe<
          Schema.String | Schema.Struct<{ readonly a: Schema.String }> | Schema.Uint8Array | undefined
        >()
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

  describe("success option", () => {
    it("should default to HttpApiSchema.NoContent", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["successSchema"]
      expect<T>().type.toBe<typeof HttpApiSchema.NoContent>()
    })

    it("should accept a schema", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        success: Schema.Struct({ a: Schema.String })
      })
      type T = typeof endpoint["successSchema"]
      expect<T>().type.toBe<Schema.Struct<{ readonly a: Schema.String }>>()
    })

    it("should accept an array of schemas", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        success: [
          Schema.Struct({ a: Schema.String }), // application/json
          HttpApiSchema.Text(), // text/plain
          HttpApiSchema.Uint8Array() // application/octet-stream
        ]
      })
      type T = typeof endpoint["successSchema"]
      expect<T>().type.toBe<Schema.String | Schema.Struct<{ readonly a: Schema.String }> | Schema.Uint8Array>()
    })
  })

  describe("error option", () => {
    it("should default to HttpApiSchemaError", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["errorSchema"]
      expect<T>().type.toBe<typeof HttpApiError.HttpApiSchemaError>()
    })
  })
})
