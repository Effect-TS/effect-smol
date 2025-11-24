import type { Annotations } from "effect/schema"
import { FromJsonSchema, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

function assertRoundtrip(schema: Schema.Top) {
  const document = Schema.makeJsonSchemaDraft2020_12(schema)
  const output = FromJsonSchema.make(document.schema)
  const fn = new Function("Schema", `return ${output.code}`)
  const generated = fn(Schema)
  const codedocument = Schema.makeJsonSchemaDraft2020_12(generated)
  deepStrictEqual(codedocument, document)
  deepStrictEqual(FromJsonSchema.make(codedocument.schema), output)
}

function assertOutput(
  input: {
    readonly schema: Record<string, unknown> | boolean
    readonly seen?: Set<string> | undefined
    readonly target?: Annotations.JsonSchema.Target | undefined
  },
  expected: FromJsonSchema.Output
) {
  const code = FromJsonSchema.make(input.schema, {
    seen: input.seen
  })
  deepStrictEqual(code, expected)
}

describe("FromJsonSchema", () => {
  describe("json schemas", () => {
    it("true", () => {
      assertOutput({ schema: true }, { code: "Schema.Unknown", type: "unknown" })
    })

    it("false", () => {
      assertOutput({ schema: false }, { code: "Schema.Never", type: "never" })
    })

    it("type: undefined", () => {
      assertOutput({ schema: {} }, { code: "Schema.Unknown", type: "unknown" })
      assertOutput({ schema: { description: "lorem" } }, {
        code: `Schema.Unknown.annotate({ description: "lorem" })`,
        type: "unknown"
      })
    })

    describe("type as array", () => {
      it("string | number", () => {
        assertOutput({
          schema: {
            "type": ["string", "number"]
          }
        }, { code: "Schema.Union([Schema.String, Schema.Number])", type: "string | number" })
        assertOutput({
          schema: {
            "type": ["string", "number"],
            "description": "description"
          }
        }, {
          code: `Schema.Union([Schema.String, Schema.Number]).annotate({ description: "description" })`,
          type: "string | number"
        })
      })
    })

    describe("type: object", () => {
      it("empty struct", () => {
        assertOutput({
          schema: {
            "anyOf": [
              { "type": "object" },
              { "type": "array" }
            ]
          }
        }, { code: "Schema.Struct({})", type: "{}" })
        assertOutput({
          schema: {
            "oneOf": [
              { "type": "object" },
              { "type": "array" }
            ]
          }
        }, { code: "Schema.Struct({})", type: "{}" })
      })

      it("no properties", () => {
        assertOutput({ schema: { "type": "object" } }, {
          code: "Schema.Record(Schema.String, Schema.Unknown)",
          type: "Record<string, unknown>"
        })
        assertOutput(
          { schema: { "type": "object", "description": "lorem" } },
          {
            code: `Schema.Record(Schema.String, Schema.Unknown).annotate({ description: "lorem" })`,
            type: "Record<string, unknown>"
          }
        )
      })

      it("properties", () => {
        assertOutput(
          {
            schema: {
              "type": "object",
              "properties": {
                "a": { "type": "string" },
                "b": { "type": "number" }
              },
              "required": ["a"]
            }
          },
          {
            code: "Schema.Struct({ a: Schema.String, b: Schema.optionalKey(Schema.Number) })",
            type: "{ readonly a: string, readonly b?: number }"
          }
        )
      })
    })

    describe("type: array", () => {
      describe("target: draft-07", () => {
        it("items: false", () => {
          assertOutput({
            target: "draft-07",
            schema: {
              "type": "array",
              "items": false
            }
          }, { code: "Schema.Tuple([])", type: "readonly []" })
        })

        it("items", () => {
          assertOutput({
            target: "draft-07",
            schema: {
              "type": "array",
              "items": { "type": "string" }
            }
          }, { code: "Schema.Array(Schema.String)", type: "ReadonlyArray<string>" })
        })
      })
    })

    describe("checks", () => {
      it("minLength", () => {
        assertOutput({
          schema: {
            "type": "string",
            "minLength": 1
          }
        }, { code: "Schema.String.check(Schema.isMinLength(1))", type: "string" })
      })

      it("maxLength", () => {
        assertOutput({
          schema: {
            "type": "string",
            "maxLength": 10
          }
        }, { code: "Schema.String.check(Schema.isMaxLength(10))", type: "string" })
      })

      it("pattern", () => {
        assertOutput({
          schema: {
            "type": "string",
            "pattern": "^[a-z]+$"
          }
        }, { code: "Schema.String.check(Schema.isPattern(/^[a-z]+$/))", type: "string" })
      })

      it("pattern with forward slashes (escaping)", () => {
        assertOutput({
          schema: {
            "type": "string",
            "pattern": "^https?://[a-z]+$"
          }
        }, { code: "Schema.String.check(Schema.isPattern(/^https?:\\/\\/[a-z]+$/))", type: "string" })
      })

      it("minimum", () => {
        assertOutput({
          schema: {
            "type": "number",
            "minimum": 0
          }
        }, { code: "Schema.Number.check(Schema.isGreaterThanOrEqualTo(0))", type: "number" })
      })

      it("maximum", () => {
        assertOutput({
          schema: {
            "type": "number",
            "maximum": 100
          }
        }, { code: "Schema.Number.check(Schema.isLessThanOrEqualTo(100))", type: "number" })
      })

      it("exclusiveMinimum", () => {
        assertOutput({
          schema: {
            "type": "number",
            "exclusiveMinimum": 0
          }
        }, { code: "Schema.Number.check(Schema.isGreaterThan(0))", type: "number" })
      })

      it("exclusiveMaximum", () => {
        assertOutput({
          schema: {
            "type": "number",
            "exclusiveMaximum": 100
          }
        }, { code: "Schema.Number.check(Schema.isLessThan(100))", type: "number" })
      })

      it("multipleOf", () => {
        assertOutput({
          schema: {
            "type": "number",
            "multipleOf": 2
          }
        }, { code: "Schema.Number.check(Schema.isMultipleOf(2))", type: "number" })
      })

      it("minItems", () => {
        assertOutput({
          schema: {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 1
          },
          target: "draft-07"
        }, { code: "Schema.Array(Schema.String).check(Schema.isMinLength(1))", type: "ReadonlyArray<string>" })
      })

      it("maxItems", () => {
        assertOutput({
          schema: {
            "type": "array",
            "items": { "type": "string" },
            "maxItems": 10
          },
          target: "draft-07"
        }, { code: "Schema.Array(Schema.String).check(Schema.isMaxLength(10))", type: "ReadonlyArray<string>" })
      })

      it("uniqueItems", () => {
        assertOutput({
          schema: {
            "type": "array",
            "items": { "type": "string" },
            "uniqueItems": true
          },
          target: "draft-07"
        }, {
          code: "Schema.Array(Schema.String).check(Schema.isUnique(Equal.equivalence()))",
          type: "ReadonlyArray<string>"
        })
      })

      it("minProperties", () => {
        assertOutput({
          schema: {
            "type": "object",
            "minProperties": 1
          }
        }, {
          code: "Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMinEntries(1))",
          type: "Record<string, unknown>"
        })
      })

      it("maxProperties", () => {
        assertOutput({
          schema: {
            "type": "object",
            "maxProperties": 10
          }
        }, {
          code: "Schema.Record(Schema.String, Schema.Unknown).check(Schema.isMaxEntries(10))",
          type: "Record<string, unknown>"
        })
      })

      it("multiple checks", () => {
        assertOutput({
          schema: {
            "type": "string",
            "minLength": 1,
            "maxLength": 10,
            "pattern": "^[a-z]+$"
          }
        }, {
          code: "Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10), Schema.isPattern(/^[a-z]+$/))",
          type: "string"
        })
      })
    })

    describe("$ref", () => {
      it("unescaped identifier", () => {
        assertOutput(
          {
            schema: {
              "$ref": "#/definitions/ID"
            }
          },
          {
            code: "ID",
            type: "ID"
          }
        )
      })

      it("escaped identifier", () => {
        assertOutput(
          {
            schema: {
              "$ref": "#/definitions/ID~1a~0b"
            }
          },
          {
            code: "ID$a$b",
            type: "ID$a$b"
          }
        )
      })

      it("inner $ref", () => {
        assertOutput(
          {
            schema: {
              "type": "object",
              "properties": {
                "a": { "$ref": "#/definitions/A" }
              },
              "required": ["a"]
            }
          },
          {
            code: `Schema.Struct({ a: A })`,
            type: "{ readonly a: A }"
          }
        )
      })

      it("recursive $ref", () => {
        assertOutput(
          {
            schema: {
              "type": "object",
              "properties": {
                "a": { "$ref": "#/definitions/A" }
              },
              "required": ["a"]
            },
            seen: new Set(["A"])
          },
          {
            code: `Schema.Struct({ a: Schema.suspend((): Schema.Codec<A> => A) })`,
            type: "{ readonly a: A }"
          }
        )
      })
    })
  })

  describe("generate", () => {
    function generate(doc: Schema.JsonSchema.Document) {
      const seen = new Set(Object.keys(doc.definitions))
      const schema = FromJsonSchema.make(doc.schema)
      const definitions = Object.entries(doc.definitions).map((
        [name, schema]
      ) => [name, FromJsonSchema.make(schema, { seen })] as const)

      const name = "schema"
      let s = ""

      s += "// Definitions\n"
      definitions.forEach(([name, { code, type }]) => {
        s += `type ${name} = ${type};\n`
        s += `const ${name} = ${code};\n`
      })

      s += "// Schema\n"
      s += `const ${name} = ${schema.code};\n`
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
      const code = generate(Schema.makeJsonSchemaDraft2020_12(Operation))
      strictEqual(
        code,
        `// Definitions
type Operation = { readonly type: string, readonly operator: string | string, readonly left: Expression, readonly right: Expression };
const Operation = Schema.Struct({ type: Schema.String, operator: Schema.Union([Schema.String, Schema.String]), left: Schema.suspend((): Schema.Codec<Expression> => Expression), right: Schema.suspend((): Schema.Codec<Expression> => Expression) });
type Expression = { readonly type: string, readonly value: number | Operation };
const Expression = Schema.Struct({ type: Schema.String, value: Schema.Union([Schema.Number, Schema.suspend((): Schema.Codec<Operation> => Operation)]) });
// Schema
const schema = Operation;
`
      )
    })
  })

  describe("roundtrips", () => {
    it("Never", () => {
      assertRoundtrip(Schema.Never)
    })

    it("Unknown", () => {
      assertRoundtrip(Schema.Unknown)
    })

    it("Null", () => {
      assertRoundtrip(Schema.Null)
    })

    describe("String", () => {
      it("basic", () => {
        assertRoundtrip(Schema.String)
      })

      it("with annotations", () => {
        assertRoundtrip(Schema.String.annotate({ title: "title", description: "description" }))
      })

      it("with check", () => {
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1)))
      })

      it("with check and annotations", () => {
        assertRoundtrip(Schema.String.annotate({ description: "description" }).check(Schema.isMinLength(1)))
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1)).annotate({ description: "description" }))
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1, { description: "description" })))
      })

      it("with checks", () => {
        assertRoundtrip(Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10)))
      })

      it("with checks and annotations", () => {
        assertRoundtrip(
          Schema.String.annotate({ description: "description" }).check(Schema.isMinLength(1), Schema.isMaxLength(10))
        )
        assertRoundtrip(
          Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10)).annotate({ description: "description" })
        )
        assertRoundtrip(
          Schema.String.check(Schema.isMinLength(1, { description: "description" }), Schema.isMaxLength(10))
        )
        assertRoundtrip(
          Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(10, { description: "description" }))
        )
        assertRoundtrip(
          Schema.String.annotate({ description: "description1" }).check(
            Schema.isMinLength(1),
            Schema.isMaxLength(10, { description: "description2" })
          )
        )
        assertRoundtrip(
          Schema.String.check(
            Schema.isMinLength(1, { description: "description1" }),
            Schema.isMaxLength(10, { description: "description2" })
          )
        )
      })
    })

    it("Number", () => {
      assertRoundtrip(Schema.Number)
    })

    it("Boolean", () => {
      assertRoundtrip(Schema.Boolean)
    })

    it("Int", () => {
      assertRoundtrip(Schema.Int)
    })

    describe("Struct", () => {
      it("empty", () => {
        assertRoundtrip(Schema.Struct({}))
      })

      it("required field", () => {
        assertRoundtrip(Schema.Struct({
          a: Schema.String
        }))
      })

      it("optionalKey field", () => {
        assertRoundtrip(Schema.Struct({
          a: Schema.optionalKey(Schema.String)
        }))
      })

      it("optional field", () => {
        assertRoundtrip(Schema.Struct({
          a: Schema.optional(Schema.String)
        }))
      })
    })

    describe("Tuple", () => {
      it("empty", () => {
        assertRoundtrip(Schema.Tuple([]))
      })

      it.todo("required element", () => {
        assertRoundtrip(Schema.Tuple([Schema.String]))
      })

      it.todo("optionalKey element", () => {
        assertRoundtrip(Schema.Tuple([Schema.optionalKey(Schema.String)]))
      })
    })

    describe("Union", () => {
      it("empty", () => {
        assertRoundtrip(Schema.Union([]))
      })

      it("String | Number", () => {
        assertRoundtrip(Schema.Union([Schema.String, Schema.Number]))
      })
    })
  })
})
