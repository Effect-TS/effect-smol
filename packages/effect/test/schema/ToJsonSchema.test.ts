import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import { Check, Getter, Schema, ToJsonSchema } from "effect/schema"
import { describe, it } from "vitest"
import { assertFalse, assertTrue, deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv2020 = require("ajv/dist/2020")

const ajvOptions: Ajv.Options = {
  strictTuples: false,
  allowMatchingProperties: true
}

function getAjvValidate(jsonSchema: object): Ajv.ValidateFunction {
  return new Ajv.default(ajvOptions).compile(jsonSchema)
}

const baseAjvOptions: AjvOptions = {
  allErrors: true,
  strict: false, // warns/throws on unknown keywords depending on Ajv version
  validateSchema: true,
  code: { esm: true } // optional
}

const ajvDraft7 = new Ajv.default(baseAjvOptions)
const ajv2020 = new Ajv2020.default(baseAjvOptions)

async function assertDraft7<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: ToJsonSchema.Draft07_Options
) {
  const jsonSchema = ToJsonSchema.makeDraft07(schema, options)
  deepStrictEqual(jsonSchema, {
    "$schema": "http://json-schema.org/draft-07/schema",
    ...expected
  })
  const valid = ajvDraft7.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

async function assertDraft2020_12<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: ToJsonSchema.Draft2020_12_Options
) {
  const jsonSchema = ToJsonSchema.makeDraft2020_12(schema, options)
  deepStrictEqual(jsonSchema, {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    ...expected
  })
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

async function assertOpenApi3_1<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: ToJsonSchema.OpenApi3_1Options
) {
  const jsonSchema = ToJsonSchema.makeOpenApi3_1(schema, options)
  deepStrictEqual(jsonSchema, {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    ...expected
  })
  const valid = ajv2020.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajv2020.errors, null)
  return jsonSchema
}

function assertAjvDraft7Success<S extends Schema.Top>(
  schema: S,
  input: S["Type"]
) {
  const jsonSchema = ToJsonSchema.makeDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertTrue(validate(input))
}

function assertAjvDraft7Failure<S extends Schema.Top>(
  schema: S,
  input: unknown
) {
  const jsonSchema = ToJsonSchema.makeDraft07(schema)
  const validate = getAjvValidate(jsonSchema)
  assertFalse(validate(input))
}

function expectError(schema: Schema.Top, message: string) {
  throws(() => ToJsonSchema.makeDraft07(schema), new Error(message))
}

