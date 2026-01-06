import { JsonSchema, Schema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

type Category = {
  readonly name: string
  readonly children: ReadonlyArray<Category>
}

const OuterCategory = Schema.Struct({
  name: Schema.String,
  children: Schema.Array(Schema.suspend((): Schema.Codec<Category> => OuterCategory))
}).annotate({ identifier: "Category" })

const InnerCategory = Schema.Struct({
  name: Schema.String,
  children: Schema.Array(
    Schema.suspend((): Schema.Codec<Category> => InnerCategory.annotate({ identifier: "Category" }))
  )
})

describe("Standard", () => {
  describe("fromJsonSchemaDocument", () => {
    function assertFromJsonSchema(
      schema: JsonSchema.JsonSchema,
      expected: {
        readonly schema: SchemaStandard.Standard
        readonly definitions?: Record<string, SchemaStandard.Standard>
      },
      runtime?: string
    ) {
      const expectedDocument: SchemaStandard.Document = {
        schema: expected.schema,
        references: expected.definitions ?? {}
      }
      const jsonDocument = JsonSchema.fromSchemaDraft2020_12(schema)
      const document = SchemaStandard.fromJsonSchemaDocument(jsonDocument)
      deepStrictEqual(document, expectedDocument)
      const multiDocument: SchemaStandard.MultiDocument = {
        schemas: [document.schema],
        references: document.references
      }
      if (runtime !== undefined) {
        strictEqual(SchemaStandard.toGenerationDocument(multiDocument).generations[0].runtime, runtime)
      }
    }

    it("{}", () => {
      assertFromJsonSchema(
        {},
        {
          schema: { _tag: "Unknown" }
        },
        "Schema.Unknown"
      )
      assertFromJsonSchema(
        { description: "a" },
        {
          schema: { _tag: "Unknown", annotations: { description: "a" } }
        },
        `Schema.Unknown.annotate({ "description": "a" })`
      )
    })

    describe("const", () => {
      it("const: literal (string)", () => {
        assertFromJsonSchema(
          { const: "a" },
          {
            schema: { _tag: "Literal", literal: "a" }
          },
          `Schema.Literal("a")`
        )
        assertFromJsonSchema(
          { const: "a", description: "a" },
          {
            schema: { _tag: "Literal", literal: "a", annotations: { description: "a" } }
          },
          `Schema.Literal("a").annotate({ "description": "a" })`
        )
      })

      it("const: literal (number)", () => {
        assertFromJsonSchema(
          { const: 1 },
          {
            schema: { _tag: "Literal", literal: 1 }
          },
          `Schema.Literal(1)`
        )
      })

      it("const: literal (boolean)", () => {
        assertFromJsonSchema(
          { const: true },
          {
            schema: { _tag: "Literal", literal: true }
          },
          `Schema.Literal(true)`
        )
      })

      it("const: null", () => {
        assertFromJsonSchema(
          { const: null },
          {
            schema: { _tag: "Null" }
          },
          `Schema.Null`
        )
        assertFromJsonSchema(
          { const: null, description: "a" },
          {
            schema: { _tag: "Null", annotations: { description: "a" } }
          },
          `Schema.Null.annotate({ "description": "a" })`
        )
      })

      it("const: non-literal", () => {
        assertFromJsonSchema(
          { const: {} },
          {
            schema: { _tag: "Unknown" }
          },
          `Schema.Unknown`
        )
      })
    })

    describe("enum", () => {
      it("single enum (string)", () => {
        assertFromJsonSchema(
          { enum: ["a"] },
          {
            schema: { _tag: "Literal", literal: "a" }
          },
          `Schema.Literal("a")`
        )
        assertFromJsonSchema(
          { enum: ["a"], description: "a" },
          {
            schema: { _tag: "Literal", literal: "a", annotations: { description: "a" } }
          },
          `Schema.Literal("a").annotate({ "description": "a" })`
        )
      })

      it("single enum (number)", () => {
        assertFromJsonSchema(
          { enum: [1] },
          {
            schema: { _tag: "Literal", literal: 1 }
          },
          `Schema.Literal(1)`
        )
      })

      it("single enum (boolean)", () => {
        assertFromJsonSchema(
          { enum: [true] },
          {
            schema: { _tag: "Literal", literal: true }
          },
          `Schema.Literal(true)`
        )
      })

      it("multiple enum (literals)", () => {
        assertFromJsonSchema(
          { enum: ["a", 1] },
          {
            schema: {
              _tag: "Union",
              types: [
                { _tag: "Literal", literal: "a" },
                { _tag: "Literal", literal: 1 }
              ],
              mode: "anyOf"
            }
          },
          `Schema.Literals(["a", 1])`
        )
        assertFromJsonSchema(
          { enum: ["a", 1], description: "a" },
          {
            schema: {
              _tag: "Union",
              types: [
                { _tag: "Literal", literal: "a" },
                { _tag: "Literal", literal: 1 }
              ],
              mode: "anyOf",
              annotations: { description: "a" }
            }
          },
          `Schema.Literals(["a", 1]).annotate({ "description": "a" })`
        )
      })

      it("enum containing null", () => {
        assertFromJsonSchema(
          { enum: ["a", null] },
          {
            schema: {
              _tag: "Union",
              types: [
                { _tag: "Literal", literal: "a" },
                { _tag: "Null" }
              ],
              mode: "anyOf"
            }
          },
          `Schema.Union([Schema.Literal("a"), Schema.Null])`
        )
      })
    })

    it("anyOf", () => {
      assertFromJsonSchema(
        { anyOf: [{ const: "a" }, { enum: [1, 2] }] },
        {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "a" },
              {
                _tag: "Union",
                types: [
                  { _tag: "Literal", literal: 1 },
                  { _tag: "Literal", literal: 2 }
                ],
                mode: "anyOf"
              }
            ],
            mode: "anyOf"
          }
        },
        `Schema.Union([Schema.Literal("a"), Schema.Literals([1, 2])])`
      )
    })

    it("oneOf", () => {
      assertFromJsonSchema(
        { oneOf: [{ const: "a" }, { enum: [1, 2] }] },
        {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "a" },
              {
                _tag: "Union",
                types: [
                  { _tag: "Literal", literal: 1 },
                  { _tag: "Literal", literal: 2 }
                ],
                mode: "anyOf"
              }
            ],
            mode: "oneOf"
          }
        },
        `Schema.Union([Schema.Literal("a"), Schema.Literals([1, 2])], { mode: "oneOf" })`
      )
    })

    describe("type: null", () => {
      it("type only", () => {
        assertFromJsonSchema(
          { type: "null" },
          {
            schema: { _tag: "Null" }
          },
          `Schema.Null`
        )
      })
    })

    describe("type: string", () => {
      it("type only", () => {
        assertFromJsonSchema(
          { type: "string" },
          {
            schema: { _tag: "String", checks: [] }
          },
          `Schema.String`
        )
      })
    })

    describe("type: number", () => {
      it("type only", () => {
        assertFromJsonSchema(
          { type: "number" },
          {
            schema: { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }] }
          },
          `Schema.Number.check(Schema.isFinite())`
        )
      })
    })

    describe("type: integer", () => {
      it("type only", () => {
        assertFromJsonSchema(
          { type: "integer" },
          {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } }
              ]
            }
          },
          `Schema.Number.check(Schema.isInt())`
        )
      })
    })

    describe("type: boolean", () => {
      it("type only", () => {
        assertFromJsonSchema(
          { type: "boolean" },
          {
            schema: { _tag: "Boolean" }
          },
          `Schema.Boolean`
        )
      })
    })

    describe("type: array", () => {
      it("type only", () => {
        assertFromJsonSchema(
          { type: "array" },
          {
            schema: {
              _tag: "Arrays",
              elements: [],
              rest: [{ _tag: "Unknown" }],
              checks: []
            }
          },
          `Schema.Array(Schema.Unknown)`
        )
      })

      it("items", () => {
        assertFromJsonSchema(
          {
            type: "array",
            items: { type: "string" }
          },
          {
            schema: { _tag: "Arrays", elements: [], rest: [{ _tag: "String", checks: [] }], checks: [] }
          },
          `Schema.Array(Schema.String)`
        )
      })

      it("prefixItems", () => {
        assertFromJsonSchema(
          {
            type: "array",
            prefixItems: [{ type: "string" }],
            maxItems: 1
          },
          {
            schema: {
              _tag: "Arrays",
              elements: [
                { isOptional: true, type: { _tag: "String", checks: [] } }
              ],
              rest: [],
              checks: []
            }
          },
          `Schema.Tuple([Schema.optionalKey(Schema.String)])`
        )

        assertFromJsonSchema(
          {
            type: "array",
            prefixItems: [{ type: "string" }],
            minItems: 1,
            maxItems: 1
          },
          {
            schema: {
              _tag: "Arrays",
              elements: [
                { isOptional: false, type: { _tag: "String", checks: [] } }
              ],
              rest: [],
              checks: []
            }
          },
          `Schema.Tuple([Schema.String])`
        )
      })

      it("prefixItems & minItems", () => {
        assertFromJsonSchema(
          {
            type: "array",
            prefixItems: [{ type: "string" }],
            minItems: 1,
            items: { type: "number" }
          },
          {
            schema: {
              _tag: "Arrays",
              elements: [
                { isOptional: false, type: { _tag: "String", checks: [] } }
              ],
              rest: [
                { _tag: "Number", checks: [{ _tag: "Filter", meta: { _tag: "isFinite" } }] }
              ],
              checks: []
            }
          },
          `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number.check(Schema.isFinite())])`
        )
      })
    })

    describe("type: object", () => {
      it("type only", () => {
        assertFromJsonSchema(
          { type: "object" },
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [],
              indexSignatures: [
                { parameter: { _tag: "String", checks: [] }, type: { _tag: "Unknown" } }
              ],
              checks: []
            }
          },
          `Schema.Record(Schema.String, Schema.Unknown)`
        )
        assertFromJsonSchema(
          {
            type: "object",
            additionalProperties: false
          },
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [],
              indexSignatures: [],
              checks: []
            }
          },
          `Schema.Struct({  })`
        )
      })

      it("additionalProperties", () => {
        assertFromJsonSchema(
          {
            type: "object",
            additionalProperties: { type: "boolean" }
          },
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [],
              indexSignatures: [
                { parameter: { _tag: "String", checks: [] }, type: { _tag: "Boolean" } }
              ],
              checks: []
            }
          },
          `Schema.Record(Schema.String, Schema.Boolean)`
        )
      })

      it("properties", () => {
        assertFromJsonSchema(
          {
            type: "object",
            properties: { a: { type: "string" }, b: { type: "string" } },
            required: ["a"],
            additionalProperties: false
          },
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [
                {
                  name: "a",
                  type: { _tag: "String", checks: [] },
                  isOptional: false,
                  isMutable: false
                },
                {
                  name: "b",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            }
          },
          `Schema.Struct({ "a": Schema.String, "b": Schema.optionalKey(Schema.String) })`
        )
      })

      it("properties & additionalProperties", () => {
        assertFromJsonSchema(
          {
            type: "object",
            properties: { a: { type: "string" } },
            required: ["a"],
            additionalProperties: { type: "boolean" }
          },
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [{
                name: "a",
                type: { _tag: "String", checks: [] },
                isOptional: false,
                isMutable: false
              }],
              indexSignatures: [
                { parameter: { _tag: "String", checks: [] }, type: { _tag: "Boolean" } }
              ],
              checks: []
            }
          },
          `Schema.StructWithRest(Schema.Struct({ "a": Schema.String }), [Schema.Record(Schema.String, Schema.Boolean)])`
        )
      })
    })

    it("type: Array", () => {
      assertFromJsonSchema(
        {
          type: ["string", "null"]
        },
        {
          schema: {
            _tag: "Union",
            types: [{ _tag: "String", checks: [] }, { _tag: "Null" }],
            mode: "anyOf"
          }
        },
        `Schema.Union([Schema.String, Schema.Null])`
      )
      assertFromJsonSchema(
        {
          type: ["string", "null"],
          description: "a"
        },
        {
          schema: {
            _tag: "Union",
            types: [{ _tag: "String", checks: [] }, { _tag: "Null" }],
            mode: "anyOf",
            annotations: { description: "a" }
          }
        },
        `Schema.Union([Schema.String, Schema.Null]).annotate({ "description": "a" })`
      )
    })

    describe("$ref", () => {
      it("should create a Reference and a definition", () => {
        assertFromJsonSchema(
          {
            $ref: "#/$defs/A",
            $defs: {
              A: {
                type: "string"
              }
            }
          },
          {
            schema: { _tag: "Reference", $ref: "A" },
            definitions: {
              A: { _tag: "String", checks: [], annotations: { identifier: "A" } }
            }
          }
        )
      })

      it("should resolve the $ref if there are annotations", () => {
        assertFromJsonSchema(
          {
            $ref: "#/$defs/A",
            description: "a",
            $defs: {
              A: {
                type: "string"
              }
            }
          },
          {
            schema: { _tag: "String", checks: [], annotations: { description: "a", identifier: "A" } },
            definitions: {
              A: { _tag: "String", checks: [], annotations: { identifier: "A" } }
            }
          }
        )
      })

      it("should resolve the $ref if there is an allOf", () => {
        assertFromJsonSchema(
          {
            allOf: [
              { $ref: "#/$defs/A" },
              { description: "a" }
            ],
            $defs: {
              A: {
                type: "string"
              }
            }
          },
          {
            schema: { _tag: "String", checks: [], annotations: { description: "a", identifier: "A" } },
            definitions: {
              A: { _tag: "String", checks: [], annotations: { identifier: "A" } }
            }
          }
        )
      })
    })

    describe("allOf", () => {
      it("add property", () => {
        assertFromJsonSchema(
          {
            type: "object",
            additionalProperties: false,
            allOf: [
              { properties: { a: { type: "string" } } }
            ]
          },
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [
                {
                  name: "a",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            }
          },
          `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`
        )
      })

      it("add additionalProperties", () => {
        assertFromJsonSchema(
          {
            type: "object",
            allOf: [
              { additionalProperties: { type: "boolean" } }
            ]
          },
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [],
              indexSignatures: [
                { parameter: { _tag: "String", checks: [] }, type: { _tag: "Boolean" } }
              ],
              checks: []
            }
          },
          `Schema.Record(Schema.String, Schema.Boolean)`
        )
      })
    })

    it("definitions", () => {
      assertFromJsonSchema(
        {
          $ref: "#/$defs/A",
          $defs: {
            A: { type: "string" }
          }
        },
        {
          schema: { _tag: "Reference", $ref: "A" },
          definitions: {
            A: { _tag: "String", checks: [], annotations: { identifier: "A" } }
          }
        }
      )
    })
  })

  describe("toSchema", () => {
    function assertToSchema(schema: Schema.Top, reviver?: SchemaStandard.Reviver<Schema.Top>) {
      const document = SchemaStandard.fromAST(schema.ast)
      const roundtrip = SchemaStandard.fromAST(
        SchemaStandard.toSchema(document, { reviver }).ast
      )
      deepStrictEqual(roundtrip, document)
    }

    describe("String", () => {
      it("String", () => {
        assertToSchema(Schema.String)
      })

      it("String & check", () => {
        assertToSchema(Schema.String.check(Schema.isMinLength(1)))
      })

      describe("checks", () => {
        it("isTrimmed", () => {
          assertToSchema(Schema.String.check(Schema.isTrimmed()))
        })

        it("isULID", () => {
          assertToSchema(Schema.String.check(Schema.isULID()))
        })
      })
    })

    it("Struct", () => {
      assertToSchema(Schema.Struct({}))
      assertToSchema(Schema.Struct({ a: Schema.String }))
      assertToSchema(Schema.Struct({ [Symbol.for("a")]: Schema.String }))
      assertToSchema(Schema.Struct({ a: Schema.optionalKey(Schema.String) }))
      assertToSchema(Schema.Struct({ a: Schema.mutableKey(Schema.String) }))
      assertToSchema(Schema.Struct({ a: Schema.optionalKey(Schema.mutableKey(Schema.String)) }))
    })

    it("Record", () => {
      assertToSchema(Schema.Record(Schema.String, Schema.Number))
      assertToSchema(Schema.Record(Schema.Symbol, Schema.Number))
    })

    it("StructWithRest", () => {
      assertToSchema(
        Schema.StructWithRest(Schema.Struct({ a: Schema.String }), [Schema.Record(Schema.String, Schema.Number)])
      )
    })

    it("Tuple", () => {
      assertToSchema(Schema.Tuple([]))
      assertToSchema(Schema.Tuple([Schema.String, Schema.Number]))
      assertToSchema(Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)]))
    })

    it("Array", () => {
      assertToSchema(Schema.Array(Schema.String))
    })

    it("TupleWithRest", () => {
      assertToSchema(Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]))
      assertToSchema(Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean]))
    })

    it("Suspend", () => {
      assertToSchema(OuterCategory)
    })

    describe("toSchemaDefaultReviver", () => {
      function assertToSchemaWithReviver(schema: Schema.Top) {
        assertToSchema(schema, SchemaStandard.toSchemaDefaultReviver)
      }

      it("Option", () => {
        assertToSchemaWithReviver(Schema.Option(Schema.String))
        assertToSchemaWithReviver(Schema.Option(Schema.URL))
      })

      it("Result", () => {
        assertToSchemaWithReviver(Schema.Result(Schema.String, Schema.Number))
      })

      it("Redacted", () => {
        assertToSchemaWithReviver(Schema.Redacted(Schema.String))
      })

      it("CauseFailure", () => {
        assertToSchemaWithReviver(Schema.CauseFailure(Schema.String, Schema.Number))
      })

      it("Cause", () => {
        assertToSchemaWithReviver(Schema.Cause(Schema.String, Schema.Number))
      })

      it("Error", () => {
        assertToSchemaWithReviver(Schema.Error)
      })

      it("Exit", () => {
        assertToSchemaWithReviver(Schema.Exit(Schema.String, Schema.Number, Schema.Boolean))
      })

      it("ReadonlyMap", () => {
        assertToSchemaWithReviver(Schema.ReadonlyMap(Schema.String, Schema.Number))
      })

      it("ReadonlySet", () => {
        assertToSchemaWithReviver(Schema.ReadonlySet(Schema.String))
      })

      it("RegExp", () => {
        assertToSchemaWithReviver(Schema.RegExp)
      })

      it("URL", () => {
        assertToSchemaWithReviver(Schema.URL)
      })

      it("Date", () => {
        assertToSchemaWithReviver(Schema.Date)
      })

      it("Duration", () => {
        assertToSchemaWithReviver(Schema.Duration)
      })

      it("FormData", () => {
        assertToSchemaWithReviver(Schema.FormData)
      })

      it("URLSearchParams", () => {
        assertToSchemaWithReviver(Schema.URLSearchParams)
      })

      it("Uint8Array", () => {
        assertToSchemaWithReviver(Schema.Uint8Array)
      })

      it("DateTime.Utc", () => {
        assertToSchemaWithReviver(Schema.DateTimeUtc)
      })
    })
  })

  describe("topologicalSort", () => {
    function assertTopologicalSort(
      definitions: Record<string, SchemaStandard.Standard>,
      expected: SchemaStandard.TopologicalSort
    ) {
      deepStrictEqual(SchemaStandard.topologicalSort(definitions), expected)
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
          A: { _tag: "String", checks: [] }
        },
        {
          nonRecursives: [
            { $ref: "A", schema: { _tag: "String", checks: [] } }
          ],
          recursives: {}
        }
      )
    })

    it("multiple independent definitions", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Number", checks: [] },
        C: { _tag: "Boolean" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Number", checks: [] } },
          { $ref: "C", schema: { _tag: "Boolean" } }
        ],
        recursives: {}
      })
    })

    it("A -> B -> C", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "B" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "C", schema: { _tag: "Reference", $ref: "B" } }
        ],
        recursives: {}
      })
    })

    it("A -> B, A -> C", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "C", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {}
      })
    })

    it("A -> B -> C, A -> D", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "B" },
        D: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "D", schema: { _tag: "Reference", $ref: "A" } },
          { $ref: "C", schema: { _tag: "Reference", $ref: "B" } }
        ],
        recursives: {}
      })
    })

    it("self-referential definition (A -> A)", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { _tag: "Reference", $ref: "A" }
        }
      })
    })

    it("mutual recursion (A -> B -> A)", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "B" },
        B: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { _tag: "Reference", $ref: "B" },
          B: { _tag: "Reference", $ref: "A" }
        }
      })
    })

    it("complex cycle (A -> B -> C -> A)", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "B" },
        B: { _tag: "Reference", $ref: "C" },
        C: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [],
        recursives: {
          A: { _tag: "Reference", $ref: "B" },
          B: { _tag: "Reference", $ref: "C" },
          C: { _tag: "Reference", $ref: "A" }
        }
      })
    })

    it("mixed recursive and non-recursive definitions", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "C" },
        D: { _tag: "Reference", $ref: "E" },
        E: { _tag: "Reference", $ref: "D" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {
          C: { _tag: "Reference", $ref: "C" },
          D: { _tag: "Reference", $ref: "E" },
          E: { _tag: "Reference", $ref: "D" }
        }
      })
    })

    it("nested $ref in object properties", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: {
          _tag: "Objects",
          propertySignatures: [{
            name: "value",
            type: { _tag: "Reference", $ref: "A" },
            isOptional: false,
            isMutable: false
          }],
          indexSignatures: [],
          checks: []
        }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          {
            $ref: "B",
            schema: {
              _tag: "Objects",
              propertySignatures: [{
                name: "value",
                type: { _tag: "Reference", $ref: "A" },
                isOptional: false,
                isMutable: false
              }],
              indexSignatures: [],
              checks: []
            }
          }
        ],
        recursives: {}
      })
    })

    it("nested $ref in array rest", () => {
      assertTopologicalSort({
        A: { _tag: "String", checks: [] },
        B: {
          _tag: "Arrays",
          elements: [],
          rest: [{ _tag: "Reference", $ref: "A" }],
          checks: []
        }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "String", checks: [] } },
          { $ref: "B", schema: { _tag: "Arrays", elements: [], rest: [{ _tag: "Reference", $ref: "A" }], checks: [] } }
        ],
        recursives: {}
      })
    })

    it("external $ref (not in definitions) should be ignored", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "#/definitions/External" },
        B: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "A", schema: { _tag: "Reference", $ref: "#/definitions/External" } },
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {}
      })
    })

    it("multiple cycles with independent definitions", () => {
      assertTopologicalSort({
        Independent: { _tag: "String", checks: [] },
        A: { _tag: "Reference", $ref: "B" },
        B: { _tag: "Reference", $ref: "A" },
        C: { _tag: "Reference", $ref: "D" },
        D: { _tag: "Reference", $ref: "C" }
      }, {
        nonRecursives: [
          { $ref: "Independent", schema: { _tag: "String", checks: [] } }
        ],
        recursives: {
          A: { _tag: "Reference", $ref: "B" },
          B: { _tag: "Reference", $ref: "A" },
          C: { _tag: "Reference", $ref: "D" },
          D: { _tag: "Reference", $ref: "C" }
        }
      })
    })

    it("definition depending on recursive definition", () => {
      assertTopologicalSort({
        A: { _tag: "Reference", $ref: "A" },
        B: { _tag: "Reference", $ref: "A" }
      }, {
        nonRecursives: [
          { $ref: "B", schema: { _tag: "Reference", $ref: "A" } }
        ],
        recursives: {
          A: { _tag: "Reference", $ref: "A" }
        }
      })
    })
  })
})
