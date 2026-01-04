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
        definitions: expected.definitions ?? {}
      }
      const jsonDocument = JsonSchema.fromSchemaDraft2020_12(schema)
      const document = SchemaStandard.fromJsonSchemaDocument(jsonDocument)
      deepStrictEqual(document, expectedDocument)
      const multiDocument: SchemaStandard.MultiDocument = {
        schemas: [document.schema],
        definitions: document.definitions
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

  describe("toJsonSchemaMultiDocument", () => {
    it("should handle multiple schemas", () => {
      const a = Schema.String.annotate({ identifier: "id", description: "a" })
      const b = a.annotate({ description: "b" })
      const multiDocument = SchemaStandard.fromASTs([a.ast, b.ast])
      const jsonMultiDocument = SchemaStandard.toJsonSchemaMultiDocument(multiDocument)
      deepStrictEqual(jsonMultiDocument, {
        dialect: "draft-2020-12",
        schemas: [
          { "$ref": "#/$defs/id" },
          { "$ref": "#/$defs/id-1" }
        ],
        definitions: {
          "id": {
            "type": "string",
            "description": "a"
          },
          "id-1": {
            "type": "string",
            "description": "b"
          }
        }
      })
    })
  })

  describe("toJson", () => {
    function assertToJson(
      schema: Schema.Top,
      expected: {
        readonly schema: JsonSchema.JsonSchema
        readonly definitions?: Record<string, JsonSchema.JsonSchema>
      }
    ) {
      const document = SchemaStandard.fromAST(schema.ast)
      const jd = SchemaStandard.toJson(document)
      deepStrictEqual(jd, { dialect: "draft-2020-12", definitions: {}, ...expected })
      deepStrictEqual(SchemaStandard.toJson(SchemaStandard.fromJson(jd)), jd)
    }

    describe("Declaration", () => {
      describe("Date", () => {
        it("Date", () => {
          assertToJson(Schema.Date, {
            schema: {
              _tag: "Declaration",
              annotations: {
                typeConstructor: { _tag: "Date" },
                generation: {
                  runtime: "Schema.Date",
                  Type: "globalThis.Date"
                }
              },
              typeParameters: [],
              checks: [],
              encodedSchema: { _tag: "String", checks: [] }
            }
          })
        })

        describe("checks", () => {
          it("isGreaterThanDate", () => {
            assertToJson(Schema.Date.check(Schema.isGreaterThanDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: {
                  typeConstructor: { _tag: "Date" },
                  generation: {
                    runtime: "Schema.Date",
                    Type: "globalThis.Date"
                  }
                },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isGreaterThanDate", exclusiveMinimum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                encodedSchema: { _tag: "String", checks: [] }
              }
            })
          })

          it("isGreaterThanOrEqualToDate", () => {
            assertToJson(Schema.Date.check(Schema.isGreaterThanOrEqualToDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: {
                  typeConstructor: { _tag: "Date" },
                  generation: {
                    runtime: "Schema.Date",
                    Type: "globalThis.Date"
                  }
                },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isGreaterThanOrEqualToDate", minimum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                encodedSchema: { _tag: "String", checks: [] }
              }
            })
          })

          it("isLessThanDate", () => {
            assertToJson(Schema.Date.check(Schema.isLessThanDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: {
                  typeConstructor: { _tag: "Date" },
                  generation: {
                    runtime: "Schema.Date",
                    Type: "globalThis.Date"
                  }
                },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isLessThanDate", exclusiveMaximum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                encodedSchema: { _tag: "String", checks: [] }
              }
            })
          })

          it("isLessThanOrEqualToDate", () => {
            assertToJson(Schema.Date.check(Schema.isLessThanOrEqualToDate(new Date(0))), {
              schema: {
                _tag: "Declaration",
                annotations: {
                  typeConstructor: { _tag: "Date" },
                  generation: {
                    runtime: "Schema.Date",
                    Type: "globalThis.Date"
                  }
                },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: { _tag: "isLessThanOrEqualToDate", maximum: "1970-01-01T00:00:00.000Z" }
                  }
                ],
                encodedSchema: { _tag: "String", checks: [] }
              }
            })
          })

          it("isBetweenDate", () => {
            assertToJson(Schema.Date.check(Schema.isBetweenDate({ minimum: new Date(0), maximum: new Date(1) })), {
              schema: {
                _tag: "Declaration",
                annotations: {
                  typeConstructor: { _tag: "Date" },
                  generation: {
                    runtime: "Schema.Date",
                    Type: "globalThis.Date"
                  }
                },
                typeParameters: [],
                checks: [
                  {
                    _tag: "Filter",
                    meta: {
                      _tag: "isBetweenDate",
                      minimum: "1970-01-01T00:00:00.000Z",
                      maximum: "1970-01-01T00:00:00.001Z"
                    }
                  }
                ],
                encodedSchema: { _tag: "String", checks: [] }
              }
            })
          })
        })
      })

      it("URL", () => {
        assertToJson(Schema.URL, {
          schema: {
            _tag: "Declaration",
            annotations: {
              typeConstructor: { _tag: "URL" },
              generation: {
                runtime: "Schema.URL",
                Type: "globalThis.URL"
              }
            },
            typeParameters: [],
            checks: [],
            encodedSchema: { _tag: "String", checks: [] }
          }
        })
      })

      it("Option(String)", () => {
        assertToJson(Schema.Option(Schema.String), {
          schema: {
            _tag: "Declaration",
            annotations: {
              typeConstructor: { _tag: "effect/Option" },
              generation: {
                runtime: "Schema.Option(?)",
                Type: "Option.Option<?>",
                importDeclaration: `import * as Option from "effect/Option"`
              }
            },
            typeParameters: [
              { _tag: "String", checks: [] }
            ],
            checks: [],
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
                      type: { _tag: "String", checks: [] },
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
          }
        })
      })
    })

    it("Any", () => {
      assertToJson(Schema.Any, { schema: { _tag: "Any" } })
      assertToJson(Schema.Any.annotate({ description: "a" }), {
        schema: { _tag: "Any", annotations: { description: "a" } }
      })
    })

    it("Unknown", () => {
      assertToJson(Schema.Unknown, { schema: { _tag: "Unknown" } })
      assertToJson(Schema.Unknown.annotate({ description: "a" }), {
        schema: { _tag: "Unknown", annotations: { description: "a" } }
      })
    })

    it("Null", () => {
      assertToJson(Schema.Null, { schema: { _tag: "Null" } })
      assertToJson(Schema.Null.annotate({ description: "a" }), {
        schema: { _tag: "Null", annotations: { description: "a" } }
      })
    })

    it("Undefined", () => {
      assertToJson(Schema.Undefined, { schema: { _tag: "Undefined" } })
      assertToJson(Schema.Undefined.annotate({ description: "a" }), {
        schema: { _tag: "Undefined", annotations: { description: "a" } }
      })
    })

    it("Void", () => {
      assertToJson(Schema.Void, { schema: { _tag: "Void" } })
      assertToJson(Schema.Void.annotate({ description: "a" }), {
        schema: { _tag: "Void", annotations: { description: "a" } }
      })
    })

    it("Never", () => {
      assertToJson(Schema.Never, { schema: { _tag: "Never" } })
      assertToJson(Schema.Never.annotate({ description: "a" }), {
        schema: { _tag: "Never", annotations: { description: "a" } }
      })
    })

    describe("String", () => {
      it("String", () => {
        assertToJson(Schema.String, { schema: { _tag: "String", checks: [] } })
        assertToJson(Schema.String.annotate({ description: "a" }), {
          schema: { _tag: "String", annotations: { "description": "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isMinLength", () => {
          assertToJson(Schema.String.check(Schema.isMinLength(1)), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isMinLength(1, { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMinLength", minLength: 1 }, annotations: { description: "a" } }
              ]
            }
          })
        })

        it("isMaxLength", () => {
          assertToJson(Schema.String.check(Schema.isMaxLength(10)), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isMaxLength(10, { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMaxLength", maxLength: 10 }, annotations: { description: "a" } }
              ]
            }
          })
        })

        it("isPattern", () => {
          assertToJson(Schema.String.check(Schema.isPattern(new RegExp("a"))), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isPattern", regExp: { source: "a", flags: "" } } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isPattern(new RegExp("a"), { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                {
                  _tag: "Filter",
                  meta: { _tag: "isPattern", regExp: { source: "a", flags: "" } },
                  annotations: { description: "a" }
                }
              ]
            }
          })
        })

        it("isLength", () => {
          assertToJson(Schema.String.check(Schema.isLength(5)), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLength", length: 5 } }
              ]
            }
          })
          assertToJson(Schema.String.check(Schema.isLength(5, { description: "a" })), {
            schema: {
              _tag: "String",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLength", length: 5 }, annotations: { description: "a" } }
              ]
            }
          })
        })
      })

      it("contentSchema", () => {
        assertToJson(
          Schema.toEncoded(Schema.fromJsonString(Schema.Struct({ a: Schema.String }))),
          {
            schema: {
              _tag: "String",
              checks: [],
              contentMediaType: "application/json",
              contentSchema: {
                _tag: "Objects",
                propertySignatures: [{
                  name: "a",
                  type: { _tag: "String", checks: [] },
                  isOptional: false,
                  isMutable: false
                }],
                indexSignatures: [],
                checks: []
              }
            }
          }
        )
      })
    })

    describe("Number", () => {
      it("Number", () => {
        assertToJson(Schema.Number, { schema: { _tag: "Number", checks: [] } })
        assertToJson(Schema.Number.annotate({ description: "a" }), {
          schema: { _tag: "Number", annotations: { description: "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isInt", () => {
          assertToJson(Schema.Number.check(Schema.isInt()), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isInt" } }
              ]
            }
          })
        })

        it("isGreaterThanOrEqualTo", () => {
          assertToJson(Schema.Number.check(Schema.isGreaterThanOrEqualTo(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualTo", minimum: 10 } }
              ]
            }
          })
        })

        it("isLessThanOrEqualTo", () => {
          assertToJson(Schema.Number.check(Schema.isLessThanOrEqualTo(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLessThanOrEqualTo", maximum: 10 } }
              ]
            }
          })
        })

        it("isGreaterThan", () => {
          assertToJson(Schema.Number.check(Schema.isGreaterThan(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThan", exclusiveMinimum: 10 } }
              ]
            }
          })
        })

        it("isLessThan", () => {
          assertToJson(Schema.Number.check(Schema.isLessThan(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isLessThan", exclusiveMaximum: 10 } }
              ]
            }
          })
        })

        it("isMultipleOf", () => {
          assertToJson(Schema.Number.check(Schema.isMultipleOf(10)), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isMultipleOf", divisor: 10 } }
              ]
            }
          })
        })

        it("isBetween", () => {
          assertToJson(Schema.Number.check(Schema.isBetween({ minimum: 1, maximum: 10 })), {
            schema: {
              _tag: "Number",
              checks: [
                { _tag: "Filter", meta: { _tag: "isBetween", minimum: 1, maximum: 10 } }
              ]
            }
          })
        })

        it("isInt32", () => {
          assertToJson(Schema.Number.check(Schema.isInt32()), {
            schema: {
              _tag: "Number",
              checks: [
                {
                  _tag: "FilterGroup",
                  checks: [
                    { _tag: "Filter", meta: { _tag: "isInt" } },
                    { _tag: "Filter", meta: { _tag: "isBetween", minimum: -2147483648, maximum: 2147483647 } }
                  ]
                }
              ]
            }
          })
        })

        it("isUint32", () => {
          assertToJson(Schema.Number.check(Schema.isUint32()), {
            schema: {
              _tag: "Number",
              checks: [
                {
                  _tag: "FilterGroup",
                  checks: [
                    { _tag: "Filter", meta: { _tag: "isInt" } },
                    {
                      _tag: "Filter",
                      meta: { _tag: "isBetween", minimum: 0, maximum: 4294967295 }
                    }
                  ]
                }
              ]
            }
          })
        })
      })
    })

    it("Boolean", () => {
      assertToJson(Schema.Boolean, { schema: { _tag: "Boolean" } })
      assertToJson(Schema.Boolean.annotate({ description: "a" }), {
        schema: { _tag: "Boolean", annotations: { description: "a" } }
      })
    })

    describe("BigInt", () => {
      it("BigInt", () => {
        assertToJson(Schema.BigInt, { schema: { _tag: "BigInt", checks: [] } })
        assertToJson(Schema.BigInt.annotate({ description: "a" }), {
          schema: { _tag: "BigInt", annotations: { description: "a" }, checks: [] }
        })
      })

      describe("checks", () => {
        it("isGreaterThanOrEqualTo", () => {
          assertToJson(Schema.BigInt.check(Schema.isGreaterThanOrEqualToBigInt(10n)), {
            schema: {
              _tag: "BigInt",
              checks: [
                { _tag: "Filter", meta: { _tag: "isGreaterThanOrEqualToBigInt", minimum: "10" } }
              ]
            }
          })
        })
      })
    })

    it("Symbol", () => {
      assertToJson(Schema.Symbol, { schema: { _tag: "Symbol" } })
      assertToJson(Schema.Symbol.annotate({ description: "a" }), {
        schema: { _tag: "Symbol", annotations: { description: "a" } }
      })
    })

    it("Literal", () => {
      assertToJson(Schema.Literal("hello"), { schema: { _tag: "Literal", literal: "hello" } })
      assertToJson(Schema.Literal("hello").annotate({ description: "a" }), {
        schema: { _tag: "Literal", annotations: { description: "a" }, literal: "hello" }
      })
    })

    it("UniqueSymbol", () => {
      assertToJson(Schema.UniqueSymbol(Symbol.for("test")), {
        schema: { _tag: "UniqueSymbol", symbol: `Symbol(test)` }
      })
      assertToJson(Schema.UniqueSymbol(Symbol.for("test")).annotate({ description: "a" }), {
        schema: { _tag: "UniqueSymbol", annotations: { description: "a" }, symbol: `Symbol(test)` }
      })
    })

    it("ObjectKeyword", () => {
      assertToJson(Schema.ObjectKeyword, { schema: { _tag: "ObjectKeyword" } })
      assertToJson(Schema.ObjectKeyword.annotate({ description: "a" }), {
        schema: { _tag: "ObjectKeyword", annotations: { description: "a" } }
      })
    })

    it("Enum", () => {
      assertToJson(Schema.Enum({ A: "a", B: "b" }), {
        schema: { _tag: "Enum", enums: [["A", "a"], ["B", "b"]] }
      })
      assertToJson(Schema.Enum({ A: "a", B: "b" }).annotate({ description: "a" }), {
        schema: { _tag: "Enum", annotations: { description: "a" }, enums: [["A", "a"], ["B", "b"]] }
      })
    })

    it("TemplateLiteral", () => {
      assertToJson(Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]), {
        schema: {
          _tag: "TemplateLiteral",
          parts: [
            { _tag: "String", checks: [] },
            {
              _tag: "Literal",
              literal: "-"
            },
            { _tag: "Number", checks: [] }
          ]
        }
      })
      assertToJson(
        Schema.TemplateLiteral([Schema.String, Schema.Literal("-"), Schema.Number]).annotate({ description: "a" }),
        {
          schema: {
            _tag: "TemplateLiteral",
            annotations: { description: "a" },
            parts: [
              { _tag: "String", checks: [] },
              { _tag: "Literal", literal: "-" },
              { _tag: "Number", checks: [] }
            ]
          }
        }
      )
    })

    describe("Tuple", () => {
      it("empty tuple", () => {
        assertToJson(Schema.Tuple([]), { schema: { _tag: "Arrays", elements: [], rest: [], checks: [] } })
        assertToJson(Schema.Tuple([]).annotate({ description: "a" }), {
          schema: { _tag: "Arrays", annotations: { description: "a" }, elements: [], rest: [], checks: [] }
        })
      })

      it("required element", () => {
        assertToJson(Schema.Tuple([Schema.String]), {
          schema: {
            _tag: "Arrays",
            elements: [{ isOptional: false, type: { _tag: "String", checks: [] } }],
            rest: [],
            checks: []
          }
        })
        const MyString = Schema.String.annotate({ identifier: "id" })
        assertToJson(Schema.Tuple([MyString, MyString]), {
          schema: {
            _tag: "Arrays",
            elements: [
              { isOptional: false, type: { _tag: "Reference", $ref: "id" } },
              { isOptional: false, type: { _tag: "Reference", $ref: "id" } }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            id: {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            }
          }
        })
      })

      it("required element & annotateKey", () => {
        const MyString = Schema.String.annotate({ identifier: "id" })
        assertToJson(Schema.Tuple([MyString, MyString.annotateKey({ description: "b" })]), {
          schema: {
            _tag: "Arrays",
            elements: [
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "id" }
              },
              {
                isOptional: false,
                type: { _tag: "Reference", $ref: "id-1" },
                annotations: { description: "b" }
              }
            ],
            rest: [],
            checks: []
          },
          definitions: {
            id: {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            },
            "id-1": {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            }
          }
        })
      })
    })

    it("Array(String)", () => {
      assertToJson(Schema.Array(Schema.String), {
        schema: {
          _tag: "Arrays",
          elements: [],
          rest: [{ _tag: "String", checks: [] }],
          checks: []
        }
      })
    })

    it("TupleWithRest(Tuple([String]), [Number])", () => {
      assertToJson(Schema.TupleWithRest(Schema.Tuple([Schema.String]), [Schema.Number]), {
        schema: {
          _tag: "Arrays",
          elements: [{ isOptional: false, type: { _tag: "String", checks: [] } }],
          rest: [{ _tag: "Number", checks: [] }],
          checks: []
        }
      })
    })

    describe("Struct", () => {
      it("empty struct", () => {
        assertToJson(Schema.Struct({}), {
          schema: {
            _tag: "Objects",
            propertySignatures: [],
            indexSignatures: [],
            checks: []
          }
        })
        assertToJson(Schema.Struct({}).annotate({ description: "a" }), {
          schema: {
            _tag: "Objects",
            annotations: { description: "a" },
            propertySignatures: [],
            indexSignatures: [],
            checks: []
          }
        })
      })

      it("properties", () => {
        assertToJson(
          Schema.Struct({
            a: Schema.String,
            b: Schema.mutableKey(Schema.String),
            c: Schema.optionalKey(Schema.String),
            d: Schema.mutableKey(Schema.optionalKey(Schema.String)),
            e: Schema.optionalKey(Schema.mutableKey(Schema.String))
          }),
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
                  isOptional: false,
                  isMutable: true
                },
                {
                  name: "c",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: false
                },
                {
                  name: "d",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: true
                },
                {
                  name: "e",
                  type: { _tag: "String", checks: [] },
                  isOptional: true,
                  isMutable: true
                }
              ],
              indexSignatures: [],
              checks: []
            }
          }
        )
      })

      it("annotateKey", () => {
        assertToJson(
          Schema.Struct({
            a: Schema.String.annotateKey({ description: "a" })
          }),
          {
            schema: {
              _tag: "Objects",
              propertySignatures: [
                {
                  name: "a",
                  type: { _tag: "String", checks: [] },
                  isOptional: false,
                  isMutable: false,
                  annotations: { description: "a" }
                }
              ],
              indexSignatures: [],
              checks: []
            }
          }
        )
      })

      it("symbol key", () => {
        assertToJson(Schema.Struct({ [Symbol.for("a")]: Schema.String }), {
          schema: {
            _tag: "Objects",
            propertySignatures: [{
              name: "Symbol(a)",
              type: { _tag: "String", checks: [] },
              isOptional: false,
              isMutable: false
            }],
            indexSignatures: [],
            checks: []
          }
        })
      })
    })

    it("Record(String, Number)", () => {
      assertToJson(Schema.Record(Schema.String, Schema.Number), {
        schema: {
          _tag: "Objects",
          propertySignatures: [],
          indexSignatures: [
            { parameter: { _tag: "String", checks: [] }, type: { _tag: "Number", checks: [] } }
          ],
          checks: []
        }
      })
    })

    it("RecordWithRest(Record(String, Number), [Symbol])", () => {
      assertToJson(
        Schema.StructWithRest(Schema.Struct({ a: Schema.Number }), [Schema.Record(Schema.String, Schema.Number)]),
        {
          schema: {
            _tag: "Objects",
            propertySignatures: [
              { name: "a", type: { _tag: "Number", checks: [] }, isOptional: false, isMutable: false }
            ],
            indexSignatures: [
              { parameter: { _tag: "String", checks: [] }, type: { _tag: "Number", checks: [] } }
            ],
            checks: []
          }
        }
      )
    })

    describe("Union", () => {
      it("anyOf", () => {
        assertToJson(Schema.Union([Schema.String, Schema.Number]), {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "String", checks: [] },
              { _tag: "Number", checks: [] }
            ],
            mode: "anyOf"
          }
        })
        assertToJson(Schema.Union([Schema.String, Schema.Number]).annotate({ description: "a" }), {
          schema: {
            _tag: "Union",
            annotations: { description: "a" },
            types: [
              { _tag: "String", checks: [] },
              { _tag: "Number", checks: [] }
            ],
            mode: "anyOf"
          }
        })
      })

      it("oneOf", () => {
        assertToJson(Schema.Union([Schema.String, Schema.Number], { mode: "oneOf" }), {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "String", checks: [] },
              { _tag: "Number", checks: [] }
            ],
            mode: "oneOf"
          }
        })
      })

      it("Literals", () => {
        assertToJson(Schema.Literals(["a", 1]), {
          schema: {
            _tag: "Union",
            types: [
              { _tag: "Literal", literal: "a" },
              { _tag: "Literal", literal: 1 }
            ],
            mode: "anyOf"
          }
        })
      })
    })

    describe("Suspend", () => {
      it("non-recursive", () => {
        assertToJson(Schema.suspend(() => Schema.String), {
          schema: { _tag: "Suspend", checks: [], thunk: { _tag: "String", checks: [] } }
        })
        assertToJson(Schema.suspend(() => Schema.String.annotate({ identifier: "id" })), {
          schema: {
            _tag: "Suspend",
            checks: [],
            thunk: {
              _tag: "Reference",
              $ref: "id"
            }
          },
          definitions: {
            id: {
              _tag: "String",
              annotations: { identifier: "id" },
              checks: []
            }
          }
        })
      })

      it("does not treat reusing the same suspended thunk result as recursion", () => {
        const inner = Schema.Struct({ a: Schema.String }).annotate({ identifier: "inner" })
        const shared = Schema.suspend(() => inner)

        const schema = Schema.Union([shared, shared])

        assertToJson(schema, {
          schema: {
            _tag: "Union",
            mode: "anyOf",
            types: [
              { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "inner" } },
              { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "inner" } }
            ]
          },
          definitions: {
            inner: {
              _tag: "Objects",
              annotations: { identifier: "inner" },
              propertySignatures: [
                { name: "a", type: { _tag: "String", checks: [] }, isOptional: false, isMutable: false }
              ],
              indexSignatures: [],
              checks: []
            }
          }
        })
      })

      describe("recursive", () => {
        it("outer identifier", () => {
          assertToJson(OuterCategory, {
            schema: {
              _tag: "Reference",
              $ref: "Category"
            },
            definitions: {
              Category: {
                _tag: "Objects",
                annotations: { identifier: "Category" },
                propertySignatures: [
                  {
                    name: "name",
                    type: { _tag: "String", checks: [] },
                    isOptional: false,
                    isMutable: false
                  },
                  {
                    name: "children",
                    type: {
                      _tag: "Arrays",
                      elements: [],
                      rest: [{
                        _tag: "Suspend",
                        checks: [],
                        thunk: { _tag: "Reference", $ref: "Category" }
                      }],
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

        it("inner identifier", () => {
          assertToJson(InnerCategory, {
            schema: {
              _tag: "Objects",
              propertySignatures: [
                {
                  name: "name",
                  type: { _tag: "String", checks: [] },
                  isOptional: false,
                  isMutable: false
                },
                {
                  name: "children",
                  type: {
                    _tag: "Arrays",
                    elements: [],
                    rest: [
                      { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "Category" } }
                    ],
                    checks: []
                  },
                  isOptional: false,
                  isMutable: false
                }
              ],
              indexSignatures: [],
              checks: []
            },
            definitions: {
              Category: {
                _tag: "Objects",
                annotations: { identifier: "Category" },
                propertySignatures: [
                  {
                    name: "name",
                    type: { _tag: "String", checks: [] },
                    isOptional: false,
                    isMutable: false
                  },
                  {
                    name: "children",
                    type: {
                      _tag: "Arrays",
                      elements: [],
                      rest: [
                        { _tag: "Suspend", checks: [], thunk: { _tag: "Reference", $ref: "Category" } }
                      ],
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
  })

  describe("fromASTs", () => {
    it("should handle multiple schemas", () => {
      const a = Schema.String.annotate({ identifier: "id", description: "a" })
      const b = a.annotate({ description: "b" })
      const multiDocument = SchemaStandard.fromASTs([a.ast, b.ast])
      deepStrictEqual(multiDocument, {
        schemas: [
          { _tag: "Reference", $ref: "id" },
          { _tag: "Reference", $ref: "id-1" }
        ],
        definitions: {
          "id": { _tag: "String", checks: [], annotations: { identifier: "id", description: "a" } },
          "id-1": { _tag: "String", checks: [], annotations: { identifier: "id", description: "b" } }
        }
      })
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
