import type { Annotations } from "effect/schema"
import { FromJsonSchema, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

function getDocumentByTarget(target: Annotations.JsonSchema.Target, schema: Schema.Top) {
  switch (target) {
    case "draft-07":
      return Schema.makeJsonSchemaDraft07(schema)
    case "2020-12":
    case "oas3.1":
      return Schema.makeJsonSchemaDraft2020_12(schema)
  }
}

function assertRoundtrip(input: {
  readonly schema: Schema.Top
  readonly target?: Annotations.JsonSchema.Target | undefined
}) {
  const target = input.target ?? "draft-07"
  const document = getDocumentByTarget(target, input.schema)
  const output = FromJsonSchema.generate(document.schema, { target })
  const fn = new Function("Schema", `return ${output.runtime}`)
  const generated = fn(Schema)
  const codedocument = getDocumentByTarget(target, generated)
  deepStrictEqual(codedocument, document)
  deepStrictEqual(FromJsonSchema.generate(codedocument.schema), output)
}

function assertGeneration(
  input: {
    readonly schema: Record<string, unknown> | boolean
    readonly options?: FromJsonSchema.GenerateOptions | undefined
  },
  expected: {
    readonly runtime: string
    readonly type: string
    readonly imports?: ReadonlySet<string>
  }
) {
  const generation = FromJsonSchema.generate(input.schema, input.options)
  deepStrictEqual(generation, { imports: new Set(), ...expected })
}

describe("FromJsonSchema", () => {
  describe("generate", () => {
    describe("options", () => {
      describe("resolver", () => {
        it("identity", () => {
          assertGeneration(
            {
              schema: {
                "$ref": "#/definitions/ID~1a~0b"
              },
              options: {
                resolver: FromJsonSchema.resolvers.identity
              }
            },
            {
              runtime: "ID/a~b",
              type: "ID/a~b"
            }
          )
        })

        it("suspend", () => {
          assertGeneration(
            {
              schema: {
                "$ref": "#/definitions/ID"
              },
              options: {
                resolver: FromJsonSchema.resolvers.suspend
              }
            },
            {
              runtime: "Schema.suspend((): Schema.Codec<ID> => ID)",
              type: "ID"
            }
          )
        })

        it("escape", () => {
          assertGeneration(
            {
              schema: {
                "$ref": "#/definitions/ID~1a~0b"
              },
              options: {
                resolver: (identifier) => {
                  const id = identifier.replace(/[/~]/g, "$")
                  return { runtime: id, type: id, imports: new Set() }
                }
              }
            },
            {
              runtime: "ID$a$b",
              type: "ID$a$b"
            }
          )
        })
      })
    })

    describe("imports", () => {
      it("custom resolver", () => {
        const GETTER_IMPORT = `import * as Getter from "effect/schema/Getter"`
        const HTTP_API_ERROR_IMPORT = `import { HttpApiSchemaError } from "effect/unstable/httpapi/HttpApiError"`
        assertGeneration(
          {
            schema: {
              "type": "object",
              "properties": {
                "a": { "type": "string" },
                "b": { "$ref": "#/definitions/effect~1HttpApiSchemaError" },
                "c": { "$ref": "#/definitions/ID" }
              },
              "required": ["a", "b", "c"]
            },
            options: {
              resolver: (identifier) => {
                if (identifier === "effect/HttpApiSchemaError") {
                  return {
                    runtime: "HttpApiSchemaError",
                    type: `typeof HttpApiSchemaError["Encoded"]`,
                    imports: new Set([HTTP_API_ERROR_IMPORT])
                  }
                }
                return {
                  runtime: identifier,
                  type: identifier,
                  imports: new Set([GETTER_IMPORT])
                }
              }
            }
          },
          {
            runtime: `Schema.Struct({ "a": Schema.String, "b": HttpApiSchemaError, "c": ID })`,
            type: `{ readonly "a": string, readonly "b": typeof HttpApiSchemaError["Encoded"], readonly "c": ID }`,
            imports: new Set([HTTP_API_ERROR_IMPORT, GETTER_IMPORT])
          }
        )
      })
    })

    it("format", () => {
      assertGeneration(
        { schema: { "type": "string", "format": "email" } },
        { runtime: `Schema.String.annotate({ format: "email" })`, type: "string" }
      )
      assertGeneration(
        { schema: { "format": "email" } },
        { runtime: `Schema.Unknown.annotate({ format: "email" })`, type: "unknown" }
      )
    })

    it("patternProperties", () => {
      assertGeneration(
        {
          schema: {
            "type": "object",
            "patternProperties": {}
          }
        },
        {
          runtime: `Schema.Record(Schema.String, Schema.Unknown)`,
          type: `{ readonly [x: string]: unknown }`
        }
      )
      assertGeneration(
        {
          schema: {
            "type": "object",
            "patternProperties": { "^x-": { "type": "string" } }
          }
        },
        {
          runtime: `Schema.Record(Schema.String.check(Schema.isPattern(/^x-/)), Schema.String)`,
          type: `{ readonly [x: string]: string }`
        }
      )
      assertGeneration(
        {
          schema: {
            "type": "object",
            "patternProperties": { "^x-": { "type": "string" }, "^y-": { "type": "number" } }
          }
        },
        {
          runtime:
            `Schema.StructWithRest(Schema.Struct({  }), [Schema.Record(Schema.String.check(Schema.isPattern(/^x-/)), Schema.String), Schema.Record(Schema.String.check(Schema.isPattern(/^y-/)), Schema.Number)])`,
          type: `{ readonly [x: string]: string, readonly [x: string]: number }`
        }
      )
    })

    it.todo("propertyNames", () => {
      assertGeneration(
        { schema: { "type": "object", "propertyNames": { "pattern": "^[A-Z]" } } },
        {
          runtime: `Schema.Record(Schema.String, Schema.Unknown).annotate({ propertyNames: { pattern: "^[A-Z]" } })`,
          type: `{ readonly [x: string]: unknown }`
        }
      )
    })

    it("true", () => {
      assertGeneration(
        { schema: true },
        { runtime: "Schema.Unknown", type: "unknown" }
      )
    })

    it("false", () => {
      assertGeneration(
        { schema: false },
        { runtime: "Schema.Never", type: "never" }
      )
    })

    it("{}", () => {
      assertGeneration(
        { schema: {} },
        { runtime: "Schema.Unknown", type: "unknown" }
      )
      assertGeneration(
        { schema: { description: "lorem" } },
        { runtime: `Schema.Unknown.annotate({ description: "lorem" })`, type: "unknown" }
      )
    })

    it("const", () => {
      assertGeneration(
        { schema: { "const": "a" } },
        { runtime: `Schema.Literal("a")`, type: `"a"` }
      )
      assertGeneration(
        { schema: { "const": "a", "description": "lorem" } },
        { runtime: `Schema.Literal("a").annotate({ description: "lorem" })`, type: `"a"` }
      )
      assertGeneration(
        { schema: { "type": "string", "const": "a" } },
        { runtime: `Schema.Literal("a")`, type: `"a"` }
      )
    })

    it("enum", () => {
      assertGeneration(
        { schema: { "enum": ["a", "b"] } },
        { runtime: `Schema.Literals(["a", "b"])`, type: `"a" | "b"` }
      )
      assertGeneration(
        { schema: { "enum": ["a", 1] } },
        { runtime: `Schema.Literals(["a", 1])`, type: `"a" | 1` }
      )
      assertGeneration(
        { schema: { "enum": ["a", "b"], "description": "lorem" } },
        { runtime: `Schema.Literals(["a", "b"]).annotate({ description: "lorem" })`, type: `"a" | "b"` }
      )
      assertGeneration(
        { schema: { "type": "string", "enum": ["a", "b"], "description": "lorem" } },
        { runtime: `Schema.Literals(["a", "b"]).annotate({ description: "lorem" })`, type: `"a" | "b"` }
      )
    })

    describe("type as array", () => {
      it("string, number", () => {
        assertGeneration(
          { schema: { "type": ["string", "number"] } },
          { runtime: "Schema.Union([Schema.String, Schema.Number])", type: "string | number" }
        )
        assertGeneration({
          schema: { "type": ["string", "number"], "description": "lorem" }
        }, {
          runtime: `Schema.Union([Schema.String, Schema.Number]).annotate({ description: "lorem" })`,
          type: "string | number"
        })
      })

      it("string, null", () => {
        assertGeneration(
          { schema: { "type": ["string", "null"] } },
          { runtime: "Schema.Union([Schema.String, Schema.Null])", type: "string | null" }
        )
      })
    })

    it("type: null", () => {
      assertGeneration(
        { schema: { "type": "null" } },
        { runtime: "Schema.Null", type: "null" }
      )
      assertGeneration(
        { schema: { "type": "null", "description": "lorem" } },
        { runtime: `Schema.Null.annotate({ description: "lorem" })`, type: "null" }
      )
    })

    it("type: string", () => {
      assertGeneration(
        { schema: { "type": "string" } },
        { runtime: "Schema.String", type: "string" }
      )
      assertGeneration(
        { schema: { "type": "string", "description": "lorem" } },
        { runtime: `Schema.String.annotate({ description: "lorem" })`, type: "string" }
      )
      assertGeneration(
        { schema: { "type": "string", "minLength": 1 } },
        { runtime: `Schema.String.check(Schema.isMinLength(1))`, type: "string" }
      )
      assertGeneration(
        { schema: { "type": "string", "maxLength": 10 } },
        { runtime: `Schema.String.check(Schema.isMaxLength(10))`, type: "string" }
      )
      assertGeneration(
        { schema: { "type": "string", "pattern": "a" } },
        { runtime: `Schema.String.check(Schema.isPattern(/a/))`, type: "string" }
      )
      assertGeneration(
        { schema: { "type": "string", "minLength": 1, "maxLength": 10 } },
        { runtime: `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10))`, type: "string" }
      )
    })

    it("type: number", () => {
      assertGeneration(
        { schema: { "type": "number" } },
        { runtime: "Schema.Number", type: "number" }
      )
      assertGeneration(
        { schema: { "type": "number", "description": "lorem" } },
        { runtime: `Schema.Number.annotate({ description: "lorem" })`, type: "number" }
      )
      assertGeneration(
        { schema: { "type": "number", "minimum": 0 } },
        { runtime: `Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))`, type: "number" }
      )
      assertGeneration(
        { schema: { "type": "number", "maximum": 10 } },
        { runtime: `Schema.Number.check(Schema.isLessThanOrEqualTo(10))`, type: "number" }
      )
      assertGeneration(
        { schema: { "type": "number", "exclusiveMinimum": 0 } },
        { runtime: `Schema.Number.check(Schema.isGreaterThan(0))`, type: "number" }
      )
      assertGeneration(
        { schema: { "type": "number", "exclusiveMaximum": 10 } },
        { runtime: `Schema.Number.check(Schema.isLessThan(10))`, type: "number" }
      )
      assertGeneration(
        { schema: { "type": "number", "multipleOf": 10 } },
        { runtime: `Schema.Number.check(Schema.isMultipleOf(10))`, type: "number" }
      )
      assertGeneration(
        { schema: { "type": "number", "minimum": 1, "maximum": 10 } },
        {
          runtime: `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
          type: "number"
        }
      )
    })

    it("type: integer", () => {
      assertGeneration(
        { schema: { "type": "integer" } },
        { runtime: "Schema.Int", type: "number" }
      )
    })

    it("type: boolean", () => {
      assertGeneration(
        { schema: { "type": "boolean" } },
        { runtime: "Schema.Boolean", type: "boolean" }
      )
      assertGeneration(
        { schema: { "type": "boolean", "description": "lorem" } },
        { runtime: `Schema.Boolean.annotate({ description: "lorem" })`, type: "boolean" }
      )
    })

    describe("type: array", () => {
      it("unknown array", () => {
        assertGeneration(
          { schema: { "type": "array" } },
          { runtime: "Schema.Array(Schema.Unknown)", type: "ReadonlyArray<unknown>" }
        )
        assertGeneration(
          { schema: { "type": "array", "description": "lorem" } },
          { runtime: `Schema.Array(Schema.Unknown).annotate({ description: "lorem" })`, type: "ReadonlyArray<unknown>" }
        )
        assertGeneration(
          { schema: { "type": "array", "minItems": 1 } },
          { runtime: "Schema.Array(Schema.Unknown).check(Schema.isMinLength(1))", type: "ReadonlyArray<unknown>" }
        )
        assertGeneration(
          { schema: { "type": "array", "maxItems": 10 } },
          { runtime: "Schema.Array(Schema.Unknown).check(Schema.isMaxLength(10))", type: "ReadonlyArray<unknown>" }
        )
        assertGeneration(
          { schema: { "type": "array", "uniqueItems": true } },
          { runtime: "Schema.Array(Schema.Unknown).check(Schema.isUnique())", type: "ReadonlyArray<unknown>" }
        )
        assertGeneration(
          { schema: { "type": "array", "items": [] } },
          { runtime: "Schema.Array(Schema.Unknown)", type: "ReadonlyArray<unknown>" }
        )
        assertGeneration(
          { schema: { "type": "array", "items": {} } },
          { runtime: "Schema.Array(Schema.Unknown)", type: "ReadonlyArray<unknown>" }
        )
      })

      it("empty tuple", () => {
        assertGeneration(
          {
            schema: {
              "type": "array",
              "items": [],
              "additionalItems": false
            }
          },
          { runtime: "Schema.Tuple([])", type: "readonly []" }
        )
        assertGeneration(
          {
            schema: {
              "type": "array",
              "items": [],
              "additionalItems": false,
              "description": "lorem"
            }
          },
          { runtime: `Schema.Tuple([]).annotate({ description: "lorem" })`, type: "readonly []" }
        )
      })

      it("required elements", () => {
        assertGeneration(
          {
            schema: {
              "type": "array",
              "items": [{ "type": "string" }],
              "additionalItems": false,
              "minItems": 1
            }
          },
          { runtime: "Schema.Tuple([Schema.String])", type: "readonly [string]" }
        )
      })

      it("optional elements", () => {
        assertGeneration(
          {
            schema: {
              "type": "array",
              "items": [{ "type": "string" }],
              "additionalItems": false
            }
          },
          { runtime: "Schema.Tuple([Schema.optionalKey(Schema.String)])", type: "readonly [string?]" }
        )
        assertGeneration(
          {
            schema: {
              "type": "array",
              "items": [{ "type": "string" }],
              "additionalItems": false,
              "description": "lorem"
            }
          },
          {
            runtime: `Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ description: "lorem" })`,
            type: "readonly [string?]"
          }
        )
        assertGeneration(
          {
            schema: {
              "type": "array",
              "items": [{ "type": "string" }],
              "additionalItems": false,
              "minItems": 0
            }
          },
          { runtime: "Schema.Tuple([Schema.optionalKey(Schema.String)])", type: "readonly [string?]" }
        )
      })

      it("required elements & rest", () => {
        assertGeneration(
          {
            schema: {
              "type": "array",
              "minItems": 1,
              "items": [
                { "type": "string" }
              ],
              "additionalItems": {
                "type": "number"
              }
            }
          },
          {
            runtime: "Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])",
            type: "readonly [string, ...Array<number>]"
          }
        )
      })
    })

    describe("type: object", () => {
      it("unknown object", () => {
        assertGeneration(
          { schema: { "type": "object" } },
          { runtime: "Schema.Record(Schema.String, Schema.Unknown)", type: "{ readonly [x: string]: unknown }" }
        )
        assertGeneration(
          { schema: { "type": "object", "description": "lorem" } },
          {
            runtime: `Schema.Record(Schema.String, Schema.Unknown).annotate({ description: "lorem" })`,
            type: "{ readonly [x: string]: unknown }"
          }
        )
        assertGeneration(
          { schema: { "type": "object", "minProperties": 1 } },
          {
            runtime: "Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMinProperties(1))",
            type: "{ readonly [x: string]: unknown }"
          }
        )
        assertGeneration(
          { schema: { "type": "object", "maxProperties": 10 } },
          {
            runtime: "Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMaxProperties(10))",
            type: "{ readonly [x: string]: unknown }"
          }
        )
        assertGeneration(
          { schema: { "type": "object", "properties": {} } },
          { runtime: "Schema.Record(Schema.String, Schema.Unknown)", type: "{ readonly [x: string]: unknown }" }
        )
        assertGeneration(
          { schema: { "type": "object", "properties": {}, "additionalProperties": false } },
          { runtime: "Schema.Record(Schema.String, Schema.Never)", type: "{ readonly [x: string]: never }" }
        )
      })

      it("required properties", () => {
        assertGeneration(
          { schema: { "type": "object", "properties": { "a": { "type": "string" } }, "required": ["a"] } },
          { runtime: `Schema.Struct({ "a": Schema.String })`, type: `{ readonly "a": string }` }
        )
        assertGeneration(
          { schema: { "type": "object", "properties": { "a-b": { "type": "string" } }, "required": ["a-b"] } },
          { runtime: `Schema.Struct({ "a-b": Schema.String })`, type: `{ readonly "a-b": string }` }
        )
      })

      it("optional properties", () => {
        assertGeneration(
          { schema: { "type": "object", "properties": { "a": { "type": "string" } } } },
          { runtime: `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`, type: `{ readonly "a"?: string }` }
        )
      })
    })

    it("Union", () => {
      describe("anyOf", () => {
        assertGeneration(
          { schema: { "anyOf": [{ "type": "string" }, { "type": "number" }] } },
          { runtime: "Schema.Union([Schema.String, Schema.Number])", type: "string | number" }
        )
        assertGeneration(
          { schema: { "anyOf": [{ "type": "string" }, { "type": "number" }], "description": "lorem" } },
          {
            runtime: `Schema.Union([Schema.String, Schema.Number]).annotate({ description: "lorem" })`,
            type: "string | number"
          }
        )
      })

      describe("oneOf", () => {
        assertGeneration(
          { schema: { "oneOf": [{ "type": "string" }, { "type": "number" }] } },
          { runtime: "Schema.Union([Schema.String, Schema.Number], { mode: 'oneOf' })", type: "string | number" }
        )
      })
    })

    it("reference", () => {
      assertGeneration(
        { schema: { "$ref": "#/definitions/A" } },
        { runtime: "A", type: "A" }
      )
      assertGeneration(
        { schema: { "$ref": "#/definitions/A", "description": "lorem" } },
        { runtime: `A.annotate({ description: "lorem" })`, type: "A" }
      )
    })

    describe("allOf", () => {
      it("string & unknown", () => {
        assertGeneration(
          { schema: { "type": "string", "allOf": [{ "minLength": 1 }] } },
          { runtime: `Schema.String.check(Schema.isMinLength(1))`, type: "string" }
        )
        assertGeneration(
          { schema: { "type": "string", "description": "lorem", "allOf": [{ "minLength": 1 }] } },
          { runtime: `Schema.String.check(Schema.isMinLength(1)).annotate({ description: "lorem" })`, type: "string" }
        )
        assertGeneration(
          {
            schema: { "type": "string", "description": "lorem", "allOf": [{ "minLength": 1, "description": "ipsum" }] }
          },
          {
            runtime: `Schema.String.check(Schema.isMinLength(1)).annotate({ description: "lorem, ipsum" })`,
            type: "string"
          }
        )
        assertGeneration(
          {
            schema: { "type": "string", "description": " ", "allOf": [{ "minLength": 1, "description": "ipsum" }] }
          },
          {
            runtime: `Schema.String.check(Schema.isMinLength(1)).annotate({ description: "ipsum" })`,
            type: "string"
          }
        )
        assertGeneration(
          {
            schema: { "type": "string", "description": "lorem", "allOf": [{ "minLength": 1, "description": " " }] }
          },
          {
            runtime: `Schema.String.check(Schema.isMinLength(1)).annotate({ description: "lorem" })`,
            type: "string"
          }
        )
      })

      it("string & string", () => {
        assertGeneration(
          { schema: { "type": "string", "minLength": 1, "allOf": [{ "type": "string", "maxLength": 10 }] } },
          { runtime: `Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10))`, type: "string" }
        )
        assertGeneration(
          { schema: { "type": "string", "minLength": 1, "allOf": [{ "type": "string", "minLength": 2 }] } },
          { runtime: `Schema.String.check(Schema.isMinLength(1), Schema.isMinLength(2))`, type: "string" }
        )
      })

      it("number & unknown", () => {
        assertGeneration(
          { schema: { "type": "number", "allOf": [{ "minimum": 1 }] } },
          { runtime: `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1))`, type: "number" }
        )
        assertGeneration(
          { schema: { "type": "number", "description": "lorem", "allOf": [{ "minimum": 1 }] } },
          {
            runtime: `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1)).annotate({ description: "lorem" })`,
            type: "number"
          }
        )
        assertGeneration(
          { schema: { "type": "number", "description": "lorem", "allOf": [{ "minimum": 1, "description": "ipsum" }] } },
          {
            runtime: `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1)).annotate({ description: "lorem, ipsum" })`,
            type: "number"
          }
        )
      })

      it("number & integer", () => {
        assertGeneration(
          { schema: { "type": "number", "allOf": [{ "type": "integer" }] } },
          { runtime: "Schema.Int", type: "number" }
        )
      })

      it("number & number", () => {
        assertGeneration(
          { schema: { "type": "number", "minimum": 1, "allOf": [{ "type": "number", "maximum": 10 }] } },
          {
            runtime: `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isLessThanOrEqualTo(10))`,
            type: "number"
          }
        )
        assertGeneration(
          { schema: { "type": "number", "minimum": 1, "allOf": [{ "type": "number", "minimum": 2 }] } },
          {
            runtime: `Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isGreaterThanOrEqualTo(2))`,
            type: "number"
          }
        )
      })

      it("struct & struct", () => {
        assertGeneration(
          {
            schema: {
              "type": "object",
              "properties": { "a": { "type": "string" } },
              "required": ["a"],
              "allOf": [{
                "type": "object",
                "properties": { "b": { "type": "string" } },
                "required": ["b"]
              }]
            }
          },
          {
            runtime: `Schema.Struct({ "a": Schema.String, "b": Schema.String })`,
            type: `{ readonly "a": string, readonly "b": string }`
          }
        )
        assertGeneration(
          {
            schema: {
              "type": "object",
              "properties": { "a": { "type": "string" } },
              "required": ["a"],
              "allOf": [{
                "type": "object",
                "properties": { "b": { "type": "string" } }
              }]
            }
          },
          {
            runtime: `Schema.Struct({ "a": Schema.String, "b": Schema.optionalKey(Schema.String) })`,
            type: `{ readonly "a": string, readonly "b"?: string }`
          }
        )
      })

      it("struct & record", () => {
        assertGeneration(
          {
            schema: {
              "type": "object",
              "properties": { "a": { "type": "string" } },
              "required": ["a"],
              "allOf": [{
                "type": "object",
                "additionalProperties": { "type": "string" }
              }]
            }
          },
          {
            runtime:
              `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.String)])`,
            type: `{ readonly "a": string, readonly [x: string]: string }`
          }
        )
      })

      it("record & struct", () => {
        assertGeneration(
          {
            schema: {
              "type": "object",
              "additionalProperties": { "type": "string" },
              "allOf": [{
                "type": "object",
                "properties": { "a": { "type": "string" } },
                "required": ["a"]
              }]
            }
          },
          {
            runtime:
              `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.String)])`,
            type: `{ readonly "a": string, readonly [x: string]: string }`
          }
        )
      })

      it("struct & union", () => {
        assertGeneration(
          {
            schema: {
              "type": "object",
              "properties": { "a": { "type": "string" } },
              "required": ["a"],
              "allOf": [
                {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": { "b": { "type": "string" } },
                      "required": ["b"]
                    },
                    {
                      "type": "object",
                      "properties": { "c": { "type": "string" } }
                    }
                  ]
                }
              ]
            }
          },
          {
            runtime:
              `Schema.Union([Schema.Struct({ "a": Schema.String, "b": Schema.String }), Schema.Struct({ "a": Schema.String, "c": Schema.optionalKey(Schema.String) })])`,
            type: `{ readonly "a": string, readonly "b": string } | { readonly "a": string, readonly "c"?: string }`
          }
        )
      })

      it("union & struct", () => {
        assertGeneration(
          {
            schema: {
              "anyOf": [
                {
                  "type": "object",
                  "properties": { "b": { "type": "string" } },
                  "required": ["b"]
                },
                {
                  "type": "object",
                  "properties": { "c": { "type": "string" } }
                }
              ],
              "allOf": [{
                "type": "object",
                "properties": { "a": { "type": "string" } },
                "required": ["a"]
              }]
            }
          },
          {
            runtime:
              `Schema.Union([Schema.Struct({ "b": Schema.String, "a": Schema.String }), Schema.Struct({ "c": Schema.optionalKey(Schema.String), "a": Schema.String })])`,
            type: `{ readonly "b": string, readonly "a": string } | { readonly "c"?: string, readonly "a": string }`
          }
        )
      })

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
          {
            runtime: `Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])`,
            type: "string | number | boolean | null"
          }
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
          {
            runtime: `Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null], { mode: "oneOf" })`,
            type: "string | number | boolean | null"
          }
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
          {
            runtime: `Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])`,
            type: "string | number | boolean | null"
          }
        )
      })

      it("array & unknown", () => {
        assertGeneration(
          {
            schema: {
              "type": "array",
              "allOf": [{ "description": "lorem" }]
            }
          },
          {
            runtime: `Schema.Array(Schema.Unknown).annotate({ description: "lorem" })`,
            type: "ReadonlyArray<unknown>"
          }
        )
      })

      it("tuple & array", () => {
        assertGeneration(
          {
            schema: {
              "type": "array",
              "minItems": 1,
              "items": [{ "type": "string" }],
              "allOf": [{ "type": "array", "items": { "type": "string" } }]
            }
          },
          {
            runtime: `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.String])`,
            type: "readonly [string, ...Array<string>]"
          }
        )
      })

      it("tuple & union of arrays", () => {
        assertGeneration(
          {
            schema: {
              "type": "array",
              "minItems": 1,
              "items": [{ "type": "string" }],
              "allOf": [
                {
                  "anyOf": [
                    { "type": "array", "items": { "type": "string" } },
                    { "type": "array", "items": { "type": "number" } }
                  ]
                }
              ]
            }
          },
          {
            runtime:
              `Schema.Union([Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.String]), Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])])`,
            type: "readonly [string, ...Array<string>] | readonly [string, ...Array<number>]"
          }
        )
      })

      it("union of arrays & tuple", () => {
        assertGeneration(
          {
            schema: {
              "anyOf": [
                { "type": "array", "items": { "type": "string" } },
                { "type": "array", "items": { "type": "number" } }
              ],
              "allOf": [
                {
                  "type": "array",
                  "minItems": 1,
                  "items": [{ "type": "string" }]
                }
              ]
            }
          },
          {
            runtime:
              `Schema.Union([Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.String]), Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])])`,
            type: "readonly [string, ...Array<string>] | readonly [string, ...Array<number>]"
          }
        )
      })
    })
  })

  it("roundtrips", () => {
    assertRoundtrip({ schema: Schema.Never })

    assertRoundtrip({ schema: Schema.Unknown })

    assertRoundtrip({ schema: Schema.Null })

    assertRoundtrip({ schema: Schema.String })
    assertRoundtrip({ schema: Schema.String.annotate({ title: "title", description: "lorem" }) })
    assertRoundtrip({ schema: Schema.String.check(Schema.isMinLength(1)) })
    assertRoundtrip({ schema: Schema.String.check(Schema.isMaxLength(10)) })
    assertRoundtrip({ schema: Schema.String.check(Schema.isLength(5)) })
    assertRoundtrip({ schema: Schema.String.annotate({ description: "lorem" }).check(Schema.isMinLength(1)) })
    assertRoundtrip({ schema: Schema.String.check(Schema.isMinLength(1)).annotate({ description: "lorem" }) })
    assertRoundtrip({ schema: Schema.String.check(Schema.isMinLength(1, { description: "lorem" })) })
    assertRoundtrip({ schema: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10)) })
    assertRoundtrip({
      schema: Schema.String.annotate({ description: "lorem" }).check(
        Schema.isMinLength(1),
        Schema.isMaxLength(10)
      )
    })
    assertRoundtrip({
      schema: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10)).annotate({
        description: "lorem"
      })
    })
    assertRoundtrip({
      schema: Schema.String.check(Schema.isMinLength(1, { description: "lorem" }), Schema.isMaxLength(10))
    })
    assertRoundtrip({
      schema: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10, { description: "lorem" }))
    })

    assertRoundtrip({ schema: Schema.Number })
    assertRoundtrip({ schema: Schema.Number.annotate({ description: "lorem" }) })
    assertRoundtrip({ schema: Schema.Number.check(Schema.isGreaterThan(1)) })
    assertRoundtrip({ schema: Schema.Number.check(Schema.isGreaterThanOrEqualTo(1)) })
    assertRoundtrip({ schema: Schema.Number.check(Schema.isLessThan(1)) })
    assertRoundtrip({ schema: Schema.Number.check(Schema.isLessThanOrEqualTo(1)) })
    assertRoundtrip({ schema: Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })) })
    assertRoundtrip({ schema: Schema.Number.check(Schema.isMultipleOf(10)) })

    assertRoundtrip({ schema: Schema.Boolean })
    assertRoundtrip({ schema: Schema.Boolean.annotate({ description: "lorem" }) })

    assertRoundtrip({ schema: Schema.Int })
    assertRoundtrip({ schema: Schema.Int.annotate({ description: "lorem" }) })

    assertRoundtrip({ schema: Schema.Struct({ a: Schema.String }) })
    assertRoundtrip({ schema: Schema.Struct({ a: Schema.optionalKey(Schema.String) }) })
    assertRoundtrip({ schema: Schema.Struct({ a: Schema.optional(Schema.String) }) })
    assertRoundtrip({ schema: Schema.Record(Schema.String, Schema.String) })
    assertRoundtrip({ schema: Schema.StructWithRest(Schema.Struct({}), [Schema.Record(Schema.String, Schema.String)]) })
    assertRoundtrip({
      schema: Schema.StructWithRest(
        Schema.Struct({ a: Schema.String }),
        [Schema.Record(Schema.String, Schema.String)]
      )
    })

    assertRoundtrip({ schema: Schema.Tuple([]) })
    assertRoundtrip({ schema: Schema.Tuple([Schema.String]) })
    assertRoundtrip({ schema: Schema.Tuple([Schema.optionalKey(Schema.String)]) })
    assertRoundtrip({
      schema: Schema.TupleWithRest(Schema.Tuple([Schema.String, Schema.Number]), [Schema.Boolean])
    })
    assertRoundtrip({ schema: Schema.Array(Schema.String) })
    assertRoundtrip({ schema: Schema.Array(Schema.String).check(Schema.isMinLength(1)) })
    assertRoundtrip({ schema: Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]) })

    assertRoundtrip({ schema: Schema.Union([]) })
    assertRoundtrip({ schema: Schema.Union([Schema.String]) })
    assertRoundtrip({ schema: Schema.Union([Schema.String, Schema.Number]) })
    assertRoundtrip({ schema: Schema.Union([], { mode: "oneOf" }) })
    assertRoundtrip({ schema: Schema.Union([Schema.String], { mode: "oneOf" }) })
    assertRoundtrip({ schema: Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }) })
  })

  describe("topologicalSort", () => {
    type TopologicalSort = {
      readonly nonRecursives: ReadonlyArray<{
        readonly identifier: string
        readonly schema: Schema.JsonSchema.Schema
      }>
      readonly recursives: {
        readonly [identifier: string]: Schema.JsonSchema.Schema
      }
    }

    function assertTopologicalSort(
      definitions: Schema.JsonSchema.Definitions,
      expected: TopologicalSort
    ) {
      const result = FromJsonSchema.topologicalSort(definitions)
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
            { identifier: "A", schema: { type: "string" } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { type: "number" } },
          { identifier: "C", schema: { type: "boolean" } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { $ref: "#/definitions/A" } },
          { identifier: "C", schema: { $ref: "#/definitions/B" } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { $ref: "#/definitions/A" } },
          { identifier: "C", schema: { $ref: "#/definitions/A" } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { $ref: "#/definitions/A" } },
          { identifier: "D", schema: { $ref: "#/definitions/A" } },
          { identifier: "C", schema: { $ref: "#/definitions/B" } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { $ref: "#/definitions/A" } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { type: "object", properties: { value: { $ref: "#/definitions/A" } } } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { type: "array", items: { $ref: "#/definitions/A" } } }
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
          { identifier: "A", schema: { type: "string" } },
          { identifier: "B", schema: { anyOf: [{ $ref: "#/definitions/A" }, { type: "number" }] } }
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
          { identifier: "A", schema: { $ref: "#/definitions/External" } },
          { identifier: "B", schema: { $ref: "#/definitions/A" } }
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
          { identifier: "A", schema: { type: "string" } },
          {
            identifier: "B",
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
          { identifier: "Independent", schema: { type: "string" } }
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
          { identifier: "B", schema: { $ref: "#/definitions/A" } }
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
          { identifier: "A", schema: { $ref: "#/definitions/~01A" } }
        ],
        recursives: {}
      })
    })
  })

  describe("generateDefinitions", () => {
    function generate(
      definitions: Schema.JsonSchema.Definitions,
      schemas: ReadonlyArray<Schema.JsonSchema.Schema>
    ) {
      const genDependencies = FromJsonSchema.generateDefinitions(definitions)
      const genSchemas = schemas.map((schema) => FromJsonSchema.generate(schema))
      let s = ""

      s += "// Definitions\n"
      genDependencies.forEach(({ generation: schema, identifier }) => {
        s += `type ${identifier} = ${schema.type};\n`
        s += `const ${identifier} = ${schema.runtime};\n\n`
      })

      s += "// Schemas\n"
      s += genSchemas.map(({ runtime: code }, i) => `const schema${i + 1} = ${code};`).join("\n")
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
        value: Schema.Union([Schema.Finite, Schema.suspend((): Schema.Codec<Operation> => Operation)])
      }).annotate({ identifier: "Expression" })

      const Operation = Schema.Struct({
        type: Schema.Literal("operation"),
        operator: Schema.Literals(["+", "-"]),
        left: Expression,
        right: Expression
      }).annotate({ identifier: "Operation" })

      {
        const document = Schema.makeJsonSchemaDraft07(Operation)
        strictEqual(
          generate(document.definitions, [document.schema]),
          `// Definitions
