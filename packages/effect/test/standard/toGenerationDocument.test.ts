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

describe("toGenerationDocument", () => {
  function assertToGenerationDocument(input: {
    readonly schema: Schema.Top
    readonly reviver?: SchemaStandard.Reviver<SchemaStandard.Generation> | undefined
  }, expected: {
    readonly generations: SchemaStandard.Generation | ReadonlyArray<SchemaStandard.Generation>
    readonly definitions?: {
      readonly nonRecursives?: ReadonlyArray<{
        readonly $ref: string
        readonly schema: SchemaStandard.Generation
      }>
      readonly recursives?: {
        readonly [$ref: string]: SchemaStandard.Generation
      }
    }
    readonly artifacts?: ReadonlyArray<SchemaStandard.Artifact>
  }) {
    const multiDocument = SchemaStandard.fromASTs([input.schema.ast])
    const generationDocument = SchemaStandard.toGenerationDocument(multiDocument, { reviver: input.reviver })
    deepStrictEqual(generationDocument, {
      generations: Array.isArray(expected.generations) ? expected.generations : [expected.generations],
      definitions: {
        nonRecursives: expected.definitions?.nonRecursives ?? [],
        recursives: expected.definitions?.recursives ?? {}
      },
      artifacts: expected.artifacts ?? []
    })
  }

  const makeGeneration = SchemaStandard.makeGeneration

  describe("Declaration", () => {
    it("declaration without typeConstructor annotation", () => {
      assertToGenerationDocument({ schema: Schema.instanceOf(URL) }, {
        generations: makeGeneration("Schema.Null", "null")
      })
    })

    it("Error", () => {
      assertToGenerationDocument({ schema: Schema.Error }, {
        generations: makeGeneration(`Schema.Error`, "globalThis.Error")
      })
    })

    it("RegExp", () => {
      assertToGenerationDocument({ schema: Schema.RegExp }, {
        generations: makeGeneration(`Schema.RegExp`, "globalThis.RegExp")
      })
    })

    it("URL", () => {
      assertToGenerationDocument({ schema: Schema.URL }, {
        generations: makeGeneration(`Schema.URL`, "globalThis.URL")
      })
    })

    it("Uint8Array", () => {
      assertToGenerationDocument({ schema: Schema.Uint8Array }, {
        generations: makeGeneration(`Schema.Uint8Array`, "globalThis.Uint8Array")
      })
    })

    it("FormData", () => {
      assertToGenerationDocument({ schema: Schema.FormData }, {
        generations: makeGeneration(`Schema.FormData`, "globalThis.FormData")
      })
    })

    it("URLSearchParams", () => {
      assertToGenerationDocument({ schema: Schema.URLSearchParams }, {
        generations: makeGeneration(`Schema.URLSearchParams`, "globalThis.URLSearchParams")
      })
    })

    describe("Date", () => {
      it("Date", () => {
        assertToGenerationDocument({ schema: Schema.Date }, {
          generations: makeGeneration(`Schema.Date`, "globalThis.Date")
        })
      })

      it("Date & check", () => {
        assertToGenerationDocument(
          { schema: Schema.Date.check(Schema.isGreaterThanDate(new Date(0))) },
          {
            generations: makeGeneration(`Schema.Date.check(Schema.isGreaterThanDate(new Date(0)))`, "globalThis.Date")
          }
        )
      })
    })

    it("Option(String)", () => {
      assertToGenerationDocument(
        { schema: Schema.Option(Schema.String) },
        {
          generations: makeGeneration("Schema.Option(Schema.String)", "Option.Option<string>"),
          artifacts: [{
            _tag: "Import",
            importDeclaration: `import * as Option from "effect/Option"`
          }]
        }
      )
    })

    it("Result(String, Number)", () => {
      assertToGenerationDocument(
        { schema: Schema.Result(Schema.String, Schema.Number) },
        {
          generations: makeGeneration("Schema.Result(Schema.String, Schema.Number)", "Result.Result<string, number>"),
          artifacts: [{
            _tag: "Import",
            importDeclaration: `import * as Result from "effect/Result"`
          }]
        }
      )
    })

    it("CauseFailure(String, Number)", () => {
      assertToGenerationDocument({ schema: Schema.CauseFailure(Schema.String, Schema.Number) }, {
        generations: makeGeneration(
          "Schema.CauseFailure(Schema.String, Schema.Number)",
          "Cause.Failure<string, number>"
        ),
        artifacts: [{ _tag: "Import", importDeclaration: `import * as Cause from "effect/Cause"` }]
      })
    })

    it("Cause(String, Number)", () => {
      assertToGenerationDocument({ schema: Schema.Cause(Schema.String, Schema.Number) }, {
        generations: makeGeneration(
          "Schema.Cause(Schema.String, Schema.Number)",
          "Cause.Cause<string, number>"
        ),
        artifacts: [{ _tag: "Import", importDeclaration: `import * as Cause from "effect/Cause"` }]
      })
    })

    it("Exit(String, Number, String)", () => {
      assertToGenerationDocument({ schema: Schema.Exit(Schema.String, Schema.Number, Schema.Boolean) }, {
        generations: makeGeneration(
          "Schema.Exit(Schema.String, Schema.Number, Schema.Boolean)",
          "Exit.Exit<string, number, boolean>"
        ),
        artifacts: [{ _tag: "Import", importDeclaration: `import * as Exit from "effect/Exit"` }]
      })
    })
  })

  it("Null", () => {
    assertToGenerationDocument({ schema: Schema.Null }, {
      generations: makeGeneration("Schema.Null", "null")
    })
    assertToGenerationDocument(
      { schema: Schema.Null.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Null.annotate({ "description": "a" })`, "null")
      }
    )
    assertToGenerationDocument({ schema: Schema.Null.annotate({}) }, {
      generations: makeGeneration("Schema.Null", "null")
    })
  })

  it("Undefined", () => {
    assertToGenerationDocument({ schema: Schema.Undefined }, {
      generations: makeGeneration("Schema.Undefined", "undefined")
    })
    assertToGenerationDocument(
      { schema: Schema.Undefined.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Undefined.annotate({ "description": "a" })`, "undefined")
      }
    )
  })

  it("Void", () => {
    assertToGenerationDocument({ schema: Schema.Void }, {
      generations: makeGeneration("Schema.Void", "void")
    })
    assertToGenerationDocument(
      { schema: Schema.Void.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Void.annotate({ "description": "a" })`, "void")
      }
    )
  })

  it("Never", () => {
    assertToGenerationDocument({ schema: Schema.Never }, {
      generations: makeGeneration("Schema.Never", "never")
    })
    assertToGenerationDocument(
      { schema: Schema.Never.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Never.annotate({ "description": "a" })`, "never")
      }
    )
  })

  it("Unknown", () => {
    assertToGenerationDocument({ schema: Schema.Unknown }, {
      generations: makeGeneration("Schema.Unknown", "unknown")
    })
    assertToGenerationDocument(
      { schema: Schema.Unknown.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Unknown.annotate({ "description": "a" })`, "unknown")
      }
    )
  })

  it("Any", () => {
    assertToGenerationDocument({ schema: Schema.Any }, {
      generations: makeGeneration("Schema.Any", "any")
    })
    assertToGenerationDocument(
      { schema: Schema.Any.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Any.annotate({ "description": "a" })`, "any")
      }
    )
  })

  describe("String", () => {
    it("String", () => {
      assertToGenerationDocument({ schema: Schema.String }, {
        generations: makeGeneration("Schema.String", "string")
      })
    })

    it("String & identifier", () => {
      assertToGenerationDocument({ schema: Schema.String.annotate({ identifier: "ID" }) }, {
        generations: makeGeneration("ID", "ID", "IDEncoded"),
        definitions: {
          nonRecursives: [
            {
              $ref: "ID",
              schema: makeGeneration(`Schema.String.annotate({ "identifier": "ID" })`, "string")
            }
          ]
        }
      })
    })

    it("String & annotations", () => {
      assertToGenerationDocument(
        { schema: Schema.String.annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.String.annotate({ "description": "a" })`, "string")
        }
      )
    })

    it("String & check", () => {
      assertToGenerationDocument(
        { schema: Schema.String.check(Schema.isMinLength(1)) },
        {
          generations: makeGeneration(`Schema.String.check(Schema.isMinLength(1))`, "string")
        }
      )
    })

    it("String & annotations & check", () => {
      assertToGenerationDocument(
        { schema: Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1)) },
        {
          generations: makeGeneration(
            `Schema.String.annotate({ "description": "a" }).check(Schema.isMinLength(1))`,
            "string"
          )
        }
      )
    })

    it("String & check + annotations", () => {
      assertToGenerationDocument(
        { schema: Schema.String.check(Schema.isMinLength(1, { description: "a" })) },
        {
          generations: makeGeneration(`Schema.String.check(Schema.isMinLength(1, { "description": "a" }))`, "string")
        }
      )
    })

    it("String & check & annotations", () => {
      assertToGenerationDocument(
        { schema: Schema.String.check(Schema.isMinLength(1)).annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.String.check(Schema.isMinLength(1, { "description": "a" }))`, "string")
        }
      )
    })
  })

  describe("Number", () => {
    it("Number", () => {
      assertToGenerationDocument({ schema: Schema.Number }, {
        generations: makeGeneration("Schema.Number", "number")
      })
      assertToGenerationDocument(
        { schema: Schema.Number.annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.Number.annotate({ "description": "a" })`, "number")
        }
      )
    })

    it("Number & check", () => {
      assertToGenerationDocument(
        { schema: Schema.Number.check(Schema.isGreaterThan(10)) },
        {
          generations: makeGeneration(`Schema.Number.check(Schema.isGreaterThan(10))`, "number")
        }
      )
    })
  })

  it("Boolean", () => {
    assertToGenerationDocument({ schema: Schema.Boolean }, {
      generations: makeGeneration("Schema.Boolean", "boolean")
    })
    assertToGenerationDocument(
      { schema: Schema.Boolean.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Boolean.annotate({ "description": "a" })`, "boolean")
      }
    )
  })

  describe("BigInt", () => {
    it("BigInt", () => {
      assertToGenerationDocument({ schema: Schema.BigInt }, {
        generations: makeGeneration("Schema.BigInt", "bigint")
      })
      assertToGenerationDocument(
        { schema: Schema.BigInt.annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.BigInt.annotate({ "description": "a" })`, "bigint")
        }
      )
    })

    it("BigInt & check", () => {
      assertToGenerationDocument(
        { schema: Schema.BigInt.check(Schema.isGreaterThanBigInt(10n)) },
        {
          generations: makeGeneration(`Schema.BigInt.check(Schema.isGreaterThanBigInt(10n))`, "bigint")
        }
      )
    })
  })

  it("Symbol", () => {
    assertToGenerationDocument({ schema: Schema.Symbol }, {
      generations: makeGeneration("Schema.Symbol", "symbol")
    })
    assertToGenerationDocument(
      { schema: Schema.Symbol.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.Symbol.annotate({ "description": "a" })`, "symbol")
      }
    )
  })

  it("ObjectKeyword", () => {
    assertToGenerationDocument({ schema: Schema.ObjectKeyword }, {
      generations: makeGeneration("Schema.ObjectKeyword", "object")
    })
    assertToGenerationDocument(
      { schema: Schema.ObjectKeyword.annotate({ "description": "a" }) },
      {
        generations: makeGeneration(`Schema.ObjectKeyword.annotate({ "description": "a" })`, "object")
      }
    )
  })

  describe("Literal", () => {
    it("string literal", () => {
      assertToGenerationDocument({ schema: Schema.Literal("a") }, {
        generations: makeGeneration(`Schema.Literal("a")`, `"a"`)
      })
      assertToGenerationDocument(
        { schema: Schema.Literal("a").annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.Literal("a").annotate({ "description": "a" })`, `"a"`)
        }
      )
    })

    it("number literal", () => {
      assertToGenerationDocument({ schema: Schema.Literal(1) }, {
        generations: makeGeneration(`Schema.Literal(1)`, "1")
      })
      assertToGenerationDocument(
        { schema: Schema.Literal(1).annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.Literal(1).annotate({ "description": "a" })`, "1")
        }
      )
    })

    it("boolean literal", () => {
      assertToGenerationDocument({ schema: Schema.Literal(true) }, {
        generations: makeGeneration(`Schema.Literal(true)`, "true")
      })
      assertToGenerationDocument(
        { schema: Schema.Literal(true).annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.Literal(true).annotate({ "description": "a" })`, "true")
        }
      )
    })

    it("bigint literal", () => {
      assertToGenerationDocument({ schema: Schema.Literal(100n) }, {
        generations: makeGeneration(`Schema.Literal(100n)`, "100n")
      })
      assertToGenerationDocument(
        { schema: Schema.Literal(100n).annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.Literal(100n).annotate({ "description": "a" })`, "100n")
        }
      )
    })
  })

  describe("UniqueSymbol", () => {
    it("should create a Symbol artifact", () => {
      assertToGenerationDocument(
        { schema: Schema.UniqueSymbol(Symbol("a")) },
        {
          generations: makeGeneration(`Schema.UniqueSymbol(sym_0)`, "typeof sym_0"),
          artifacts: [{
            _tag: "Symbol",
            identifier: "sym_0",
            generation: makeGeneration(`Symbol("a")`, `typeof sym_0`)
          }]
        }
      )
      assertToGenerationDocument(
        { schema: Schema.UniqueSymbol(Symbol()) },
        {
          generations: makeGeneration(`Schema.UniqueSymbol(sym_0)`, "typeof sym_0"),
          artifacts: [{
            _tag: "Symbol",
            identifier: "sym_0",
            generation: makeGeneration(`Symbol()`, `typeof sym_0`)
          }]
        }
      )
    })

    it("should create a global Symbol artifact", () => {
      assertToGenerationDocument(
        { schema: Schema.UniqueSymbol(Symbol.for("a")) },
        {
          generations: makeGeneration(`Schema.UniqueSymbol(sym_0)`, "typeof sym_0"),
          artifacts: [{
            _tag: "Symbol",
            identifier: "sym_0",
            generation: makeGeneration(`Symbol.for("a")`, `typeof sym_0`)
          }]
        }
      )
      assertToGenerationDocument(
        { schema: Schema.UniqueSymbol(Symbol.for("a")).annotate({ "description": "a" }) },
        {
          generations: makeGeneration(
            `Schema.UniqueSymbol(sym_0).annotate({ "description": "a" })`,
            "typeof sym_0"
          ),
          artifacts: [{
            _tag: "Symbol",
            identifier: "sym_0",
            generation: makeGeneration(`Symbol.for("a")`, `typeof sym_0`)
          }]
        }
      )
    })
  })

  describe("Enum", () => {
    it("string values", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Enum({
            A: "a",
            B: "b"
          })
        },
        {
          generations: makeGeneration(`Schema.Enum(enum_0)`, `typeof enum_0`),
          artifacts: [{
            _tag: "Enum",
            identifier: "enum_0",
            generation: makeGeneration(`enum enum_0 { "A": "a", "B": "b" }`, `typeof enum_0`)
          }]
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.Enum({
            A: "a",
            B: "b"
          }).annotate({ "description": "a" })
        },
        {
          generations: makeGeneration(
            `Schema.Enum(enum_0).annotate({ "description": "a" })`,
            `typeof enum_0`
          ),
          artifacts: [{
            _tag: "Enum",
            identifier: "enum_0",
            generation: makeGeneration(`enum enum_0 { "A": "a", "B": "b" }`, `typeof enum_0`)
          }]
        }
      )
    })

    it("number values", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Enum({
            One: 1,
            Two: 2
          })
        },
        {
          generations: makeGeneration(`Schema.Enum(enum_0)`, `typeof enum_0`),
          artifacts: [{
            _tag: "Enum",
            identifier: "enum_0",
            generation: makeGeneration(`enum enum_0 { "One": 1, "Two": 2 }`, `typeof enum_0`)
          }]
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.Enum({
            One: 1,
            Two: 2
          }).annotate({ "description": "a" })
        },
        {
          generations: makeGeneration(
            `Schema.Enum(enum_0).annotate({ "description": "a" })`,
            `typeof enum_0`
          ),
          artifacts: [{
            _tag: "Enum",
            identifier: "enum_0",
            generation: makeGeneration(`enum enum_0 { "One": 1, "Two": 2 }`, `typeof enum_0`)
          }]
        }
      )
    })

    it("mixed values", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Enum({
            A: "a",
            One: 1
          })
        },
        {
          generations: makeGeneration(`Schema.Enum(enum_0)`, `typeof enum_0`),
          artifacts: [{
            _tag: "Enum",
            identifier: "enum_0",
            generation: makeGeneration(`enum enum_0 { "A": "a", "One": 1 }`, `typeof enum_0`)
          }]
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.Enum({
            A: "a",
            One: 1
          }).annotate({ "description": "a" })
        },
        {
          generations: makeGeneration(
            `Schema.Enum(enum_0).annotate({ "description": "a" })`,
            `typeof enum_0`
          ),
          artifacts: [{
            _tag: "Enum",
            identifier: "enum_0",
            generation: makeGeneration(`enum enum_0 { "A": "a", "One": 1 }`, `typeof enum_0`)
          }]
        }
      )
    })
  })

  describe("TemplateLiteral", () => {
    it("empty template literal", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([]) },
        {
          generations: makeGeneration(`Schema.TemplateLiteral([])`, "``")
        }
      )
    })

    it("string literal", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a")]) },
        {
          generations: makeGeneration(`Schema.TemplateLiteral([Schema.Literal("a")])`, "`a`")
        }
      )
    })

    it("number literal", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal(1)]) },
        {
          generations: makeGeneration(`Schema.TemplateLiteral([Schema.Literal(1)])`, "`1`")
        }
      )
    })

    it("bigint literal", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal(1n)]) },
        {
          generations: makeGeneration(`Schema.TemplateLiteral([Schema.Literal(1n)])`, "`1`")
        }
      )
    })

    it("multiple consecutive literals", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b"), Schema.Literal("c")]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b"), Schema.Literal("c")])`,
            "`abc`"
          )
        }
      )
    })

    it("special characters in literals", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a b"), Schema.String]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a b"), Schema.String])`,
            "`a b${string}`"
          )
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("\n"), Schema.String]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("\\n"), Schema.String])`,
            "`\n${string}`"
          )
        }
      )
    })

    it("only schemas", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.String]) },
        {
          generations: makeGeneration(`Schema.TemplateLiteral([Schema.String])`, "`${string}`")
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Number]) },
        {
          generations: makeGeneration(`Schema.TemplateLiteral([Schema.Number])`, "`${number}`")
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.BigInt]) },
        {
          generations: makeGeneration(`Schema.TemplateLiteral([Schema.BigInt])`, "`${bigint}`")
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.String, Schema.Number]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Number])`,
            "`${string}${number}`"
          )
        }
      )
    })

    it("schema & literal", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.String, Schema.Literal("a")]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("a")])`,
            "`${string}a`"
          )
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")])`,
            "`${number}a`"
          )
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.BigInt, Schema.Literal("a")]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.BigInt, Schema.Literal("a")])`,
            "`${bigint}a`"
          )
        }
      )
    })

    it("literal & schema", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.String]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.String])`,
            "`a${string}`"
          )
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number])`,
            "`a${number}`"
          )
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.BigInt]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.BigInt])`,
            "`a${bigint}`"
          )
        }
      )
    })

    it("schema & literal & schema", () => {
      assertToGenerationDocument(
        { schema: Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]) },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number])`,
            "`${string}-${number}`"
          )
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({
            "description": "ad"
          })
        },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ "description": "ad" })`,
            "`${string}-${number}`"
          )
        }
      )
    })

    it("TemplateLiteral as part", () => {
      assertToGenerationDocument(
        {
          schema: Schema.TemplateLiteral([
            Schema.Literal("a"),
            Schema.TemplateLiteral([Schema.String, Schema.Literals(["-", "+"]), Schema.Number])
          ])
        },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.TemplateLiteral([Schema.String, Schema.Literals(["-", "+"]), Schema.Number])])`,
            "`a${string}-${number}` | `a${string}+${number}`"
          )
        }
      )
    })

    it("Union as part", () => {
      assertToGenerationDocument(
        {
          schema: Schema.TemplateLiteral([Schema.Literal("a"), Schema.Union([Schema.String, Schema.Number])])
        },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literal("a"), Schema.Union([Schema.String, Schema.Number])])`,
            "`a${string}` | `a${number}`"
          )
        }
      )
    })

    it("Literals as part", () => {
      assertToGenerationDocument(
        {
          schema: Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String])
        },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String])`,
            "`a${string}` | `b${string}`"
          )
        }
      )
    })

    it("multiple unions", () => {
      assertToGenerationDocument(
        {
          schema: Schema.TemplateLiteral([
            Schema.Union([Schema.Literal("a"), Schema.Literal("b")]),
            Schema.String,
            Schema.Union([Schema.Number, Schema.BigInt])
          ])
        },
        {
          generations: makeGeneration(
            `Schema.TemplateLiteral([Schema.Literals(["a", "b"]), Schema.String, Schema.Union([Schema.BigInt, Schema.Number])])`,
            "`a${string}${bigint}` | `a${string}${number}` | `b${string}${bigint}` | `b${string}${number}`"
          )
        }
      )
    })
  })

  describe("Arrays", () => {
    describe("Tuple", () => {
      it("empty tuple", () => {
        assertToGenerationDocument({ schema: Schema.Tuple([]) }, {
          generations: makeGeneration("Schema.Tuple([])", "readonly []")
        })
        assertToGenerationDocument(
          { schema: Schema.Tuple([]).annotate({ "description": "a" }) },
          {
            generations: makeGeneration(`Schema.Tuple([]).annotate({ "description": "a" })`, "readonly []")
          }
        )
      })

      it("required element", () => {
        assertToGenerationDocument(
          { schema: Schema.Tuple([Schema.String]) },
          {
            generations: makeGeneration(`Schema.Tuple([Schema.String])`, "readonly [string]")
          }
        )
        assertToGenerationDocument(
          { schema: Schema.Tuple([Schema.String]).annotate({ "description": "a" }) },
          {
            generations: makeGeneration(
              `Schema.Tuple([Schema.String]).annotate({ "description": "a" })`,
              "readonly [string]"
            )
          }
        )
      })

      it("optional element", () => {
        assertToGenerationDocument(
          { schema: Schema.Tuple([Schema.optionalKey(Schema.String)]) },
          {
            generations: makeGeneration(`Schema.Tuple([Schema.optionalKey(Schema.String)])`, "readonly [string?]")
          }
        )
        assertToGenerationDocument(
          { schema: Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ "description": "a" }) },
          {
            generations: makeGeneration(
              `Schema.Tuple([Schema.optionalKey(Schema.String)]).annotate({ "description": "a" })`,
              "readonly [string?]"
            )
          }
        )
      })

      it("annotateKey", () => {
        assertToGenerationDocument(
          { schema: Schema.Tuple([Schema.String.annotateKey({ "description": "a" })]) },
          {
            generations: makeGeneration(
              `Schema.Tuple([Schema.String.annotateKey({ "description": "a" })])`,
              "readonly [string]"
            )
          }
        )
      })
    })

    it("Array", () => {
      assertToGenerationDocument(
        { schema: Schema.Array(Schema.String) },
        {
          generations: makeGeneration("Schema.Array(Schema.String)", "ReadonlyArray<string>")
        }
      )
      assertToGenerationDocument(
        { schema: Schema.Array(Schema.String).annotate({ "description": "a" }) },
        {
          generations: makeGeneration(
            `Schema.Array(Schema.String).annotate({ "description": "a" })`,
            "ReadonlyArray<string>"
          )
        }
      )
    })

    it("TupleWithRest", () => {
      assertToGenerationDocument(
        { schema: Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]) },
        {
          generations: makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number])`,
            "readonly [string, ...Array<number>]"
          )
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({
            "description": "a"
          })
        },
        {
          generations: makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]).annotate({ "description": "a" })`,
            "readonly [string, ...Array<number>]"
          )
        }
      )
      assertToGenerationDocument(
        { schema: Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean]) },
        {
          generations: makeGeneration(
            `Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number, Schema.Boolean])`,
            "readonly [string, ...Array<number>, boolean]"
          )
        }
      )
    })
  })

  describe("Objects", () => {
    it("empty struct", () => {
      assertToGenerationDocument({ schema: Schema.Struct({}) }, {
        generations: makeGeneration("Schema.Struct({  })", "{  }")
      })
      assertToGenerationDocument(
        { schema: Schema.Struct({}).annotate({ "description": "a" }) },
        {
          generations: makeGeneration(`Schema.Struct({  }).annotate({ "description": "a" })`, "{  }")
        }
      )
    })

    it("required properties", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            a: Schema.String
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ "a": Schema.String })`,
            `{ readonly "a": string }`
          )
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            a: Schema.String,
            b: Schema.Number
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ "a": Schema.String, "b": Schema.Number })`,
            `{ readonly "a": string, readonly "b": number }`
          )
        }
      )
    })

    it("optional properties", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            a: Schema.optionalKey(Schema.String)
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ "a": Schema.optionalKey(Schema.String) })`,
            `{ readonly "a"?: string }`
          )
        }
      )
    })

    it("mutable properties", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            a: Schema.mutableKey(Schema.String)
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ "a": Schema.mutableKey(Schema.String) })`,
            `{ "a": string }`
          )
        }
      )
    })

    it("optional and mutable properties", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            a: Schema.optionalKey(Schema.mutableKey(Schema.String))
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ "a": Schema.optionalKey(Schema.mutableKey(Schema.String)) })`,
            `{ "a"?: string }`
          )
        }
      )
    })

    it("annotateKey", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            a: Schema.String.annotateKey({ "description": "a" })
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ "a": Schema.String.annotateKey({ "description": "a" }) })`,
            `{ readonly "a": string }`
          )
        }
      )
    })

    it("struct with symbol property key", () => {
      const sym = Symbol.for("a")
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            [sym]: Schema.String
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ [sym_0]: Schema.String })`,
            `{ readonly [typeof sym_0]: string }`
          ),
          artifacts: [{
            _tag: "Symbol",
            identifier: "sym_0",
            generation: makeGeneration(`Symbol.for("a")`, `typeof sym_0`)
          }]
        }
      )
    })
  })

  describe("Union", () => {
    it("union with anyOf mode (default)", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number])
        },
        {
          generations: makeGeneration("Schema.Union([Schema.String, Schema.Number])", "string | number")
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" })
        },
        {
          generations: makeGeneration(
            `Schema.Union([Schema.String, Schema.Number]).annotate({ "description": "z" })`,
            "string | number"
          )
        }
      )
    })

    it("union with oneOf mode", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })
        },
        {
          generations: makeGeneration(
            `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" })`,
            "string | number"
          )
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" })
        },
        {
          generations: makeGeneration(
            `Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }).annotate({ "description": "aa" })`,
            "string | number"
          )
        }
      )
    })

    it("union with multiple types", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number, Schema.Boolean])
        },
        {
          generations: makeGeneration(
            "Schema.Union([Schema.String, Schema.Number, Schema.Boolean])",
            "string | number | boolean"
          )
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "a" })
        },
        {
          generations: makeGeneration(
            `Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).annotate({ "description": "a" })`,
            "string | number | boolean"
          )
        }
      )
    })
  })

  describe("Suspend", () => {
    it("non-recursive", () => {
      assertToGenerationDocument(
        {
          schema: Schema.suspend(() => Schema.String)
        },
        {
          generations: makeGeneration(`Schema.suspend((): Schema.Codec<string, string> => Schema.String)`, "string")
        }
      )
      assertToGenerationDocument(
        {
          schema: Schema.suspend(() => Schema.String.annotate({ identifier: "ID" }))
        },
        {
          generations: makeGeneration(`Schema.suspend((): Schema.Codec<ID, IDEncoded> => ID)`, "ID", "IDEncoded"),
          definitions: {
            nonRecursives: [
              {
                $ref: "ID",
                schema: makeGeneration(`Schema.String.annotate({ "identifier": "ID" })`, "string")
              }
            ]
          }
        }
      )
    })

    describe("recursive", () => {
      it("outer identifier", () => {
        assertToGenerationDocument(
          {
            schema: OuterCategory
          },
          {
            generations: makeGeneration("Category", "Category", "CategoryEncoded"),
            definitions: {
              recursives: {
                Category: makeGeneration(
                  `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category)) }).annotate({ "identifier": "Category" })`,
                  `{ readonly "name": string, readonly "children": ReadonlyArray<Category> }`,
                  `{ readonly "name": string, readonly "children": ReadonlyArray<CategoryEncoded> }`
                )
              }
            }
          }
        )
      })

      it("inner identifier", () => {
        assertToGenerationDocument(
          {
            schema: InnerCategory
          },
          {
            generations: makeGeneration(
              `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category)) })`,
              `{ readonly "name": string, readonly "children": ReadonlyArray<Category> }`,
              `{ readonly "name": string, readonly "children": ReadonlyArray<CategoryEncoded> }`
            ),
            definitions: {
              recursives: {
                Category: makeGeneration(
                  `Schema.Struct({ "name": Schema.String, "children": Schema.Array(Schema.suspend((): Schema.Codec<Category, CategoryEncoded> => Category)) }).annotate({ "identifier": "Category" })`,
                  `{ readonly "name": string, readonly "children": ReadonlyArray<Category> }`,
                  `{ readonly "name": string, readonly "children": ReadonlyArray<CategoryEncoded> }`
                )
              }
            }
          }
        )
      })
    })
  })

  describe("nested structures", () => {
    it("tuple with struct elements", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Tuple([
            Schema.Struct({ a: Schema.String }),
            Schema.Struct({ b: Schema.Number })
          ])
        },
        {
          generations: makeGeneration(
            `Schema.Tuple([Schema.Struct({ "a": Schema.String }), Schema.Struct({ "b": Schema.Number })])`,
            `readonly [{ readonly "a": string }, { readonly "b": number }]`
          )
        }
      )
    })

    it("nested struct", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Struct({
            user: Schema.Struct({
              a: Schema.String,
              b: Schema.Number
            })
          })
        },
        {
          generations: makeGeneration(
            `Schema.Struct({ "user": Schema.Struct({ "a": Schema.String, "b": Schema.Number }) })`,
            `{ readonly "user": { readonly "a": string, readonly "b": number } }`
          )
        }
      )
    })

    it("union of structs", () => {
      assertToGenerationDocument(
        {
          schema: Schema.Union([
            Schema.Struct({ type: Schema.Literal("a"), value: Schema.String }),
            Schema.Struct({ type: Schema.Literal("b"), value: Schema.Number })
          ])
        },
        {
          generations: makeGeneration(
            `Schema.Union([Schema.Struct({ "type": Schema.Literal("a"), "value": Schema.String }), Schema.Struct({ "type": Schema.Literal("b"), "value": Schema.Number })])`,
            `{ readonly "type": "a", readonly "value": string } | { readonly "type": "b", readonly "value": number }`
          )
        }
      )
    })
  })
})
