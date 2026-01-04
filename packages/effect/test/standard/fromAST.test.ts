import { Schema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, throws } from "../utils/assert.ts"

describe("fromAST", () => {
  function assertFromAST(schema: Schema.Top, expected: SchemaStandard.Document) {
    const document = SchemaStandard.fromAST(schema.ast)
    deepStrictEqual(document, expected)
  }

  describe("String", () => {
    it("String", () => {
      assertFromAST(Schema.String, {
        schema: {
          _tag: "String",
          checks: []
        },
        definitions: {}
      })
    })

    it("String & brand", () => {
      assertFromAST(Schema.String.pipe(Schema.brand("a")), {
        schema: {
          _tag: "String",
          checks: [],
          annotations: { brands: ["a"] }
        },
        definitions: {}
      })
    })

    it("String & brand & brand", () => {
      assertFromAST(Schema.String.pipe(Schema.brand("a"), Schema.brand("b")), {
        schema: {
          _tag: "String",
          checks: [],
          annotations: { brands: ["a", "b"] }
        },
        definitions: {}
      })
    })
  })

  describe("identifier handling", () => {
    it("should handle suspended schemas with duplicate identifiers", () => {
      type A = {
        readonly a?: A
      }

      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A))
      }).annotate({ identifier: "A" })

      type A2 = {
        readonly a?: A2
      }

      const A2 = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A2> => A2))
      }).annotate({ identifier: "A" })

      const schema = Schema.Tuple([A, A2])
      assertFromAST(schema, {
        schema: {
          _tag: "Arrays",
          elements: [
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "A" }
            },
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "A-1" }
            }
          ],
          rest: [],
          checks: []
        },
        definitions: {
          A: {
            _tag: "Objects",
            annotations: { identifier: "A" },
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "Suspend",
                  checks: [],
                  thunk: { _tag: "Reference", $ref: "A" }
                },
                isOptional: true,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          },
          "A-1": {
            _tag: "Objects",
            annotations: { identifier: "A" },
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "Suspend",
                  checks: [],
                  thunk: { _tag: "Reference", $ref: "A-1" }
                },
                isOptional: true,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        }
      })
    })

    it("should handle duplicate identifiers", () => {
      assertFromAST(
        Schema.Tuple([
          Schema.String.annotate({ identifier: "ID", description: "a" }),
          Schema.String.annotate({ identifier: "ID", description: "b" })
        ]),
        {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "ID-1" }
              }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            "ID": { _tag: "String", checks: [], annotations: { identifier: "ID", description: "a" } },
            "ID-1": { _tag: "String", checks: [], annotations: { identifier: "ID", description: "b" } }
          }
        }
      )
    })

    it("String & identifier", () => {
      assertFromAST(Schema.String.annotate({ identifier: "ID" }), {
        schema: {
          _tag: "Reference",
          $ref: "ID"
        },
        definitions: {
          "ID": {
            _tag: "String",
            checks: [],
            annotations: { identifier: "ID" }
          }
        }
      })
    })

    it("String & identifier & encoding ", () => {
      assertFromAST(
        Schema.String.annotate({ identifier: "ID" }).pipe(Schema.encodeTo(Schema.Literal("a"))),
        {
          schema: {
            _tag: "Literal",
            literal: "a"
          },
          definitions: {}
        }
      )
    })

    it("Tuple(ID, ID)", () => {
      const ID = Schema.String.annotate({ identifier: "ID" })
      assertFromAST(Schema.Tuple([ID, ID]), {
        schema: {
          _tag: "Arrays",
          elements: [
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "ID" }
            },
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "ID" }
            }
          ],
          rest: [],
          checks: []
        },
        definitions: {
          "ID": { _tag: "String", checks: [], annotations: { identifier: "ID" } }
        }
      })
    })

    it("Tuple(ID, ID & description)", () => {
      const ID = Schema.String.annotate({ identifier: "ID" })
      assertFromAST(Schema.Tuple([ID, ID.annotate({ description: "a" })]), {
        schema: {
          _tag: "Arrays",
          elements: [
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "ID" }
            },
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "ID-1" }
            }
          ],
          rest: [],
          checks: []
        },
        definitions: {
          "ID": { _tag: "String", checks: [], annotations: { identifier: "ID" } },
          "ID-1": { _tag: "String", checks: [], annotations: { identifier: "ID", description: "a" } }
        }
      })
    })
  })

  describe("suspend", () => {
    type A = {
      readonly a?: A
    }

    it("should throw if there is a suspended schema without an identifier", () => {
      const schema = Schema.Struct({
        name: Schema.String,
        children: Schema.Array(Schema.suspend((): Schema.Codec<unknown> => schema))
      })
      throws(() => SchemaStandard.fromAST(schema.ast), "Suspended schema without identifier")

      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A).annotate({ identifier: "A" }))
      })
      throws(() => SchemaStandard.fromAST(A.ast), "Suspended schema without identifier")
    })

    it("outer identifier annotation", () => {
      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A))
      }).annotate({ identifier: "A" })

      assertFromAST(A, {
        schema: {
          _tag: "Reference",
          $ref: "A"
        },
        definitions: {
          A: {
            _tag: "Objects",
            annotations: { identifier: "A" },
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "Suspend",
                  checks: [],
                  thunk: { _tag: "Reference", $ref: "A" }
                },
                isOptional: true,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        }
      })
    })

    it("inner identifier annotation", () => {
      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A.annotate({ identifier: "A" })))
      })

      assertFromAST(A, {
        schema: {
          _tag: "Objects",
          propertySignatures: [
            {
              name: "a",
              type: {
                _tag: "Suspend",
                checks: [],
                thunk: { _tag: "Reference", $ref: "A" }
              },
              isOptional: true,
              isMutable: false
            }
          ],
          indexSignatures: [],
          checks: []
        },
        definitions: {
          A: {
            _tag: "Objects",
            annotations: { identifier: "A" },
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "Suspend",
                  checks: [],
                  thunk: { _tag: "Reference", $ref: "A" }
                },
                isOptional: true,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        }
      })
    })
  })
})
