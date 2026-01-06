import type { JsonSchema } from "effect"
import { Schema, SchemaFromJson } from "effect"
import { describe, expect, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

function assertGeneration(
  input: {
    readonly schema: Record<string, unknown> | boolean
    readonly options?: {
      readonly source?: JsonSchema.Dialect | undefined
      readonly resolver?: SchemaFromJson.Resolver | undefined
      readonly extractJsDocs?:
        | boolean
        | ((annotations: Schema.Annotations.Annotations) => string | undefined)
        | undefined
      readonly parseContentSchema?: boolean | undefined
      readonly collectAnnotations?:
        | ((
          schema: JsonSchema.JsonSchema,
          annotations: Schema.Annotations.Annotations
        ) => Schema.Annotations.Annotations)
        | undefined
      readonly definitions?: JsonSchema.Definitions | undefined
    } | undefined
  },
  expected: {
    readonly code: string
    readonly types: SchemaFromJson.Types
    readonly jsDocs?: string | undefined
    readonly importDeclarations?: ReadonlySet<string>
  }
) {
  const source = input.options?.source ?? "draft-07"
  const generation = SchemaFromJson.generate(input.schema, { ...input.options, source })
  deepStrictEqual(generation, {
    importDeclarations: new Set<string>(),
    jsDocs: undefined,
    ...expected
  })
}

const sourceDraft202012: SchemaFromJson.GenerateOptions = {
  source: "draft-2020-12"
}

const sourceOpenapi30: SchemaFromJson.GenerateOptions = {
  source: "openapi-3.0"
}

const sourceOpenapi31: SchemaFromJson.GenerateOptions = {
  source: "openapi-3.1"
}

describe("SchemaFromJson", () => {
  describe("defaultExtractJsDocs", () => {
    it("should return undefined when description is missing", () => {
      const result = SchemaFromJson.defaultExtractJsDocs({})
      strictEqual(result, undefined)
    })

    it("should return formatted JSDoc when description exists", () => {
      const result = SchemaFromJson.defaultExtractJsDocs({ description: "Test description" })
      strictEqual(result, "\n/** Test description */\n")
    })

    it("should handle `*/` in description", () => {
      const result = SchemaFromJson.defaultExtractJsDocs({ description: "a */ b" })
      strictEqual(result, "\n/** a *\\/ b */\n")
    })
  })

  describe("makeGenerationExtern", () => {
    it("should generate extern with namespace and import", () => {
      const result = SchemaFromJson.makeGenerationExtern("MySchema", `import { MySchema } from "my-lib"`)
      deepStrictEqual(result, {
        code: "MySchema",
        types: {
          Type: `typeof MySchema["Type"]`,
          Encoded: `typeof MySchema["Encoded"]`,
          DecodingServices: `typeof MySchema["DecodingServices"]`,
          EncodingServices: `typeof MySchema["EncodingServices"]`
        },
        jsDocs: undefined,
        importDeclarations: new Set([`import { MySchema } from "my-lib"`])
      })
    })
  })

  describe("generate", () => {
    describe("draft-2020-12", () => {
      it("should support prefixItems", () => {
        assertGeneration(
          {
            schema: {
              "prefixItems": [{ "type": "string" }],
              "items": false,
              "minItems": 1
            },
            options: sourceDraft202012
          },
          SchemaFromJson.makeGeneration(
            "Schema.Tuple([Schema.String])",
            SchemaFromJson.makeTypes("readonly [string]")
          )
        )
      })
    })

    describe("openapi-3.1", () => {
      it("should support prefixItems", () => {
        assertGeneration(
          {
            schema: {
              "prefixItems": [{ "type": "string" }],
              "items": false,
              "minItems": 1
            },
            options: sourceOpenapi31
          },
          SchemaFromJson.makeGeneration(
            "Schema.Tuple([Schema.String])",
            SchemaFromJson.makeTypes("readonly [string]")
          )
        )
      })
    })

    describe("openapi-3.0", () => {
      it("should support example (singular)", () => {
        assertGeneration(
          {
            schema: {
              "type": "string",
              "example": "a"
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.String.annotate({ "examples": ["a"] })`,
            SchemaFromJson.makeTypes("string")
          )
        )
      })

      it("should support exclusiveMinimum as boolean", () => {
        assertGeneration(
          {
            schema: {
              "minimum": 0
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration(
            "Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))",
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          {
            schema: {
              "minimum": 0,
              "exclusiveMinimum": false
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration(
            "Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))",
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          {
            schema: {
              "minimum": 0,
              "exclusiveMinimum": true
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration(
            "Schema.Number.check(Schema.isGreaterThan(0))",
            SchemaFromJson.makeTypes("number")
          )
        )
      })

      it("should support exclusiveMaximum as boolean", () => {
        assertGeneration(
          {
            schema: {
              "maximum": 10
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration(
            "Schema.Number.check(Schema.isLessThanOrEqualTo(10))",
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          {
            schema: {
              "maximum": 10,
              "exclusiveMaximum": false
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration(
            "Schema.Number.check(Schema.isLessThanOrEqualTo(10))",
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          {
            schema: {
              "maximum": 10,
              "exclusiveMaximum": true
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration(
            "Schema.Number.check(Schema.isLessThan(10))",
            SchemaFromJson.makeTypes("number")
          )
        )
      })

      it("should support nullable", () => {
        assertGeneration(
          {
            schema: {
              "type": "string",
              "nullable": true
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration("Schema.NullOr(Schema.String)", SchemaFromJson.makeTypes("string | null"))
        )
        assertGeneration(
          {
            schema: {
              "type": "string",
              "nullable": true,
              "description": "a",
              "example": null
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration(
            `Schema.NullOr(Schema.String).annotate({ "description": "a", "examples": [null] })`,
            SchemaFromJson.makeTypes("string | null")
          )
        )
      })

      it("nullable should be idempotent", () => {
        assertGeneration(
          {
            schema: {
              "type": "string",
              "nullable": true,
              "allOf": [{ "nullable": true }]
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration("Schema.NullOr(Schema.String)", SchemaFromJson.makeTypes("string | null"))
        )
        assertGeneration(
          {
            schema: {
              "enum": [1, null],
              "nullable": true
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration("Schema.NullOr(Schema.Literal(1))", SchemaFromJson.makeTypes("1 | null"))
        )
        assertGeneration(
          {
            schema: {
              "enum": [null],
              "nullable": true
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration("Schema.Null", SchemaFromJson.makeTypes("null"))
        )
        assertGeneration(
          {
            schema: {
              "const": null,
              "nullable": true
            },
            options: sourceOpenapi30
          },
          SchemaFromJson.makeGeneration("Schema.Null", SchemaFromJson.makeTypes("null"))
        )
      })
    })

    describe("options", () => {
      it("resolver", () => {
        assertGeneration(
          {
            schema: {
              "$ref": "#/definitions/ID~1a~0b"
            },
            options: {
              resolver: (ref) => {
                const identifier = ref.replace(/[/~]/g, "$")
                return SchemaFromJson.makeGeneration(identifier, SchemaFromJson.makeTypes(identifier))
              }
            }
          },
          SchemaFromJson.makeGeneration("ID$a$b", SchemaFromJson.makeTypes("ID$a$b"))
        )
      })

      it("extractJsDocs: true", () => {
        const options: SchemaFromJson.GenerateOptions = { source: "draft-07", extractJsDocs: true }
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "type": "string" },
                "b": { "type": "string", "description": "desc-b" }
              },
              "required": ["a", "b"],
              "description": "desc-o",
              "additionalProperties": false
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String, "b": Schema.String.annotate({ "description": "desc-b" }) }).annotate({ "description": "desc-o" })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string, \n/** desc-b */\nreadonly "b": string }`),
            `\n/** desc-o */\n`
          )
        )
      })

      it("extractJsDocs: function", () => {
        const options: SchemaFromJson.GenerateOptions = {
          source: "draft-07",
          extractJsDocs: (annotations) => {
            const description = annotations.description ?? annotations.title
            if (description === undefined) return undefined
            return `\n/** ${description} */\n`
          }
        }
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "type": "string" },
                "b": { "type": "string", "title": "desc-b" }
              },
              "required": ["a", "b"],
              "additionalProperties": false
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String, "b": Schema.String.annotate({ "title": "desc-b" }) })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string, \n/** desc-b */\nreadonly "b": string }`)
          )
        )
      })

      it("collectAnnotations", () => {
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": {
                  "type": "string",
                  "errorMessage": "Input must be a string"
                },
                "b": {
                  "type": "number"
                }
              },
              "required": ["a", "b"],
              "additionalProperties": false
            },
            options: {
              collectAnnotations: (schema, annotations) => {
                return {
                  ...annotations,
                  ...(typeof schema.errorMessage === "string" ? { message: schema.errorMessage } : {})
                }
              }
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String.annotate({ "message": "Input must be a string" }), "b": Schema.Number })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": number }`)
          )
        )
      })
    })

    it("importDeclarations", () => {
      const B_IMPORT = `import { B } from "my-library"`
      const C_IMPORT = `import * as C from "my-library"`
      assertGeneration(
        {
          schema: {
            "properties": {
              "a": { "type": "string" },
              "b": { "$ref": "#/definitions/B" },
              "c": { "$ref": "#/definitions/C" }
            },
            "required": ["a", "b", "c"],
            "additionalProperties": false
          },
          options: {
            resolver: (ref) => {
              const identifier = ref.replace(/[/~]/g, "$")
              switch (identifier) {
                case "B":
                  return SchemaFromJson.makeGeneration(
                    "B",
                    SchemaFromJson.makeTypes(
                      `typeof B["Type"]`,
                      `typeof B["Encoded"]`
                    ),
                    undefined,
                    new Set([B_IMPORT])
                  )
                case "C":
                  return SchemaFromJson.makeGeneration(
                    identifier,
                    SchemaFromJson.makeTypes(identifier),
                    undefined,
                    new Set([C_IMPORT])
                  )
                default:
                  return SchemaFromJson.makeGeneration(identifier, SchemaFromJson.makeTypes(identifier))
              }
            }
          }
        },
        SchemaFromJson.makeGeneration(
          `Schema.Struct({ "a": Schema.String, "b": B, "c": C })`,
          SchemaFromJson.makeTypes(
            `{ readonly "a": string, readonly "b": typeof B["Type"], readonly "c": C }`,
            `{ readonly "a": string, readonly "b": typeof B["Encoded"], readonly "c": C }`
          ),
          undefined,
          new Set([B_IMPORT, C_IMPORT])
        )
      )
    })

    it("format", () => {
      assertGeneration(
        { schema: { "type": "string", "format": "email" } },
        SchemaFromJson.makeGeneration(
          `Schema.String.annotate({ "format": "email" })`,
          SchemaFromJson.makeTypes("string")
        )
      )
      assertGeneration(
        { schema: { "format": "email" } },
        SchemaFromJson.makeGeneration(
          `Schema.String.annotate({ "format": "email" })`,
          SchemaFromJson.makeTypes("string")
        )
      )
    })

    it("patternProperties", () => {
      assertGeneration(
        {
          schema: {
            "patternProperties": {}
          }
        },
        SchemaFromJson.makeGeneration(
          `Schema.Record(Schema.String, Schema.Unknown)`,
          SchemaFromJson.makeTypes(`{ readonly [x: string]: unknown }`)
        )
      )
      assertGeneration(
        {
          schema: {
            "patternProperties": {
              "^x-": { "type": "string" }
            },
            "additionalProperties": false
          }
        },
        SchemaFromJson.makeGeneration(
          `Schema.Record(Schema.String.check(Schema.isPattern(new RegExp("^x-"))), Schema.String)`,
          SchemaFromJson.makeTypes(`{ readonly [x: string]: string }`)
        )
      )
      assertGeneration(
        {
          schema: {
            "patternProperties": {
              "^x-": { "type": "string" },
              "^y-": { "type": "number" }
            },
            "additionalProperties": false
          }
        },
        SchemaFromJson.makeGeneration(
          `Schema.StructWithRest(Schema.Struct({  }), [Schema.Record(Schema.String.check(Schema.isPattern(new RegExp("^x-"))), Schema.String), Schema.Record(Schema.String.check(Schema.isPattern(new RegExp("^y-"))), Schema.Number)])`,
          SchemaFromJson.makeTypes(`{ readonly [x: string]: string, readonly [x: string]: number }`)
        )
      )
    })

    it("propertyNames", () => {
      assertGeneration(
        {
          schema: {
            "propertyNames": { "pattern": "^[A-Z]" }
          }
        },
        SchemaFromJson.makeGeneration(
          `Schema.Record(Schema.String.check(Schema.isPattern(new RegExp("^[A-Z]"))), Schema.Unknown)`,
          SchemaFromJson.makeTypes(`{ readonly [x: string]: unknown }`)
        )
      )
    })

    describe("contentSchema", () => {
      it("should be ignored in draft-07", () => {
        assertGeneration(
          {
            schema: {
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "number"
              },
              "description": "a string that will be decoded as JSON"
            },
            options: {
              source: "draft-07",
              parseContentSchema: true
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.String.annotate({ "description": "a string that will be decoded as JSON" })`,
            SchemaFromJson.makeTypes("string")
          )
        )
      })

      const options: SchemaFromJson.GenerateOptions = {
        source: "draft-2020-12",
        parseContentSchema: true
      }

      it("missing contentSchema", () => {
        assertGeneration(
          {
            schema: {
              "contentMediaType": "application/json"
            },
            options
          },
          SchemaFromJson.makeGeneration(`Schema.String`, SchemaFromJson.makeTypes("string"))
        )
      })

      it("should ignore contentSchema with non-application/json media type", () => {
        assertGeneration(
          {
            schema: {
              "contentMediaType": "text/plain",
              "contentSchema": {
                "type": "number"
              }
            },
            options
          },
          SchemaFromJson.makeGeneration(`Schema.String`, SchemaFromJson.makeTypes("string"))
        )
      })

      it("missing contentMediaType", () => {
        assertGeneration(
          {
            schema: {
              "contentSchema": {
                "type": "number"
              }
            },
            options
          },
          SchemaFromJson.makeGeneration(`Schema.String`, SchemaFromJson.makeTypes("string"))
        )
      })

      it("contentSchema: object", () => {
        assertGeneration(
          {
            schema: {
              "contentMediaType": "application/json",
              "contentSchema": {
                "type": "number"
              }
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.fromJsonString(Schema.Number)`,
            SchemaFromJson.makeTypes("number", "string", "never", "never")
          )
        )
      })

      it("contentSchema: $ref", () => {
        assertGeneration(
          {
            schema: {
              "contentMediaType": "application/json",
              "contentSchema": {
                "$ref": "#/definitions/A"
              }
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.fromJsonString(Schema.Unknown)`,
            SchemaFromJson.makeTypes("unknown", "string", "never", "never")
          )
        )
      })
    })

    it("true", () => {
      assertGeneration(
        { schema: true },
        SchemaFromJson.makeGeneration("Schema.Unknown", SchemaFromJson.makeTypes("unknown"))
      )
      assertGeneration(
        {
          schema: {
            "allOf": [
              true,
              { "description": "a" }
            ]
          }
        },
        SchemaFromJson.makeGeneration(
          `Schema.Unknown.annotate({ "description": "a" })`,
          SchemaFromJson.makeTypes("unknown")
        )
      )
    })

    it("false", () => {
      assertGeneration(
        { schema: false },
        SchemaFromJson.makeGeneration("Schema.Never", SchemaFromJson.makeTypes("never"))
      )
      assertGeneration(
        {
          schema: {
            "allOf": [
              false,
              { "description": "a" }
            ]
          }
        },
        SchemaFromJson.makeGeneration(
          `Schema.Never.annotate({ "description": "a" })`,
          SchemaFromJson.makeTypes("never")
        )
      )
    })

    describe("Unknown", () => {
      it("non object", () => {
        assertGeneration(
          { schema: null as any },
          SchemaFromJson.makeGeneration("Schema.Unknown", SchemaFromJson.makeTypes("unknown"))
        )
      })

      it("empty object", () => {
        assertGeneration(
          { schema: {} },
          SchemaFromJson.makeGeneration("Schema.Unknown", SchemaFromJson.makeTypes("unknown"))
        )
        assertGeneration(
          { schema: { description: "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Unknown.annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("unknown")
          )
        )
      })

      it("should handle object with only unknown properties", () => {
        assertGeneration(
          {
            schema: {
              customProperty: "value"
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Unknown",
            SchemaFromJson.makeTypes("unknown")
          )
        )
      })
    })

    it("const", () => {
      assertGeneration(
        { schema: { "const": "a" } },
        SchemaFromJson.makeGeneration(`Schema.Literal("a")`, SchemaFromJson.makeTypes(`"a"`))
      )
      assertGeneration(
        { schema: { "const": "a", "description": "a" } },
        SchemaFromJson.makeGeneration(
          `Schema.Literal("a").annotate({ "description": "a" })`,
          SchemaFromJson.makeTypes(`"a"`)
        )
      )
      assertGeneration(
        { schema: { "type": "string", "const": "a" } },
        SchemaFromJson.makeGeneration(`Schema.Literal("a")`, SchemaFromJson.makeTypes(`"a"`))
      )
      assertGeneration(
        { schema: { "const": null } },
        SchemaFromJson.makeGeneration(`Schema.Null`, SchemaFromJson.makeTypes(`null`))
      )
      assertGeneration(
        { schema: { "const": null, "description": "a" } },
        SchemaFromJson.makeGeneration(
          `Schema.Null.annotate({ "description": "a" })`,
          SchemaFromJson.makeTypes(`null`)
        )
      )
      assertGeneration(
        { schema: { "const": {} } },
        SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
      )
    })

    describe("enum", () => {
      it("baseline", () => {
        assertGeneration(
          { schema: { "enum": ["a", "b"] } },
          SchemaFromJson.makeGeneration(`Schema.Literals(["a", "b"])`, SchemaFromJson.makeTypes(`"a" | "b"`))
        )
        assertGeneration(
          { schema: { "type": "string", "enum": ["a", "b"] } },
          SchemaFromJson.makeGeneration(`Schema.Literals(["a", "b"])`, SchemaFromJson.makeTypes(`"a" | "b"`))
        )
        assertGeneration(
          { schema: { "enum": ["a", 1] } },
          SchemaFromJson.makeGeneration(`Schema.Literals(["a", 1])`, SchemaFromJson.makeTypes(`"a" | 1`))
        )
        assertGeneration(
          { schema: { "enum": ["a", "b"], "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Literals(["a", "b"]).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes(`"a" | "b"`)
          )
        )
        assertGeneration(
          { schema: { "enum": [] } },
          SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
        )
        assertGeneration(
          { schema: { "enum": [], "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Never.annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("never")
          )
        )
      })

      it("including null", () => {
        assertGeneration(
          { schema: { "enum": [null] } },
          SchemaFromJson.makeGeneration(`Schema.Null`, SchemaFromJson.makeTypes(`null`))
        )
        assertGeneration(
          { schema: { "enum": [null], "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Null.annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes(`null`)
          )
        )
        assertGeneration(
          { schema: { "enum": ["a", null] } },
          SchemaFromJson.makeGeneration(`Schema.NullOr(Schema.Literal("a"))`, SchemaFromJson.makeTypes(`"a" | null`))
        )
        assertGeneration(
          { schema: { "enum": ["a", null], "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.NullOr(Schema.Literal("a")).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes(`"a" | null`)
          )
        )
      })

      describe("allOf", () => {
        it("enum & enum", () => {
          assertGeneration(
            {
              schema: {
                "enum": ["a", "b"],
                "allOf": [{ "enum": ["a"] }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Literal("a")`, SchemaFromJson.makeTypes(`"a"`))
          )
          assertGeneration(
            {
              schema: {
                "enum": ["a", "b"],
                "allOf": [{ "enum": ["c"] }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
          )
        })

        it("enum & string", () => {
          assertGeneration(
            {
              schema: {
                "enum": ["a", 1],
                "allOf": [{ "type": "string" }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Literal("a")`, SchemaFromJson.makeTypes(`"a"`))
          )
          assertGeneration(
            {
              schema: {
                "enum": [1, 2],
                "allOf": [{ "type": "string" }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
          )
          assertGeneration(
            {
              schema: {
                "enum": [1, 2, "a", "aa"],
                "allOf": [{ "minLength": 2 }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Literal("aa")`, SchemaFromJson.makeTypes(`"aa"`))
          )
          assertGeneration(
            {
              schema: {
                "enum": ["a", "b"],
                "allOf": [{ "pattern": "a" }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Literal("a")`, SchemaFromJson.makeTypes(`"a"`))
          )
        })

        it("enum & number", () => {
          assertGeneration(
            {
              schema: {
                "enum": ["a", 1],
                "allOf": [{ "type": "number" }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Literal(1)`, SchemaFromJson.makeTypes(`1`))
          )
          assertGeneration(
            {
              schema: {
                "enum": ["a", "b"],
                "allOf": [{ "type": "number" }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
          )
          assertGeneration(
            {
              schema: {
                "enum": [1, 2, "a", "aa"],
                "allOf": [{ "minimum": 2 }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Literal(2)`, SchemaFromJson.makeTypes(`2`))
          )
        })

        it("enum & boolean", () => {
          assertGeneration(
            {
              schema: {
                "type": "string",
                "enum": ["a", true],
                "allOf": [{ "type": "boolean" }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Literal(true)`, SchemaFromJson.makeTypes(`true`))
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "enum": [1, 2],
                "allOf": [{ "type": "boolean" }]
              }
            },
            SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
          )
        })
      })
    })

    describe("type as array", () => {
      it("string, number", () => {
        assertGeneration(
          { schema: { "type": ["string", "number"] } },
          SchemaFromJson.makeGeneration(
            "Schema.Union([Schema.String, Schema.Number])",
            SchemaFromJson.makeTypes("string | number")
          )
        )
        assertGeneration(
          {
            schema: {
              "type": ["string", "number"],
              "description": "a"
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("string | number")
          )
        )
        assertGeneration(
          {
            schema: {
              "type": ["string", "number"],
              "minLength": 1,
              "description": "a"
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Union([Schema.String.check(Schema.isMinLength(1)), Schema.Number]).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("string | number")
          )
        )
      })

      it("string, null", () => {
        assertGeneration(
          { schema: { "type": ["string", "null"] } },
          SchemaFromJson.makeGeneration(
            "Schema.NullOr(Schema.String)",
            SchemaFromJson.makeTypes("string | null")
          )
        )
      })
      it("null, string", () => {
        assertGeneration(
          { schema: { "type": ["null", "string"] } },
          SchemaFromJson.makeGeneration(
            "Schema.NullOr(Schema.String)",
            SchemaFromJson.makeTypes("string | null")
          )
        )
      })
    })

    it("type: null", () => {
      assertGeneration(
        { schema: { "type": "null" } },
        SchemaFromJson.makeGeneration("Schema.Null", SchemaFromJson.makeTypes("null"))
      )
      assertGeneration(
        { schema: { "type": "null", "description": "a" } },
        SchemaFromJson.makeGeneration(
          `Schema.Null.annotate({ "description": "a" })`,
          SchemaFromJson.makeTypes("null")
        )
      )
    })

    describe("type: string", () => {
      it("baseline", () => {
        assertGeneration(
          { schema: { "type": "string" } },
          SchemaFromJson.makeGeneration("Schema.String", SchemaFromJson.makeTypes("string"))
        )
        assertGeneration(
          { schema: { "type": "string", "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.String.annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("string")
          )
        )
      })

      it("checks", () => {
        assertGeneration(
          { schema: { "minLength": 1 } },
          SchemaFromJson.makeGeneration(
            `Schema.String.check(Schema.isMinLength(1))`,
            SchemaFromJson.makeTypes("string")
          )
        )
        assertGeneration(
          { schema: { "maxLength": 10 } },
          SchemaFromJson.makeGeneration(
            `Schema.String.check(Schema.isMaxLength(10))`,
            SchemaFromJson.makeTypes("string")
          )
        )
        assertGeneration(
          { schema: { "pattern": "a/b" } },
          SchemaFromJson.makeGeneration(
            `Schema.String.check(Schema.isPattern(new RegExp("a/b")))`,
            SchemaFromJson.makeTypes("string")
          )
        )
        // should ignore invalid pattern
        assertGeneration(
          {
            schema: { "pattern": "\\" }
          },
          SchemaFromJson.makeGeneration(`Schema.String`, SchemaFromJson.makeTypes(`string`))
        )
        assertGeneration(
          { schema: { "minLength": 1, "maxLength": 10 } },
          SchemaFromJson.makeGeneration(
            `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10))`,
            SchemaFromJson.makeTypes("string")
          )
        )
        assertGeneration(
          { schema: { "minLength": 1, "maxLength": 10, "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1), Schema.isMaxLength(10))`,
            SchemaFromJson.makeTypes("string")
          )
        )
      })

      describe("allOf", () => {
        it("string & unknown", () => {
          assertGeneration(
            {
              schema: {
                "type": "string",
                "allOf": [{ "description": "a" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a" })`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "description": "a",
                "allOf": [{ "description": "b" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a, b" })`,
              SchemaFromJson.makeTypes("string")
            )
          )
        })

        it("string & string", () => {
          assertGeneration(
            {
              schema: {
                "type": "string",
                "allOf": [{ "minLength": 1 }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.isMinLength(1))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "description": "a",
                "allOf": [{ "minLength": 1 }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "allOf": [{ "minLength": 1, "description": "b" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.isMinLength(1, { "description": "b" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "description": "a",
                "allOf": [{ "minLength": 1, "description": "b" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1, { "description": "b" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "minLength": 1,
                "allOf": [
                  { "maxLength": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "minLength": 1,
                "allOf": [
                  { "maxLength": 10, "description": "a" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10, { "description": "a" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "allOf": [
                  { "minLength": 1 },
                  { "maxLength": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "description": "a",
                "allOf": [
                  { "minLength": 1 },
                  { "maxLength": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1), Schema.isMaxLength(10))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "description": "a",
                "allOf": [
                  { "description": "b" },
                  { "minLength": 1 },
                  { "maxLength": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a, b" }).check(Schema.isMinLength(1), Schema.isMaxLength(10))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "allOf": [
                  { "minLength": 1, "description": "b" },
                  { "maxLength": 10, "description": "c" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.isMinLength(1, { "description": "b" }), Schema.isMaxLength(10, { "description": "c" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "allOf": [
                  { "minLength": 1, "maxLength": 10, "description": "a" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.makeFilterGroup([Schema.isMinLength(1), Schema.isMaxLength(10)], { "description": "a" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "description": "a",
                "allOf": [
                  { "minLength": 1, "maxLength": 10, "description": "b" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a" }).check(Schema.makeFilterGroup([Schema.isMinLength(1), Schema.isMaxLength(10)], { "description": "b" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "allOf": [
                  { "minLength": 1 },
                  {
                    "allOf": [
                      { "description": "a" },
                      { "maxLength": 10 }
                    ],
                    "description": "b"
                  }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10, { "description": "b, a" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "string",
                "description": "a",
                "allOf": [
                  {
                    "allOf": [
                      { "minLength": 1 },
                      { "maxLength": 10 }
                    ],
                    "description": "b"
                  }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.String.annotate({ "description": "a" }).check(Schema.makeFilterGroup([Schema.isMinLength(1), Schema.isMaxLength(10)], { "description": "b" }))`,
              SchemaFromJson.makeTypes("string")
            )
          )
        })
      })

      it("string & enum", () => {
        assertGeneration(
          {
            schema: {
              "type": "string",
              "allOf": [{ "enum": [1, 2] }]
            }
          },
          SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
        )
        assertGeneration(
          {
            schema: {
              "type": "string",
              "allOf": [{ "enum": ["a", "b", 1] }]
            }
          },
          SchemaFromJson.makeGeneration(`Schema.Literals(["a", "b"])`, SchemaFromJson.makeTypes(`"a" | "b"`))
        )
      })
    })

    describe("type: number", () => {
      it("baseline", () => {
        assertGeneration(
          { schema: { "type": "number" } },
          SchemaFromJson.makeGeneration("Schema.Number", SchemaFromJson.makeTypes("number"))
        )
        assertGeneration(
          { schema: { "type": "number", "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Number.annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("number")
          )
        )
      })

      it("checks", () => {
        assertGeneration(
          { schema: { "minimum": 1 } },
          SchemaFromJson.makeGeneration(
            `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1))`,
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          { schema: { "maximum": 10 } },
          SchemaFromJson.makeGeneration(
            `Schema.Number.check(Schema.isLessThanOrEqualTo(10))`,
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          { schema: { "multipleOf": 10 } },
          SchemaFromJson.makeGeneration(
            `Schema.Number.check(Schema.isMultipleOf(10))`,
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          { schema: { "minimum": 1, "maximum": 10 } },
          SchemaFromJson.makeGeneration(
            `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
            SchemaFromJson.makeTypes("number")
          )
        )
        assertGeneration(
          { schema: { "minimum": 1, "maximum": 10, "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Number.annotate({ "description": "a" }).check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
            SchemaFromJson.makeTypes("number")
          )
        )
      })

      describe("allOf", () => {
        it("number & unknown", () => {
          assertGeneration(
            {
              schema: {
                "type": "number",
                "allOf": [{ "description": "a" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a" })`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "description": "a",
                "allOf": [{ "description": "b" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a, b" })`,
              SchemaFromJson.makeTypes("number")
            )
          )
        })

        it("number & number", () => {
          assertGeneration(
            {
              schema: {
                "type": "number",
                "allOf": [{ "minimum": 1 }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "description": "a",
                "allOf": [{ "minimum": 1 }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a" }).check(Schema.isGreaterThanOrEqualTo(1))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "allOf": [{ "minimum": 1, "description": "b" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1, { "description": "b" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "description": "a",
                "allOf": [{ "minimum": 1, "description": "b" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a" }).check(Schema.isGreaterThanOrEqualTo(1, { "description": "b" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "minimum": 1,
                "allOf": [
                  { "maximum": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "minimum": 1,
                "allOf": [
                  { "maximum": 10, "description": "a" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10, { "description": "a" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "allOf": [
                  { "minimum": 1 },
                  { "maximum": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "description": "a",
                "allOf": [
                  { "minimum": 1 },
                  { "maximum": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a" }).check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "description": "a",
                "allOf": [
                  { "description": "b" },
                  { "minimum": 1 },
                  { "maximum": 10 }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a, b" }).check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "allOf": [
                  { "minimum": 1, "description": "b" },
                  { "maximum": 10, "description": "c" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1, { "description": "b" }), Schema.isLessThanOrEqualTo(10, { "description": "c" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "allOf": [
                  { "minimum": 1, "maximum": 10, "description": "a" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.makeFilterGroup([Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10)], { "description": "a" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "description": "a",
                "allOf": [
                  { "minimum": 1, "maximum": 10, "description": "b" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a" }).check(Schema.makeFilterGroup([Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10)], { "description": "b" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "allOf": [
                  { "minimum": 1 },
                  {
                    "allOf": [
                      { "description": "a" },
                      { "maximum": 10 }
                    ],
                    "description": "b"
                  }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10, { "description": "b, a" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
          assertGeneration(
            {
              schema: {
                "type": "number",
                "description": "a",
                "allOf": [
                  {
                    "allOf": [
                      { "minimum": 1 },
                      { "maximum": 10 }
                    ],
                    "description": "b"
                  }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Number.annotate({ "description": "a" }).check(Schema.makeFilterGroup([Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10)], { "description": "b" }))`,
              SchemaFromJson.makeTypes("number")
            )
          )
        })
      })

      it("number & integer", () => {
        assertGeneration(
          {
            schema: {
              "type": "number",
              "allOf": [{ "type": "integer" }]
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Int",
            SchemaFromJson.makeTypes("number")
          )
        )
      })

      it("number & enum", () => {
        assertGeneration(
          {
            schema: {
              "type": "number",
              "allOf": [{ "enum": ["a", "b"] }]
            }
          },
          SchemaFromJson.makeGeneration(`Schema.Never`, SchemaFromJson.makeTypes("never"))
        )
        assertGeneration(
          {
            schema: {
              "type": "number",
              "allOf": [{ "enum": ["a", "b", 1] }]
            }
          },
          SchemaFromJson.makeGeneration(`Schema.Literal(1)`, SchemaFromJson.makeTypes("1"))
        )
      })
    })

    it("type: integer", () => {
      assertGeneration(
        { schema: { "type": "integer" } },
        SchemaFromJson.makeGeneration("Schema.Int", SchemaFromJson.makeTypes("number"))
      )
      assertGeneration(
        { schema: { "type": "integer", "description": "a" } },
        SchemaFromJson.makeGeneration(
          `Schema.Int.annotate({ "description": "a" })`,
          SchemaFromJson.makeTypes("number")
        )
      )
      assertGeneration(
        { schema: { "type": "integer", "minimum": 0 } },
        SchemaFromJson.makeGeneration(
          `Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))`,
          SchemaFromJson.makeTypes("number")
        )
      )
      assertGeneration(
        { schema: { "type": "integer", "maximum": 10 } },
        SchemaFromJson.makeGeneration(
          `Schema.Int.check(Schema.isLessThanOrEqualTo(10))`,
          SchemaFromJson.makeTypes("number")
        )
      )
      assertGeneration(
        { schema: { "type": "integer", "exclusiveMinimum": 0 } },
        SchemaFromJson.makeGeneration(
          `Schema.Int.check(Schema.isGreaterThan(0))`,
          SchemaFromJson.makeTypes("number")
        )
      )
      assertGeneration(
        { schema: { "type": "integer", "exclusiveMaximum": 10 } },
        SchemaFromJson.makeGeneration(`Schema.Int.check(Schema.isLessThan(10))`, SchemaFromJson.makeTypes("number"))
      )
      assertGeneration(
        { schema: { "type": "integer", "multipleOf": 10 } },
        SchemaFromJson.makeGeneration(
          `Schema.Int.check(Schema.isMultipleOf(10))`,
          SchemaFromJson.makeTypes("number")
        )
      )
      assertGeneration(
        { schema: { "type": "integer", "minimum": 1, "maximum": 10 } },
        SchemaFromJson.makeGeneration(
          `Schema.Int.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
          SchemaFromJson.makeTypes("number")
        )
      )
      assertGeneration(
        { schema: { "type": "integer", "minimum": 1, "maximum": 10, "description": "a" } },
        SchemaFromJson.makeGeneration(
          `Schema.Int.annotate({ "description": "a" }).check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
          SchemaFromJson.makeTypes("number")
        )
      )
    })

    it("type: boolean", () => {
      assertGeneration(
        { schema: { "type": "boolean" } },
        SchemaFromJson.makeGeneration("Schema.Boolean", SchemaFromJson.makeTypes("boolean"))
      )
      assertGeneration(
        { schema: { "type": "boolean", "description": "a" } },
        SchemaFromJson.makeGeneration(
          `Schema.Boolean.annotate({ "description": "a" })`,
          SchemaFromJson.makeTypes("boolean")
        )
      )
    })

    describe("type: array", () => {
      it("unknown array", () => {
        assertGeneration(
          { schema: { "type": "array" } },
          SchemaFromJson.makeGeneration(
            "Schema.Array(Schema.Unknown)",
            SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
          )
        )
        assertGeneration(
          { schema: { "type": "array", "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Array(Schema.Unknown).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
          )
        )
        assertGeneration(
          { schema: { "minItems": 1 } },
          SchemaFromJson.makeGeneration(
            `Schema.Array(Schema.Unknown).check(Schema.isMinLength(1))`,
            SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
          )
        )
        assertGeneration(
          { schema: { "maxItems": 10 } },
          SchemaFromJson.makeGeneration(
            `Schema.Array(Schema.Unknown).check(Schema.isMaxLength(10))`,
            SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
          )
        )
        assertGeneration(
          { schema: { "additionalItems": false, "minItems": 1 } },
          SchemaFromJson.makeGeneration(
            `Schema.Tuple([])`,
            SchemaFromJson.makeTypes("readonly []")
          )
        )
        assertGeneration(
          { schema: { "uniqueItems": true } },
          SchemaFromJson.makeGeneration(
            `Schema.Array(Schema.Unknown).check(Schema.isUnique())`,
            SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
          )
        )
        assertGeneration(
          { schema: { "items": [] } },
          SchemaFromJson.makeGeneration(
            "Schema.Array(Schema.Unknown)",
            SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
          )
        )
        assertGeneration(
          { schema: { "items": {} } },
          SchemaFromJson.makeGeneration(
            "Schema.Array(Schema.Unknown)",
            SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
          )
        )
      })

      it("empty tuple", () => {
        assertGeneration(
          {
            schema: {
              "items": [],
              "additionalItems": false
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Tuple([])",
            SchemaFromJson.makeTypes("readonly []")
          )
        )
        assertGeneration(
          {
            schema: {
              "items": [],
              "additionalItems": false,
              "description": "a"
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Tuple([]).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("readonly []")
          )
        )
      })

      it("required elements", () => {
        assertGeneration(
          {
            schema: {
              "items": [{ "type": "string" }],
              "additionalItems": false,
              "minItems": 1
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Tuple([Schema.String])",
            SchemaFromJson.makeTypes("readonly [string]")
          )
        )
      })

      it("optional elements", () => {
        assertGeneration(
          {
            schema: {
              "items": [{ "type": "string" }],
              "additionalItems": false
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Tuple([Schema.optionalKey(Schema.String)])",
            SchemaFromJson.makeTypes("readonly [string?]")
          )
        )
        assertGeneration(
          {
            schema: {
              "items": [{ "type": "string" }],
              "additionalItems": false,
              "description": "a"
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("readonly [string?]")
          )
        )
        assertGeneration(
          {
            schema: {
              "items": [{ "type": "string" }],
              "additionalItems": false,
              "minItems": 0
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Tuple([Schema.optionalKey(Schema.String)])`,
            SchemaFromJson.makeTypes("readonly [string?]")
          )
        )
      })

      it("required elements & rest", () => {
        assertGeneration(
          {
            schema: {
              "minItems": 1,
              "items": [
                { "type": "string" }
              ],
              "additionalItems": {
                "type": "number"
              }
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])`,
            SchemaFromJson.makeTypes("readonly [string, ...Array<number>]")
          )
        )
      })

      describe("allOf", () => {
        it("array & unknown", () => {
          assertGeneration(
            {
              schema: {
                "type": "array",
                "allOf": [{ "description": "a" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Array(Schema.Unknown).annotate({ "description": "a" })`,
              SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
            )
          )
        })

        it("tuple & array", () => {
          assertGeneration(
            {
              schema: {
                "minItems": 1,
                "items": [{ "type": "string" }],
                "allOf": [{ "items": { "type": "string" } }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.String])`,
              SchemaFromJson.makeTypes("readonly [string, ...Array<string>]")
            )
          )
        })

        it("tuple & union of arrays", () => {
          assertGeneration(
            {
              schema: {
                "minItems": 1,
                "items": [{ "type": "string" }],
                "allOf": [
                  {
                    "anyOf": [
                      { "items": { "type": "string" } },
                      { "items": { "type": "number" } }
                    ]
                  }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Union([Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.String]), Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])])`,
              SchemaFromJson.makeTypes("readonly [string, ...Array<string>] | readonly [string, ...Array<number>]")
            )
          )
        })

        it("array & array", () => {
          assertGeneration(
            {
              schema: {
                "type": "array",
                "allOf": [
                  { "uniqueItems": true, "description": "a" }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Array(Schema.Unknown).check(Schema.isUnique({ "description": "a" }))`,
              SchemaFromJson.makeTypes("ReadonlyArray<unknown>")
            )
          )
        })

        it("union of arrays & tuple", () => {
          assertGeneration(
            {
              schema: {
                "anyOf": [
                  { "items": { "type": "string" } },
                  { "items": { "type": "number" } }
                ],
                "allOf": [
                  {
                    "minItems": 1,
                    "items": [{ "type": "string" }]
                  }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Union([Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.String]), Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])])`,
              SchemaFromJson.makeTypes("readonly [string, ...Array<string>] | readonly [string, ...Array<number>]")
            )
          )
        })
      })
    })

    describe("type: object", () => {
      it("unknown object", () => {
        assertGeneration(
          { schema: { "type": "object" } },
          SchemaFromJson.makeGeneration(
            "Schema.Record(Schema.String, Schema.Unknown)",
            SchemaFromJson.makeTypes("{ readonly [x: string]: unknown }")
          )
        )
        assertGeneration(
          { schema: { "type": "object", "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Record(Schema.String, Schema.Unknown).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("{ readonly [x: string]: unknown }")
          )
        )
        assertGeneration(
          { schema: { "minProperties": 1 } },
          SchemaFromJson.makeGeneration(
            `Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMinProperties(1))`,
            SchemaFromJson.makeTypes("{ readonly [x: string]: unknown }")
          )
        )
        assertGeneration(
          { schema: { "maxProperties": 10 } },
          SchemaFromJson.makeGeneration(
            `Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMaxProperties(10))`,
            SchemaFromJson.makeTypes("{ readonly [x: string]: unknown }")
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": {}
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Record(Schema.String, Schema.Unknown)",
            SchemaFromJson.makeTypes("{ readonly [x: string]: unknown }")
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": {},
              "additionalProperties": false
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Record(Schema.String, Schema.Never)",
            SchemaFromJson.makeTypes("{ readonly [x: string]: never }")
          )
        )
      })

      it("required properties", () => {
        assertGeneration(
          {
            schema: {
              "required": ["a"],
              "additionalProperties": false
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.Unknown })`,
            SchemaFromJson.makeTypes(`{ readonly "a": unknown }`)
          )
        )
        assertGeneration(
          {
            schema: {
              "required": ["a"]
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.StructWithRest(Schema.Struct({ "a": Schema.Unknown }), [Schema.Record(Schema.String, Schema.Unknown)])`,
            SchemaFromJson.makeTypes(`{ readonly "a": unknown, readonly [x: string]: unknown }`)
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": { "a": { "type": "string" } },
              "required": ["a"],
              "additionalProperties": false
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string }`)
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": { "a": { "type": "string" } },
              "required": ["a", "b"],
              "additionalProperties": false
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String, "b": Schema.Unknown })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": unknown }`)
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": { "a-b": { "type": "string" } },
              "required": ["a-b"],
              "additionalProperties": false
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a-b": Schema.String })`,
            SchemaFromJson.makeTypes(`{ readonly "a-b": string }`)
          )
        )
      })

      it("optional properties", () => {
        assertGeneration(
          {
            schema: {
              "properties": { "a": { "type": "string" } },
              "additionalProperties": false
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`,
            SchemaFromJson.makeTypes(`{ readonly "a"?: string }`)
          )
        )
      })

      it("missing additionalProperties", () => {
        assertGeneration(
          {
            schema: {
              "properties": { "a": { "type": "string" } },
              "required": ["a"]
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.Unknown)])`,
            SchemaFromJson.makeTypes(`{ readonly "a": string, readonly [x: string]: unknown }`)
          )
        )
      })

      it("additionalProperties: true", () => {
        assertGeneration(
          {
            schema: {
              "properties": { "a": { "type": "string" } },
              "required": ["a"],
              "additionalProperties": true
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.Unknown)])`,
            SchemaFromJson.makeTypes(`{ readonly "a": string, readonly [x: string]: unknown }`)
          )
        )
      })

      describe("allOf", () => {
        it("object & unknown", () => {
          assertGeneration(
            {
              schema: {
                "type": "object",
                "allOf": [{ "description": "a" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Record(Schema.String, Schema.Unknown).annotate({ "description": "a" })`,
              SchemaFromJson.makeTypes("{ readonly [x: string]: unknown }")
            )
          )
          assertGeneration(
            {
              schema: {
                "minProperties": 1,
                "allOf": [{ "description": "b" }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Record(Schema.String, Schema.Unknown).annotate({ "description": "b" }).check(Schema.isMinProperties(1))`,
              SchemaFromJson.makeTypes("{ readonly [x: string]: unknown }")
            )
          )
        })

        it("struct & struct", () => {
          assertGeneration(
            {
              schema: {
                "properties": { "a": { "type": "string" } },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [{
                  "properties": { "b": { "type": "string" } },
                  "required": ["b"],
                  "additionalProperties": false
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "b": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "properties": { "a": { "type": "string" } },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [{
                  "properties": { "b": { "type": "string" } },
                  "additionalProperties": false
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "b": Schema.optionalKey(Schema.String) })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b"?: string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "properties": {
                  "a": { "type": "string" },
                  "b": { "type": "string" }
                },
                "required": ["a", "b"],
                "additionalProperties": false,
                "allOf": [{
                  "properties": {
                    "b": { "enum": ["b"] },
                    "c": { "type": "string" }
                  },
                  "required": ["c"],
                  "additionalProperties": false
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "b": Schema.Literal("b"), "c": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": "b", readonly "c": string }`)
            )
          )
        })

        it("struct & record", () => {
          assertGeneration(
            {
              schema: {
                "properties": { "a": { "type": "string" } },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [{
                  "additionalProperties": { "type": "string" }
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "properties": { "a": { "type": "string" } },
                "required": ["a"],
                "additionalProperties": true,
                "allOf": [{
                  "additionalProperties": { "type": "string" }
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.String)])`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly [x: string]: string }`)
            )
          )
        })

        it("record & struct", () => {
          assertGeneration(
            {
              schema: {
                "additionalProperties": { "type": "string" },
                "allOf": [{
                  "properties": { "a": { "type": "string" } },
                  "required": ["a"],
                  "additionalProperties": false
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "additionalProperties": { "type": "string" },
                "allOf": [{
                  "properties": { "a": { "type": "string" } },
                  "required": ["a"],
                  "additionalProperties": true
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.String)])`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly [x: string]: string }`)
            )
          )
        })

        it("record & record", () => {
          assertGeneration(
            {
              schema: {
                "additionalProperties": { "required": ["a"] },
                "allOf": [{
                  "additionalProperties": { "required": ["b"], "additionalProperties": false }
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Record(Schema.String, Schema.Struct({ "a": Schema.Unknown, "b": Schema.Unknown }))`,
              SchemaFromJson.makeTypes(`{ readonly [x: string]: { readonly "a": unknown, readonly "b": unknown } }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "additionalProperties": { "required": ["a"] },
                "allOf": [{
                  "additionalProperties": { "required": ["b"] }
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Record(Schema.String, Schema.StructWithRest(Schema.Struct({ "a": Schema.Unknown, "b": Schema.Unknown }), [Schema.Record(Schema.String, Schema.Unknown)]))`,
              SchemaFromJson.makeTypes(
                `{ readonly [x: string]: { readonly "a": unknown, readonly "b": unknown, readonly [x: string]: unknown } }`
              )
            )
          )
        })

        it("struct & union", () => {
          assertGeneration(
            {
              schema: {
                "properties": { "a": { "type": "string" } },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [
                  {
                    "anyOf": [
                      {
                        "properties": { "b": { "type": "string" } },
                        "required": ["b"],
                        "additionalProperties": false
                      },
                      {
                        "properties": { "c": { "type": "string" } },
                        "additionalProperties": false
                      }
                    ]
                  }
                ]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Union([Schema.Struct({ "a": Schema.String, "b": Schema.String }), Schema.Struct({ "a": Schema.String, "c": Schema.optionalKey(Schema.String) })])`,
              SchemaFromJson.makeTypes(
                `{ readonly "a": string, readonly "b": string } | { readonly "a": string, readonly "c"?: string }`
              )
            )
          )
        })

        it("union & struct", () => {
          assertGeneration(
            {
              schema: {
                "anyOf": [
                  {
                    "properties": { "b": { "type": "string" } },
                    "required": ["b"],
                    "additionalProperties": false
                  },
                  {
                    "properties": { "c": { "type": "string" } },
                    "additionalProperties": false
                  }
                ],
                "allOf": [{
                  "properties": { "a": { "type": "string" } },
                  "required": ["a"],
                  "additionalProperties": false
                }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Union([Schema.Struct({ "b": Schema.String, "a": Schema.String }), Schema.Struct({ "c": Schema.optionalKey(Schema.String), "a": Schema.String })])`,
              SchemaFromJson.makeTypes(
                `{ readonly "b": string, readonly "a": string } | { readonly "c"?: string, readonly "a": string }`
              )
            )
          )
        })

        it("object & $ref", () => {
          assertGeneration(
            {
              schema: {
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [
                  { "$ref": "#/definitions/B" }
                ],
                "definitions": {
                  "B": {
                    "properties": {
                      "b": { "type": "string" }
                    },
                    "required": ["b"],
                    "additionalProperties": false
                  }
                }
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "b": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [
                  { "$ref": "#/definitions/B" }
                ],
                "definitions": {
                  "B": {
                    "properties": {
                      "b": { "$ref": "#/definitions/C" }
                    },
                    "required": ["b"],
                    "additionalProperties": false
                  },
                  "C": {
                    "type": "string"
                  }
                }
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "b": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [
                  { "$ref": "#/definitions/B" }
                ]
              },
              options: {
                definitions: {
                  "B": {
                    "properties": {
                      "b": { "type": "string" }
                    },
                    "required": ["b"],
                    "additionalProperties": false
                  }
                }
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "b": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [
                  { "$ref": "#/definitions/B" }
                ]
              },
              options: {
                definitions: {
                  "B": {
                    "properties": {
                      "b": { "$ref": "#/definitions/C" }
                    },
                    "required": ["b"],
                    "additionalProperties": false
                  },
                  "C": {
                    "type": "string"
                  }
                }
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "b": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "b": string }`)
            )
          )
          assertGeneration(
            {
              schema: {
                "properties": {
                  "a": { "type": "string" }
                },
                "required": ["a"],
                "additionalProperties": false,
                "allOf": [
                  { "$ref": "#/definitions/B/definitions/C" }
                ]
              },
              options: {
                definitions: {
                  "B": {
                    "properties": {
                      "b": { "type": "string" }
                    },
                    "required": ["b"],
                    "definitions": {
                      "C": {
                        "properties": {
                          "c": { "type": "string" }
                        },
                        "required": ["c"],
                        "additionalProperties": false
                      }
                    }
                  }
                }
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Struct({ "a": Schema.String, "c": Schema.String })`,
              SchemaFromJson.makeTypes(`{ readonly "a": string, readonly "c": string }`)
            )
          )
        })
      })
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertGeneration(
          { schema: { "anyOf": [{ "type": "string" }, { "type": "number" }] } },
          SchemaFromJson.makeGeneration(
            "Schema.Union([Schema.String, Schema.Number])",
            SchemaFromJson.makeTypes("string | number")
          )
        )
        assertGeneration(
          { schema: { "anyOf": [{ "type": "string" }, { "type": "number" }], "description": "a" } },
          SchemaFromJson.makeGeneration(
            `Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "a" })`,
            SchemaFromJson.makeTypes("string | number")
          )
        )
      })

      it("oneOf", () => {
        assertGeneration(
          { schema: { "oneOf": [{ "type": "string" }, { "type": "number" }] } },
          SchemaFromJson.makeGeneration(
            `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })`,
            SchemaFromJson.makeTypes("string | number")
          )
        )
      })

      describe("allOf", () => {
        it("anyOf & anyOf", () => {
          assertGeneration(
            {
              schema: {
                "anyOf": [
                  { "type": "string" },
                  { "type": "number" }
                ],
                "allOf": [{ "anyOf": [{ "type": "boolean" }, { "type": "null" }] }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])`,
              SchemaFromJson.makeTypes("string | number | boolean | null")
            )
          )
        })

        it("oneOf & oneOf", () => {
          assertGeneration(
            {
              schema: {
                "oneOf": [
                  { "type": "string" },
                  { "type": "number" }
                ],
                "allOf": [{ "oneOf": [{ "type": "boolean" }, { "type": "null" }] }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null], { mode: "oneOf" })`,
              SchemaFromJson.makeTypes("string | number | boolean | null")
            )
          )
        })

        it("anyOf & oneOf", () => {
          assertGeneration(
            {
              schema: {
                "anyOf": [
                  { "type": "string" },
                  { "type": "number" }
                ],
                "allOf": [{ "oneOf": [{ "type": "boolean" }, { "type": "null" }] }]
              }
            },
            SchemaFromJson.makeGeneration(
              `Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])`,
              SchemaFromJson.makeTypes("string | number | boolean | null")
            )
          )
        })
      })
    })

    describe("$ref", () => {
      it("invalid $ref", () => {
        expect(() => {
          SchemaFromJson.generate({ $ref: "" }, { source: "draft-07" })
        }).toThrow(`Invalid $ref: ""`)
        expect(() => {
          SchemaFromJson.generate({ $ref: "#" }, { source: "draft-07" })
        }).toThrow(`Invalid $ref: "#"`)
        expect(() => {
          SchemaFromJson.generate({ $ref: "#/" }, { source: "draft-07" })
        }).toThrow(`Invalid $ref: "#/"`)
      })

      it("should handle allOf with unresolvable references", () => {
        assertGeneration(
          {
            schema: {
              allOf: [
                { $ref: "#/definitions/Missing" },
                { type: "string" }
              ]
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Never",
            SchemaFromJson.makeTypes("never")
          )
        )
      })

      it("should handle allOf with circular references in refStack", () => {
        assertGeneration(
          {
            schema: { $ref: "#/definitions/A" },
            options: {
              definitions: {
                A: {
                  allOf: [
                    { $ref: "#/definitions/B" }
                  ]
                },
                B: {
                  allOf: [
                    { $ref: "#/definitions/A" }
                  ]
                }
              }
            }
          },
          SchemaFromJson.makeGeneration(
            "Schema.Unknown",
            SchemaFromJson.makeTypes("unknown")
          )
        )
      })

      it("$ref", () => {
        const options: SchemaFromJson.GenerateOptions = {
          source: "draft-07",
          resolver: (ref) => {
            const identifier = ref.replace(/[/~]/g, "$")
            return SchemaFromJson.makeGeneration(
              identifier,
              SchemaFromJson.makeTypes(
                `T${identifier}`,
                `E${identifier}`,
                `DS${identifier}`,
                `ES${identifier}`
              )
            )
          }
        }

        assertGeneration(
          {
            schema: {
              "$ref": "#/definitions/A"
            },
            options
          },
          SchemaFromJson.makeGeneration(
            "A",
            SchemaFromJson.makeTypes("TA", "EA", "DSA", "ESA")
          )
        )
        // should ignore annotations on the referenced schema
        assertGeneration(
          {
            schema: {
              "$ref": "#/definitions/A",
              "description": "a"
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `A`,
            SchemaFromJson.makeTypes("TA", "EA", "DSA", "ESA")
          )
        )
        assertGeneration(
          {
            schema: {
              "type": "array",
              "minItems": 1,
              "items": [
                { "$ref": "#/definitions/A" }
              ],
              "additionalItems": false
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Tuple([A])`,
            SchemaFromJson.makeTypes("readonly [TA]", "readonly [EA]", "DSA", "ESA")
          )
        )
        assertGeneration(
          {
            schema: {
              "type": "array",
              "minItems": 2,
              "items": [
                { "$ref": "#/definitions/A" },
                { "$ref": "#/definitions/B" }
              ],
              "additionalItems": false
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Tuple([A, B])`,
            SchemaFromJson.makeTypes("readonly [TA, TB]", "readonly [EA, EB]", "DSA | DSB", "ESA | ESB")
          )
        )
        assertGeneration(
          {
            schema: {
              "type": "array",
              "items": { "$ref": "#/definitions/A" }
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Array(A)`,
            SchemaFromJson.makeTypes("ReadonlyArray<TA>", "ReadonlyArray<EA>", "DSA", "ESA")
          )
        )
        assertGeneration(
          {
            schema: {
              "type": "array",
              "minItems": 1,
              "items": [
                { "$ref": "#/definitions/A" }
              ],
              "additionalItems": { "$ref": "#/definitions/B" }
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([A]), [B])`,
            SchemaFromJson.makeTypes(
              "readonly [TA, ...Array<TB>]",
              "readonly [EA, ...Array<EB>]",
              "DSA | DSB",
              "ESA | ESB"
            )
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/A" }
              },
              "required": ["a"],
              "additionalProperties": false
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": A })`,
            SchemaFromJson.makeTypes(`{ readonly "a": TA }`, `{ readonly "a": EA }`, "DSA", "ESA")
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/A" },
                "b": { "$ref": "#/definitions/B" }
              },
              "required": ["a", "b"],
              "additionalProperties": false
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": A, "b": B })`,
            SchemaFromJson.makeTypes(
              `{ readonly "a": TA, readonly "b": TB }`,
              `{ readonly "a": EA, readonly "b": EB }`,
              "DSA | DSB",
              "ESA | ESB"
            )
          )
        )
        assertGeneration(
          {
            schema: {
              "additionalProperties": { "$ref": "#/definitions/A" }
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Record(Schema.String, A)`,
            SchemaFromJson.makeTypes("{ readonly [x: string]: TA }", "{ readonly [x: string]: EA }", "DSA", "ESA")
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/A" }
              },
              "required": ["a"],
              "additionalProperties": { "$ref": "#/definitions/B" }
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.StructWithRest(Schema.Struct({ "a": A }), [Schema.Record(Schema.String, B)])`,
            SchemaFromJson.makeTypes(
              `{ readonly "a": TA, readonly [x: string]: TB }`,
              `{ readonly "a": EA, readonly [x: string]: EB }`,
              "DSA | DSB",
              "ESA | ESB"
            )
          )
        )
        assertGeneration(
          {
            schema: {
              "anyOf": [
                { "$ref": "#/definitions/A" },
                { "$ref": "#/definitions/B" }
              ]
            },
            options
          },
          SchemaFromJson.makeGeneration(
            `Schema.Union([A, B])`,
            SchemaFromJson.makeTypes("TA | TB", "EA | EB", "DSA | DSB", "ESA | ESB")
          )
        )
      })

      it("should inline local definitions", () => {
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/A" }
              },
              "required": ["a"],
              "additionalProperties": false,
              "definitions": {
                "A": {
                  "type": "string"
                }
              }
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string }`)
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/A" }
              },
              "required": ["a"],
              "additionalProperties": false,
              "definitions": {
                "A": { "$ref": "#/definitions/B" },
                "B": {
                  "type": "string"
                }
              }
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string }`)
          )
        )
        // prevent stack overflow
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/A" }
              },
              "required": ["a"],
              "additionalProperties": false,
              "definitions": {
                "A": { "$ref": "#/definitions/A" }
              }
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.Unknown })`,
            SchemaFromJson.makeTypes(`{ readonly "a": unknown }`)
          )
        )
        // nested inline definitions
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/B/definitions/C" }
              },
              "required": ["a"],
              "additionalProperties": false,
              "definitions": {
                "B": {
                  "properties": {
                    "b": { "type": "string" }
                  },
                  "required": ["b"],
                  "definitions": {
                    "C": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string }`)
          )
        )
        assertGeneration(
          {
            schema: {
              "properties": {
                "a": { "$ref": "#/definitions/B/definitions/C/properties/b" }
              },
              "required": ["a"],
              "additionalProperties": false,
              "definitions": {
                "B": {
                  "properties": {
                    "b": { "type": "string" }
                  },
                  "required": ["b"],
                  "additionalProperties": false,
                  "definitions": {
                    "C": {
                      "properties": {
                        "b": { "type": "string" }
                      },
                      "required": ["b"],
                      "additionalProperties": false
                    }
                  }
                }
              }
            }
          },
          SchemaFromJson.makeGeneration(
            `Schema.Struct({ "a": Schema.String })`,
            SchemaFromJson.makeTypes(`{ readonly "a": string }`)
          )
        )
      })
    })
  })

  describe("generateDefinitions", () => {
    function generate(
      definitions: JsonSchema.Definitions,
      schemas: ReadonlyArray<JsonSchema.JsonSchema>
    ) {
      const resolver: SchemaFromJson.Resolver = (ref) => {
        return SchemaFromJson.makeGeneration(
          ref,
          SchemaFromJson.makeTypes(ref)
        )
      }
      const genDependencies = SchemaFromJson.generateDefinitions(definitions, { source: "draft-07", resolver })
      const genSchemas = schemas.map((schema) =>
        SchemaFromJson.generate(schema, { source: "draft-07", resolver, definitions })
      )
      let s = ""

      s += "// Definitions\n"
      genDependencies.forEach(({ generation: schema, ref }) => {
        s += `type ${ref} = ${schema.types.Type};\n`
        s += `const ${ref} = ${schema.code};\n\n`
      })

      s += "// Schemas\n"
      s += genSchemas.map(({ code: runtime }, i) => `const schema${i + 1} = ${runtime};`).join("\n")
      return s
    }

    it("mutually recursive", () => {
      interface Expression {
        readonly type: "expression"
        readonly value: number | Operation
      }

      interface Operation {
        readonly type: "operation"
        readonly operator: "+" | "-"
        readonly left: Expression
        readonly right: Expression
      }

      const Expression = Schema.Struct({
        type: Schema.Literal("expression"),
        value: Schema.Union([Schema.Int, Schema.suspend((): Schema.Codec<Operation> => Operation)])
      }).annotate({ identifier: "Expression" })

      const Operation = Schema.Struct({
        type: Schema.Literal("operation"),
        operator: Schema.Literals(["+", "-"]),
        left: Expression,
        right: Expression
      }).annotate({ identifier: "Operation" })

      {
        const document = Schema.toJsonSchemaDocument(Operation)
        strictEqual(
          generate(document.definitions, [document.schema]),
          `// Definitions
type Expression = { readonly "type": "expression", readonly "value": number | Operation };
const Expression = Schema.Struct({ "type": Schema.Literal("expression"), "value": Schema.Union([Schema.Int, Schema.suspend((): Schema.Codec<Operation> => Operation)]) }).annotate({ "identifier": "Expression" });

type Operation = { readonly "type": "operation", readonly "operator": "+" | "-", readonly "left": Expression, readonly "right": Expression };
const Operation = Schema.Struct({ "type": Schema.Literal("operation"), "operator": Schema.Union([Schema.Literal("+"), Schema.Literal("-")]), "left": Schema.suspend((): Schema.Codec<Expression> => Expression), "right": Schema.suspend((): Schema.Codec<Expression> => Expression) }).annotate({ "identifier": "Operation" });

// Schemas
const schema1 = Operation;`
        )
      }
      {
        const document = Schema.toJsonSchemaDocument(Expression)
        strictEqual(
          generate(document.definitions, [document.schema]),
          `// Definitions
type Expression = { readonly "type": "expression", readonly "value": number | { readonly "type": "operation", readonly "operator": "+" | "-", readonly "left": Expression, readonly "right": Expression } };
const Expression = Schema.Struct({ "type": Schema.Literal("expression"), "value": Schema.Union([Schema.Int, Schema.Struct({ "type": Schema.Literal("operation"), "operator": Schema.Union([Schema.Literal("+"), Schema.Literal("-")]), "left": Schema.suspend((): Schema.Codec<Expression> => Expression), "right": Schema.suspend((): Schema.Codec<Expression> => Expression) })]) }).annotate({ "identifier": "Expression" });

// Schemas
const schema1 = Expression;`
        )
      }
    })

    it("nested identifiers", () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: Schema.Struct({
            c: Schema.String.annotate({ identifier: "C" })
          }).annotate({ identifier: "B" })
        }).annotate({ identifier: "A" })
      })
      const document = Schema.toJsonSchemaDocument(schema)
      strictEqual(
        generate(document.definitions, [document.schema]),
        `// Definitions
// Schemas
const schema1 = Schema.Struct({ "a": Schema.Struct({ "b": Schema.Struct({ "c": Schema.String }) }) });`
      )
    })
  })

  describe("topologicalSort", () => {
    type TopologicalSort = {
      readonly nonRecursives: ReadonlyArray<{
        readonly ref: string
        readonly schema: JsonSchema.JsonSchema
      }>
      readonly recursives: {
        readonly [ref: string]: JsonSchema.JsonSchema
      }
    }

    function assertTopologicalSort(
      definitions: JsonSchema.Definitions,
      expected: TopologicalSort
    ) {
      const result = SchemaFromJson.topologicalSort(definitions)
      deepStrictEqual(result, expected)
    }

    it("empty definitions", () => {
      assertTopologicalSort(
        {},
        { nonRecursives: [], recursives: {} }
      )
    })

    it("single definition with no dependencies", () => {
      assertTopologicalSort(
        {
          A: { type: "string" }
        },
        {
          nonRecursives: [
            { ref: "A", schema: { type: "string" } }
          ],
          recursives: {}
        }
      )
    })

    it("multiple independent definitions", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: { type: "number" },
        C: { type: "boolean" }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { type: "number" } },
          { ref: "C", schema: { type: "boolean" } }
        ],
        recursives: {}
      })
    })

    it("linear dependencies (A -> B -> C)", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: { $ref: "#/definitions/A" },
        C: { $ref: "#/definitions/B" }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { $ref: "#/definitions/A" } },
          { ref: "C", schema: { $ref: "#/definitions/B" } }
        ],
        recursives: {}
      })
    })

    it("branching dependencies (A -> B, A -> C)", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: { $ref: "#/definitions/A" },
        C: { $ref: "#/definitions/A" }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { $ref: "#/definitions/A" } },
          { ref: "C", schema: { $ref: "#/definitions/A" } }
        ],
        recursives: {}
      })
    })

    it("complex dependencies (A -> B -> C, A -> D)", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: { $ref: "#/definitions/A" },
        C: { $ref: "#/definitions/B" },
        D: { $ref: "#/definitions/A" }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { $ref: "#/definitions/A" } },
          { ref: "D", schema: { $ref: "#/definitions/A" } },
          { ref: "C", schema: { $ref: "#/definitions/B" } }
        ],
        recursives: {}
      })
    })

    it("self-referential definition (A -> A)", () => {
      assertTopologicalSort({
        A: { $ref: "#/definitions/A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { $ref: "#/definitions/A" }
        }
      })
    })

    it("mutual recursion (A -> B -> A)", () => {
      assertTopologicalSort({
        A: { $ref: "#/definitions/B" },
        B: { $ref: "#/definitions/A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { $ref: "#/definitions/B" },
          B: { $ref: "#/definitions/A" }
        }
      })
    })

    it("complex cycle (A -> B -> C -> A)", () => {
      assertTopologicalSort({
        A: { $ref: "#/definitions/B" },
        B: { $ref: "#/definitions/C" },
        C: { $ref: "#/definitions/A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { $ref: "#/definitions/B" },
          B: { $ref: "#/definitions/C" },
          C: { $ref: "#/definitions/A" }
        }
      })
    })

    it("mixed recursive and non-recursive definitions", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: { $ref: "#/definitions/A" },
        C: { $ref: "#/definitions/C" },
        D: { $ref: "#/definitions/E" },
        E: { $ref: "#/definitions/D" }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { $ref: "#/definitions/A" } }
        ],
        recursives: {
          C: { $ref: "#/definitions/C" },
          D: { $ref: "#/definitions/E" },
          E: { $ref: "#/definitions/D" }
        }
      })
    })

    it("nested $ref in object properties", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: {
          type: "object",
          properties: {
            value: { $ref: "#/definitions/A" }
          }
        }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { type: "object", properties: { value: { $ref: "#/definitions/A" } } } }
        ],
        recursives: {}
      })
    })

    it("nested $ref in array items", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: {
          type: "array",
          items: { $ref: "#/definitions/A" }
        }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { type: "array", items: { $ref: "#/definitions/A" } } }
        ],
        recursives: {}
      })
    })

    it("nested $ref in anyOf", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: {
          anyOf: [
            { $ref: "#/definitions/A" },
            { type: "number" }
          ]
        }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          { ref: "B", schema: { anyOf: [{ $ref: "#/definitions/A" }, { type: "number" }] } }
        ],
        recursives: {}
      })
    })

    it("external $ref (not in definitions) should be ignored", () => {
      assertTopologicalSort({
        A: { $ref: "#/definitions/External" },
        B: { $ref: "#/definitions/A" }
      }, {
        nonRecursives: [
          { ref: "A", schema: { $ref: "#/definitions/External" } },
          { ref: "B", schema: { $ref: "#/definitions/A" } }
        ],
        recursives: {}
      })
    })

    it("deeply nested $ref in complex structure", () => {
      assertTopologicalSort({
        A: { type: "string" },
        B: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                anyOf: [
                  { $ref: "#/definitions/A" },
                  {
                    type: "object",
                    properties: {
                      nested: { $ref: "#/definitions/A" }
                    }
                  }
                ]
              }
            }
          }
        }
      }, {
        nonRecursives: [
          { ref: "A", schema: { type: "string" } },
          {
            ref: "B",
            schema: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    anyOf: [{ $ref: "#/definitions/A" }, {
                      type: "object",
                      properties: { nested: { $ref: "#/definitions/A" } }
                    }]
                  }
                }
              }
            }
          }
        ],
        recursives: {}
      })
    })

    it("multiple cycles with independent definitions", () => {
      assertTopologicalSort({
        Independent: { type: "string" },
        A: { $ref: "#/definitions/B" },
        B: { $ref: "#/definitions/A" },
        C: { $ref: "#/definitions/D" },
        D: { $ref: "#/definitions/C" }
      }, {
        nonRecursives: [
          { ref: "Independent", schema: { type: "string" } }
        ],
        recursives: {
          A: { $ref: "#/definitions/B" },
          B: { $ref: "#/definitions/A" },
          C: { $ref: "#/definitions/D" },
          D: { $ref: "#/definitions/C" }
        }
      })
    })

    it("definition depending on recursive definition", () => {
      assertTopologicalSort({
        A: { $ref: "#/definitions/A" },
        B: { $ref: "#/definitions/A" }
      }, {
        nonRecursives: [
          { ref: "B", schema: { $ref: "#/definitions/A" } }
        ],
        recursives: {
          A: { $ref: "#/definitions/A" }
        }
      })
    })

    it("escaped $ref", () => {
      assertTopologicalSort({
        A: { $ref: "#/definitions/~01A" }
      }, {
        nonRecursives: [
          { ref: "A", schema: { $ref: "#/definitions/~01A" } }
        ],
        recursives: {}
      })
    })
  })

  describe("generateCode", () => {
    it("smoke test", () => {
      const generation = generateCode(
        "draft-07",
        [
          {
            identifier: "A",
            schema: {
              "type": "string",
              "description": "A string schema"
            }
          }
        ],
        {
          "B": {
            "type": "string",
            "description": "A string definition"
          }
        },
        {}
      )
      const code = toCode(generation)
      strictEqual(
        code,
        `import * as Schema from "effect/Schema"

/** A string definition */
export type B = string
export type BEncoded = B

/** A string definition */
export const B = Schema.String.annotate({ "description": "A string definition" }).annotate({ "identifier": "B" })

/** A string schema */
export type A = string
export type AEncoded = A

/** A string schema */
export const A = Schema.String.annotate({ "description": "A string schema" })
`
      )
    })

    it("recursion & external reference", () => {
      const generation = generateCode(
        "draft-07",
        [
          {
            identifier: "A",
            schema: {
              "properties": {
                "a": {
                  "$ref": "#/definitions/B"
                }
              },
              "required": ["a"],
              "additionalProperties": false
            }
          }
        ],
        {
          "B": {
            "properties": {
              "b": {
                "$ref": "#/definitions/B"
              },
              "c": {
                "$ref": "#/definitions/C-id"
              }
            },
            "required": ["b", "c"],
            "additionalProperties": false
          }
        },
        {
          "C-id": {
            namespace: "C",
            importDeclaration: `import { C } from "my-lib"`
          }
        }
      )
      const code = toCode(generation)
      strictEqual(
        code,
        `import * as Schema from "effect/Schema"
import { C } from "my-lib"
export type B = { readonly "b": B, readonly "c": typeof C["Type"] }
export type BEncoded = { readonly "b": BEncoded, readonly "c": typeof C["Encoded"] }
export const B = Schema.Struct({ "b": Schema.suspend((): Schema.Codec<B, BEncoded> => B), "c": C }).annotate({ "identifier": "B" })
export type A = { readonly "a": B }
export type AEncoded = { readonly "a": BEncoded }
export const A = Schema.Struct({ "a": B })
`
      )
    })
  })
})

type CodeGeneration = {
  schemaGenerations: Array<{
    identifier: string
    generation: SchemaFromJson.Generation
  }>
  definitionGenerations: Array<SchemaFromJson.DefinitionGeneration>
  importDeclarations: Set<string>
}

function generateCode(
  source: JsonSchema.Dialect,
  schemas: ReadonlyArray<{
    readonly identifier: string
    readonly schema: JsonSchema.JsonSchema
  }>,
  definitions: JsonSchema.Definitions,
  externs: Record<string, {
    readonly namespace: string
    readonly importDeclaration: string
  }> = {}
): CodeGeneration {
  const options: SchemaFromJson.GenerateOptions = {
    source,
    resolver: (ref) => {
      if (ref in externs) {
        return SchemaFromJson.makeGenerationExtern(
          externs[ref].namespace,
          externs[ref].importDeclaration
        )
      }
      return SchemaFromJson.makeGeneration(
        ref,
        SchemaFromJson.makeTypes(ref, `${ref}Encoded`)
      )
    },
    definitions,
    extractJsDocs: true
  }
  const schemaGenerations = schemas.map(({ identifier, schema }) => ({
    identifier,
    generation: SchemaFromJson.generate(schema, options)
  }))
  const generatedDefinitions = SchemaFromJson.generateDefinitions(definitions, options)
  const definitionGenerations: Array<SchemaFromJson.DefinitionGeneration> = []
  const importDeclarations = new Set<string>([`import * as Schema from "effect/Schema"`])
  for (const d of generatedDefinitions) {
    for (const i of d.generation.importDeclarations) {
      importDeclarations.add(i)
    }
    if (!(d.ref in externs)) {
      definitionGenerations.push(d)
    } else {
      importDeclarations.add(externs[d.ref].importDeclaration)
    }
  }
  return { importDeclarations, definitionGenerations, schemaGenerations }
}

function toCode(generation: CodeGeneration): string {
  return [...generation.importDeclarations].map((i) => i + "\n").join("") +
    generation.definitionGenerations.map((d) => {
      const identifier = d.ref.replace(/[/~]/g, "$")
      return render(identifier, d.generation)
    }).join("") +
    generation.schemaGenerations.map((s) => {
      return render(s.identifier, s.generation)
    }).join("")
}

function render(identifier: string, generation: SchemaFromJson.Generation): string {
  let out = `${generation.jsDocs ?? ""}export type ${identifier} = ${generation.types.Type}\n`
  if (generation.types.Encoded !== generation.types.Type) {
    out += `export type ${identifier}Encoded = ${generation.types.Encoded}\n`
  } else {
    out += `export type ${identifier}Encoded = ${identifier}\n`
  }
  out += `${generation.jsDocs ?? ""}export const ${identifier} = ${generation.code}\n`
  return out
}