describe("ToJsonSchema", () => {
  describe("options", () => {
    it("definitionsPath", async () => {
      const schema = Schema.String.annotate({ identifier: "ID" })
      const definitions = {}
      await assertDraft7(schema, {
        "$schema": "http://json-schema.org/draft-07/schema",
        "$defs": {
          "ID": {
            "type": "string"
          }
        },
        "$ref": "#/components/schemas/ID"
      }, {
        getRef: (id) => `#/components/schemas/${id}`,
        definitions
      })
      deepStrictEqual(definitions, {
        "ID": {
          "type": "string"
        }
      })
    })

    describe("topLevelReferenceStrategy", () => {
      describe(`"skip"`, () => {
        it("top level identifier", async () => {
          const schema = Schema.String.annotate({ identifier: "ID" })
          const definitions = {}
          await assertDraft7(schema, {
            "$schema": "http://json-schema.org/draft-07/schema",
            "type": "string"
          }, {
            topLevelReferenceStrategy: "skip",
            definitions
          })
          deepStrictEqual(definitions, {})
        })

        it("nested identifiers", async () => {
          class A extends Schema.Class<A>("A")({ s: Schema.String.annotate({ identifier: "ID4" }) }) {}
          const schema = Schema.Struct({
            a: Schema.String.annotate({ identifier: "ID" }),
            b: Schema.Struct({
              c: Schema.String.annotate({ identifier: "ID3" })
            }).annotate({ identifier: "ID2" }),
            d: A
          })
          const definitions = {}
          await assertDraft7(schema, {
            "type": "object",
            "properties": {
              "a": {
                "type": "string"
              },
              "b": {
                "type": "object",
                "properties": {
                  "c": { "type": "string" }
                },
                "required": ["c"],
                "additionalProperties": false
              },
              "d": {
                "type": "object",
                "properties": {
                  "s": { "type": "string" }
                },
                "required": ["s"],
                "additionalProperties": false
              }
            },
            "required": ["a", "b", "d"],
            "additionalProperties": false
          }, {
            topLevelReferenceStrategy: "skip",
            definitions
          })
          deepStrictEqual(definitions, {})
        })

        describe("Suspend", () => {
          it("inner annotation", async () => {
            interface A {
              readonly a: string
              readonly as: ReadonlyArray<A>
            }
            const schema = Schema.Struct({
              a: Schema.String.annotate({ identifier: "ID" }),
              as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema.annotate({ identifier: "A" })))
            })
            await assertDraft7(schema, {
              "$defs": {
                "A": {
                  "type": "object",
                  "required": [
                    "a",
                    "as"
                  ],
                  "properties": {
                    "a": {
                      "type": "string"
                    },
                    "as": {
                      "type": "array",
                      "items": {
                        "$ref": "#/$defs/A"
                      }
                    }
                  },
                  "additionalProperties": false
                }
              },
              "type": "object",
              "required": [
                "a",
                "as"
              ],
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "additionalProperties": false
            }, {
              topLevelReferenceStrategy: "skip"
            })
          })

          it("outer annotation", async () => {
            interface A {
              readonly a: string
              readonly as: ReadonlyArray<A>
            }
            const schema = Schema.Struct({
              a: Schema.String.annotate({ identifier: "ID" }),
              as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema).annotate({ identifier: "A" }))
            })
            await assertDraft7(schema, {
              "$defs": {
                "A": {
                  "type": "object",
                  "required": [
                    "a",
                    "as"
                  ],
                  "properties": {
                    "a": {
                      "type": "string"
                    },
                    "as": {
                      "type": "array",
                      "items": {
                        "$ref": "#/$defs/A"
                      }
                    }
                  },
                  "additionalProperties": false
                }
              },
              "type": "object",
              "required": [
                "a",
                "as"
              ],
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "additionalProperties": false
            }, {
              topLevelReferenceStrategy: "skip"
            })
          })

          it("top annotation", async () => {
            interface A {
              readonly a: string
              readonly as: ReadonlyArray<A>
            }
            const schema = Schema.Struct({
              a: Schema.String.annotate({ identifier: "ID" }),
              as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
            }).annotate({ identifier: "A" })
            await assertDraft7(schema, {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "required": [
                "a",
                "as"
              ],
              "additionalProperties": false,
              "$defs": {
                "A": {
                  "type": "object",
                  "properties": {
                    "a": {
                      "type": "string"
                    },
                    "as": {
                      "type": "array",
                      "items": {
                        "$ref": "#/$defs/A"
                      }
                    }
                  },
                  "required": [
                    "a",
                    "as"
                  ],
                  "additionalProperties": false
                }
              }
            }, {
              topLevelReferenceStrategy: "skip"
            })
          })
        })
      })
    })

    describe("additionalPropertiesStrategy", () => {
      it(`"allow"`, async () => {
        const schema = Schema.Struct({ a: Schema.String })

        await assertDraft7(schema, {
          "$schema": "http://json-schema.org/draft-07/schema",
          "type": "object",
          "properties": {
            "a": {
              "type": "string"
            }
          },
          "required": ["a"],
          "additionalProperties": true
        }, {
          additionalPropertiesStrategy: "allow"
        })
      })
    })
  })

  describe("Unsupported schemas", () => {
    it("Declaration", async () => {
      expectError(
        Schema.instanceOf(globalThis.URL),
        `cannot generate JSON Schema for Declaration at root`
      )
    })

    it("BigInt", async () => {
      expectError(
        Schema.BigInt,
        `cannot generate JSON Schema for BigIntKeyword at root`
      )
    })

    it("UniqueSymbol", async () => {
      expectError(
        Schema.UniqueSymbol(Symbol.for("effect/Schema/test/a")),
        `cannot generate JSON Schema for UniqueSymbol at root`
      )
    })

    it("Symbol", async () => {
      expectError(
        Schema.Symbol,
        `cannot generate JSON Schema for SymbolKeyword at root`
      )
    })

    it("Literal(bigint)", () => {
      expectError(
        Schema.Literal(1n),
        `cannot generate JSON Schema for LiteralType at root`
      )
    })

    it("Suspend", () => {
      interface A {
        readonly a: string
        readonly as: ReadonlyArray<A>
      }
      const schema = Schema.Struct({
        a: Schema.String,
        as: Schema.Array(Schema.suspend((): Schema.Schema<A> => schema))
      })
      expectError(
        schema,
        "cannot generate JSON Schema for Suspend at [\"as\"][0], required `id` annotation"
      )
    })

    describe("Tuple", () => {
      it("Unsupported element", () => {
        expectError(
          Schema.Tuple([Schema.Symbol]),
          `cannot generate JSON Schema for SymbolKeyword at [0]`
        )
      })

      it("Unsupported post-rest elements", () => {
        expectError(
          Schema.TupleWithRest(Schema.Tuple([]), [Schema.Number, Schema.String]),
          "Generating a JSON Schema for post-rest elements is not currently supported. You're welcome to contribute by submitting a Pull Request"
        )
      })
    })

    describe("Struct", () => {
      it("Unsupported field", () => {
        expectError(
          Schema.Struct({ a: Schema.Symbol }),
          `cannot generate JSON Schema for SymbolKeyword at ["a"]`
        )
      })

      it("Unsupported property signature key", () => {
        const a = Symbol.for("effect/Schema/test/a")
        expectError(
          Schema.Struct({ [a]: Schema.String }),
          `cannot generate JSON Schema for TypeLiteral at [Symbol(effect/Schema/test/a)]`
        )
      })

      it("Unsupported index signature parameter", () => {
        expectError(
          Schema.Record(Schema.Symbol, Schema.Number),
          `cannot generate JSON Schema for SymbolKeyword at root`
        )
      })
    })
  })

  describe("draft-07", () => {
    describe("Void", () => {
      it("Void", async () => {
        const schema = Schema.Void
        await assertDraft7(schema, {})
      })

      it("Void & annotate", async () => {
        const schema = Schema.Void.annotate({
          title: "title",
          description: "description",
          default: void 0,
          examples: [void 0]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description"
        })
      })

      it("Void & json schema annotation", async () => {
        const schema = Schema.Void.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({
              type: "string"
            })
          }
        })
        await assertDraft7(schema, {
          type: "string"
        })
      })
    })

    describe("Any", () => {
      it("Any", async () => {
        const schema = Schema.Any
        await assertDraft7(schema, {})
      })

      it("Any & annotate", async () => {
        const schema = Schema.Any.annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
      })

      it("Any & json schema annotation", async () => {
        const schema = Schema.Any.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({
              type: "string"
            })
          }
        })
        await assertDraft7(schema, {
          type: "string"
        })
      })
    })

    describe("Unknown", () => {
      it("Unknown", async () => {
        const schema = Schema.Unknown
        await assertDraft7(schema, {})
      })

      it("Unknown & annotate", async () => {
        const schema = Schema.Unknown.annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
      })

      it("Unknown & json schema annotation", async () => {
        const schema = Schema.Unknown.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({
              type: "string"
            })
          }
        })
        await assertDraft7(schema, {
          type: "string"
        })
      })
    })

    describe("Never", () => {
      it("Never", async () => {
        const schema = Schema.Never
        await assertDraft7(schema, {
          not: {}
        })
      })

      it("Never & annotate", async () => {
        const schema = Schema.Never.annotate({
          title: "title",
          description: "description"
        })
        await assertDraft7(schema, {
          not: {},
          title: "title",
          description: "description"
        })
      })
    })

    describe("Null", () => {
      it("Null", async () => {
        const schema = Schema.Null
        await assertDraft7(schema, {
          type: "null"
        })
        assertAjvDraft7Success(schema, null)
        assertAjvDraft7Failure(schema, "a")
      })

      it("Null & annotate", async () => {
        const schema = Schema.Null.annotate({
          title: "title",
          description: "description",
          default: null,
          examples: [null]
        })
        await assertDraft7(schema, {
          type: "null",
          title: "title",
          description: "description",
          default: null,
          examples: [null]
        })
      })

      it("Null & json schema annotation", async () => {
        const schema = Schema.Null.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({
              type: "string"
            })
          }
        })
        await assertDraft7(schema, {
          type: "string"
        })
      })
    })

    describe("Undefined", () => {
      it("Undefined", async () => {
        const schema = Schema.Undefined
        await assertDraft7(schema, {
          not: {}
        })
      })

      it("Undefined & annotate", async () => {
        const schema = Schema.Undefined.annotate({
          title: "title",
          description: "description",
          default: undefined,
          examples: [undefined]
        })
        await assertDraft7(schema, {
          not: {},
          title: "title",
          description: "description"
        })
      })

      it("Undefined & json schema annotation", async () => {
        const schema = Schema.Undefined.annotate({
          jsonSchema: {
            _tag: "Override",
            override: () => ({
              type: "string"
            })
          }
        })
        await assertDraft7(schema, {
          type: "string"
        })
      })

      it("NullOr(Undefined)", async () => {
        const schema = Schema.NullOr(Schema.Undefined)
        await assertDraft7(schema, { "type": "null" })
      })

      it("NullOr(Undefined) & annotate (undefined)", async () => {
        const schema = Schema.NullOr(Schema.Undefined).annotate({
          title: "title",
          description: "description",
          default: undefined,
          examples: [undefined]
        })
        await assertDraft7(schema, {
          type: "null",
          title: "title",
          description: "description"
        })
      })

      it("NullOr(Undefined) & annotate (null)", async () => {
        const schema = Schema.NullOr(Schema.Undefined).annotate({
          title: "title",
          description: "description",
          default: null,
          examples: [null]
        })
        await assertDraft7(schema, {
          type: "null",
          title: "title",
          description: "description",
          default: null,
          examples: [null]
        })
      })
    })

    describe("String", () => {
      it("String", async () => {
        const schema = Schema.String
        await assertDraft7(schema, {
          "type": "string"
        })
        assertAjvDraft7Success(schema, "a")
        assertAjvDraft7Failure(schema, null)
      })

      it("String & annotate", async () => {
        const schema = Schema.String.annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
      })

      it("String & annotateKey", async () => {
        const schema = Schema.String.annotateKey({
          title: "title",
          description: "description",
          documentation: "documentation"
        })
        // should ignore the annotations if the schema is not contextual
        await assertDraft7(schema, {
          type: "string"
        })
      })

      it("String & minLength", async () => {
        const schema = Schema.String.check(Check.minLength(1))
        await assertDraft7(schema, {
          type: "string",
          minLength: 1,
          title: "minLength(1)",
          description: "a value with a length of at least 1"
        })
      })

      it("String & minLength & maxlength", async () => {
        const schema = Schema.String.check(Check.minLength(1), Check.maxLength(2))
        await assertDraft7(schema, {
          type: "string",
          minLength: 1,
          title: "minLength(1)",
          description: "a value with a length of at least 1",
          allOf: [
            {
              description: "a value with a length of at most 2",
              maxLength: 2,
              title: "maxLength(2)"
            }
          ]
        })
      })

      it("String & annotate & minLength", async () => {
        const schema = Schema.String.annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        }).check(Check.minLength(1))
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"],
          allOf: [
            {
              description: "a value with a length of at least 1",
              minLength: 1,
              title: "minLength(1)"
            }
          ]
        })
      })

      it("String & minLength & annotate", async () => {
        const schema = Schema.String.check(Check.minLength(1)).annotate({
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          title: "title",
          description: "description",
          default: "default",
          examples: ["a"],
          minLength: 1
        })
      })

      it("String & minLength(1) & minLength(2)", async () => {
        const schema = Schema.String.check(Check.minLength(1), Check.minLength(2))
        await assertDraft7(schema, {
          type: "string",
          description: "a value with a length of at least 1",
          minLength: 1,
          title: "minLength(1)",
          allOf: [
            {
              description: "a value with a length of at least 2",
              minLength: 2,
              title: "minLength(2)"
            }
          ]
        })
      })

      it("String & minLength(2) & minLength(1)", async () => {
        const schema = Schema.String.check(Check.minLength(2), Check.minLength(1))
        await assertDraft7(schema, {
          type: "string",
          description: "a value with a length of at least 2",
          minLength: 2,
          title: "minLength(2)",
          allOf: [
            {
              description: "a value with a length of at least 1",
              minLength: 1,
              title: "minLength(1)"
            }
          ]
        })
      })
    })

    describe("Number", () => {
      it("Number", async () => {
        const schema = Schema.Number
        await assertDraft7(schema, {
          type: "number"
        })
      })

      it("Number & annotate", async () => {
        const schema = Schema.Number.annotate({
          title: "title",
          description: "description",
          default: 1,
          examples: [2]
        })
        await assertDraft7(schema, {
          type: "number",
          title: "title",
          description: "description",
          default: 1,
          examples: [2]
        })
      })

      it("Integer", async () => {
        const schema = Schema.Number.check(Check.int())
        await assertDraft7(schema, {
          type: "integer",
          description: "an integer",
          title: "int"
        })
      })

      it("Integer & annotate", async () => {
        const schema = Schema.Number.annotate({
          title: "title",
          description: "description",
          default: 1,
          examples: [2]
        }).check(Check.int())
        await assertDraft7(schema, {
          type: "integer",
          title: "title",
          description: "description",
          default: 1,
          examples: [2],
          allOf: [
            {
              description: "an integer",
              title: "int"
            }
          ]
        })
      })
    })

    describe("Boolean", () => {
      it("Boolean", async () => {
        const schema = Schema.Boolean
        await assertDraft7(schema, {
          type: "boolean"
        })
      })

      it("Boolean & annotate", async () => {
        const schema = Schema.Boolean.annotate({
          title: "title",
          description: "description",
          default: true,
          examples: [false]
        })
        await assertDraft7(schema, {
          type: "boolean",
          title: "title",
          description: "description",
          default: true,
          examples: [false]
        })
      })
    })

    describe("Object", () => {
      it("Object", async () => {
        const schema = Schema.Object
        await assertDraft7(schema, {
          anyOf: [
            { type: "object" },
            { type: "array" }
          ]
        })
      })

      it("Object & annotate", async () => {
        const schema = Schema.Object.annotate({
          title: "title",
          description: "description",
          default: {},
          examples: [{}, []]
        })
        await assertDraft7(schema, {
          anyOf: [
            { type: "object" },
            { type: "array" }
          ],
          title: "title",
          description: "description",
          default: {},
          examples: [{}, []]
        })
      })
    })

    describe("Literal", () => {
      it("string", async () => {
        const schema = Schema.Literal("a")
        await assertDraft7(schema, {
          type: "string",
          enum: ["a"]
        })
      })

      it("string & annotate", async () => {
        const schema = Schema.Literal("a").annotate({
          title: "title",
          description: "description",
          default: "a",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          enum: ["a"],
          title: "title",
          description: "description",
          default: "a",
          examples: ["a"]
        })
      })

      it("number", async () => {
        const schema = Schema.Literal(1)
        await assertDraft7(schema, {
          type: "number",
          enum: [1]
        })
      })

      it("number & annotate", async () => {
        const schema = Schema.Literal(1).annotate({
          title: "title",
          description: "description",
          default: 1,
          examples: [1]
        })
        await assertDraft7(schema, {
          type: "number",
          enum: [1],
          title: "title",
          description: "description",
          default: 1,
          examples: [1]
        })
      })

      it("boolean", async () => {
        const schema = Schema.Literal(true)
        await assertDraft7(schema, {
          type: "boolean",
          enum: [true]
        })
      })

      it("boolean & annotate", async () => {
        const schema = Schema.Literal(true).annotate({
          title: "title",
          description: "description",
          default: true,
          examples: [true]
        })
        await assertDraft7(schema, {
          type: "boolean",
          enum: [true],
          title: "title",
          description: "description",
          default: true,
          examples: [true]
        })
      })
    })

    describe("Literals", () => {
      it("strings", async () => {
        const schema = Schema.Literals(["a", "b"])
        await assertDraft7(schema, {
          type: "string",
          enum: ["a", "b"]
        })
      })

      it("strings & annotate", async () => {
        const schema = Schema.Literals(["a", "b"]).annotate({ description: "description" })
        await assertDraft7(schema, {
          type: "string",
          enum: ["a", "b"],
          description: "description"
        })
      })

      it("numbers", async () => {
        const schema = Schema.Literals([1, 2])
        await assertDraft7(schema, {
          type: "number",
          enum: [1, 2]
        })
      })

      it("booleans", async () => {
        const schema = Schema.Literals([true, false])
        await assertDraft7(schema, {
          type: "boolean",
          enum: [true, false]
        })
      })

      it("strings & numbers", async () => {
        const schema = Schema.Literals(["a", 1])
        await assertDraft7(schema, {
          anyOf: [
            { type: "string", enum: ["a"] },
            { type: "number", enum: [1] }
          ]
        })
      })
    })

    describe("Union of literals", () => {
      it("strings", async () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b")
        ])
        await assertDraft7(schema, {
          type: "string",
          enum: ["a", "b"]
        })
      })

      it("strings & outer annotate", async () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b")
        ]).annotate({ description: "description" })
        await assertDraft7(schema, {
          type: "string",
          enum: ["a", "b"],
          description: "description"
        })
      })

      it("strings & inner annotate", async () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b").annotate({ description: "description" })
        ])
        await assertDraft7(schema, {
          anyOf: [
            { type: "string", enum: ["a"] },
            { type: "string", enum: ["b"], description: "description" }
          ]
        })
      })

      it("strings & inner annotate & outer annotate", async () => {
        const schema = Schema.Union([
          Schema.Literal("a"),
          Schema.Literal("b").annotate({ description: "inner-description" })
        ])
          .annotate({ description: "outer-description" })
        await assertDraft7(schema, {
          anyOf: [
            { type: "string", enum: ["a"] },
            { type: "string", enum: ["b"], description: "inner-description" }
          ],
          description: "outer-description"
        })
      })

      it("numbers", async () => {
        const schema = Schema.Union([Schema.Literal(1), Schema.Literal(2)])
        await assertDraft7(schema, {
          type: "number",
          enum: [1, 2]
        })
      })

      it("booleans", async () => {
        const schema = Schema.Union([Schema.Literal(true), Schema.Literal(false)])
        await assertDraft7(schema, {
          type: "boolean",
          enum: [true, false]
        })
      })

      it("strings & numbers", async () => {
        const schema = Schema.Union([Schema.Literal("a"), Schema.Literal(1)])
        await assertDraft7(schema, {
          anyOf: [
            { type: "string", enum: ["a"] },
            { type: "number", enum: [1] }
          ]
        })
      })
    })

    describe("Enums", () => {
      it("empty enum", async () => {
        enum Empty {}
        await assertDraft7(Schema.Enums(Empty), {
          "not": {}
        })
        await assertDraft7(Schema.Enums(Empty).annotate({ description: "description" }), {
          "not": {},
          "description": "description"
        })
      })

      it("single enum", async () => {
        enum Fruits {
          Apple
        }
        await assertDraft7(Schema.Enums(Fruits), {
          "type": "number",
          "title": "Apple",
          "enum": [0]
        })
        await assertDraft7(Schema.Enums(Fruits).annotate({ description: "description" }), {
          "type": "number",
          "title": "Apple",
          "enum": [0],
          "description": "description"
        })
      })

      it("Enums", async () => {
        enum Fruits {
          Apple,
          Banana,
          Orange = "orange"
        }

        const schema = Schema.Enums(Fruits)
        await assertDraft7(schema, {
          anyOf: [
            { type: "number", enum: [0], title: "Apple" },
            { type: "number", enum: [1], title: "Banana" },
            { type: "string", enum: ["orange"], title: "Orange" }
          ]
        })
      })

      it("Enums & annotate", async () => {
        enum Fruits {
          Apple,
          Banana,
          Orange = "orange"
        }

        const schema = Schema.Enums(Fruits).annotate({
          title: "title",
          description: "description",
          default: Fruits.Apple,
          examples: [Fruits.Banana, Fruits.Orange]
        })
        await assertDraft7(schema, {
          anyOf: [
            { type: "number", enum: [0], title: "Apple" },
            { type: "number", enum: [1], title: "Banana" },
            { type: "string", enum: ["orange"], title: "Orange" }
          ],
          title: "title",
          description: "description",
          default: Fruits.Apple,
          examples: [Fruits.Banana, "orange"]
        })
      })

      it("const enums", async () => {
        const Fruits = {
          Apple: "apple",
          Banana: "banana",
          Cantaloupe: 3
        } as const
        await assertDraft7(Schema.Enums(Fruits), {
          "anyOf": [
            { "type": "string", "title": "Apple", "enum": ["apple"] },
            { "type": "string", "title": "Banana", "enum": ["banana"] },
            { "type": "number", "title": "Cantaloupe", "enum": [3] }
          ]
        })
      })
    })

    describe("TemplateLiteral", () => {
      it("TemplateLiteral", async () => {
        const schema = Schema.TemplateLiteral(["a", Schema.String])
        await assertDraft7(schema, {
          type: "string",
          pattern: "^(a)([\\s\\S]*?)$"
        })
      })

      it("TemplateLiteral & annotate", async () => {
        const schema = Schema.TemplateLiteral(["a", Schema.String]).annotate({
          title: "title",
          description: "description",
          default: "a",
          examples: ["a"]
        })
        await assertDraft7(schema, {
          type: "string",
          pattern: "^(a)([\\s\\S]*?)$",
          title: "title",
          description: "description",
          default: "a",
          examples: ["a"]
        })
      })
    })

    describe("Tuple", () => {
      it("empty tuple", async () => {
        const schema = Schema.Tuple([]).annotate({ description: "tuple-description" })
        await assertDraft7(schema, {
          type: "array",
          items: false,
          description: "tuple-description"
        })
      })

      it("required elements", async () => {
        const schema = Schema.Tuple([
          Schema.String,
          Schema.String.annotate({ description: "1" }),
          Schema.String.annotate({ description: "2-inner" }).annotateKey({ description: "2-outer" }),
          Schema.String.annotateKey({ default: "d", examples: ["d"] })
        ]).annotate({ description: "tuple-description" })
        await assertDraft7(schema, {
          type: "array",
          items: [
            { type: "string" },
            { type: "string", description: "1" },
            { type: "string", description: "2-outer" },
            { type: "string", default: "d", examples: ["d"] }
          ],
          additionalItems: false,
          description: "tuple-description"
        })
      })

      it("optionalKey elements", async () => {
        const schema = Schema.Tuple([
          Schema.optionalKey(Schema.String),
          Schema.optionalKey(Schema.String.annotate({ description: "b" })),
          Schema.optionalKey(
            Schema.String.annotate({ description: "c-inner" }).annotateKey({ description: "c-outer" })
          ),
          Schema.optionalKey(Schema.String.annotate({ description: "d-inner" })).annotateKey({
            description: "d-outer"
          })
        ])
        await assertDraft7(schema, {
          type: "array",
          items: [
            { type: "string" },
            { type: "string", description: "b" },
            { type: "string", description: "c-outer" },
            { type: "string", description: "d-outer" }
          ],
          minItems: 0,
          additionalItems: false
        })
      })

      it("optional elements", async () => {
        const schema = Schema.Tuple([
          Schema.optional(Schema.String),
          Schema.optional(Schema.String.annotate({ description: "b" })),
          Schema.optional(
            Schema.String.annotate({ description: "c-inner" }).annotateKey({ description: "c-outer" })
          ),
          Schema.optional(Schema.String.annotate({ description: "d-inner" })).annotateKey({
            description: "d-outer"
          })
        ])
        await assertDraft7(schema, {
          type: "array",
          items: [
            { type: "string" },
            { type: "string", description: "b" },
            { type: "string", description: "c-outer" },
            { type: "string", description: "d-outer" }
          ],
          minItems: 0,
          additionalItems: false
        })
      })

      it("UndefinedOr elements", async () => {
        const schema = Schema.Tuple([
          Schema.String,
          Schema.UndefinedOr(Schema.String),
          Schema.UndefinedOr(Schema.String.annotate({ description: "2-description" })),
          Schema.UndefinedOr(Schema.String.annotate({ description: "3-inner" })).annotate({ description: "3-outer" }),
          Schema.UndefinedOr(Schema.String.annotate({ description: "4-inner" })).annotateKey({
            description: "4-outer"
          })
        ])
        await assertDraft7(schema, {
          type: "array",
          items: [
            { type: "string" },
            { type: "string" },
            { type: "string", description: "2-description" },
            { type: "string", description: "3-outer" },
            { type: "string", description: "4-outer" }
          ],
          minItems: 1,
          additionalItems: false
        })
      })
    })

    describe("Array", () => {
      it("Array", async () => {
        const schema = Schema.Array(Schema.String)
        await assertDraft7(schema, {
          type: "array",
          items: { type: "string" }
        })
      })

      it("Array & annotate", async () => {
        const schema = Schema.Array(Schema.String).annotate({
          title: "title",
          description: "description",
          default: ["a"],
          examples: [["a"]]
        })
        await assertDraft7(schema, {
          type: "array",
          items: { type: "string" },
          title: "title",
          description: "description",
          default: ["a"],
          examples: [["a"]]
        })
      })

      it("UniqueArray", async () => {
        const schema = Schema.UniqueArray(Schema.String)
        await assertDraft7(schema, {
          "type": "array",
          "items": { "type": "string" },
          "title": "unique",
          "description": "an array with unique items",
          "uniqueItems": true
        })
      })
    })

    describe("Struct", () => {
      it("required properties", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String.annotate({ description: "b" }),
          c: Schema.String.annotate({ description: "c-inner" }).annotateKey({ description: "c-outer" }),
          d: Schema.String.annotateKey({ default: "d", examples: ["d"] })
        }).annotate({ description: "struct-description" })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string", description: "b" },
            c: { type: "string", description: "c-outer" },
            d: { type: "string", default: "d", examples: ["d"] }
          },
          required: ["a", "b", "c", "d"],
          additionalProperties: false,
          description: "struct-description"
        })
      })

      it("optionalKey properties", async () => {
        const schema = Schema.Struct({
          a: Schema.optionalKey(Schema.String),
          b: Schema.optionalKey(Schema.String.annotate({ description: "b" })),
          c: Schema.optionalKey(
            Schema.String.annotate({ description: "c-inner" }).annotateKey({ description: "c-outer" })
          ),
          d: Schema.optionalKey(Schema.String.annotate({ description: "d-inner" })).annotateKey({
            description: "d-outer"
          })
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string", description: "b" },
            c: { type: "string", description: "c-outer" },
            d: { type: "string", description: "d-outer" }
          },
          required: [],
          additionalProperties: false
        })
      })

      it("optional properties", async () => {
        const schema = Schema.Struct({
          a: Schema.optional(Schema.String),
          b: Schema.optional(Schema.String.annotate({ description: "b" })),
          c: Schema.optional(
            Schema.String.annotate({ description: "c-inner" }).annotateKey({ description: "c-outer" })
          ),
          d: Schema.optional(Schema.String.annotate({ description: "d-inner" })).annotateKey({
            description: "d-outer"
          })
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string", description: "b" },
            c: { type: "string", description: "c-outer" },
            d: { type: "string", description: "d-outer" }
          },
          required: [],
          additionalProperties: false
        })
      })

      it("Undefined properties", async () => {
        const schema = Schema.Struct({
          a: Schema.Undefined,
          b: Schema.Undefined.annotate({ description: "b" }),
          c: Schema.Undefined.annotate({ description: "b" }).annotateKey({ description: "c" }),
          d: Schema.Undefined.annotate({ description: "d-inner" }).annotateKey({ description: "d-outer" })
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { not: {} },
            b: { not: {}, description: "b" },
            c: { not: {}, description: "c" },
            d: { not: {}, description: "d-outer" }
          },
          required: [],
          additionalProperties: false
        })
      })

      it("UndefinedOr properties", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.UndefinedOr(Schema.String),
          c: Schema.UndefinedOr(Schema.String.annotate({ description: "c-description" })),
          d: Schema.UndefinedOr(Schema.String.annotate({ description: "d-inner" })).annotate({
            description: "d-outer"
          }),
          e: Schema.UndefinedOr(Schema.String.annotate({ description: "e-inner" })).annotateKey({
            description: "e-outer"
          })
        })
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" },
            b: { type: "string" },
            c: { type: "string", description: "c-description" },
            d: { type: "string", description: "d-outer" },
            e: { type: "string", description: "e-outer" }
          },
          required: ["a"],
          additionalProperties: false
        })
      })
    })

    describe("Record", () => {
      it("Record(String, Number)", async () => {
        const schema = Schema.Record(Schema.String, Schema.Number)
        await assertDraft7(schema, {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: {
            type: "number"
          }
        })
      })

      it("Record(String & minLength(1), Number) & annotate", async () => {
        const schema = Schema.Record(Schema.String.check(Check.minLength(1)), Schema.Number)
        await assertDraft7(schema, {
          type: "object",
          properties: {},
          required: [],
          additionalProperties: {
            type: "number"
          }
        })
      })

      it("Record(`a${string}`, Number) & annotate", async () => {
        const schema = Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number)
        await assertDraft7(schema, {
          type: "object",
          properties: {},
          required: [],
          patternProperties: {
            "^(a)([\\s\\S]*?)$": {
              type: "number"
            }
          }
        })
      })
    })

    describe("Union", () => {
      it("empty union", async () => {
        await assertDraft7(Schema.Union([]), {
          "not": {}
        })
        await assertDraft7(Schema.Union([]).annotate({ description: "description" }), {
          "not": {},
          "description": "description"
        })
      })

      it("single member", async () => {
        await assertDraft7(Schema.Union([Schema.String]), {
          "type": "string"
        })
        await assertDraft7(Schema.Union([Schema.String]).annotate({ description: "description" }), {
          "type": "string",
          "description": "description"
        })
      })

      it("String | Number", async () => {
        await assertDraft7(
          Schema.Union([
            Schema.String,
            Schema.Number
          ]),
          {
            "anyOf": [
              { "type": "string" },
              { "type": "number" }
            ]
          }
        )
        await assertDraft7(
          Schema.Union([
            Schema.String,
            Schema.Number
          ]).annotate({ description: "description" }),
          {
            "anyOf": [
              { "type": "string" },
              { "type": "number" }
            ],
            "description": "description"
          }
        )
      })

      it(`1 | 2 | string`, async () => {
        await assertDraft7(
          Schema.Union([
            Schema.Literal(1),
            Schema.Literal(2),
            Schema.String
          ]),
          {
            "anyOf": [
              { "type": "number", "enum": [1, 2] },
              { "type": "string" }
            ]
          }
        )
      })

      it(`(1 | 2) | string`, async () => {
        await assertDraft7(
          Schema.Union([
            Schema.Literals([1, 2]),
            Schema.String
          ]),
          {
            "anyOf": [
              { "type": "number", "enum": [1, 2] },
              { "type": "string" }
            ]
          }
        )
      })

      it(`(1 | 2)(with description) | string`, async () => {
        await assertDraft7(
          Schema.Union([
            Schema.Literals([1, 2]).annotate({ description: "1-2-description" }),
            Schema.String
          ]),
          {
            "anyOf": [
              {
                "type": "number",
                "enum": [1, 2],
                "description": "1-2-description"
              },
              { "type": "string" }
            ]
          }
        )
      })

      it(`(1 | 2)(with description) | 3 | string`, async () => {
        await assertDraft7(
          Schema.Union(
            [
              Schema.Literals([1, 2]).annotate({ description: "1-2-description" }),
              Schema.Literal(3),
              Schema.String
            ]
          ),
          {
            "anyOf": [
              {
                "type": "number",
                "enum": [1, 2],
                "description": "1-2-description"
              },
              { "enum": [3], "type": "number" },
              {
                "type": "string"
              }
            ]
          }
        )
      })

      it(`1(with description) | 2 | string`, async () => {
        await assertDraft7(
          Schema.Union(
            [
              Schema.Literal(1).annotate({ description: "1-description" }),
              Schema.Literal(2),
              Schema.String
            ]
          ),
          {
            "anyOf": [
              {
                "type": "number",
                "description": "1-description",
                "enum": [1]
              },
              { "type": "number", "enum": [2] },
              { "type": "string" }
            ]
          }
        )
      })

      it(`1 | 2(with description) | string`, async () => {
        await assertDraft7(
          Schema.Union(
            [
              Schema.Literal(1),
              Schema.Literal(2).annotate({ description: "2-description" }),
              Schema.String
            ]
          ),
          {
            "anyOf": [
              { "type": "number", "enum": [1] },
              {
                "type": "number",
                "description": "2-description",
                "enum": [2]
              },
              { "type": "string" }
            ]
          }
        )
      })

      it(`string | 1 | 2 `, async () => {
        await assertDraft7(Schema.Union([Schema.String, Schema.Literal(1), Schema.Literal(2)]), {
          "anyOf": [
            { "type": "string" },
            { "type": "number", "enum": [1, 2] }
          ]
        })
      })

      it(`string | (1 | 2) `, async () => {
        await assertDraft7(Schema.Union([Schema.String, Schema.Literals([1, 2])]), {
          "anyOf": [
            { "type": "string" },
            { "type": "number", "enum": [1, 2] }
          ]
        })
      })

      it(`string | 1(with description) | 2`, async () => {
        await assertDraft7(
          Schema.Union(
            [
              Schema.String,
              Schema.Literal(1).annotate({ description: "1-description" }),
              Schema.Literal(2)
            ]
          ),
          {
            "anyOf": [
              { "type": "string" },
              {
                "type": "number",
                "description": "1-description",
                "enum": [1]
              },
              { "type": "number", "enum": [2] }
            ]
          }
        )
      })

      it(`string | 1 | 2(with description)`, async () => {
        await assertDraft7(
          Schema.Union(
            [
              Schema.String,
              Schema.Literal(1),
              Schema.Literal(2).annotate({ description: "2-description" })
            ]
          ),
          {
            "anyOf": [
              { "type": "string" },
              { "type": "number", "enum": [1] },
              {
                "type": "number",
                "description": "2-description",
                "enum": [2]
              }
            ]
          }
        )
      })
    })

    describe("Suspend", () => {
      it("inner annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema.annotate({ identifier: "A" })))
        })
        await assertDraft7(schema, {
          "$defs": {
            "A": {
              "type": "object",
              "required": [
                "a",
                "as"
              ],
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "additionalProperties": false
            }
          },
          "type": "object",
          "required": [
            "a",
            "as"
          ],
          "properties": {
            "a": {
              "type": "string"
            },
            "as": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/A"
              }
            }
          },
          "additionalProperties": false
        })
      })

      it("outer annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema).annotate({ identifier: "A" }))
        })
        await assertDraft7(schema, {
          "$defs": {
            "A": {
              "type": "object",
              "required": [
                "a",
                "as"
              ],
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "additionalProperties": false
            }
          },
          "type": "object",
          "required": [
            "a",
            "as"
          ],
          "properties": {
            "a": {
              "type": "string"
            },
            "as": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/A"
              }
            }
          },
          "additionalProperties": false
        })
      })

      it("top annotation", async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
        }).annotate({ identifier: "A" })
        await assertDraft7(schema, {
          "$ref": "#/$defs/A",
          "$defs": {
            "A": {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "required": [
                "a",
                "as"
              ],
              "additionalProperties": false
            }
          }
        })
      })

      it(`top annotation but topLevelReferenceStrategy === "skip"`, async () => {
        interface A {
          readonly a: string
          readonly as: ReadonlyArray<A>
        }
        const schema = Schema.Struct({
          a: Schema.String,
          as: Schema.Array(Schema.suspend((): Schema.Codec<A> => schema))
        }).annotate({ identifier: "A" })
        await assertDraft7(schema, {
          "type": "object",
          "properties": {
            "a": {
              "type": "string"
            },
            "as": {
              "type": "array",
              "items": {
                "$ref": "#/$defs/A"
              }
            }
          },
          "required": [
            "a",
            "as"
          ],
          "additionalProperties": false,
          "$defs": {
            "A": {
              "type": "object",
              "properties": {
                "a": {
                  "type": "string"
                },
                "as": {
                  "type": "array",
                  "items": {
                    "$ref": "#/$defs/A"
                  }
                }
              },
              "required": [
                "a",
                "as"
              ],
              "additionalProperties": false
            }
          }
        }, {
          topLevelReferenceStrategy: "skip"
        })
      })
    })

    describe("Class", () => {
      // TODO: add tests for ErrorClass and other classes

      it("Class", async () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        const schema = A
        await assertDraft7(schema, {
          "$ref": "#/$defs/A",
          "$defs": {
            "A": {
              type: "object",
              properties: {
                a: { type: "string" }
              },
              required: ["a"],
              additionalProperties: false
            }
          }
        })
      })

      it("Class & annotate", async () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}
        const schema = A.annotate({})
        await assertDraft7(schema, {
          type: "object",
          properties: {
            a: { type: "string" }
          },
          required: ["a"],
          additionalProperties: false
        })
      })
    })

    describe("Checks", () => {
      it("uuid", async () => {
        await assertDraft7(Schema.String.check(Check.uuid()), {
          "description": "a UUID",
          "format": "uuid",
          "pattern":
            "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$",
          "title": "uuid",
          "type": "string"
        })
        await assertDraft7(Schema.String.check(Check.uuid(4)), {
          "description": "a UUID v4",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$",
          "title": "uuid-v4",
          "type": "string"
        })
      })

      it("int32", async () => {
        await assertDraft7(Schema.Number.check(Check.int32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "int"
            },
            {
              "description": "a value between -2147483648 and 2147483647",
              "maximum": 2147483647,
              "minimum": -2147483648,
              "title": "between(-2147483648, 2147483647)"
            }
          ],
          "type": "integer",
          "title": "int32",
          "description": "a 32-bit integer"
        })
      })

      it("uint32", async () => {
        await assertDraft7(Schema.Number.check(Check.uint32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "int"
            },
            {
              "description": "a value between 0 and 4294967295",
              "maximum": 4294967295,
              "minimum": 0,
              "title": "between(0, 4294967295)"
            }
          ],
          "type": "integer",
          "title": "uint32",
          "description": "a 32-bit unsigned integer"
        })
      })

      it("base64", async () => {
        await assertDraft7(Schema.String.check(Check.base64()), {
          "type": "string",
          "title": "base64",
          "description": "a base64 encoded string",
          "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
        })
      })

      it("base64url", async () => {
        await assertDraft7(Schema.String.check(Check.base64url()), {
          "type": "string",
          "title": "base64url",
          "description": "a base64url encoded string",
          "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
        })
      })

      it("length (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Check.length(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "a value with a length of 2",
          "title": "length(2)",
          "minItems": 2,
          "maxItems": 2
        })
      })

      it("length (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Check.length(2)), {
          "type": "array",
          "items": [{
            "type": "string"
          }],
          "description": "a value with a length of 2",
          "title": "length(2)",
          "minItems": 2,
          "maxItems": 2,
          "additionalItems": {
            "type": "string"
          }
        })
      })

      it("minLength (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Check.minLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "a value with a length of at least 2",
          "title": "minLength(2)",
          "minItems": 2
        })
      })

      it("minLength (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Check.minLength(2)), {
          "type": "array",
          "items": [{
            "type": "string"
          }],
          "description": "a value with a length of at least 2",
          "title": "minLength(2)",
          "minItems": 2,
          "additionalItems": {
            "type": "string"
          }
        })
      })

      it("maxLength (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Check.maxLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "a value with a length of at most 2",
          "title": "maxLength(2)",
          "maxItems": 2
        })
      })

      it("maxLength (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Check.maxLength(2)), {
          "type": "array",
          "items": [{
            "type": "string"
          }],
          "description": "a value with a length of at most 2",
          "title": "maxLength(2)",
          "maxItems": 2,
          "additionalItems": {
            "type": "string"
          }
        })
      })

      it("minLength (String)", async () => {
        await assertDraft7(Schema.String.check(Check.minLength(1)), {
          "type": "string",
          "title": "minLength(1)",
          "description": "a value with a length of at least 1",
          "minLength": 1
        })
      })

      it("maxLength (String)", async () => {
        await assertDraft7(Schema.String.check(Check.maxLength(1)), {
          "type": "string",
          "title": "maxLength(1)",
          "description": "a value with a length of at most 1",
          "maxLength": 1
        })
      })

      it("length (String)", async () => {
        await assertDraft7(Schema.String.check(Check.length(1)), {
          "type": "string",
          "title": "length(1)",
          "description": "a value with a length of 1",
          "maxLength": 1,
          "minLength": 1
        })
      })

      it("greaterThan", async () => {
        await assertDraft7(Schema.Number.check(Check.greaterThan(1)), {
          "type": "number",
          "title": "greaterThan(1)",
          "description": "a value greater than 1",
          "exclusiveMinimum": 1
        })
      })

      it("greaterThanOrEqualTo", async () => {
        await assertDraft7(Schema.Number.check(Check.greaterThanOrEqualTo(1)), {
          "type": "number",
          "title": "greaterThanOrEqualTo(1)",
          "description": "a value greater than or equal to 1",
          "minimum": 1
        })
      })

      it("lessThan", async () => {
        await assertDraft7(Schema.Number.check(Check.lessThan(1)), {
          "type": "number",
          "title": "lessThan(1)",
          "description": "a value less than 1",
          "exclusiveMaximum": 1
        })
      })

      it("lessThanOrEqualTo", async () => {
        await assertDraft7(Schema.Number.check(Check.lessThanOrEqualTo(1)), {
          "type": "number",
          "title": "lessThanOrEqualTo(1)",
          "description": "a value less than or equal to 1",
          "maximum": 1
        })
      })

      it("pattern", async () => {
        await assertDraft7(Schema.String.check(Check.regex(/^abb+$/)), {
          "type": "string",
          "title": "regex(^abb+$)",
          "description": "a string matching the regex ^abb+$",
          "pattern": "^abb+$"
        })
      })

      it("int", async () => {
        await assertDraft7(Schema.Number.check(Check.int()), {
          "type": "integer",
          "title": "int",
          "description": "an integer"
        })
      })

      it("Trimmed", async () => {
        const schema = Schema.Trimmed
        await assertDraft7(schema, {
          "title": "trimmed",
          "description": "a string with no leading or trailing whitespace",
          "pattern": "^\\S[\\s\\S]*\\S$|^\\S$|^$",
          "type": "string"
        })
      })

      it("lowercased", async () => {
        const schema = Schema.String.check(Check.lowercased())
        await assertDraft7(schema, {
          "title": "lowercased",
          "description": "a string with all characters in lowercase",
          "pattern": "^[^A-Z]*$",
          "type": "string"
        })
      })

      it("uppercased", async () => {
        const schema = Schema.String.check(Check.uppercased())
        await assertDraft7(schema, {
          "title": "uppercased",
          "description": "a string with all characters in uppercase",
          "pattern": "^[^a-z]*$",
          "type": "string"
        })
      })

      it("capitalized", async () => {
        const schema = Schema.String.check(Check.capitalized())
        await assertDraft7(schema, {
          "title": "capitalized",
          "description": "a string with the first character in uppercase",
          "pattern": "^[^a-z]?.*$",
          "type": "string"
        })
      })

      it("uncapitalized", async () => {
        const schema = Schema.String.check(Check.uncapitalized())
        await assertDraft7(schema, {
          "title": "uncapitalized",
          "description": "a string with the first character in lowercase",
          "pattern": "^[^A-Z]?.*$",
          "type": "string"
        })
      })

      describe("should handle merge conflicts", () => {
        it("minLength + minLength", async () => {
          await assertDraft7(Schema.String.check(Check.minLength(1), Check.minLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at least 2",
                "minLength": 2,
                "title": "minLength(2)"
              }
            ],
            "description": "a value with a length of at least 1",
            "minLength": 1,
            "title": "minLength(1)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Check.minLength(2), Check.minLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at least 1",
                "minLength": 1,
                "title": "minLength(1)"
              }
            ],
            "description": "a value with a length of at least 2",
            "minLength": 2,
            "title": "minLength(2)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Check.minLength(2), Check.minLength(1), Check.minLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at least 1",
                "minLength": 1,
                "title": "minLength(1)"
              },
              {
                "description": "a value with a length of at least 2",
                "minLength": 2,
                "title": "minLength(2)"
              }
            ],
            "description": "a value with a length of at least 2",
            "minLength": 2,
            "title": "minLength(2)",
            "type": "string"
          })
        })

        it("maxLength + maxLength", async () => {
          await assertDraft7(Schema.String.check(Check.maxLength(1), Check.maxLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at most 2",
                "maxLength": 2,
                "title": "maxLength(2)"
              }
            ],
            "description": "a value with a length of at most 1",
            "maxLength": 1,
            "title": "maxLength(1)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Check.maxLength(2), Check.maxLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at most 1",
                "maxLength": 1,
                "title": "maxLength(1)"
              }
            ],
            "description": "a value with a length of at most 2",
            "maxLength": 2,
            "title": "maxLength(2)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Check.maxLength(1), Check.maxLength(2), Check.maxLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at most 2",
                "maxLength": 2,
                "title": "maxLength(2)"
              },
              {
                "description": "a value with a length of at most 1",
                "maxLength": 1,
                "title": "maxLength(1)"
              }
            ],
            "description": "a value with a length of at most 1",
            "maxLength": 1,
            "title": "maxLength(1)",
            "type": "string"
          })
        })

        it("pattern + pattern", async () => {
          await assertDraft7(Schema.String.check(Check.startsWith("a"), Check.endsWith("c")), {
            "allOf": [
              {
                "description": "a string ending with \"c\"",
                "pattern": "c$",
                "title": "endsWith(\"c\")"
              }
            ],
            "description": "a string starting with \"a\"",
            "pattern": "^a",
            "title": "startsWith(\"a\")",
            "type": "string"
          })
          await assertDraft7(
            Schema.String.check(Check.startsWith("a"), Check.endsWith("c"), Check.startsWith("a")),
            {
              "allOf": [
                {
                  "description": "a string ending with \"c\"",
                  "pattern": "c$",
                  "title": "endsWith(\"c\")"
                },
                {
                  "description": "a string starting with \"a\"",
                  "pattern": "^a",
                  "title": "startsWith(\"a\")"
                }
              ],
              "description": "a string starting with \"a\"",
              "pattern": "^a",
              "title": "startsWith(\"a\")",
              "type": "string"
            }
          )
          await assertDraft7(
            Schema.String.check(Check.endsWith("c"), Check.startsWith("a"), Check.endsWith("c")),
            {
              "allOf": [
                {
                  "description": "a string starting with \"a\"",
                  "pattern": "^a",
                  "title": "startsWith(\"a\")"
                },
                {
                  "description": "a string ending with \"c\"",
                  "pattern": "c$",
                  "title": "endsWith(\"c\")"
                }
              ],
              "description": "a string ending with \"c\"",
              "pattern": "c$",
              "title": "endsWith(\"c\")",
              "type": "string"
            }
          )
        })

        it("minItems + minItems", async () => {
          await assertDraft7(Schema.Array(Schema.String).check(Check.minLength(1), Check.minLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at least 2",
                "minItems": 2,
                "title": "minLength(2)"
              }
            ],
            "description": "a value with a length of at least 1",
            "items": {
              "type": "string"
            },
            "minItems": 1,
            "title": "minLength(1)",
            "type": "array"
          })
          await assertDraft7(Schema.Array(Schema.String).check(Check.minLength(2), Check.minLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at least 1",
                "minItems": 1,
                "title": "minLength(1)"
              }
            ],
            "description": "a value with a length of at least 2",
            "items": {
              "type": "string"
            },
            "minItems": 2,
            "title": "minLength(2)",
            "type": "array"
          })
          await assertDraft7(
            Schema.Array(Schema.String).check(Check.minLength(2), Check.minLength(1), Check.minLength(2)),
            {
              "allOf": [
                {
                  "description": "a value with a length of at least 1",
                  "minItems": 1,
                  "title": "minLength(1)"
                },
                {
                  "description": "a value with a length of at least 2",
                  "minItems": 2,
                  "title": "minLength(2)"
                }
              ],
              "description": "a value with a length of at least 2",
              "items": {
                "type": "string"
              },
              "minItems": 2,
              "title": "minLength(2)",
              "type": "array"
            }
          )
        })

        it("maxItems + maxItems", async () => {
          await assertDraft7(Schema.Array(Schema.String).check(Check.maxLength(1), Check.maxLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at most 2",
                "maxItems": 2,
                "title": "maxLength(2)"
              }
            ],
            "description": "a value with a length of at most 1",
            "items": {
              "type": "string"
            },
            "maxItems": 1,
            "title": "maxLength(1)",
            "type": "array"
          })
          await assertDraft7(Schema.Array(Schema.String).check(Check.maxLength(2), Check.maxLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at most 1",
                "maxItems": 1,
                "title": "maxLength(1)"
              }
            ],
            "description": "a value with a length of at most 2",
            "items": {
              "type": "string"
            },
            "maxItems": 2,
            "title": "maxLength(2)",
            "type": "array"
          })
          await assertDraft7(
            Schema.Array(Schema.String).check(Check.maxLength(1), Check.maxLength(2), Check.maxLength(1)),
            {
              "allOf": [
                {
                  "description": "a value with a length of at most 2",
                  "maxItems": 2,
                  "title": "maxLength(2)"
                },
                {
                  "description": "a value with a length of at most 1",
                  "maxItems": 1,
                  "title": "maxLength(1)"
                }
              ],
              "description": "a value with a length of at most 1",
              "items": {
                "type": "string"
              },
              "maxItems": 1,
              "title": "maxLength(1)",
              "type": "array"
            }
          )
        })

        it("minimum + minimum", async () => {
          await assertDraft7(Schema.Number.check(Check.greaterThanOrEqualTo(1), Check.greaterThanOrEqualTo(2)), {
            "allOf": [
              {
                "description": "a value greater than or equal to 2",
                "minimum": 2,
                "title": "greaterThanOrEqualTo(2)"
              }
            ],
            "description": "a value greater than or equal to 1",
            "minimum": 1,
            "title": "greaterThanOrEqualTo(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Check.greaterThanOrEqualTo(2), Check.greaterThanOrEqualTo(1)), {
            "allOf": [
              {
                "description": "a value greater than or equal to 1",
                "minimum": 1,
                "title": "greaterThanOrEqualTo(1)"
              }
            ],
            "description": "a value greater than or equal to 2",
            "minimum": 2,
            "title": "greaterThanOrEqualTo(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(
              Check.greaterThanOrEqualTo(2),
              Check.greaterThanOrEqualTo(1),
              Check.greaterThanOrEqualTo(2)
            ),
            {
              "allOf": [
                {
                  "description": "a value greater than or equal to 1",
                  "minimum": 1,
                  "title": "greaterThanOrEqualTo(1)"
                },
                {
                  "description": "a value greater than or equal to 2",
                  "minimum": 2,
                  "title": "greaterThanOrEqualTo(2)"
                }
              ],
              "description": "a value greater than or equal to 2",
              "minimum": 2,
              "title": "greaterThanOrEqualTo(2)",
              "type": "number"
            }
          )
        })

        it("maximum + maximum", async () => {
          await assertDraft7(Schema.Number.check(Check.lessThanOrEqualTo(1), Check.lessThanOrEqualTo(2)), {
            "allOf": [
              {
                "description": "a value less than or equal to 2",
                "maximum": 2,
                "title": "lessThanOrEqualTo(2)"
              }
            ],
            "description": "a value less than or equal to 1",
            "maximum": 1,
            "title": "lessThanOrEqualTo(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Check.lessThanOrEqualTo(2), Check.lessThanOrEqualTo(1)), {
            "allOf": [
              {
                "description": "a value less than or equal to 1",
                "maximum": 1,
                "title": "lessThanOrEqualTo(1)"
              }
            ],
            "description": "a value less than or equal to 2",
            "maximum": 2,
            "title": "lessThanOrEqualTo(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(Check.lessThanOrEqualTo(1), Check.lessThanOrEqualTo(2), Check.lessThanOrEqualTo(1)),
            {
              "allOf": [
                {
                  "description": "a value less than or equal to 2",
                  "maximum": 2,
                  "title": "lessThanOrEqualTo(2)"
                },
                {
                  "description": "a value less than or equal to 1",
                  "maximum": 1,
                  "title": "lessThanOrEqualTo(1)"
                }
              ],
              "description": "a value less than or equal to 1",
              "maximum": 1,
              "title": "lessThanOrEqualTo(1)",
              "type": "number"
            }
          )
        })

        it("exclusiveMinimum + exclusiveMinimum", async () => {
          await assertDraft7(Schema.Number.check(Check.greaterThan(1), Check.greaterThan(2)), {
            "allOf": [
              {
                "description": "a value greater than 2",
                "exclusiveMinimum": 2,
                "title": "greaterThan(2)"
              }
            ],
            "description": "a value greater than 1",
            "exclusiveMinimum": 1,
            "title": "greaterThan(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Check.greaterThan(2), Check.greaterThan(1)), {
            "allOf": [
              {
                "description": "a value greater than 1",
                "exclusiveMinimum": 1,
                "title": "greaterThan(1)"
              }
            ],
            "description": "a value greater than 2",
            "exclusiveMinimum": 2,
            "title": "greaterThan(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(
              Check.greaterThan(2),
              Check.greaterThan(1),
              Check.greaterThan(2)
            ),
            {
              "allOf": [
                {
                  "description": "a value greater than 1",
                  "exclusiveMinimum": 1,
                  "title": "greaterThan(1)"
                },
                {
                  "description": "a value greater than 2",
                  "exclusiveMinimum": 2,
                  "title": "greaterThan(2)"
                }
              ],
              "description": "a value greater than 2",
              "exclusiveMinimum": 2,
              "title": "greaterThan(2)",
              "type": "number"
            }
          )
        })

        it("exclusiveMaximum + exclusiveMaximum", async () => {
          await assertDraft7(Schema.Number.check(Check.lessThan(1), Check.lessThan(2)), {
            "allOf": [
              {
                "description": "a value less than 2",
                "exclusiveMaximum": 2,
                "title": "lessThan(2)"
              }
            ],
            "description": "a value less than 1",
            "exclusiveMaximum": 1,
            "title": "lessThan(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Check.lessThan(2), Check.lessThan(1)), {
            "allOf": [
              {
                "description": "a value less than 1",
                "exclusiveMaximum": 1,
                "title": "lessThan(1)"
              }
            ],
            "description": "a value less than 2",
            "exclusiveMaximum": 2,
            "title": "lessThan(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(Check.lessThan(1), Check.lessThan(2), Check.lessThan(1)),
            {
              "allOf": [
                {
                  "description": "a value less than 2",
                  "exclusiveMaximum": 2,
                  "title": "lessThan(2)"
                },
                {
                  "description": "a value less than 1",
                  "exclusiveMaximum": 1,
                  "title": "lessThan(1)"
                }
              ],
              "description": "a value less than 1",
              "exclusiveMaximum": 1,
              "title": "lessThan(1)",
              "type": "number"
            }
          )
        })

        it("multipleOf + multipleOf", async () => {
          await assertDraft7(Schema.Number.check(Check.multipleOf(2), Check.multipleOf(3)), {
            "allOf": [
              {
                "description": "a value that is a multiple of 3",
                "multipleOf": 3,
                "title": "multipleOf(3)"
              }
            ],
            "description": "a value that is a multiple of 2",
            "multipleOf": 2,
            "title": "multipleOf(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(Check.multipleOf(2), Check.multipleOf(3), Check.multipleOf(3)),
            {
              "allOf": [
                {
                  "description": "a value that is a multiple of 3",
                  "multipleOf": 3,
                  "title": "multipleOf(3)"
                },
                {
                  "description": "a value that is a multiple of 3",
                  "multipleOf": 3,
                  "title": "multipleOf(3)"
                }
              ],
              "description": "a value that is a multiple of 2",
              "multipleOf": 2,
              "title": "multipleOf(2)",
              "type": "number"
            }
          )
          await assertDraft7(
            Schema.Number.check(Check.multipleOf(3), Check.multipleOf(2), Check.multipleOf(3)),
            {
              "allOf": [
                {
                  "description": "a value that is a multiple of 2",
                  "multipleOf": 2,
                  "title": "multipleOf(2)"
                },
                {
                  "description": "a value that is a multiple of 3",
                  "multipleOf": 3,
                  "title": "multipleOf(3)"
                }
              ],
              "description": "a value that is a multiple of 3",
              "multipleOf": 3,
              "title": "multipleOf(3)",
              "type": "number"
            }
          )
        })
      })
    })

    describe("annotations", () => {
      it("should support getters", async () => {
        const schema = Schema.String.annotate({
          get description() {
            return "description"
          }
        })
        await assertDraft7(schema, {
          "type": "string",
          "description": "description"
        })
      })

      it("should filter out invalid examples", async () => {
        await assertDraft7(Schema.NonEmptyString.annotate({ examples: ["", "a"] }), {
          "type": "string",
          "title": "minLength(1)",
          "description": "a value with a length of at least 1",
          "minLength": 1,
          "examples": ["a"]
        })
      })

      it("should filter out invalid defaults", async () => {
        await assertDraft7(Schema.NonEmptyString.annotate({ default: "" }), {
          "type": "string",
          "title": "minLength(1)",
          "description": "a value with a length of at least 1",
          "minLength": 1
        })
      })
    })

    describe("identifier annotation", () => {
      it(`String & annotation`, async () => {
        const schema = Schema.String.annotate({ identifier: "A" })
        await assertDraft7(schema, {
          "$ref": "#/$defs/A",
          "$defs": {
            "A": {
              "type": "string"
            }
          }
        })
      })

      it(`String & annotation & check`, async () => {
        const schema = Schema.String.annotate({ identifier: "A" }).check(Check.nonEmpty())
        await assertDraft7(schema, {
          "type": "string",
          "description": "a value with a length of at least 1",
          "title": "minLength(1)",
          "minLength": 1
        })
      })

      it(`String & annotation & check & annotation`, async () => {
        const schema = Schema.String.annotate({ identifier: "A" }).check(Check.nonEmpty({ identifier: "B" }))
        await assertDraft7(schema, {
          "$ref": "#/$defs/B",
          "$defs": {
            "B": {
              "type": "string",
              "title": "minLength(1)",
              "description": "a value with a length of at least 1",
              "minLength": 1
            }
          }
        })
      })

      it(`String & annotation & check & annotation & check`, async () => {
        const schema = Schema.String.annotate({ identifier: "A" }).check(
          Check.nonEmpty({ identifier: "B" }),
          Check.maxLength(2)
        )
        await assertDraft7(schema, {
          "type": "string",
          "allOf": [
            {
              "title": "maxLength(2)",
              "description": "a value with a length of at most 2",
              "maxLength": 2
            }
          ],
          "title": "minLength(1)",
          "description": "a value with a length of at least 1",
          "minLength": 1
        })
      })

      it("using the same annotated schema twice", async () => {
        const Member = Schema.String.annotate({ identifier: "ID/a" })
        const schema = Schema.Union([Member, Member])
        await assertDraft7(schema, {
          "$defs": {
            "ID/a": {
              "type": "string"
            }
          },
          "anyOf": [
            { "$ref": "#/$defs/ID~1a" },
            { "$ref": "#/$defs/ID~1a" }
          ]
        })
      })

      it("using a schema with two different encodings", async () => {
        const To = Schema.String.annotate({ identifier: "ID/a" })
        const schema1 = To.pipe(Schema.encodeTo(Schema.Literal(1), {
          decode: Getter.succeed("a"),
          encode: Getter.succeed(1)
        }))
        const schema2 = To.pipe(Schema.encodeTo(Schema.Literal(2), {
          decode: Getter.succeed("b"),
          encode: Getter.succeed(2)
        }))
        const schema = Schema.Union([schema1, schema2])
        await assertDraft7(schema, {
          "$defs": {
            "ID/a": {
              "type": "number",
              "enum": [1]
            }
          },
          "anyOf": [
            { "$ref": "#/$defs/ID~1a" },
            { "type": "number", "enum": [2] }
          ]
        })
      })

      it("identifier & override json schema annotation", async () => {
        const schema = Schema.Number.annotate({
          identifier: "ID",
          jsonSchema: {
            _tag: "Override",
            override: () => ({ type: "integer" })
          }
        })
        await assertDraft7(schema, {
          "$defs": {
            "ID": {
              "type": "integer"
            }
          },
          "$ref": "#/$defs/ID"
        })
      })
    })

    describe("jsonSchema annotation", () => {
      describe("Override", () => {
        it("Number", async () => {
          const schema = Schema.Number.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ type: "integer" })
            }
          })
          await assertDraft7(schema, {
            "type": "integer"
          })
        })

        it("Number & nonNegative + annotation", async () => {
          const schema = Schema.Number.check(Check.nonNegative()).annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ type: "integer" })
            }
          })
          await assertDraft7(schema, {
            "type": "integer"
          })
        })

        it("Number + annotation & nonNegative", async () => {
          const schema = Schema.Number.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ type: "integer" })
            }
          }).check(Check.nonNegative())
          await assertDraft7(schema, {
            "type": "integer"
          })
        })

        it("required: true", async () => {
          const schema = Schema.Struct({
            a: Schema.UndefinedOr(Schema.Number).annotate({
              jsonSchema: {
                _tag: "Override",
                override: (ctx) => ({ ...ctx.jsonSchema, description: "a" }),
                required: true
              }
            })
          })
          await assertDraft7(schema, {
            "type": "object",
            "properties": {
              "a": {
                "type": "number",
                "description": "a"
              }
            },
            "required": ["a"],
            "additionalProperties": false
          })
        })

        it("should ignore errors", async () => {
          const schema = Schema.Symbol.annotate({
            jsonSchema: {
              _tag: "Override",
              override: () => ({ type: "string" })
            }
          })
          await assertDraft7(schema, {
            "type": "string"
          })
        })
      })

      describe("Constraint", () => {
        it("String & format", async () => {
          const schema = Schema.String.annotate({
            jsonSchema: {
              _tag: "Constraint",
              constraint: () => ({ minLength: 1 })
            }
          })
          await assertDraft7(schema, {
            "type": "string",
            "minLength": 1
          })
        })
      })
    })

    describe("fromJsonString", () => {
      it("top level fromJsonString", async () => {
        const schema = Schema.fromJsonString(Schema.FiniteFromString)
        await assertDraft7(schema, {
          "type": "string",
          "description": "a string that will be decoded as JSON"
        })
      })

      it("nested fromJsonString", async () => {
        const schema = Schema.fromJsonString(Schema.Struct({
          a: Schema.fromJsonString(Schema.FiniteFromString)
        }))
        await assertDraft7(schema, {
          "type": "string",
          "description": "a string that will be decoded as JSON"
        })
      })
    })
  })

  describe("draft-2020-12", () => {
    describe("Checks", () => {
      it("int32", async () => {
        await assertDraft2020_12(Schema.Number.check(Check.int32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "int"
            },
            {
              "description": "a value between -2147483648 and 2147483647",
              "maximum": 2147483647,
              "minimum": -2147483648,
              "title": "between(-2147483648, 2147483647)"
            }
          ],
          "type": "integer",
          "title": "int32",
          "description": "a 32-bit integer"
        })
      })

      it("uint32", async () => {
        await assertDraft2020_12(Schema.Number.check(Check.uint32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "int"
            },
            {
              "description": "a value between 0 and 4294967295",
              "maximum": 4294967295,
              "minimum": 0,
              "title": "between(0, 4294967295)"
            }
          ],
          "type": "integer",
          "title": "uint32",
          "description": "a 32-bit unsigned integer"
        })
      })

      it("base64", async () => {
        await assertDraft2020_12(Schema.String.check(Check.base64()), {
          "type": "string",
          "title": "base64",
          "description": "a base64 encoded string",
          "contentEncoding": "base64",
          "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
        })
      })

      it("base64url", async () => {
        await assertDraft2020_12(Schema.String.check(Check.base64url()), {
          "type": "string",
          "title": "base64url",
          "description": "a base64url encoded string",
          "contentEncoding": "base64",
          "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
        })
      })
    })

    describe("fromJsonString", () => {
      it("top level fromJsonString", async () => {
        const schema = Schema.fromJsonString(Schema.FiniteFromString)
        await assertDraft2020_12(schema, {
          "type": "string",
          "description": "a string that will be decoded as JSON",
          "contentMediaType": "application/json",
          "contentSchema": {
            "type": "string",
            "description": "a string that will be decoded as a finite number"
          }
        })
      })

      it("nested fromJsonString", async () => {
        const schema = Schema.fromJsonString(Schema.Struct({
          a: Schema.fromJsonString(Schema.FiniteFromString)
        }))
        await assertDraft2020_12(schema, {
          "type": "string",
          "description": "a string that will be decoded as JSON",
          "contentMediaType": "application/json",
          "contentSchema": {
            "type": "object",
            "properties": {
              "a": {
                "type": "string",
                "description": "a string that will be decoded as JSON",
                "contentMediaType": "application/json",
                "contentSchema": {
                  "type": "string",
                  "description": "a string that will be decoded as a finite number"
                }
              }
            },
            "required": ["a"],
            "additionalProperties": false
          }
        })
      })
    })
  })

  describe("openApi3.1", () => {
    describe("Checks", () => {
      it("int32", async () => {
        await assertOpenApi3_1(Schema.Number.check(Check.int32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "int"
            },
            {
              "description": "a value between -2147483648 and 2147483647",
              "maximum": 2147483647,
              "minimum": -2147483648,
              "title": "between(-2147483648, 2147483647)"
            }
          ],
          "type": "integer",
          "title": "int32",
          "description": "a 32-bit integer",
          "format": "int32"
        })
      })

      it("uint32", async () => {
        await assertOpenApi3_1(Schema.Number.check(Check.uint32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "int"
            },
            {
              "description": "a value between 0 and 4294967295",
              "maximum": 4294967295,
              "minimum": 0,
              "title": "between(0, 4294967295)"
            }
          ],
          "type": "integer",
          "title": "uint32",
          "description": "a 32-bit unsigned integer",
          "format": "uint32"
        })
      })

      it("base64", async () => {
        await assertOpenApi3_1(Schema.String.check(Check.base64()), {
          "type": "string",
          "title": "base64",
          "description": "a base64 encoded string",
          "contentEncoding": "base64",
          "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
        })
      })

      it("base64url", async () => {
        await assertOpenApi3_1(Schema.String.check(Check.base64url()), {
          "type": "string",
          "title": "base64url",
          "description": "a base64url encoded string",
          "contentEncoding": "base64",
          "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
        })
      })
    })
  })
})
