import { Schema } from "effect"
import { HttpApiEndpoint, type HttpApiError, HttpApiSchema } from "effect/unstable/httpapi"
import { describe, expect, it } from "tstyche"

describe("HttpApiEndpoint", () => {
  describe("path option", () => {
    it("should default to never", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["~Params"]
      expect<T>().type.toBe<never>()
    })

    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        params: {
          id: Schema.FiniteFromString
        }
      })
      type T = typeof endpoint["~Params"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }>>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a", {
        // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'ParamsContraint'.
        params: Schema.Struct({ id: Schema.String })
      })
    })
  })

  describe("query option", () => {
    it("should default to never", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["~Query"]
      expect<T>().type.toBe<never>()
    })

    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        query: {
          id: Schema.FiniteFromString
        }
      })
      type T = typeof endpoint["~Query"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }>>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a", {
        // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'QuerySchemaContraint'.
        query: Schema.Struct({ id: Schema.String })
      })
    })
  })

  describe("headers option", () => {
    it("should default to never", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["~Headers"]
      expect<T>().type.toBe<never>()
    })

    it("should accept a record of fields", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        headers: {
          id: Schema.FiniteFromString
        }
      })
      type T = typeof endpoint["~Headers"]
      expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }>>()
    })

    it("should not accept any other schema", () => {
      HttpApiEndpoint.get("a", "/a", {
        // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'HeadersSchemaContraint'.
        headers: Schema.Struct({ id: Schema.String })
      })
    })
  })

  describe("payload option", () => {
    it("should default to never", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["~Payload"]
      expect<T>().type.toBe<never>()
    })

    describe("GET", () => {
      it("should accept a record of fields", () => {
        const endpoint = HttpApiEndpoint.get("a", "/a", {
          payload: {
            id: Schema.FiniteFromString
          }
        })
        type T = typeof endpoint["~Payload"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }>>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.get("a", "/a", {
          // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'Record<string, Encoder<string | readonly string[] | undefined, unknown>>'.
          payload: Schema.Struct({ id: Schema.String })
        })
      })
    })

    describe("POST", () => {
      it("should accept a schema", () => {
        const endpoint = HttpApiEndpoint.post("a", "/a", {
          payload: Schema.Struct({ a: Schema.String })
        })
        type T = typeof endpoint["~Payload"]
        expect<T>().type.toBe<Schema.Struct<{ readonly a: Schema.String }>>()
      })

      it("should accept an array of schemas", () => {
        const endpoint = HttpApiEndpoint.post("a", "/a", {
          payload: [
            Schema.Struct({ a: Schema.String }), // application/json
            Schema.String.pipe(HttpApiSchema.asText()), // text/plain
            Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()) // application/octet-stream
          ]
        })
        type T = typeof endpoint["~Payload"]
        expect<T>().type.toBe<
          Schema.String | Schema.Struct<{ readonly a: Schema.String }> | Schema.Uint8Array
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
        type T = typeof endpoint["~Payload"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }>>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.head("a", "/a", {
          // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'Record<string, Encoder<string | readonly string[] | undefined, unknown>>'.
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
        type T = typeof endpoint["~Payload"]
        expect<T>().type.toBe<Schema.Struct<{ id: Schema.FiniteFromString }>>()
      })

      it("should not accept any other schema", () => {
        HttpApiEndpoint.options("a", "/a", {
          // @ts-expect-error Type 'Struct<{ readonly id: String; }>' is not assignable to type 'Record<string, Encoder<string | readonly string[] | undefined, unknown>>'.
          payload: Schema.Struct({ id: Schema.String })
        })
      })
    })
  })

  describe("success option", () => {
    it("should default to HttpApiSchema.NoContent", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["~Success"]
      expect<T>().type.toBe<typeof HttpApiSchema.NoContent>()
    })

    it("should accept a schema", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        success: Schema.Struct({ a: Schema.String })
      })
      type T = typeof endpoint["~Success"]
      expect<T>().type.toBe<Schema.Struct<{ readonly a: Schema.String }>>()
    })

    it("should accept an array of schemas", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a", {
        success: [
          Schema.Struct({ a: Schema.String }), // application/json
          Schema.String.pipe(HttpApiSchema.asText()), // text/plain
          Schema.Uint8Array.pipe(HttpApiSchema.asUint8Array()) // application/octet-stream
        ]
      })
      type T = typeof endpoint["~Success"]
      expect<T>().type.toBe<Schema.String | Schema.Struct<{ readonly a: Schema.String }> | Schema.Uint8Array>()
    })
  })

  describe("error option", () => {
    it("should default to HttpApiSchemaError", () => {
      const endpoint = HttpApiEndpoint.get("a", "/a")
      type T = typeof endpoint["~Error"]
      expect<T>().type.toBe<typeof HttpApiError.HttpApiSchemaError>()
    })
  })
})
