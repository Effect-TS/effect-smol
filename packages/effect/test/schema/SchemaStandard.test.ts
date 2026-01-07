import { Schema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

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
