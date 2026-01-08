import { Schema, SchemaRepresentation } from "effect"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../../utils/assert.ts"

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

describe("toCodeDocument", () => {
  function assertToCodeDocument(input: {
    readonly schema: Schema.Top
    readonly reviver?: SchemaRepresentation.Reviver<SchemaRepresentation.Code> | undefined
  }, expected: {
    readonly codes: SchemaRepresentation.Code | ReadonlyArray<SchemaRepresentation.Code>
    readonly references?: {
      readonly nonRecursives?: ReadonlyArray<{
        readonly $ref: string
        readonly code: SchemaRepresentation.Code
      }>
      readonly recursives?: {
        readonly [$ref: string]: SchemaRepresentation.Code
      }
    }
    readonly artifacts?: ReadonlyArray<SchemaRepresentation.Artifact>
  }) {
    const multiDocument = SchemaRepresentation.fromASTs([input.schema.ast])
    const generationDocument = SchemaRepresentation.toCodeDocument(multiDocument, { reviver: input.reviver })
    deepStrictEqual(generationDocument, {
      codes: Array.isArray(expected.codes) ? expected.codes : [expected.codes],
      references: {
        nonRecursives: expected.references?.nonRecursives ?? [],
        recursives: expected.references?.recursives ?? {}
      },
      artifacts: expected.artifacts ?? []
    })
  }

  const makeCode = SchemaRepresentation.makeCode

  describe("options", () => {
    it("sanitizeReference", () => {
    })
  })

  describe("Declaration", () => {
    it("declaration without typeConstructor annotation", () => {
      assertToCodeDocument({ schema: Schema.instanceOf(URL) }, {
        codes: makeCode("Schema.Null", "null")
      })
    })

    it("Error", () => {
      assertToCodeDocument({ schema: Schema.Error }, {
        codes: makeCode(`Schema.Error`, "globalThis.Error")
      })
    })

    // TODO: remove unnecessary reference
    it("RegExp", () => {
      assertToCodeDocument({ schema: Schema.RegExp }, {
        codes: makeCode(`Schema.RegExp`, "globalThis.RegExp"),
        references: {
          nonRecursives: [
            {
              $ref: "_2",
              code: makeCode("Schema.String", "string")
            }
          ]
        }
      })
    })

    it("URL", () => {
      assertToCodeDocument({ schema: Schema.URL }, {
        codes: makeCode(`Schema.URL`, "globalThis.URL")
      })
    })

    it("Uint8Array", () => {
      assertToCodeDocument({ schema: Schema.Uint8Array }, {
        codes: makeCode(`Schema.Uint8Array`, "globalThis.Uint8Array")
      })
    })

    it("Blob", () => {
      assertToCodeDocument({ schema: Schema.Blob }, {
        codes: makeCode(`Schema.Blob`, "globalThis.Blob")
      })
    })

    it("URLSearchParams", () => {
      assertToCodeDocument({ schema: Schema.URLSearchParams }, {
        codes: makeCode(`Schema.URLSearchParams`, "globalThis.URLSearchParams")
      })
    })

    it("File", () => {
      assertToCodeDocument({ schema: Schema.File }, {
        codes: makeCode(`Schema.File`, "globalThis.File"),
        references: {
          nonRecursives: [
            {
              $ref: "_3",
              code: makeCode("Schema.String", "string")
            }
          ]
        }
      })
    })

    it("FormData", () => {
      assertToCodeDocument({ schema: Schema.FormData }, {
        codes: makeCode(`Schema.FormData`, "globalThis.FormData"),
        references: {
          nonRecursives: [
            {
              $ref: "_3",
              code: makeCode("Schema.String", "string")
            }
          ]
        }
      })
    })

    it("URLSearchParams", () => {
      assertToCodeDocument({ schema: Schema.URLSearchParams }, {
        codes: makeCode(`Schema.URLSearchParams`, "globalThis.URLSearchParams")
      })
    })

    describe("Date", () => {
      it("Date", () => {
        assertToCodeDocument({ schema: Schema.Date }, {
          codes: makeCode(`Schema.Date`, "globalThis.Date")
        })
      })

      it("Date & check", () => {
        assertToCodeDocument(
          { schema: Schema.Date.check(Schema.isGreaterThanDate(new Date(0))) },
          {
            codes: makeCode(`Schema.Date.check(Schema.isGreaterThanDate(new Date(0)))`, "globalThis.Date")
          }
        )
      })
    })

    it("Option(String)", () => {
      assertToCodeDocument(
        { schema: Schema.Option(Schema.String) },
        {
          codes: makeCode("Schema.Option(_1)", "Option.Option<_1>"),
          references: {
            nonRecursives: [
              {
                $ref: "_1",
                code: makeCode("Schema.String", "string")
              }
            ]
          },
          artifacts: [{
            _tag: "Import",
            importDeclaration: `import * as Option from "effect/Option"`
          }]
        }
      )
    })

    it("Result(String, Number)", () => {
      assertToCodeDocument(
        { schema: Schema.Result(Schema.String, Schema.Number) },
        {
          codes: makeCode("Schema.Result(_1, _2)", "Result.Result<_1, _2>"),
          references: {
            nonRecursives: [
              {
                $ref: "_1",
                code: makeCode("Schema.String", "string")
              },
              {
                $ref: "_2",
                code: makeCode("Schema.Number", "number")
              }
            ]
          },
          artifacts: [{
            _tag: "Import",
            importDeclaration: `import * as Result from "effect/Result"`
          }]
        }
      )
    })

    it("CauseFailure(String, Number)", () => {
      assertToCodeDocument({ schema: Schema.CauseFailure(Schema.String, Schema.Number) }, {
        codes: makeCode("Schema.CauseFailure(_1, _2)", "Cause.Failure<_1, _2>"),
        references: {
          nonRecursives: [
            {
              $ref: "_1",
              code: makeCode("Schema.String", "string")
            },
            {
              $ref: "_2",
              code: makeCode("Schema.Number", "number")
            }
          ]
        },
        artifacts: [{ _tag: "Import", importDeclaration: `import * as Cause from "effect/Cause"` }]
      })
    })

    it("Cause(String, Number)", () => {
      assertToCodeDocument({ schema: Schema.Cause(Schema.String, Schema.Number) }, {
        codes: makeCode("Schema.Cause(_1, _2)", "Cause.Cause<_1, _2>"),
        references: {
          nonRecursives: [
            {
              $ref: "_1",
              code: makeCode("Schema.String", "string")
            },
            {
              $ref: "_2",
              code: makeCode("Schema.Number", "number")
            }
          ]
        },
        artifacts: [{ _tag: "Import", importDeclaration: `import * as Cause from "effect/Cause"` }]
      })
    })

    it("Exit(String, Number, String)", () => {
      assertToCodeDocument({ schema: Schema.Exit(Schema.String, Schema.Number, Schema.Boolean) }, {
        codes: makeCode("Schema.Exit(_1, _2, _3)", "Exit.Exit<_1, _2, _3>"),
        references: {
          nonRecursives: [
            {
              $ref: "_1",
              code: makeCode("Schema.String", "string")
            },
            {
              $ref: "_2",
              code: makeCode("Schema.Number", "number")
            },
            {
              $ref: "_3",
              code: makeCode("Schema.Boolean", "boolean")
            }
          ]
        },
        artifacts: [{ _tag: "Import", importDeclaration: `import * as Exit from "effect/Exit"` }]
      })
    })
  })

  it("Null", () => {
    assertToCodeDocument({ schema: Schema.Null }, {
      codes: makeCode("Schema.Null", "null")
    })
    assertToCodeDocument(
      { schema: Schema.Null.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Null.annotate({ "description": "a" })`, "null")
      }
    )
    assertToCodeDocument({ schema: Schema.Null.annotate({}) }, {
      codes: makeCode("Schema.Null", "null")
    })
  })

  it("Undefined", () => {
    assertToCodeDocument({ schema: Schema.Undefined }, {
      codes: makeCode("Schema.Undefined", "undefined")
    })
    assertToCodeDocument(
      { schema: Schema.Undefined.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Undefined.annotate({ "description": "a" })`, "undefined")
      }
    )
  })

  it("Void", () => {
    assertToCodeDocument({ schema: Schema.Void }, {
      codes: makeCode("Schema.Void", "void")
    })
    assertToCodeDocument(
      { schema: Schema.Void.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Void.annotate({ "description": "a" })`, "void")
      }
    )
  })

  it("Never", () => {
    assertToCodeDocument({ schema: Schema.Never }, {
      codes: makeCode("Schema.Never", "never")
    })
    assertToCodeDocument(
      { schema: Schema.Never.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Never.annotate({ "description": "a" })`, "never")
      }
    )
  })

  it("Unknown", () => {
    assertToCodeDocument({ schema: Schema.Unknown }, {
      codes: makeCode("Schema.Unknown", "unknown")
    })
    assertToCodeDocument(
      { schema: Schema.Unknown.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Unknown.annotate({ "description": "a" })`, "unknown")
      }
    )
  })

  it("Any", () => {
    assertToCodeDocument({ schema: Schema.Any }, {
      codes: makeCode("Schema.Any", "any")
    })
    assertToCodeDocument(
      { schema: Schema.Any.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Any.annotate({ "description": "a" })`, "any")
      }
    )
  })

  describe("String", () => {
    it("String", () => {
      assertToCodeDocument({ schema: Schema.String }, {
        codes: makeCode("Schema.String", "string")
      })
    })

    it("String & identifier", () => {
      assertToCodeDocument({ schema: Schema.String.annotate({ identifier: "ID" }) }, {
        codes: makeCode(`Schema.String.annotate({ "identifier": "ID" })`, "string")
      })
    })

    it("String & annotations", () => {
      assertToCodeDocument(
        { schema: Schema.String.annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.String.annotate({ "description": "a" })`, "string")
        }
      )
    })

    it("String & check", () => {
      assertToCodeDocument(
        { schema: Schema.String.check(Schema.isMinLength(1)) },
        {
          codes: makeCode(`Schema.String.check(Schema.isMinLength(1))`, "string")
        }
      )
    })

    it("String & annotations & check", () => {
      assertToCodeDocument(
        { schema: Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1)) },
        {
          codes: makeCode(
            `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1))`,
            "string"
          )
        }
      )
    })

    it("String & check + annotations", () => {
      assertToCodeDocument(
        { schema: Schema.String.check(Schema.isMinLength(1, { description: "a" })) },
        {
          codes: makeCode(`Schema.String.check(Schema.isMinLength(1, { "description": "a" }))`, "string")
        }
      )
    })

    it("String & check & annotations", () => {
      assertToCodeDocument(
        { schema: Schema.String.check(Schema.isMinLength(1)).annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.String.check(Schema.isMinLength(1, { "description": "a" }))`, "string")
        }
      )
    })
  })

  describe("Number", () => {
    it("Number", () => {
      assertToCodeDocument({ schema: Schema.Number }, {
        codes: makeCode("Schema.Number", "number")
      })
      assertToCodeDocument(
        { schema: Schema.Number.annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.Number.annotate({ "description": "a" })`, "number")
        }
      )
    })

    it("Number & check", () => {
      assertToCodeDocument(
        { schema: Schema.Number.check(Schema.isGreaterThan(10)) },
        {
          codes: makeCode(`Schema.Number.check(Schema.isGreaterThan(10))`, "number")
        }
      )
    })
  })

  it("Boolean", () => {
    assertToCodeDocument({ schema: Schema.Boolean }, {
      codes: makeCode("Schema.Boolean", "boolean")
    })
    assertToCodeDocument(
      { schema: Schema.Boolean.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Boolean.annotate({ "description": "a" })`, "boolean")
      }
    )
  })

  describe("BigInt", () => {
    it("BigInt", () => {
      assertToCodeDocument({ schema: Schema.BigInt }, {
        codes: makeCode("Schema.BigInt", "bigint")
      })
      assertToCodeDocument(
        { schema: Schema.BigInt.annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.BigInt.annotate({ "description": "a" })`, "bigint")
        }
      )
    })

    it("BigInt & check", () => {
      assertToCodeDocument(
        { schema: Schema.BigInt.check(Schema.isGreaterThanBigInt(10n)) },
        {
          codes: makeCode(`Schema.BigInt.check(Schema.isGreaterThanBigInt(10n))`, "bigint")
        }
      )
    })
  })

  it("Symbol", () => {
    assertToCodeDocument({ schema: Schema.Symbol }, {
      codes: makeCode("Schema.Symbol", "symbol")
    })
    assertToCodeDocument(
      { schema: Schema.Symbol.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.Symbol.annotate({ "description": "a" })`, "symbol")
      }
    )
  })

  it("ObjectKeyword", () => {
    assertToCodeDocument({ schema: Schema.ObjectKeyword }, {
      codes: makeCode("Schema.ObjectKeyword", "object")
    })
    assertToCodeDocument(
      { schema: Schema.ObjectKeyword.annotate({ "description": "a" }) },
      {
        codes: makeCode(`Schema.ObjectKeyword.annotate({ "description": "a" })`, "object")
      }
    )
  })

  describe("Literal", () => {
    it("string literal", () => {
      assertToCodeDocument({ schema: Schema.Literal("a") }, {
        codes: makeCode(`Schema.Literal("a")`, `"a"`)
      })
      assertToCodeDocument(
        { schema: Schema.Literal("a").annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.Literal("a").annotate({ "description": "a" })`, `"a"`)
        }
      )
    })

    it("number literal", () => {
      assertToCodeDocument({ schema: Schema.Literal(1) }, {
        codes: makeCode(`Schema.Literal(1)`, "1")
      })
      assertToCodeDocument(
        { schema: Schema.Literal(1).annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.Literal(1).annotate({ "description": "a" })`, "1")
        }
      )
    })

    it("boolean literal", () => {
      assertToCodeDocument({ schema: Schema.Literal(true) }, {
        codes: makeCode(`Schema.Literal(true)`, "true")
      })
      assertToCodeDocument(
        { schema: Schema.Literal(true).annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.Literal(true).annotate({ "description": "a" })`, "true")
        }
      )
    })

    it("bigint literal", () => {
      assertToCodeDocument({ schema: Schema.Literal(100n) }, {
        codes: makeCode(`Schema.Literal(100n)`, "100n")
      })
      assertToCodeDocument(
        { schema: Schema.Literal(100n).annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.Literal(100n).annotate({ "description": "a" })`, "100n")
        }
      )
    })
  })

  describe("UniqueSymbol", () => {
    it("should create a Symbol artifact", () => {
      assertToCodeDocument(
        { schema: Schema.UniqueSymbol(Symbol("a")) },
        {
          codes: makeCode(`Schema.UniqueSymbol(_symbol)`, "typeof _symbol"),
          artifacts: [{
            _tag: "Symbol",
            identifier: "_symbol",
            generation: makeCode(`Symbol("a")`, `typeof _symbol`)
          }]
        }
      )
      assertToCodeDocument(
        { schema: Schema.UniqueSymbol(Symbol()) },
        {
          codes: makeCode(`Schema.UniqueSymbol(_symbol)`, "typeof _symbol"),
          artifacts: [{
            _tag: "Symbol",
            identifier: "_symbol",
            generation: makeCode(`Symbol()`, `typeof _symbol`)
          }]
        }
      )
    })

    it("should create a global Symbol artifact", () => {
      assertToCodeDocument(
        { schema: Schema.UniqueSymbol(Symbol.for("a")) },
        {
          codes: makeCode(`Schema.UniqueSymbol(_symbol)`, "typeof _symbol"),
          artifacts: [{
            _tag: "Symbol",
            identifier: "_symbol",
            generation: makeCode(`Symbol.for("a")`, `typeof _symbol`)
          }]
        }
      )
      assertToCodeDocument(
        { schema: Schema.UniqueSymbol(Symbol.for("a")).annotate({ "description": "a" }) },
        {
          codes: makeCode(
            `Schema.UniqueSymbol(_symbol).annotate({ "description": "a" })`,
            "typeof _symbol"
          ),
          artifacts: [{
            _tag: "Symbol",
            identifier: "_symbol",
            generation: makeCode(`Symbol.for("a")`, `typeof _symbol`)
          }]
        }
      )
    })
  })

  describe("Enum", () => {
    it("string values", () => {
      assertToCodeDocument(
        {
          schema: Schema.Enum({
            A: "a",
            B: "b"
          })
        },
        {
          codes: makeCode(`Schema.Enum(_Enum)`, `typeof _Enum`),
          artifacts: [{
            _tag: "Enum",
            identifier: "_Enum",
            generation: makeCode(`enum _Enum { "A": "a", "B": "b" }`, `typeof _Enum`)
          }]
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.Enum({
            A: "a",
            B: "b"
          }).annotate({ "description": "a" })
        },
        {
          codes: makeCode(
            `Schema.Enum(_Enum).annotate({ "description": "a" })`,
            `typeof _Enum`
          ),
          artifacts: [{
            _tag: "Enum",
            identifier: "_Enum",
            generation: makeCode(`enum _Enum { "A": "a", "B": "b" }`, `typeof _Enum`)
          }]
        }
      )
    })

    it("number values", () => {
      assertToCodeDocument(
        {
          schema: Schema.Enum({
            One: 1,
            Two: 2
          })
        },
        {
          codes: makeCode(`Schema.Enum(_Enum)`, `typeof _Enum`),
          artifacts: [{
            _tag: "Enum",
            identifier: "_Enum",
            generation: makeCode(`enum _Enum { "One": 1, "Two": 2 }`, `typeof _Enum`)
          }]
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.Enum({
            One: 1,
            Two: 2
          }).annotate({ "description": "a" })
        },
        {
          codes: makeCode(
            `Schema.Enum(_Enum).annotate({ "description": "a" })`,
            `typeof _Enum`
          ),
          artifacts: [{
            _tag: "Enum",
            identifier: "_Enum",
            generation: makeCode(`enum _Enum { "One": 1, "Two": 2 }`, `typeof _Enum`)
          }]
        }
      )
    })

    it("mixed values", () => {
      assertToCodeDocument(
        {
          schema: Schema.Enum({
            A: "a",
            One: 1
          })
        },
        {
          codes: makeCode(`Schema.Enum(_Enum)`, `typeof _Enum`),
          artifacts: [{
            _tag: "Enum",
            identifier: "_Enum",
            generation: makeCode(`enum _Enum { "A": "a", "One": 1 }`, `typeof _Enum`)
          }]
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.Enum({
            A: "a",
            One: 1
          }).annotate({ "description": "a" })
        },
        {
          codes: makeCode(
            `Schema.Enum(_Enum).annotate({ "description": "a" })`,
            `typeof _Enum`
          ),
          artifacts: [{
            _tag: "Enum",
            identifier: "_Enum",
            generation: makeCode(`enum _Enum { "A": "a", "One": 1 }`, `typeof _Enum`)
          }]
        }
      )
    })
  })

  describe("TemplateLiteral", () => {
    it("empty template literal", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([]) },
        {
          codes: makeCode(`Schema.TemplateLiteral([])`, "``")
        }
      )
    })

    it("string literal", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a")]) },
        {
          codes: makeCode(`Schema.TemplateLiteral([Schema.Literal("a")])`, "`a`")
        }
      )
    })

    it("number literal", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal(1)]) },
        {
          codes: makeCode(`Schema.TemplateLiteral([Schema.Literal(1)])`, "`1`")
        }
      )
    })

    it("bigint literal", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal(1n)]) },
        {
          codes: makeCode(`Schema.TemplateLiteral([Schema.Literal(1n)])`, "`1`")
        }
      )
    })

    it("multiple consecutive literals", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b"), Schema.Literal("c")]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b"), Schema.Literal("c")])`,
            "`abc`"
          )
        }
      )
    })

    it("special characters in literals", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a b"), Schema.String]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("a b"), Schema.String])`,
            "`a b${string}`"
          )
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("\n"), Schema.String]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("\\n"), Schema.String])`,
            "`\n${string}`"
          )
        }
      )
    })

    it("only schemas", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.String]) },
        {
          codes: makeCode(`Schema.TemplateLiteral([Schema.String])`, "`${string}`")
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Number]) },
        {
          codes: makeCode(`Schema.TemplateLiteral([Schema.Number])`, "`${number}`")
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.BigInt]) },
        {
          codes: makeCode(`Schema.TemplateLiteral([Schema.BigInt])`, "`${bigint}`")
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.String, Schema.Number]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.String, Schema.Number])`,
            "`${string}${number}`"
          )
        }
      )
    })

    it("schema & literal", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.String, Schema.Literal("a")]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("a")])`,
            "`${string}a`"
          )
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")])`,
            "`${number}a`"
          )
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.BigInt, Schema.Literal("a")]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.BigInt, Schema.Literal("a")])`,
            "`${bigint}a`"
          )
        }
      )
    })

    it("literal & schema", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.String]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.String])`,
            "`a${string}`"
          )
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number])`,
            "`a${number}`"
          )
        }
      )
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.BigInt]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.BigInt])`,
            "`a${bigint}`"
          )
        }
      )
    })

    it("schema & literal & schema", () => {
      assertToCodeDocument(
        { schema: Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]) },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number])`,
            "`${string}-${number}`"
          )
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({
            "description": "ad"
          })
        },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" })`,
            "`${string}-${number}`"
          )
        }
      )
    })

    it("TemplateLiteral as part", () => {
      assertToCodeDocument(
        {
          schema: Schema.TemplateLiteral([
            Schema.Literal("a"),
            Schema.TemplateLiteral([Schema.String, Schema.Literals(["-", "+"]), Schema.Number])
          ])
        },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.TemplateLiteral([Schema.String, Schema.Literals(["-", "+"]), Schema.Number])])`,
            "`a${string}-${number}` | `a${string}+${number}`"
          )
        }
      )
    })

    it("Union as part", () => {
      assertToCodeDocument(
        {
          schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.Union([Schema.String, Schema.Number])])
        },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Union([Schema.String, Schema.Number])])`,
            "`a${string}` | `a${number}`"
          )
        }
      )
    })

    it("Literals as part", () => {
      assertToCodeDocument(
        {
          schema: Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String])
        },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String])`,
            "`a${string}` | `b${string}`"
          )
        }
      )
    })

    it("multiple unions", () => {
      assertToCodeDocument(
        {
          schema: Schema.TemplateLiteral([
            Schema.Union([Schema.Literal("a"), Schema.Literal("b")]),
            Schema.String,
            Schema.Union([Schema.Number, Schema.BigInt])
          ])
        },
        {
          codes: makeCode(
            `Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String, Schema.Union([Schema.BigInt, Schema.Number])])`,
            "`a${string}${bigint}` | `a${string}${number}` | `b${string}${bigint}` | `b${string}${number}`"
          )
        }
      )
    })
  })

  describe("Tuple", () => {
    it("empty tuple", () => {
      assertToCodeDocument({ schema: Schema.Tuple([]) }, {
        codes: makeCode("Schema.Tuple([])", "readonly []")
      })
      assertToCodeDocument(
        { schema: Schema.Tuple([]).annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.Tuple([]).annotate({ "description": "a" })`, "readonly []")
        }
      )
    })

    it("required element", () => {
      assertToCodeDocument(
        { schema: Schema.Tuple([Schema.String]) },
        {
          codes: makeCode(`Schema.Tuple([Schema.String])`, "readonly [string]")
        }
      )
      assertToCodeDocument(
        { schema: Schema.Tuple([Schema.String]).annotate({ "description": "a" }) },
        {
          codes: makeCode(
            `Schema.Tuple([Schema.String]).annotate({ "description": "a" })`,
            "readonly [string]"
          )
        }
      )
    })

    it("optional element", () => {
      assertToCodeDocument(
        { schema: Schema.Tuple([Schema.optionalKey(Schema.String)]) },
        {
          codes: makeCode(`Schema.Tuple([Schema.optionalKey(Schema.String)])`, "readonly [string?]")
        }
      )
      assertToCodeDocument(
        { schema: Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ "description": "a" }) },
        {
          codes: makeCode(
            `Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ "description": "a" })`,
            "readonly [string?]"
          )
        }
      )
    })

    it("annotateKey", () => {
      assertToCodeDocument(
        { schema: Schema.Tuple([Schema.String.annotateKey({ "description": "a" })]) },
        {
          codes: makeCode(
            `Schema.Tuple([Schema.String.annotateKey({ "description": "a" })])`,
            "readonly [string]"
          )
        }
      )
    })
  })

  it("Array", () => {
    assertToCodeDocument(
      { schema: Schema.Array(Schema.String) },
      {
        codes: makeCode("Schema.Array(Schema.String)", "ReadonlyArray<string>")
      }
    )
    assertToCodeDocument(
      { schema: Schema.Array(Schema.String).annotate({ "description": "a" }) },
      {
        codes: makeCode(
          `Schema.Array(Schema.String).annotate({ "description": "a" })`,
          "ReadonlyArray<string>"
        )
      }
    )
  })

  it("TupleWithRest", () => {
    assertToCodeDocument(
      { schema: Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]) },
      {
        codes: makeCode(
          `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])`,
          "readonly [string, ...Array<number>]"
        )
      }
    )
    assertToCodeDocument(
      {
        schema: Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({
          "description": "a"
        })
      },
      {
        codes: makeCode(
          `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "a" })`,
          "readonly [string, ...Array<number>]"
        )
      }
    )
    assertToCodeDocument(
      { schema: Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean]) },
      {
        codes: makeCode(
          `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean])`,
          "readonly [string, ...Array<number>, boolean]"
        )
      }
    )
  })

  describe("Struct", () => {
    it("empty struct", () => {
      assertToCodeDocument({ schema: Schema.Struct({}) }, {
        codes: makeCode("Schema.Struct({  })", "{  }")
      })
      assertToCodeDocument(
        { schema: Schema.Struct({}).annotate({ "description": "a" }) },
        {
          codes: makeCode(`Schema.Struct({  }).annotate({ "description": "a" })`, "{  }")
        }
      )
    })

    it("required properties", () => {
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            a: Schema.String
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ "a": Schema.String })`,
            `{ readonly "a": string }`
          )
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            a: Schema.String,
            b: Schema.Number
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ "a": Schema.String, "b": Schema.Number })`,
            `{ readonly "a": string, readonly "b": number }`
          )
        }
      )
    })

    it("optional properties", () => {
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            a: Schema.optionalKey(Schema.String)
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`,
            `{ readonly "a"?: string }`
          )
        }
      )
    })

    it("mutable properties", () => {
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            a: Schema.mutableKey(Schema.String)
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ "a": Schema.mutableKey(Schema.String) })`,
            `{ "a": string }`
          )
        }
      )
    })

    it("optional and mutable properties", () => {
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            a: Schema.optionalKey(Schema.mutableKey(Schema.String))
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ "a": Schema.optionalKey(Schema.mutableKey(Schema.String)) })`,
            `{ "a"?: string }`
          )
        }
      )
    })

    it("annotateKey", () => {
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            a: Schema.String.annotateKey({ "description": "a" })
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ "a": Schema.String.annotateKey({ "description": "a" }) })`,
            `{ readonly "a": string }`
          )
        }
      )
    })

    it("struct with symbol property key", () => {
      const sym = Symbol.for("a")
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            [sym]: Schema.String
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ [_symbol]: Schema.String })`,
            `{ readonly [typeof _symbol]: string }`
          ),
          artifacts: [{
            _tag: "Symbol",
            identifier: "_symbol",
            generation: makeCode(`Symbol.for("a")`, `typeof _symbol`)
          }]
        }
      )
    })
  })

  it("Record(String, Number)", () => {
    assertToCodeDocument(
      {
        schema: Schema.Record(Schema.String, Schema.Number)
      },
      {
        codes: makeCode("Schema.Record(Schema.String, Schema.Number)", "{ readonly [x: string]: number }")
      }
    )
    assertToCodeDocument(
      {
        schema: Schema.Record(Schema.String, Schema.Number).annotate({ "description": "a" })
      },
      {
        codes: makeCode(
          `Schema.Record(Schema.String, Schema.Number).annotate({ "description": "a" })`,
          "{ readonly [x: string]: number }"
        )
      }
    )
  })

  it("StructWithRest", () => {
    assertToCodeDocument(
      {
        schema: Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [
          Schema.Record(Schema.String, Schema.Boolean)
        ])
      },
      {
        codes: makeCode(
          `Schema.StructWithRest(Schema.Struct({ "a": Schema.Number }), [Schema.Record(Schema.String, Schema.Boolean)])`,
          `{ readonly "a": number, readonly [x: string]: boolean }`
        )
      }
    )
    assertToCodeDocument(
      {
        schema: Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [
          Schema.Record(Schema.String, Schema.Boolean)
        ]).annotate({ description: "a" })
      },
      {
        codes: makeCode(
          `Schema.StructWithRest(Schema.Struct({ "a": Schema.Number }), [Schema.Record(Schema.String, Schema.Boolean)]).annotate({ "description": "a" })`,
          `{ readonly "a": number, readonly [x: string]: boolean }`
        )
      }
    )
  })

  describe("Union", () => {
    it("union with anyOf mode (default)", () => {
      assertToCodeDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number])
        },
        {
          codes: makeCode("Schema.Union([Schema.String, Schema.Number])", "string | number")
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" })
        },
        {
          codes: makeCode(
            `Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" })`,
            "string | number"
          )
        }
      )
    })

    it("union with oneOf mode", () => {
      assertToCodeDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })
        },
        {
          codes: makeCode(
            `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })`,
            "string | number"
          )
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" })
        },
        {
          codes: makeCode(
            `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" })`,
            "string | number"
          )
        }
      )
    })

    it("union with multiple types", () => {
      assertToCodeDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number, Schema.Boolean])
        },
        {
          codes: makeCode(
            "Schema.Union([Schema.String, Schema.Number, Schema.Boolean])",
            "string | number | boolean"
          )
        }
      )
      assertToCodeDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "a" })
        },
        {
          codes: makeCode(
            `Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "a" })`,
            "string | number | boolean"
          )
        }
      )
    })
  })

  describe("suspend", () => {
    it("non-recursive", () => {
      assertToCodeDocument(
        {
          schema: Schema.suspend(() => Schema.String)
        },
        {
          codes: makeCode(`Schema.suspend((): Schema.Codec<string> => Schema.String)`, "string")
        }
      )
    })

    it("no identifier annotation", () => {
      type A = {
        readonly a?: A
      }
      const A = Schema.Struct({
        a: Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A))
      })

      assertToCodeDocument({ schema: A }, {
        codes: makeCode(`_`, `_`),
        references: {
          recursives: {
            _: makeCode(
              `Schema.Struct({ "a": Schema.optionalKey(Schema.suspend((): Schema.Codec<_> => _)) })`,
              `{ readonly "a"?: _ }`
            )
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

      assertToCodeDocument({ schema: A }, {
        codes: makeCode(`A`, `A`),
        references: {
          recursives: {
            A: makeCode(
              `Schema.Struct({ "a": Schema.optionalKey(Schema.suspend((): Schema.Codec<A> => A)) }).annotate({ "identifier": "A" })`,
              `{ readonly "a"?: A }`
            )
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

      assertToCodeDocument({ schema: A }, {
        codes: makeCode(
          `Schema.Struct({ "a": Schema.optionalKey(_1) })`,
          `{ readonly "a"?: _1 }`
        ),
        references: {
          recursives: {
            _1: makeCode(
              `Schema.suspend((): Schema.Codec<{ readonly "a"?: _1 }> => Schema.Struct({ "a": Schema.optionalKey(_1) }).annotate({ "identifier": "A" }))`,
              `{ readonly "a"?: _1 }`
            )
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

      assertToCodeDocument({ schema: A }, {
        codes: makeCode(`_`, `_`),
        references: {
          recursives: {
            _: makeCode(
              `Schema.Struct({ "a": Schema.optionalKey(Schema.suspend((): Schema.Codec<_> => _).annotate({ "identifier": "A" })) })`,
              `{ readonly "a"?: _ }`
            )
          }
        }
      })
    })
  })

  describe("nested structures", () => {
    it("tuple with struct elements", () => {
      assertToCodeDocument(
        {
          schema: Schema.Tuple([
            Schema.Struct({ a: Schema.String }),
            Schema.Struct({ b: Schema.Number })
          ])
        },
        {
          codes: makeCode(
            `Schema.Tuple([Schema.Struct({ "a": Schema.String }), Schema.Struct({ "b": Schema.Number })])`,
            `readonly [{ readonly "a": string }, { readonly "b": number }]`
          )
        }
      )
    })

    it("nested struct", () => {
      assertToCodeDocument(
        {
          schema: Schema.Struct({
            user: Schema.Struct({
              a: Schema.String,
              b: Schema.Number
            })
          })
        },
        {
          codes: makeCode(
            `Schema.Struct({ "user": Schema.Struct({ "a": Schema.String, "b": Schema.Number }) })`,
            `{ readonly "user": { readonly "a": string, readonly "b": number } }`
          )
        }
      )
    })

    it("union of structs", () => {
      assertToCodeDocument(
        {
          schema: Schema.Union([
            Schema.Struct({ type: Schema.Literal("a"), value: Schema.String }),
            Schema.Struct({ type: Schema.Literal("b"), value: Schema.Number })
          ])
        },
        {
          codes: makeCode(
            `Schema.Union([Schema.Struct({ "type": Schema.Literal("a"), "value": Schema.String }), Schema.Struct({ "type": Schema.Literal("b"), "value": Schema.Number })])`,
            `{ readonly "type": "a", readonly "value": string } | { readonly "type": "b", readonly "value": number }`
          )
        }
      )
    })
  })
})

describe("toValidIdentifier", () => {
  const toValidIdentifier = SchemaRepresentation.toValidIdentifier

  it("should return '_' for empty string", () => {
    strictEqual(toValidIdentifier(""), "_")
  })

  it("should keep a simple valid identifier unchanged", () => {
    strictEqual(toValidIdentifier("abc"), "abc")
  })

  it("should keep '$' and '_' identifiers unchanged", () => {
    strictEqual(toValidIdentifier("_"), "_")
    strictEqual(toValidIdentifier("$"), "$")
    strictEqual(toValidIdentifier("_$a9"), "_$a9")
  })

  it("should not change a valid identifier that contains digits (not first)", () => {
    strictEqual(toValidIdentifier("a0"), "a0")
    strictEqual(toValidIdentifier("a123"), "a123")
    strictEqual(toValidIdentifier("a1b2c3"), "a1b2c3")
  })

  it("should prefix '_' when the first character is not a valid identifier start (digit)", () => {
    strictEqual(toValidIdentifier("1"), "_1")
    strictEqual(toValidIdentifier("1a"), "_1a")
    strictEqual(toValidIdentifier("9lives"), "_9lives")
  })

  it("should prefix '_' when the first character is not a valid identifier start (space)", () => {
    // first pass would replace space with "_", which is already a valid start,
    // so no extra prefix beyond that replacement
    strictEqual(toValidIdentifier(" abc"), "_abc")
  })

  it("should replace invalid characters with '_' (single)", () => {
    strictEqual(toValidIdentifier("a-b"), "a_b")
    strictEqual(toValidIdentifier("a b"), "a_b")
    strictEqual(toValidIdentifier("a.b"), "a_b")
    strictEqual(toValidIdentifier("a/b"), "a_b")
  })

  it("should replace invalid characters with '_' (multiple)", () => {
    strictEqual(toValidIdentifier("a-b c"), "a_b_c")
    strictEqual(toValidIdentifier("a..b"), "a__b")
    strictEqual(toValidIdentifier("a--b"), "a__b")
    strictEqual(toValidIdentifier("a b\tc"), "a_b_c")
  })

  it("should replace non-ascii characters with '_' under ASCII rules", () => {
    strictEqual(toValidIdentifier("café"), "caf_")
    strictEqual(toValidIdentifier("你好"), "__")
    strictEqual(toValidIdentifier("🤖"), "_")
    strictEqual(toValidIdentifier("a🤖b"), "a_b")
  })

  it("should allow '$' and '_' anywhere", () => {
    strictEqual(toValidIdentifier("a$b"), "a$b")
    strictEqual(toValidIdentifier("a_b"), "a_b")
    strictEqual(toValidIdentifier("$a_b9"), "$a_b9")
  })

  it("should handle leading invalid characters by replacing them (not necessarily extra prefix)", () => {
    strictEqual(toValidIdentifier("-a"), "_a")
    strictEqual(toValidIdentifier(".a"), "_a")
    strictEqual(toValidIdentifier(" a"), "_a")
    strictEqual(toValidIdentifier("\ta"), "_a")
  })

  it("should keep already-sanitized results stable (idempotent)", () => {
    const cases = [
      "",
      "abc",
      "_",
      "$",
      "a1b2",
      "a-b",
      "a b",
      "1a",
      "-a",
      "class",
      "café",
      "a🤖b"
    ] as const

    for (const input of cases) {
      const once = toValidIdentifier(input)
      const twice = toValidIdentifier(once)
      strictEqual(twice, once)
    }
  })

  it("should avoid reserved words by prefixing '_'", () => {
    strictEqual(toValidIdentifier("class"), "_class")
    strictEqual(toValidIdentifier("return"), "_return")
    strictEqual(toValidIdentifier("null"), "_null")
    strictEqual(toValidIdentifier("true"), "_true")
    strictEqual(toValidIdentifier("false"), "_false")
  })

  it("should avoid reserved words even if the input is otherwise valid", () => {
    // ensures the 'reserved' check happens after basic validation
    strictEqual(toValidIdentifier("for"), "_for")
    strictEqual(toValidIdentifier("while"), "_while")
    strictEqual(toValidIdentifier("switch"), "_switch")
  })

  it("should not treat non-reserved lookalikes as reserved", () => {
    strictEqual(toValidIdentifier("class_"), "class_")
    strictEqual(toValidIdentifier("_class"), "_class")
    strictEqual(toValidIdentifier("Class"), "Class")
    strictEqual(toValidIdentifier("trueValue"), "trueValue")
  })

  it("should combine rules: replace invalid chars, then avoid reserved words", () => {
    // "class-name" -> "class_name" (now not reserved)
    strictEqual(toValidIdentifier("class-name"), "class_name")

    // "class" is reserved, but "class " becomes "class_" and is not reserved
    strictEqual(toValidIdentifier("class "), "class_")
  })

  it("should preserve length when only replacements are needed", () => {
    strictEqual(toValidIdentifier("a-b").length, "a-b".length)
    strictEqual(toValidIdentifier("a b").length, "a b".length)
    strictEqual(toValidIdentifier("..").length, "..".length)
  })

  it("should increase length only when prefixing is required (digit-start or reserved word)", () => {
    strictEqual(toValidIdentifier("1a"), "_1a")
    strictEqual(toValidIdentifier("1a").length, "1a".length + 1)

    strictEqual(toValidIdentifier("class"), "_class")
    strictEqual(toValidIdentifier("class").length, "class".length + 1)
  })
})