type Operation = { readonly "type": "operation", readonly "operator": "+" | "-", readonly "left": Expression, readonly "right": Expression };
const Operation = Schema.Struct({ "type": Schema.Literal("operation"), "operator": Schema.Union([Schema.Literal("+"), Schema.Literal("-")]), "left": Schema.suspend((): Schema.Codec<Expression> => Expression), "right": Schema.suspend((): Schema.Codec<Expression> => Expression) }).annotate({ identifier: "Operation" });

type Expression = { readonly "type": "expression", readonly "value": number | Operation };
const Expression = Schema.Struct({ "type": Schema.Literal("expression"), "value": Schema.Union([Schema.Number, Schema.suspend((): Schema.Codec<Operation> => Operation)]) }).annotate({ identifier: "Expression" });

// Schemas
const schema1 = Operation;`
        )
      }
      {
        const document = Schema.makeJsonSchemaDraft07(Expression)
        strictEqual(
          generate(document.definitions, [document.schema]),
          `// Definitions
type Expression = { readonly "type": "expression", readonly "value": number | Operation };
const Expression = Schema.Struct({ "type": Schema.Literal("expression"), "value": Schema.Union([Schema.Number, Schema.suspend((): Schema.Codec<Operation> => Operation)]) }).annotate({ identifier: "Expression" });

type Operation = { readonly "type": "operation", readonly "operator": "+" | "-", readonly "left": Expression, readonly "right": Expression };
const Operation = Schema.Struct({ "type": Schema.Literal("operation"), "operator": Schema.Union([Schema.Literal("+"), Schema.Literal("-")]), "left": Schema.suspend((): Schema.Codec<Expression> => Expression), "right": Schema.suspend((): Schema.Codec<Expression> => Expression) }).annotate({ identifier: "Operation" });

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
      const document = Schema.makeJsonSchemaDraft07(schema)
      strictEqual(
        generate(document.definitions, [document.schema]),
        `// Definitions
type C = string;
const C = Schema.String.annotate({ identifier: "C" });

type B = { readonly "c": C };
const B = Schema.Struct({ "c": C }).annotate({ identifier: "B" });

type A = { readonly "b": B };
const A = Schema.Struct({ "b": B }).annotate({ identifier: "A" });

// Schemas
const schema1 = Schema.Struct({ "a": A });`
      )
    })
  })
})
