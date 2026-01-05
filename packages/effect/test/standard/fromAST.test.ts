import { Schema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("fromAST", () => {
  function assertFromAST(schema: Schema.Top, expected: {
    readonly schema: SchemaStandard.Standard
    readonly references?: SchemaStandard.References
  }) {
    const document = SchemaStandard.fromAST(schema.ast)
    deepStrictEqual(document, { schema: expected.schema, references: expected.references ?? {} })
  }

  describe("String", () => {
    it("String", () => {
      assertFromAST(Schema.String, {
        schema: {
          _tag: "String",
          checks: []
        }
      })
    })

    it("String & brand", () => {
      assertFromAST(Schema.String.pipe(Schema.brand("a")), {
        schema: {
          _tag: "String",
          checks: [],
          annotations: { brands: ["a"] }
        }
      })
    })

    it("String & brand & brand", () => {
      assertFromAST(Schema.String.pipe(Schema.brand("a"), Schema.brand("b")), {
        schema: {
          _tag: "String",
          checks: [],
          annotations: { brands: ["a", "b"] }
        }
      })
    })
  })

  describe("identifier handling", () => {
    it("String & identifier", () => {
      assertFromAST(Schema.String.annotate({ identifier: "id" }), {
        schema: { _tag: "Reference", $ref: "id" },
        references: {
          id: {
            _tag: "String",
            checks: [],
            annotations: { identifier: "id" }
          }
        }
      })
    })

    it("String & identifier & encoding", () => {
      assertFromAST(
        Schema.String.annotate({ identifier: "id" }).pipe(Schema.encodeTo(Schema.Literal("a"))),
        {
          schema: { _tag: "Reference", $ref: "id" },
          references: {
            id: {
              _tag: "Literal",
              literal: "a"
            }
          }
        }
      )
    })

    it("String & identifier & encoding & identifier", () => {
      assertFromAST(
        Schema.String.annotate({ identifier: "id" }).pipe(
          Schema.encodeTo(Schema.Literal("a").annotate({ identifier: "id2" }))
        ),
        {
          schema: { _tag: "Reference", $ref: "id2" },
          references: {
            id2: {
              _tag: "Literal",
              literal: "a",
              annotations: { identifier: "id2" }
            }
          }
        }
      )
    })

    it("should handle duplicate identifiers", () => {
      assertFromAST(
        Schema.Tuple([
          Schema.String.annotate({ identifier: "id", description: "a" }),
          Schema.String.annotate({ identifier: "id", description: "b" })
        ]),
        {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "id" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "id2" }
              }
            ],
            rest: [],
            checks: []
          },
          references: {
            id: {
              _tag: "String",
              checks: [],
              annotations: { identifier: "id", description: "a" }
            },
            id2: {
              _tag: "String",
              checks: [],
              annotations: { identifier: "id", description: "b" }
            }
          }
        }
      )
    })

    it("should handle shared references", () => {
      const S = Schema.String.annotate({ identifier: "id" })
      assertFromAST(Schema.Tuple([S, S]), {
        schema: {
          _tag: "Arrays",
          elements: [
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "id" }
            },
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "id" }
            }
          ],
          rest: [],
          checks: []
        },
        references: {
          id: {
            _tag: "String",
            checks: [],
            annotations: { identifier: "id" }
          }
        }
      })
    })
  })

  describe("suspend", () => {
    it("no identifier annotation", () => {
      type A = {
        readonly a?: A
      }
      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A))
      })

      assertFromAST(A, {
        schema: { _tag: "Reference", $ref: "_" },
        references: {
          _: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "Suspend",
                  checks: [],
                  thunk: { _tag: "Reference", $ref: "_" }
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

    it("outer identifier annotation", () => {
      type A = {
        readonly a?: A
      }
      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A))
      }).annotate({ identifier: "A" }) // outer identifier annotation

      assertFromAST(A, {
        schema: { _tag: "Reference", $ref: "A" },
        references: {
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
      type A = {
        readonly a?: A
      }
      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A.annotate({ identifier: "A" })))
      })

      assertFromAST(A, {
        schema: {
          _tag: "Objects",
          propertySignatures: [
            {
              name: "a",
              type: { _tag: "Reference", $ref: "_2" },
              isOptional: true,
              isMutable: false
            }
          ],
          indexSignatures: [],
          checks: []
        },
        references: {
          _2: {
            _tag: "Suspend",
            checks: [],
            thunk: { _tag: "Reference", $ref: "A" }
          },
          A: {
            _tag: "Objects",
            annotations: { identifier: "A" },
            propertySignatures: [
              {
                name: "a",
                type: { _tag: "Reference", $ref: "_2" },
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

    it("suspend identifier annotation", () => {
      type A = {
        readonly a?: A
      }
      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A).annotate({ identifier: "A" }))
      })

      assertFromAST(A, {
        schema: { _tag: "Reference", $ref: "_" },
        references: {
          _: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: { _tag: "Reference", $ref: "A" },
                isOptional: true,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          },
          A: {
            _tag: "Suspend",
            annotations: { identifier: "A" },
            checks: [],
            thunk: { _tag: "Reference", $ref: "_" }
          }
        }
      })
    })

    it("duplicate identifiers", () => {
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
              type: { _tag: "Reference", $ref: "A2" }
            }
          ],
          rest: [],
          checks: []
        },
        references: {
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
          A2: {
            _tag: "Objects",
            annotations: { identifier: "A" },
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "Suspend",
                  checks: [],
                  thunk: { _tag: "Reference", $ref: "A2" }
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

  describe("Declaration", () => {
    it("URL", () => {
      assertFromAST(Schema.URL, {
        schema: {
          _tag: "Declaration",
          annotations: {
            expected: "URL",
            typeConstructor: { _tag: "URL" },
            generation: {
              runtime: "Schema.URL",
              Type: "globalThis.URL"
            }
          },
          checks: [],
          typeParameters: [],
          encodedSchema: {
            _tag: "String",
            annotations: {
              expected: "a string that will be decoded as a URL"
            },
            checks: []
          }
        }
      })
    })
  })

  describe("Class", () => {
    it("Class", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertFromAST(A, {
        schema: { _tag: "Reference", $ref: "A" },
        references: {
          A: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "String",
                  checks: []
                },
                isOptional: false,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        }
      })
    })

    it("toType(Class)", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertFromAST(Schema.toType(A), {
        schema: { _tag: "Reference", $ref: "A" },
        references: {
          A: {
            _tag: "Declaration",
            annotations: {
              identifier: "A"
            },
            checks: [],
            typeParameters: [
              { _tag: "Reference", $ref: "_" }
            ],
            encodedSchema: { _tag: "Reference", $ref: "_" }
          },
          _: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "String",
                  checks: []
                },
                isOptional: false,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        }
      })
    })

    it("using the class schema twice should point to the same definition", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertFromAST(Schema.Tuple([A, A]), {
        schema: {
          _tag: "Arrays",
          elements: [
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "A" }
            },
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "A" }
            }
          ],
          rest: [],
          checks: []
        },
        references: {
          A: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "String",
                  checks: []
                },
                isOptional: false,
                isMutable: false
              }
            ],
            indexSignatures: [],
            checks: []
          }
        }
      })
    })

    it("the type side and the class used together", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertFromAST(Schema.Tuple([Schema.toType(A), A]), {
        schema: {
          _tag: "Arrays",
          elements: [
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "A" }
            },
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "_2" }
            }
          ],
          rest: [],
          checks: []
        },
        references: {
          A: {
            _tag: "Declaration",
            annotations: { identifier: "A" },
            checks: [],
            typeParameters: [
              { _tag: "Reference", $ref: "_2" }
            ],
            encodedSchema: { _tag: "Reference", $ref: "_2" }
          },
          _2: {
            _tag: "Objects",
            propertySignatures: [
              {
                name: "a",
                type: {
                  _tag: "String",
                  checks: []
                },
                isOptional: false,
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
