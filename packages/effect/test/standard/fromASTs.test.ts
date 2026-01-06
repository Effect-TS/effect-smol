import { Array as Arr, Schema, SchemaStandard } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("fromASTs", () => {
  function assertFromASTs(schemas: readonly [Schema.Top, ...Array<Schema.Top>], expected: {
    readonly schemas: readonly [SchemaStandard.Standard, ...Array<SchemaStandard.Standard>]
    readonly references?: SchemaStandard.References
  }) {
    const document = SchemaStandard.fromASTs(Arr.map(schemas, (s) => s.ast))
    deepStrictEqual(document, {
      schemas: expected.schemas,
      references: expected.references ?? {}
    })
  }

  it("should handle multiple schemas", () => {
    const A = Schema.String.annotate({ identifier: "id", description: "a" })
    const B = Schema.String.annotate({ identifier: "id", description: "b" })
    const C = Schema.Tuple([A, B])
    assertFromASTs([A, B, C], {
      schemas: [
        { _tag: "Reference", $ref: "id" },
        { _tag: "Reference", $ref: "id2" },
        {
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
        }
      ],
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
    })
  })
})

describe("fromAST", () => {
  function assertFromAST(schema: Schema.Top, expected: {
    readonly schema: SchemaStandard.Standard
    readonly references?: SchemaStandard.References
  }) {
    const document = SchemaStandard.fromAST(schema.ast)
    deepStrictEqual(document, {
      schema: expected.schema,
      references: expected.references ?? {}
    })
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

  it("RegExp", () => {
    assertFromAST(Schema.RegExp, {
      schema: {
        _tag: "Declaration",
        annotations: {
          expected: "RegExp",
          typeConstructor: { _tag: "RegExp" },
          generation: {
            runtime: "Schema.RegExp",
            Type: "globalThis.RegExp"
          }
        },
        checks: [],
        typeParameters: [],
        encodedSchema: {
          _tag: "Objects",
          propertySignatures: [
            {
              name: "source",
              type: { _tag: "Reference", $ref: "_3" },
              isOptional: false,
              isMutable: false
            },
            {
              name: "flags",
              type: { _tag: "Reference", $ref: "_3" },
              isOptional: false,
              isMutable: false
            }
          ],
          indexSignatures: [],
          checks: []
        }
      },
      references: {
        _3: {
          _tag: "String",
          checks: []
        }
      }
    })
  })

  it("URLSearchParams", () => {
    assertFromAST(Schema.URLSearchParams, {
      schema: {
        _tag: "Declaration",
        annotations: {
          expected: "URLSearchParams",
          typeConstructor: { _tag: "URLSearchParams" },
          generation: {
            runtime: "Schema.URLSearchParams",
            Type: "globalThis.URLSearchParams"
          }
        },
        checks: [],
        typeParameters: [],
        encodedSchema: {
          _tag: "Null"
        }
      }
    })
  })

  it("Option(Number)", () => {
    assertFromAST(Schema.Option(Schema.Number), {
      schema: {
        _tag: "Declaration",
        annotations: {
          expected: "Option",
          typeConstructor: { _tag: "effect/Option" },
          generation: {
            runtime: "Schema.Option(?)",
            Type: "Option.Option<?>",
            importDeclaration: `import * as Option from "effect/Option"`
          }
        },
        checks: [],
        typeParameters: [
          { _tag: "Reference", $ref: "_2" }
        ],
        encodedSchema: {
          _tag: "Union",
          types: [
            {
              _tag: "Objects",
              propertySignatures: [
                {
                  name: "_tag",
                  type: { _tag: "Literal", literal: "Some" },
                  isOptional: false,
                  isMutable: false
                },
                {
                  name: "value",
                  type: { _tag: "Reference", $ref: "_2" },
                  isOptional: false,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            },
            {
              _tag: "Objects",
              propertySignatures: [
                {
                  name: "_tag",
                  type: { _tag: "Literal", literal: "None" },
                  isOptional: false,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            }
          ],
          mode: "anyOf"
        }
      },
      references: {
        _2: {
          _tag: "Number",
          checks: []
        }
      }
    })
  })

  describe("Class", () => {
    it("Class", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertFromAST(A, {
        schema: {
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
      })
    })

    it("toType(Class)", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertFromAST(Schema.toType(A), {
        schema: {
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
        references: {
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
              type: {
                _tag: "Declaration",
                annotations: { identifier: "A" },
                checks: [],
                typeParameters: [
                  { _tag: "Reference", $ref: "_2" }
                ],
                encodedSchema: { _tag: "Reference", $ref: "_2" }
              }
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

  describe("reference handling", () => {
    it("using a schema twice should point to the same reference", () => {
      const S = Schema.String
      assertFromAST(Schema.Tuple([S, S]), {
        schema: {
          _tag: "Arrays",
          elements: [
            {
              isOptional: false,
              type: { _tag: "Reference", $ref: "_2" }
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
          _2: {
            _tag: "String",
            checks: []
          }
        }
      })
    })

    it("using a schema with an identifier twice should point to the identifier as a reference", () => {
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
                type: {
                  _tag: "String",
                  checks: [],
                  annotations: { identifier: "id", description: "a" }
                }
              },
              {
                isOptional: false,
                type: {
                  _tag: "String",
                  checks: [],
                  annotations: { identifier: "id", description: "b" }
                }
              }
            ],
            rest: [],
            checks: []
          }
        }
      )
    })

    describe("suspend", () => {
      it("non-recursive", () => {
        assertFromAST(Schema.suspend(() => Schema.String), {
          schema: {
            _tag: "Suspend",
            checks: [],
            thunk: {
              _tag: "String",
              checks: []
            }
          }
        })
      })

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
              thunk: {
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
                  type: {
                    _tag: "Suspend",
                    annotations: { identifier: "A" },
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
  })
})
