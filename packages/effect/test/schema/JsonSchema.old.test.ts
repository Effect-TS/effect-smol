import type { Options as AjvOptions } from "ajv"
// eslint-disable-next-line import-x/no-named-as-default
import Ajv from "ajv"
import { Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

const baseAjvOptions: AjvOptions = {
  allErrors: true,
  strict: false, // warns/throws on unknown keywords depending on Ajv version
  validateSchema: true,
  code: { esm: true } // optional
}

const ajvDraft7 = new Ajv.default(baseAjvOptions)

async function assertDraft7<S extends Schema.Top>(
  schema: S,
  expected: object,
  options?: Schema.JsonSchemaOptions
) {
  const { jsonSchema, uri } = Schema.makeJsonSchemaDraft07(schema, options)
  strictEqual(uri, "http://json-schema.org/draft-07/schema")
  deepStrictEqual(jsonSchema, expected)
  const valid = ajvDraft7.validateSchema(jsonSchema)
  if (valid instanceof Promise) {
    await valid
  }
  strictEqual(ajvDraft7.errors, null)
  return jsonSchema
}

describe.skip("ToJsonSchema", () => {
  describe("options", () => {
    describe("topLevelReferenceStrategy", () => {
      describe(`"skip"`, () => {
        it("top level identifier", async () => {
          const schema = Schema.String.annotate({ identifier: "ID" })
          const definitions = {}
          await assertDraft7(schema, {
            "$schema": "http://json-schema.org/draft-07/schema",
            "type": "string"
          }, {
            referenceStrategy: "skip",
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
            referenceStrategy: "skip",
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
              referenceStrategy: "skip"
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
              referenceStrategy: "skip"
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
              referenceStrategy: "skip"
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
          additionalProperties: true
        })
      })
    })
  })

  describe("draft-07", () => {
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
          "title": "isUnique",
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
        const schema = Schema.Record(Schema.String.check(Schema.isMinLength(1)), Schema.Number)
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
          referenceStrategy: "skip"
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
      it("isUUID", async () => {
        await assertDraft7(Schema.String.check(Schema.isUUID()), {
          "description": "a UUID",
          "format": "uuid",
          "pattern":
            "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000)$",
          "title": "isUUID",
          "type": "string"
        })
        await assertDraft7(Schema.String.check(Schema.isUUID(4)), {
          "description": "a UUID v4",
          "format": "uuid",
          "pattern": "^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$",
          "title": "isUUID-v4",
          "type": "string"
        })
      })

      it("isInt32", async () => {
        await assertDraft7(Schema.Number.check(Schema.isInt32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "isInt"
            },
            {
              "description": "a value between -2147483648 and 2147483647",
              "maximum": 2147483647,
              "minimum": -2147483648,
              "title": "isBetween(-2147483648, 2147483647)"
            }
          ],
          "type": "integer",
          "title": "isInt32",
          "description": "a 32-bit integer"
        })
      })

      it("isUint32", async () => {
        await assertDraft7(Schema.Number.check(Schema.isUint32()), {
          "allOf": [
            {
              "description": "an integer",
              "title": "isInt"
            },
            {
              "description": "a value between 0 and 4294967295",
              "maximum": 4294967295,
              "minimum": 0,
              "title": "isBetween(0, 4294967295)"
            }
          ],
          "type": "integer",
          "title": "isUint32",
          "description": "a 32-bit unsigned integer"
        })
      })

      it("isBase64", async () => {
        await assertDraft7(Schema.String.check(Schema.isBase64()), {
          "type": "string",
          "title": "isBase64",
          "description": "a base64 encoded string",
          "pattern": "^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$"
        })
      })

      it("isBase64Url", async () => {
        await assertDraft7(Schema.String.check(Schema.isBase64Url()), {
          "type": "string",
          "title": "isBase64Url",
          "description": "a base64url encoded string",
          "pattern": "^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$"
        })
      })

      it("isLength (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Schema.isLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "a value with a length of 2",
          "title": "isLength(2)",
          "minItems": 2,
          "maxItems": 2
        })
      })

      it("isLength (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Schema.isLength(2)), {
          "type": "array",
          "items": [{
            "type": "string"
          }],
          "description": "a value with a length of 2",
          "title": "isLength(2)",
          "minItems": 2,
          "maxItems": 2,
          "additionalItems": {
            "type": "string"
          }
        })
      })

      it("isMinLength (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Schema.isMinLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "a value with a length of at least 2",
          "title": "isMinLength(2)",
          "minItems": 2
        })
      })

      it("isMinLength (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Schema.isMinLength(2)), {
          "type": "array",
          "items": [{
            "type": "string"
          }],
          "description": "a value with a length of at least 2",
          "title": "isMinLength(2)",
          "minItems": 2,
          "additionalItems": {
            "type": "string"
          }
        })
      })

      it("isMaxLength (Array)", async () => {
        await assertDraft7(Schema.Array(Schema.String).check(Schema.isMaxLength(2)), {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "a value with a length of at most 2",
          "title": "isMaxLength(2)",
          "maxItems": 2
        })
      })

      it("isMaxLength (NonEmptyArray)", async () => {
        await assertDraft7(Schema.NonEmptyArray(Schema.String).check(Schema.isMaxLength(2)), {
          "type": "array",
          "items": [{
            "type": "string"
          }],
          "description": "a value with a length of at most 2",
          "title": "isMaxLength(2)",
          "maxItems": 2,
          "additionalItems": {
            "type": "string"
          }
        })
      })

      it("isMinLength (String)", async () => {
        await assertDraft7(Schema.String.check(Schema.isMinLength(1)), {
          "type": "string",
          "title": "isMinLength(1)",
          "description": "a value with a length of at least 1",
          "minLength": 1
        })
      })

      it("isMaxLength (String)", async () => {
        await assertDraft7(Schema.String.check(Schema.isMaxLength(1)), {
          "type": "string",
          "title": "isMaxLength(1)",
          "description": "a value with a length of at most 1",
          "maxLength": 1
        })
      })

      it("isLength (String)", async () => {
        await assertDraft7(Schema.String.check(Schema.isLength(1)), {
          "type": "string",
          "title": "isLength(1)",
          "description": "a value with a length of 1",
          "maxLength": 1,
          "minLength": 1
        })
      })

      it("isGreaterThan", async () => {
        await assertDraft7(Schema.Number.check(Schema.isGreaterThan(1)), {
          "type": "number",
          "title": "isGreaterThan(1)",
          "description": "a value greater than 1",
          "exclusiveMinimum": 1
        })
      })

      it("isGreaterThanOrEqualTo", async () => {
        await assertDraft7(Schema.Number.check(Schema.isGreaterThanOrEqualTo(1)), {
          "type": "number",
          "title": "isGreaterThanOrEqualTo(1)",
          "description": "a value greater than or equal to 1",
          "minimum": 1
        })
      })

      it("isLessThan", async () => {
        await assertDraft7(Schema.Number.check(Schema.isLessThan(1)), {
          "type": "number",
          "title": "isLessThan(1)",
          "description": "a value less than 1",
          "exclusiveMaximum": 1
        })
      })

      it("isLessThanOrEqualTo", async () => {
        await assertDraft7(Schema.Number.check(Schema.isLessThanOrEqualTo(1)), {
          "type": "number",
          "title": "isLessThanOrEqualTo(1)",
          "description": "a value less than or equal to 1",
          "maximum": 1
        })
      })

      it("isPattern", async () => {
        await assertDraft7(Schema.String.check(Schema.isPattern(/^abb+$/)), {
          "type": "string",
          "title": "isPattern(^abb+$)",
          "description": "a string matching the regex ^abb+$",
          "pattern": "^abb+$"
        })
      })

      it("isInt", async () => {
        await assertDraft7(Schema.Number.check(Schema.isInt()), {
          "type": "integer",
          "title": "isInt",
          "description": "an integer"
        })
      })

      it("isTrimmed", async () => {
        const schema = Schema.Trimmed
        await assertDraft7(schema, {
          "title": "isTrimmed",
          "description": "a string with no leading or trailing whitespace",
          "pattern": "^\\S[\\s\\S]*\\S$|^\\S$|^$",
          "type": "string"
        })
      })

      it("isLowercased", async () => {
        const schema = Schema.String.check(Schema.isLowercased())
        await assertDraft7(schema, {
          "title": "isLowercased",
          "description": "a string with all characters in lowercase",
          "pattern": "^[^A-Z]*$",
          "type": "string"
        })
      })

      it("isUppercased", async () => {
        const schema = Schema.String.check(Schema.isUppercased())
        await assertDraft7(schema, {
          "title": "isUppercased",
          "description": "a string with all characters in uppercase",
          "pattern": "^[^a-z]*$",
          "type": "string"
        })
      })

      it("isCapitalized", async () => {
        const schema = Schema.String.check(Schema.isCapitalized())
        await assertDraft7(schema, {
          "title": "isCapitalized",
          "description": "a string with the first character in uppercase",
          "pattern": "^[^a-z]?.*$",
          "type": "string"
        })
      })

      it("isUncapitalized", async () => {
        const schema = Schema.String.check(Schema.isUncapitalized())
        await assertDraft7(schema, {
          "title": "isUncapitalized",
          "description": "a string with the first character in lowercase",
          "pattern": "^[^A-Z]?.*$",
          "type": "string"
        })
      })

      describe("should handle merge conflicts", () => {
        it("isMinLength + isMinLength", async () => {
          await assertDraft7(Schema.String.check(Schema.isMinLength(1), Schema.isMinLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at least 2",
                "minLength": 2,
                "title": "isMinLength(2)"
              }
            ],
            "description": "a value with a length of at least 1",
            "minLength": 1,
            "title": "isMinLength(1)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Schema.isMinLength(2), Schema.isMinLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at least 1",
                "minLength": 1,
                "title": "isMinLength(1)"
              }
            ],
            "description": "a value with a length of at least 2",
            "minLength": 2,
            "title": "isMinLength(2)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Schema.isMinLength(2), Schema.isMinLength(1), Schema.isMinLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at least 1",
                "minLength": 1,
                "title": "isMinLength(1)"
              },
              {
                "description": "a value with a length of at least 2",
                "minLength": 2,
                "title": "isMinLength(2)"
              }
            ],
            "description": "a value with a length of at least 2",
            "minLength": 2,
            "title": "isMinLength(2)",
            "type": "string"
          })
        })

        it("isMaxLength + isMaxLength", async () => {
          await assertDraft7(Schema.String.check(Schema.isMaxLength(1), Schema.isMaxLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at most 2",
                "maxLength": 2,
                "title": "isMaxLength(2)"
              }
            ],
            "description": "a value with a length of at most 1",
            "maxLength": 1,
            "title": "isMaxLength(1)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Schema.isMaxLength(2), Schema.isMaxLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at most 1",
                "maxLength": 1,
                "title": "isMaxLength(1)"
              }
            ],
            "description": "a value with a length of at most 2",
            "maxLength": 2,
            "title": "isMaxLength(2)",
            "type": "string"
          })
          await assertDraft7(Schema.String.check(Schema.isMaxLength(1), Schema.isMaxLength(2), Schema.isMaxLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at most 2",
                "maxLength": 2,
                "title": "isMaxLength(2)"
              },
              {
                "description": "a value with a length of at most 1",
                "maxLength": 1,
                "title": "isMaxLength(1)"
              }
            ],
            "description": "a value with a length of at most 1",
            "maxLength": 1,
            "title": "isMaxLength(1)",
            "type": "string"
          })
        })

        it("isStartsWith + isEndsWith", async () => {
          await assertDraft7(Schema.String.check(Schema.isStartsWith("a"), Schema.isEndsWith("c")), {
            "allOf": [
              {
                "description": "a string ending with \"c\"",
                "pattern": "c$",
                "title": "isEndsWith(\"c\")"
              }
            ],
            "description": "a string starting with \"a\"",
            "pattern": "^a",
            "title": "isStartsWith(\"a\")",
            "type": "string"
          })
          await assertDraft7(
            Schema.String.check(Schema.isStartsWith("a"), Schema.isEndsWith("c"), Schema.isStartsWith("a")),
            {
              "allOf": [
                {
                  "description": "a string ending with \"c\"",
                  "pattern": "c$",
                  "title": "isEndsWith(\"c\")"
                },
                {
                  "description": "a string starting with \"a\"",
                  "pattern": "^a",
                  "title": "isStartsWith(\"a\")"
                }
              ],
              "description": "a string starting with \"a\"",
              "pattern": "^a",
              "title": "isStartsWith(\"a\")",
              "type": "string"
            }
          )
          await assertDraft7(
            Schema.String.check(Schema.isEndsWith("c"), Schema.isStartsWith("a"), Schema.isEndsWith("c")),
            {
              "allOf": [
                {
                  "description": "a string starting with \"a\"",
                  "pattern": "^a",
                  "title": "isStartsWith(\"a\")"
                },
                {
                  "description": "a string ending with \"c\"",
                  "pattern": "c$",
                  "title": "isEndsWith(\"c\")"
                }
              ],
              "description": "a string ending with \"c\"",
              "pattern": "c$",
              "title": "isEndsWith(\"c\")",
              "type": "string"
            }
          )
        })

        it("isMinLength + isMinLength", async () => {
          await assertDraft7(Schema.Array(Schema.String).check(Schema.isMinLength(1), Schema.isMinLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at least 2",
                "minItems": 2,
                "title": "isMinLength(2)"
              }
            ],
            "description": "a value with a length of at least 1",
            "items": {
              "type": "string"
            },
            "minItems": 1,
            "title": "isMinLength(1)",
            "type": "array"
          })
          await assertDraft7(Schema.Array(Schema.String).check(Schema.isMinLength(2), Schema.isMinLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at least 1",
                "minItems": 1,
                "title": "isMinLength(1)"
              }
            ],
            "description": "a value with a length of at least 2",
            "items": {
              "type": "string"
            },
            "minItems": 2,
            "title": "isMinLength(2)",
            "type": "array"
          })
          await assertDraft7(
            Schema.Array(Schema.String).check(Schema.isMinLength(2), Schema.isMinLength(1), Schema.isMinLength(2)),
            {
              "allOf": [
                {
                  "description": "a value with a length of at least 1",
                  "minItems": 1,
                  "title": "isMinLength(1)"
                },
                {
                  "description": "a value with a length of at least 2",
                  "minItems": 2,
                  "title": "isMinLength(2)"
                }
              ],
              "description": "a value with a length of at least 2",
              "items": {
                "type": "string"
              },
              "minItems": 2,
              "title": "isMinLength(2)",
              "type": "array"
            }
          )
        })

        it("isMaxLength + isMaxLength", async () => {
          await assertDraft7(Schema.Array(Schema.String).check(Schema.isMaxLength(1), Schema.isMaxLength(2)), {
            "allOf": [
              {
                "description": "a value with a length of at most 2",
                "maxItems": 2,
                "title": "isMaxLength(2)"
              }
            ],
            "description": "a value with a length of at most 1",
            "items": {
              "type": "string"
            },
            "maxItems": 1,
            "title": "isMaxLength(1)",
            "type": "array"
          })
          await assertDraft7(Schema.Array(Schema.String).check(Schema.isMaxLength(2), Schema.isMaxLength(1)), {
            "allOf": [
              {
                "description": "a value with a length of at most 1",
                "maxItems": 1,
                "title": "isMaxLength(1)"
              }
            ],
            "description": "a value with a length of at most 2",
            "items": {
              "type": "string"
            },
            "maxItems": 2,
            "title": "isMaxLength(2)",
            "type": "array"
          })
          await assertDraft7(
            Schema.Array(Schema.String).check(Schema.isMaxLength(1), Schema.isMaxLength(2), Schema.isMaxLength(1)),
            {
              "allOf": [
                {
                  "description": "a value with a length of at most 2",
                  "maxItems": 2,
                  "title": "isMaxLength(2)"
                },
                {
                  "description": "a value with a length of at most 1",
                  "maxItems": 1,
                  "title": "isMaxLength(1)"
                }
              ],
              "description": "a value with a length of at most 1",
              "items": {
                "type": "string"
              },
              "maxItems": 1,
              "title": "isMaxLength(1)",
              "type": "array"
            }
          )
        })

        it("isGreaterThanOrEqualTo + isGreaterThanOrEqualTo", async () => {
          await assertDraft7(Schema.Number.check(Schema.isGreaterThanOrEqualTo(1), Schema.isGreaterThanOrEqualTo(2)), {
            "allOf": [
              {
                "description": "a value greater than or equal to 2",
                "minimum": 2,
                "title": "isGreaterThanOrEqualTo(2)"
              }
            ],
            "description": "a value greater than or equal to 1",
            "minimum": 1,
            "title": "isGreaterThanOrEqualTo(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Schema.isGreaterThanOrEqualTo(2), Schema.isGreaterThanOrEqualTo(1)), {
            "allOf": [
              {
                "description": "a value greater than or equal to 1",
                "minimum": 1,
                "title": "isGreaterThanOrEqualTo(1)"
              }
            ],
            "description": "a value greater than or equal to 2",
            "minimum": 2,
            "title": "isGreaterThanOrEqualTo(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(
              Schema.isGreaterThanOrEqualTo(2),
              Schema.isGreaterThanOrEqualTo(1),
              Schema.isGreaterThanOrEqualTo(2)
            ),
            {
              "allOf": [
                {
                  "description": "a value greater than or equal to 1",
                  "minimum": 1,
                  "title": "isGreaterThanOrEqualTo(1)"
                },
                {
                  "description": "a value greater than or equal to 2",
                  "minimum": 2,
                  "title": "isGreaterThanOrEqualTo(2)"
                }
              ],
              "description": "a value greater than or equal to 2",
              "minimum": 2,
              "title": "isGreaterThanOrEqualTo(2)",
              "type": "number"
            }
          )
        })

        it("isLessThanOrEqualTo + isLessThanOrEqualTo", async () => {
          await assertDraft7(Schema.Number.check(Schema.isLessThanOrEqualTo(1), Schema.isLessThanOrEqualTo(2)), {
            "allOf": [
              {
                "description": "a value less than or equal to 2",
                "maximum": 2,
                "title": "isLessThanOrEqualTo(2)"
              }
            ],
            "description": "a value less than or equal to 1",
            "maximum": 1,
            "title": "isLessThanOrEqualTo(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Schema.isLessThanOrEqualTo(2), Schema.isLessThanOrEqualTo(1)), {
            "allOf": [
              {
                "description": "a value less than or equal to 1",
                "maximum": 1,
                "title": "isLessThanOrEqualTo(1)"
              }
            ],
            "description": "a value less than or equal to 2",
            "maximum": 2,
            "title": "isLessThanOrEqualTo(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(
              Schema.isLessThanOrEqualTo(1),
              Schema.isLessThanOrEqualTo(2),
              Schema.isLessThanOrEqualTo(1)
            ),
            {
              "allOf": [
                {
                  "description": "a value less than or equal to 2",
                  "maximum": 2,
                  "title": "isLessThanOrEqualTo(2)"
                },
                {
                  "description": "a value less than or equal to 1",
                  "maximum": 1,
                  "title": "isLessThanOrEqualTo(1)"
                }
              ],
              "description": "a value less than or equal to 1",
              "maximum": 1,
              "title": "isLessThanOrEqualTo(1)",
              "type": "number"
            }
          )
        })

        it("isGreaterThan + isGreaterThan", async () => {
          await assertDraft7(Schema.Number.check(Schema.isGreaterThan(1), Schema.isGreaterThan(2)), {
            "allOf": [
              {
                "description": "a value greater than 2",
                "exclusiveMinimum": 2,
                "title": "isGreaterThan(2)"
              }
            ],
            "description": "a value greater than 1",
            "exclusiveMinimum": 1,
            "title": "isGreaterThan(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Schema.isGreaterThan(2), Schema.isGreaterThan(1)), {
            "allOf": [
              {
                "description": "a value greater than 1",
                "exclusiveMinimum": 1,
                "title": "isGreaterThan(1)"
              }
            ],
            "description": "a value greater than 2",
            "exclusiveMinimum": 2,
            "title": "isGreaterThan(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(
              Schema.isGreaterThan(2),
              Schema.isGreaterThan(1),
              Schema.isGreaterThan(2)
            ),
            {
              "allOf": [
                {
                  "description": "a value greater than 1",
                  "exclusiveMinimum": 1,
                  "title": "isGreaterThan(1)"
                },
                {
                  "description": "a value greater than 2",
                  "exclusiveMinimum": 2,
                  "title": "isGreaterThan(2)"
                }
              ],
              "description": "a value greater than 2",
              "exclusiveMinimum": 2,
              "title": "isGreaterThan(2)",
              "type": "number"
            }
          )
        })

        it("isLessThan + isLessThan", async () => {
          await assertDraft7(Schema.Number.check(Schema.isLessThan(1), Schema.isLessThan(2)), {
            "allOf": [
              {
                "description": "a value less than 2",
                "exclusiveMaximum": 2,
                "title": "isLessThan(2)"
              }
            ],
            "description": "a value less than 1",
            "exclusiveMaximum": 1,
            "title": "isLessThan(1)",
            "type": "number"
          })
          await assertDraft7(Schema.Number.check(Schema.isLessThan(2), Schema.isLessThan(1)), {
            "allOf": [
              {
                "description": "a value less than 1",
                "exclusiveMaximum": 1,
                "title": "isLessThan(1)"
              }
            ],
            "description": "a value less than 2",
            "exclusiveMaximum": 2,
            "title": "isLessThan(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(Schema.isLessThan(1), Schema.isLessThan(2), Schema.isLessThan(1)),
            {
              "allOf": [
                {
                  "description": "a value less than 2",
                  "exclusiveMaximum": 2,
                  "title": "isLessThan(2)"
                },
                {
                  "description": "a value less than 1",
                  "exclusiveMaximum": 1,
                  "title": "isLessThan(1)"
                }
              ],
              "description": "a value less than 1",
              "exclusiveMaximum": 1,
              "title": "isLessThan(1)",
              "type": "number"
            }
          )
        })

        it("isMultipleOf + isMultipleOf", async () => {
          await assertDraft7(Schema.Number.check(Schema.isMultipleOf(2), Schema.isMultipleOf(3)), {
            "allOf": [
              {
                "description": "a value that is a multiple of 3",
                "multipleOf": 3,
                "title": "isMultipleOf(3)"
              }
            ],
            "description": "a value that is a multiple of 2",
            "multipleOf": 2,
            "title": "isMultipleOf(2)",
            "type": "number"
          })
          await assertDraft7(
            Schema.Number.check(Schema.isMultipleOf(2), Schema.isMultipleOf(3), Schema.isMultipleOf(3)),
            {
              "allOf": [
                {
                  "description": "a value that is a multiple of 3",
                  "multipleOf": 3,
                  "title": "isMultipleOf(3)"
                },
                {
                  "description": "a value that is a multiple of 3",
                  "multipleOf": 3,
                  "title": "isMultipleOf(3)"
                }
              ],
              "description": "a value that is a multiple of 2",
              "multipleOf": 2,
              "title": "isMultipleOf(2)",
              "type": "number"
            }
          )
          await assertDraft7(
            Schema.Number.check(Schema.isMultipleOf(3), Schema.isMultipleOf(2), Schema.isMultipleOf(3)),
            {
              "allOf": [
                {
                  "description": "a value that is a multiple of 2",
                  "multipleOf": 2,
                  "title": "isMultipleOf(2)"
                },
                {
                  "description": "a value that is a multiple of 3",
                  "multipleOf": 3,
                  "title": "isMultipleOf(3)"
                }
              ],
              "description": "a value that is a multiple of 3",
              "multipleOf": 3,
              "title": "isMultipleOf(3)",
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
          "title": "isMinLength(1)",
          "description": "a value with a length of at least 1",
          "minLength": 1,
          "examples": ["a"]
        })
      })

      it("should filter out invalid defaults", async () => {
        await assertDraft7(Schema.NonEmptyString.annotate({ default: "" }), {
          "type": "string",
          "title": "isMinLength(1)",
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
        const schema = Schema.String.annotate({ identifier: "A" }).check(Schema.isNonEmpty())
        await assertDraft7(schema, {
          "type": "string",
          "description": "a value with a length of at least 1",
          "title": "isMinLength(1)",
          "minLength": 1
        })
      })

      it(`String & annotation & check & annotation`, async () => {
        const schema = Schema.String.annotate({ identifier: "A" }).check(Schema.isNonEmpty({ identifier: "B" }))
        await assertDraft7(schema, {
          "$ref": "#/$defs/B",
          "$defs": {
            "B": {
              "type": "string",
              "title": "isMinLength(1)",
              "description": "a value with a length of at least 1",
              "minLength": 1
            }
          }
        })
      })

      it(`String & annotation & check & annotation & check`, async () => {
        const schema = Schema.String.annotate({ identifier: "A" }).check(
          Schema.isNonEmpty({ identifier: "B" }),
          Schema.isMaxLength(2)
        )
        await assertDraft7(schema, {
          "type": "string",
          "allOf": [
            {
              "title": "isMaxLength(2)",
              "description": "a value with a length of at most 2",
              "maxLength": 2
            }
          ],
          "title": "isMinLength(1)",
          "description": "a value with a length of at least 1",
          "minLength": 1
        })
      })
    })
  })
})
