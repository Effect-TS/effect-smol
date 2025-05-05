import {
  Context,
  Effect,
  Option,
  pipe,
  Result,
  Schema,
  SchemaAST,
  SchemaFilter,
  SchemaIssue,
  SchemaMiddleware,
  SchemaParser,
  SchemaResult,
  SchemaTransformation
} from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { assertFalse, assertTrue, deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

const Trim = Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.trim))

const FiniteFromString = Schema.String.pipe(Schema.decodeTo(
  Schema.Finite,
  new SchemaTransformation.Transformation(
    SchemaParser.Number,
    SchemaParser.String
  )
))

const SnakeToCamel = Schema.String.pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.snakeToCamel
  )
)

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    new SchemaTransformation.Transformation(
      SchemaParser.Number,
      SchemaParser.String
    )
  )
)

const mapOutput = (
  f: (out: SchemaFilter.FilterOut) => SchemaFilter.FilterOut,
  annotations?: SchemaFilter.Annotations
) =>
<T>(filter: SchemaFilter.Filter<T>): SchemaFilter.Filter<T> => {
  return new SchemaFilter.Filter<T>(
    (input, ast, options) => f(filter.run(input, ast, options)),
    filter.bail,
    { ...filter.annotations, ...annotations }
  )
}

describe("Schema", () => {
  it("isSchema", () => {
    class A extends Schema.Opaque<A>()(Schema.Struct({ a: Schema.String })) {}
    assertTrue(Schema.isSchema(Schema.String))
    assertTrue(Schema.isSchema(A))
    assertFalse(Schema.isSchema({}))
  })

  describe("Literal", () => {
    it(`"a"`, async () => {
      const schema = Schema.Literal("a")

      strictEqual(SchemaAST.format(schema.ast), `"a"`)

      await assertions.make.succeed(schema, "a")
      await assertions.make.fail(schema, null as any, `Expected "a", actual null`)
      assertions.makeUnsafe.succeed(schema, "a")
      assertions.makeUnsafe.fail(schema, null as any, `Expected "a", actual null`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, 1, `Expected "a", actual 1`)

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.fail(schema, 1 as any, `Expected "a", actual 1`)
    })
  })

  describe("Literals", () => {
    it("red, green, blue", async () => {
      const schema = Schema.Literals(["red", "green", "blue"])

      strictEqual(SchemaAST.format(schema.ast), `"red" | "green" | "blue"`)

      deepStrictEqual(schema.literals, ["red", "green", "blue"])

      await assertions.make.succeed(schema, "red")
      await assertions.make.succeed(schema, "green")
      await assertions.make.succeed(schema, "blue")
      await assertions.make.fail(
        schema,
        "yellow" as any,
        `"red" | "green" | "blue"
├─ Expected "red", actual "yellow"
├─ Expected "green", actual "yellow"
└─ Expected "blue", actual "yellow"`
      )

      await assertions.decoding.succeed(schema, "red")
      await assertions.decoding.succeed(schema, "green")
      await assertions.decoding.succeed(schema, "blue")
      await assertions.decoding.fail(
        schema,
        "yellow",
        `"red" | "green" | "blue"
├─ Expected "red", actual "yellow"
├─ Expected "green", actual "yellow"
└─ Expected "blue", actual "yellow"`
      )

      await assertions.encoding.succeed(schema, "red")
      await assertions.encoding.succeed(schema, "green")
      await assertions.encoding.succeed(schema, "blue")
      await assertions.encoding.fail(
        schema,
        "yellow",
        `"red" | "green" | "blue"
├─ Expected "red", actual "yellow"
├─ Expected "green", actual "yellow"
└─ Expected "blue", actual "yellow"`
      )
    })
  })

  it("Never", async () => {
    const schema = Schema.Never

    await assertions.make.fail(schema, null as never, `Expected never, actual null`)
    assertions.makeUnsafe.fail(schema, null as never, `Expected never, actual null`)

    strictEqual(SchemaAST.format(schema.ast), `never`)

    await assertions.decoding.fail(schema, "a", `Expected never, actual "a"`)
    await assertions.encoding.fail(schema, "a", `Expected never, actual "a"`)
  })

  it("Unknown", async () => {
    const schema = Schema.Unknown

    strictEqual(SchemaAST.format(schema.ast), `unknown`)

    await assertions.make.succeed(schema, "a")
    assertions.makeUnsafe.succeed(schema, "a")

    await assertions.decoding.succeed(schema, "a")
  })

  it("Null", async () => {
    const schema = Schema.Null

    strictEqual(SchemaAST.format(schema.ast), `null`)

    await assertions.make.succeed(schema, null)
    await assertions.make.fail(schema, undefined as any, `Expected null, actual undefined`)
    assertions.makeUnsafe.succeed(schema, null)
    assertions.makeUnsafe.fail(schema, undefined as any, `Expected null, actual undefined`)
  })

  it("Undefined", async () => {
    const schema = Schema.Undefined

    strictEqual(SchemaAST.format(schema.ast), `undefined`)

    await assertions.make.succeed(schema, undefined)
    await assertions.make.fail(schema, null as any, `Expected undefined, actual null`)
    assertions.makeUnsafe.succeed(schema, undefined)
    assertions.makeUnsafe.fail(schema, null as any, `Expected undefined, actual null`)
  })

  it("String", async () => {
    const schema = Schema.String

    strictEqual(SchemaAST.format(schema.ast), `string`)

    await assertions.make.succeed(schema, "a")
    await assertions.make.fail(schema, null as any, `Expected string, actual null`)
    assertions.makeUnsafe.succeed(schema, "a")
    assertions.makeUnsafe.fail(schema, null as any, `Expected string, actual null`)

    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(schema, 1, "Expected string, actual 1")

    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(schema, 1 as any, "Expected string, actual 1")
  })

  it("Number", async () => {
    const schema = Schema.Number

    strictEqual(SchemaAST.format(schema.ast), `number`)

    await assertions.make.succeed(schema, 1)
    await assertions.make.fail(schema, null as any, `Expected number, actual null`)
    assertions.makeUnsafe.succeed(schema, 1)
    assertions.makeUnsafe.fail(schema, null as any, `Expected number, actual null`)

    await assertions.decoding.succeed(schema, 1)
    await assertions.decoding.fail(schema, "a", `Expected number, actual "a"`)

    await assertions.encoding.succeed(schema, 1)
    await assertions.encoding.fail(schema, "a" as any, `Expected number, actual "a"`)
  })

  it("UniqueSymbol", async () => {
    const a = Symbol("a")
    const schema = Schema.UniqueSymbol(a)

    strictEqual(SchemaAST.format(schema.ast), `Symbol(a)`)

    await assertions.make.succeed(schema, a)
    await assertions.make.fail(schema, Symbol("b") as any, `Expected Symbol(a), actual Symbol(b)`)
    assertions.makeUnsafe.succeed(schema, a)
    assertions.makeUnsafe.fail(schema, Symbol("b") as any, `Expected Symbol(a), actual Symbol(b)`)

    await assertions.decoding.succeed(schema, a)
    await assertions.decoding.fail(schema, Symbol("b"), `Expected Symbol(a), actual Symbol(b)`)
  })

  it("BigInt", async () => {
    const schema = Schema.BigInt

    strictEqual(SchemaAST.format(schema.ast), `bigint`)

    await assertions.make.succeed(schema, 1n)
    await assertions.make.fail(schema, null as any, `Expected bigint, actual null`)
    assertions.makeUnsafe.succeed(schema, 1n)
    assertions.makeUnsafe.fail(schema, null as any, `Expected bigint, actual null`)

    await assertions.decoding.succeed(schema, 1n)
    await assertions.decoding.fail(schema, "1" as any, `Expected bigint, actual "1"`)

    await assertions.encoding.succeed(schema, 1n)
    await assertions.encoding.fail(schema, "1" as any, `Expected bigint, actual "1"`)
  })

  describe("Struct", () => {
    it(`{ readonly "a": string }`, async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string }`)

      // Should be able to access the fields
      deepStrictEqual(schema.fields, { a: Schema.String })

      await assertions.make.succeed(schema, { a: "a" })
      await assertions.make.fail(schema, null as any, `Expected { readonly "a": string }, actual null`)
      assertions.makeUnsafe.succeed(schema, { a: "a" })
      assertions.makeUnsafe.fail(schema, null as any, `Expected { readonly "a": string }, actual null`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a": string }
└─ ["a"]
   └─ Missing value`
      )
      await assertions.decoding.fail(
        schema,
        { a: 1 },
        `{ readonly "a": string }
└─ ["a"]
   └─ Expected string, actual 1`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a": string }
└─ ["a"]
   └─ Missing value`
      )
      await assertions.encoding.fail(
        schema,
        { a: 1 } as any,
        `{ readonly "a": string }
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    describe("ParseOptions", () => {
      it(`{ errors: "all" }`, async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.Number
        })

        await assertions.make.fail(
          schema,
          {} as any,
          `{ readonly "a": string; readonly "b": number }
├─ ["a"]
│  └─ Missing value
└─ ["b"]
   └─ Missing value`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.decoding.fail(
          schema,
          {},
          `{ readonly "a": string; readonly "b": number }
├─ ["a"]
│  └─ Missing value
└─ ["b"]
   └─ Missing value`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.encoding.fail(
          schema,
          {} as any,
          `{ readonly "a": string; readonly "b": number }
├─ ["a"]
│  └─ Missing value
└─ ["b"]
   └─ Missing value`,
          { parseOptions: { errors: "all" } }
        )
      })
    })

    it(`{ readonly "a": FiniteFromString }`, async () => {
      const schema = Schema.Struct({
        a: FiniteFromString
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": number & finite <-> string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.fail(
        schema,
        { a: "a" },
        `{ readonly "a": number & finite <-> string }
└─ ["a"]
   └─ number & finite <-> string
      └─ finite
         └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.fail(
        schema,
        { a: "a" } as any,
        `{ readonly "a": string <-> number & finite }
└─ ["a"]
   └─ string <-> number & finite
      └─ Expected number & finite, actual "a"`
      )
    })

    describe("optionalKey", () => {
      it(`{ readonly "a"?: string }`, async () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.optionalKey)
        })

        strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: string }`)

        await assertions.make.succeed(schema, { a: "a" })
        await assertions.make.succeed(schema, {})
        assertions.makeUnsafe.succeed(schema, { a: "a" })
        assertions.makeUnsafe.succeed(schema, {})

        await assertions.decoding.succeed(schema, { a: "a" })
        await assertions.decoding.succeed(schema, {})
        await assertions.decoding.fail(
          schema,
          { a: 1 },
          `{ readonly "a"?: string }
└─ ["a"]
   └─ Expected string, actual 1`
        )

        await assertions.encoding.succeed(schema, { a: "a" })
        await assertions.encoding.succeed(schema, {})
        await assertions.encoding.fail(
          schema,
          { a: 1 } as any,
          `{ readonly "a"?: string }
└─ ["a"]
   └─ Expected string, actual 1`
        )
      })
    })

    describe("extend", () => {
      it("Struct", async () => {
        const from = Schema.Struct({
          a: Schema.String
        })
        const schema = from.pipe(Schema.extend({ b: Schema.String }))

        await assertions.decoding.succeed(schema, { a: "a", b: "b" })
        await assertions.decoding.fail(
          schema,
          { b: "b" },
          `{ readonly "a": string; readonly "b": string }
└─ ["a"]
   └─ Missing value`
        )
        await assertions.decoding.fail(
          schema,
          { a: "a" },
          `{ readonly "a": string; readonly "b": string }
└─ ["b"]
   └─ Missing value`
        )
      })

      it("overlapping fields", async () => {
        const from = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        })
        const schema = from.pipe(Schema.extend({ b: Schema.Number, c: Schema.Number }))

        await assertions.decoding.succeed(schema, { a: "a", b: 1, c: 2 })
        await assertions.decoding.fail(
          schema,
          { a: "a", b: "b" },
          `{ readonly "a": string; readonly "b": number; readonly "c": number }
└─ ["b"]
   └─ Expected number, actual "b"`
        )
      })

      it("Struct & filter", async () => {
        const from = Schema.Struct({
          a: Schema.String
        })
        const schema = from.pipe(
          Schema.check(SchemaFilter.make(({ a }: { a: string }) => a.length > 0)),
          Schema.extend({
            b: Schema.String
          })
        )

        await assertions.decoding.succeed(schema, { a: "a", b: "b" })
        await assertions.decoding.fail(
          schema,
          { a: "", b: "b" },
          `{ readonly "a": string; readonly "b": string } & <filter>
└─ <filter>
   └─ Invalid value {"a":"","b":"b"}`
        )
      })
    })

    describe("pick", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).pipe(Schema.pick(["a"]))

        await assertions.decoding.succeed(schema, { a: "a" })
      })
    })

    describe("omit", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).pipe(Schema.omit(["b"]))

        await assertions.decoding.succeed(schema, { a: "a" })
      })
    })
  })

  describe("ReadonlyTuple", () => {
    it(`readonly [string]`, async () => {
      const schema = Schema.ReadonlyTuple([Schema.NonEmptyString])

      strictEqual(SchemaAST.format(schema.ast), `readonly [string & minLength(1)]`)

      await assertions.make.succeed(schema, ["a"])
      await assertions.make.fail(
        schema,
        [""],
        `readonly [string & minLength(1)]
└─ [0]
   └─ string & minLength(1)
      └─ minLength(1)
         └─ Invalid value ""`
      )
      assertions.makeUnsafe.succeed(schema, ["a"])
      assertions.makeUnsafe.fail(schema, [""], `Expected readonly [string & minLength(1)], actual [""]`)

      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.fail(
        schema,
        [],
        `readonly [string & minLength(1)]
└─ [0]
   └─ Missing value`
      )
      await assertions.decoding.fail(
        schema,
        [1],
        `readonly [string & minLength(1)]
└─ [0]
   └─ Expected string & minLength(1), actual 1`
      )

      await assertions.encoding.succeed(schema, ["a"])
      await assertions.encoding.fail(
        schema,
        [] as any,
        `readonly [string & minLength(1)]
└─ [0]
   └─ Missing value`
      )
      await assertions.decoding.fail(
        schema,
        [],
        `readonly [string & minLength(1)]
└─ [0]
   └─ Missing value`
      )
      await assertions.encoding.fail(
        schema,
        [1] as any,
        `readonly [string & minLength(1)]
└─ [0]
   └─ Expected string & minLength(1), actual 1`
      )
    })

    it(`readonly [string?]`, async () => {
      const schema = Schema.ReadonlyTuple([Schema.String.pipe(Schema.optionalKey)])

      strictEqual(SchemaAST.format(schema.ast), `readonly [string?]`)

      assertions.makeUnsafe.succeed(schema, ["a"])
      assertions.makeUnsafe.succeed(schema, [])

      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.succeed(schema, [])

      await assertions.encoding.succeed(schema, ["a"])
      await assertions.encoding.succeed(schema, [])
    })
  })

  describe("ReadonlyArray", () => {
    it("readonly string[]", async () => {
      const schema = Schema.ReadonlyArray(Schema.String)

      strictEqual(SchemaAST.format(schema.ast), `ReadonlyArray<string>`)

      await assertions.make.succeed(schema, ["a", "b"])
      assertions.makeUnsafe.succeed(schema, ["a", "b"])

      await assertions.decoding.succeed(schema, ["a", "b"])
      await assertions.decoding.fail(
        schema,
        ["a", 1],
        `ReadonlyArray<string>
└─ [1]
   └─ Expected string, actual 1`
      )

      await assertions.encoding.succeed(schema, ["a", "b"])
      await assertions.encoding.fail(
        schema,
        ["a", 1] as any,
        `ReadonlyArray<string>
└─ [1]
   └─ Expected string, actual 1`
      )
    })
  })

  describe("Filters", () => {
    describe("check", () => {
      const delay = <T>(filter: SchemaFilter.Filter<T>, delay: number): SchemaFilter.Filter<T> =>
        pipe(
          filter,
          mapOutput((out) => {
            const eff = Effect.isEffect(out) ? out : Effect.succeed(out)
            return eff.pipe(Effect.delay(delay))
          }, { title: `delayed(${filter.annotations?.title}, ${delay})` })
        )

      it("single filter", async () => {
        const schema = Schema.String.pipe(Schema.check(
          SchemaFilter.minLength(3)
        ))

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3)
└─ minLength(3)
   └─ Invalid value "ab"`
        )
      })

      it("multiple filters", async () => {
        const schema = Schema.String.pipe(Schema.check(
          SchemaFilter.minLength(3),
          SchemaFilter.includes("c")
        ))

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3) & includes("c")
├─ minLength(3)
│  └─ Invalid value "ab"
└─ includes("c")
   └─ Invalid value "ab"`
        )
      })

      it("aborting filters", async () => {
        const schema = Schema.String.pipe(Schema.check(
          SchemaFilter.minLength(2).abort(),
          SchemaFilter.includes("b")
        ))

        await assertions.decoding.fail(
          schema,
          "a",
          `string & minLength(2) & includes("b")
└─ minLength(2)
   └─ Invalid value "a"`
        )
      })

      it("single effectful filter", async () => {
        const schema = Schema.String.pipe(
          Schema.check(
            delay(SchemaFilter.minLength(3), 10),
            SchemaFilter.includes("c")
          )
        )

        strictEqual(SchemaAST.format(schema.ast), `string & delayed(minLength(3), 10) & includes("c")`)

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & delayed(minLength(3), 10) & includes("c")
├─ delayed(minLength(3), 10)
│  └─ Invalid value "ab"
└─ includes("c")
   └─ Invalid value "ab"`
        )
      })

      it("multiple effectful filters", async () => {
        const schema = Schema.String.pipe(
          Schema.check(
            delay(SchemaFilter.minLength(3), 10),
            delay(SchemaFilter.includes("c"), 15)
          )
        )

        strictEqual(SchemaAST.format(schema.ast), `string & delayed(minLength(3), 10) & delayed(includes("c"), 15)`)

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & delayed(minLength(3), 10) & delayed(includes("c"), 15)
├─ delayed(minLength(3), 10)
│  └─ Invalid value "ab"
└─ delayed(includes("c"), 15)
   └─ Invalid value "ab"`
        )
      })
    })

    describe("checkEncoded", () => {
      it("single filter", async () => {
        const schema = FiniteFromString.pipe(
          Schema.checkEncoded(SchemaFilter.minLength(3))
        )

        strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string & minLength(3)`)

        await assertions.encoding.succeed(schema, 123, { expected: "123" })
        await assertions.encoding.fail(
          schema,
          12,
          `string & minLength(3) <-> number & finite
└─ minLength(3)
   └─ Invalid value "12"`
        )
      })

      it("multiple filters", async () => {
        const schema = FiniteFromString.pipe(
          Schema.checkEncoded(SchemaFilter.minLength(3), SchemaFilter.includes("1"))
        )

        strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string & minLength(3) & includes("1")`)

        await assertions.encoding.succeed(schema, 123, { expected: "123" })
        await assertions.encoding.fail(
          schema,
          12,
          `string & minLength(3) & includes("1") <-> number & finite
└─ minLength(3)
   └─ Invalid value "12"`
        )
        await assertions.encoding.fail(
          schema,
          234,
          `string & minLength(3) & includes("1") <-> number & finite
└─ includes("1")
   └─ Invalid value "234"`
        )
      })
    })

    it("refine", async () => {
      const schema = Schema.Option(Schema.String).pipe(
        Schema.refine((os) => Option.isSome(os), { title: "Some" }),
        Schema.check(SchemaFilter.make(({ value }: { value: string }) => value.length > 0, { title: "length > 0" }))
      )

      strictEqual(SchemaAST.format(schema.ast), `Option<string> & Some & length > 0`)

      await assertions.decoding.succeed(schema, Option.some("a"))
      await assertions.decoding.fail(
        schema,
        Option.some(""),
        `Option<string> & Some & length > 0
└─ length > 0
   └─ Invalid value {
  "_id": "Option",
  "_tag": "Some",
  "value": ""
}`
      )
      await assertions.decoding.fail(
        schema,
        Option.none(),
        `Option<string> & Some & length > 0
└─ Some
   └─ Expected Option<string> & Some & length > 0, actual {
  "_id": "Option",
  "_tag": "None"
}`
      )
    })

    describe("String filters", () => {
      it("regex", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaFilter.regex(/^a/)))

        strictEqual(SchemaAST.format(schema.ast), `string & regex(^a)`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & regex(^a)
└─ regex(^a)
   └─ Invalid value "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & regex(^a)
└─ regex(^a)
   └─ Invalid value "b"`
        )
      })

      it("startsWith", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaFilter.startsWith("a")))

        strictEqual(SchemaAST.format(schema.ast), `string & startsWith("a")`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & startsWith("a")
└─ startsWith("a")
   └─ Invalid value "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & startsWith("a")
└─ startsWith("a")
   └─ Invalid value "b"`
        )
      })

      it("endsWith", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaFilter.endsWith("a")))

        strictEqual(SchemaAST.format(schema.ast), `string & endsWith("a")`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & endsWith("a")
└─ endsWith("a")
   └─ Invalid value "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & endsWith("a")
└─ endsWith("a")
   └─ Invalid value "b"`
        )
      })

      it("lowercased", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaFilter.lowercased))

        strictEqual(SchemaAST.format(schema.ast), `string & lowercased`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "A",
          `string & lowercased
└─ lowercased
   └─ Invalid value "A"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "A",
          `string & lowercased
└─ lowercased
   └─ Invalid value "A"`
        )
      })

      it("uppercased", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaFilter.uppercased))

        strictEqual(SchemaAST.format(schema.ast), `string & uppercased`)

        await assertions.decoding.succeed(schema, "A")
        await assertions.decoding.fail(
          schema,
          "a",
          `string & uppercased
└─ uppercased
   └─ Invalid value "a"`
        )

        await assertions.encoding.succeed(schema, "A")
        await assertions.encoding.fail(
          schema,
          "a",
          `string & uppercased
└─ uppercased
   └─ Invalid value "a"`
        )
      })

      it("trimmed", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaFilter.trimmed))

        strictEqual(SchemaAST.format(schema.ast), `string & trimmed`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          " a ",
          `string & trimmed
└─ trimmed
   └─ Invalid value " a "`
        )
      })

      it("minLength", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaFilter.minLength(1)))

        strictEqual(SchemaAST.format(schema.ast), `string & minLength(1)`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "",
          `string & minLength(1)
└─ minLength(1)
   └─ Invalid value ""`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "",
          `string & minLength(1)
└─ minLength(1)
   └─ Invalid value ""`
        )
      })
    })

    describe("Number filters", () => {
      it("greaterThan", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaFilter.greaterThan(1)))

        strictEqual(SchemaAST.format(schema.ast), `number & greaterThan(1)`)

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          1,
          `number & greaterThan(1)
└─ greaterThan(1)
   └─ Invalid value 1`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          1,
          `number & greaterThan(1)
└─ greaterThan(1)
   └─ Invalid value 1`
        )
      })

      it("between", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaFilter.between(1, 3)))

        strictEqual(SchemaAST.format(schema.ast), `number & between(1, 3)`)

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          0,
          `number & between(1, 3)
└─ between(1, 3)
   └─ Invalid value 0`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          0,
          `number & between(1, 3)
└─ between(1, 3)
   └─ Invalid value 0`
        )
      })
    })

    it("int", async () => {
      const schema = Schema.Number.pipe(Schema.check(SchemaFilter.int))

      strictEqual(SchemaAST.format(schema.ast), `number & int`)

      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        1.1,
        `number & int
└─ int
   └─ Invalid value 1.1`
      )

      await assertions.encoding.succeed(schema, 1)
      await assertions.encoding.fail(
        schema,
        1.1,
        `number & int
└─ int
   └─ Invalid value 1.1`
      )
    })

    it("int32", async () => {
      const schema = Schema.Number.pipe(Schema.check(SchemaFilter.int32))

      strictEqual(SchemaAST.format(schema.ast), `number & int32`)

      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        1.1,
        `number & int32
└─ int
   └─ Invalid value 1.1`
      )
      await assertions.decoding.fail(
        schema,
        Number.MAX_SAFE_INTEGER + 1,
        `number & int32
├─ int
│  └─ Invalid value 9007199254740992
└─ between(-2147483648, 2147483647)
   └─ Invalid value 9007199254740992`
      )

      await assertions.encoding.succeed(schema, 1)
      await assertions.encoding.fail(
        schema,
        1.1,
        `number & int32
└─ int
   └─ Invalid value 1.1`
      )
      await assertions.encoding.fail(
        schema,
        Number.MAX_SAFE_INTEGER + 1,
        `number & int32
├─ int
│  └─ Invalid value 9007199254740992
└─ between(-2147483648, 2147483647)
   └─ Invalid value 9007199254740992`
      )
    })
  })

  describe("Transformations", () => {
    it("annotations on both sides", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          new SchemaTransformation.Transformation(
            SchemaParser.fail((o) => new SchemaIssue.InvalidIssue(o, "err decoding")),
            SchemaParser.fail((o) => new SchemaIssue.InvalidIssue(o, "err encoding"))
          )
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.decoding.fail(
        schema,
        "a",
        `string <-> string
└─ <parser>
   └─ err decoding`
      )

      await assertions.encoding.fail(
        schema,
        "a",
        `string <-> string
└─ <parser>
   └─ err encoding`
      )
    })

    describe("String transformations", () => {
      it("trim", async () => {
        const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.trim))

        strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.succeed(schema, " a", { expected: "a" })
        await assertions.decoding.succeed(schema, "a ", { expected: "a" })
        await assertions.decoding.succeed(schema, " a ", { expected: "a" })

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.succeed(schema, " a ")
      })
    })

    it("NumberToString", async () => {
      const schema = FiniteFromString

      strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string`)

      await assertions.decoding.succeed(schema, "1", { expected: 1 })
      await assertions.decoding.fail(
        schema,
        "a",
        `number & finite <-> string
└─ finite
   └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, 1, { expected: "1" })
      await assertions.encoding.fail(
        schema,
        "a" as any,
        `string <-> number & finite
└─ Expected number & finite, actual "a"`
      )
    })

    it("NumberToString & greaterThan", async () => {
      const schema = FiniteFromString.pipe(Schema.check(SchemaFilter.greaterThan(2)))

      strictEqual(SchemaAST.format(schema.ast), `number & finite & greaterThan(2) <-> string`)

      await assertions.decoding.succeed(schema, "3", { expected: 3 })
      await assertions.decoding.fail(
        schema,
        "1",
        `number & finite & greaterThan(2) <-> string
└─ greaterThan(2)
   └─ Invalid value 1`
      )

      await assertions.encoding.succeed(schema, 3, { expected: "3" })
      await assertions.encoding.fail(
        schema,
        1,
        `string <-> number & finite & greaterThan(2)
└─ number & finite & greaterThan(2)
   └─ greaterThan(2)
      └─ Invalid value 1`
      )
    })
  })

  describe("decodeTo", () => {
    it("should expose the source and the target schemas", () => {
      const schema = FiniteFromString

      strictEqual(schema.from, Schema.String)
      strictEqual(schema.to, Schema.Finite)
    })

    it("transformation with filters", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          FiniteFromString,
          SchemaTransformation.trim
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string`)
    })

    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.String,
            SchemaTransformation.identity()
          )
        )
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string <-> string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a": string <-> string }
└─ ["a"]
   └─ Missing value`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a": string <-> string }
└─ ["a"]
   └─ Missing value`
      )
    })

    it("required to optional", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.optionalKey(Schema.String),
            SchemaTransformation.withEncodingDefault(() => "default")
          )
        )
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: string <-> string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ required
         └─ Missing value`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { expected: { a: "default" } })
    })

    it("optional to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.decodeTo(
            Schema.String,
            SchemaTransformation.withDecodingDefault(() => "default")
          )
        )
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string <-> readonly ?: string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { expected: { a: "default" } })

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ required
         └─ Missing value`
      )
    })

    it("double transformation", async () => {
      const schema = Trim.pipe(Schema.decodeTo(
        FiniteFromString,
        SchemaTransformation.identity()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with filters", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.check(SchemaFilter.minLength(2))).pipe(
          Schema.decodeTo(
            Schema.String.pipe(Schema.check(SchemaFilter.minLength(3))),
            SchemaTransformation.identity()
          ),
          Schema.decodeTo(
            Schema.String,
            SchemaTransformation.identity()
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "aaa" })
      await assertions.decoding.fail(
        schema,
        { a: "aa" },
        `{ readonly "a": string <-> string & minLength(2) }
└─ ["a"]
   └─ string <-> string & minLength(2)
      └─ string & minLength(3) <-> string & minLength(2)
         └─ minLength(3)
            └─ Invalid value "aa"`
      )

      await assertions.encoding.succeed(schema, { a: "aaa" })
      await assertions.encoding.fail(
        schema,
        { a: "aa" },
        `{ readonly "a": string & minLength(2) <-> string }
└─ ["a"]
   └─ string & minLength(2) <-> string
      └─ string & minLength(3)
         └─ minLength(3)
            └─ Invalid value "aa"`
      )
    })

    it("nested defaults", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.Struct({
          b: Schema.optionalKey(Schema.String)
        })).pipe(Schema.decodeTo(
          Schema.Struct({
            b: Schema.optionalKey(Schema.String).pipe(
              Schema.decodeTo(Schema.String, SchemaTransformation.withDecodingDefault(() => "default-b"))
            )
          }),
          SchemaTransformation.withDecodingDefault(() => ({}))
        ))
      })

      await assertions.decoding.succeed(schema, { a: { b: "b" } })
      await assertions.decoding.succeed(schema, { a: {} }, { expected: { a: { b: "default-b" } } })
      await assertions.decoding.succeed(schema, {}, { expected: { a: { b: "default-b" } } })
    })
  })

  describe("encodeTo", () => {
    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String,
            SchemaTransformation.identity()
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a": string <-> string }
└─ ["a"]
   └─ Missing value`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a": string <-> string }
└─ ["a"]
   └─ Missing value`
      )
    })

    it("required to optional", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.String),
            SchemaTransformation.withDecodingDefault(() => "default")
          )
        )
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string <-> readonly ?: string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { expected: { a: "default" } })

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ required
         └─ Missing value`
      )
    })

    it("optional to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.encodeTo(
            Schema.String,
            SchemaTransformation.withEncodingDefault(() => "default")
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ required
         └─ Missing value`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { expected: { a: "default" } })
    })

    it("double transformation", async () => {
      const schema = FiniteFromString.pipe(Schema.encodeTo(
        Trim,
        SchemaTransformation.identity()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with filters", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String.pipe(Schema.check(SchemaFilter.minLength(3))),
            SchemaTransformation.identity()
          ),
          Schema.encodeTo(
            Schema.String.pipe(Schema.check(SchemaFilter.minLength(2))),
            SchemaTransformation.identity()
          )
        )
      })
      await assertions.decoding.succeed(schema, { a: "aaa" })
      await assertions.decoding.fail(
        schema,
        { a: "aa" },
        `{ readonly "a": string <-> string & minLength(2) }
└─ ["a"]
   └─ string <-> string & minLength(2)
      └─ string & minLength(3)
         └─ minLength(3)
            └─ Invalid value "aa"`
      )

      await assertions.encoding.succeed(schema, { a: "aaa" })
      await assertions.encoding.fail(
        schema,
        { a: "aa" },
        `{ readonly "a": string & minLength(2) <-> string }
└─ ["a"]
   └─ string & minLength(2) <-> string
      └─ string & minLength(3)
         └─ minLength(3)
            └─ Invalid value "aa"`
      )
    })
  })

  describe("flip", () => {
    it("string & minLength(3) <-> number & greaterThan(2)", async () => {
      const schema = FiniteFromString.pipe(
        Schema.check(SchemaFilter.greaterThan(2)),
        Schema.flip,
        Schema.check(SchemaFilter.minLength(3))
      )

      await assertions.encoding.succeed(schema, "123", { expected: 123 })

      await assertions.decoding.fail(
        schema,
        2,
        `string & minLength(3) <-> number & finite & greaterThan(2)
└─ number & finite & greaterThan(2)
   └─ greaterThan(2)
      └─ Invalid value 2`
      )
      await assertions.decoding.fail(
        schema,
        3,
        `string & minLength(3) <-> number & finite & greaterThan(2)
└─ minLength(3)
   └─ Invalid value "3"`
      )
    })

    it("setConstructorDefault", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.setConstructorDefault(() => Result.succeedSome(-1)))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })

      const flipped = schema.pipe(Schema.flip)
      throws(() => flipped.makeUnsafe({} as any))
      assertions.makeUnsafe.succeed(flipped, { a: "1" })

      const flipped2 = flipped.pipe(Schema.flip)
      deepStrictEqual(flipped2.fields, schema.fields)
      assertions.makeUnsafe.succeed(flipped2, { a: 1 })
      assertions.makeUnsafe.succeed(flipped2, {}, { a: -1 })
    })
  })

  it("declareRefinement", async () => {
    const schema = Schema.declareRefinement({
      is: (u) => u instanceof File,
      annotations: {
        title: "File"
      }
    })

    await assertions.decoding.succeed(schema, new File([], "a.txt"))
    await assertions.decoding.fail(schema, "a", `Expected File, actual "a"`)
  })

  describe("Option", () => {
    it("Option(FiniteFromString)", async () => {
      const schema = Schema.Option(FiniteFromString)

      await assertions.decoding.succeed(schema, Option.none())
      await assertions.decoding.succeed(schema, Option.some("123"), { expected: Option.some(123) })
      await assertions.decoding.fail(schema, null, `Expected Option<number & finite <-> string>, actual null`)
      await assertions.decoding.fail(
        schema,
        Option.some(null),
        `Option<number & finite <-> string>
└─ number & finite <-> string
   └─ Expected string, actual null`
      )

      await assertions.encoding.succeed(schema, Option.none())
      await assertions.encoding.succeed(schema, Option.some(123), { expected: Option.some("123") })
      await assertions.encoding.fail(schema, null, `Expected Option<string <-> number & finite>, actual null`)
      await assertions.encoding.fail(
        schema,
        Option.some(null) as any,
        `Option<string <-> number & finite>
└─ string <-> number & finite
   └─ Expected number & finite, actual null`
      )
    })
  })

  describe("suspend", () => {
    it("should work", async () => {
      interface Category<A, T> {
        readonly a: A
        readonly categories: ReadonlyArray<T>
      }
      interface CategoryType extends Category<number, CategoryType> {}
      interface CategoryEncoded extends Category<string, CategoryEncoded> {}

      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.check(SchemaFilter.greaterThan(0))),
        categories: Schema.ReadonlyArray(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
      })

      await assertions.decoding.succeed(schema, { a: "1", categories: [] }, { expected: { a: 1, categories: [] } })
      await assertions.decoding.succeed(schema, { a: "1", categories: [{ a: "2", categories: [] }] }, {
        expected: { a: 1, categories: [{ a: 2, categories: [] }] }
      })
      await assertions.decoding.fail(
        schema,
        {
          a: "1",
          categories: [{ a: "a", categories: [] }]
        },
        `{ readonly "a": number & finite & greaterThan(0) <-> string; readonly "categories": ReadonlyArray<#> }
└─ ["categories"]
   └─ ReadonlyArray<#>
      └─ [0]
         └─ { readonly "a": number & finite & greaterThan(0) <-> string; readonly "categories": ReadonlyArray<#> }
            └─ ["a"]
               └─ number & finite & greaterThan(0) <-> string
                  └─ finite
                     └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, { a: 1, categories: [] }, { expected: { a: "1", categories: [] } })
      await assertions.encoding.succeed(schema, { a: 1, categories: [{ a: 2, categories: [] }] }, {
        expected: { a: "1", categories: [{ a: "2", categories: [] }] }
      })
      await assertions.encoding.fail(
        schema,
        { a: 1, categories: [{ a: -1, categories: [] }] },
        `{ readonly "a": string <-> number & finite & greaterThan(0); readonly "categories": ReadonlyArray<#> }
└─ ["categories"]
   └─ ReadonlyArray<#>
      └─ [0]
         └─ { readonly "a": string <-> number & finite & greaterThan(0); readonly "categories": ReadonlyArray<#> }
            └─ ["a"]
               └─ string <-> number & finite & greaterThan(0)
                  └─ number & finite & greaterThan(0)
                     └─ greaterThan(0)
                        └─ Invalid value -1`
      )
    })
  })

  describe("setConstructorDefault", () => {
    it("by default should not apply defaults when decoding / encoding", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optionalKey, Schema.setConstructorDefault(() => Result.succeedSome("a")))
      })

      await assertions.decoding.succeed(schema, {})
      await assertions.encoding.succeed(schema, {}, {})
    })

    it("Struct & Some", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.setConstructorDefault(() => Result.succeedSome(-1)))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })
    })

    it("nested defaults", () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: FiniteFromString.pipe(Schema.setConstructorDefault(() => Result.succeedSome(-1)))
        }).pipe(Schema.setConstructorDefault(() => Result.succeedSome({})))
      })

      assertions.makeUnsafe.succeed(schema, { a: { b: 1 } })
      assertions.makeUnsafe.succeed(schema, {}, { a: { b: -1 } })
    })

    it("Struct & Effect sync", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.setConstructorDefault(() => Effect.succeed(Option.some(-1))))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })
    })

    it("Struct & Effect async", async () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.setConstructorDefault(() =>
          Effect.gen(function*() {
            yield* Effect.sleep(100)
            return Option.some(-1)
          })
        ))
      })

      await assertions.make.succeed(schema, { a: 1 })
      await assertions.make.succeed(schema, {}, { a: -1 })
    })

    it("Struct & Effect async & service", async () => {
      class Service extends Context.Tag<Service, { value: Effect.Effect<number> }>()("Service") {}

      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.setConstructorDefault(() =>
          Effect.gen(function*() {
            yield* Effect.sleep(100)
            const oservice = yield* Effect.serviceOption(Service)
            if (Option.isNone(oservice)) {
              return Option.none()
            }
            return Option.some(yield* oservice.value.value)
          })
        ))
      })

      await assertions.make.succeed(schema, { a: 1 })
      const spr = schema.make({})
      const eff = SchemaResult.asEffect(spr)
      const provided = Effect.provideService(
        eff,
        Service,
        Service.of({ value: Effect.succeed(-1) })
      )
      await assertions.effect.succeed(provided, { a: -1 })
    })
  })

  describe("ReadonlyRecord", () => {
    it("ReadonlyRecord(String, Number)", async () => {
      const schema = Schema.ReadonlyRecord(Schema.String, Schema.Number)

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string]: number }`)

      await assertions.make.succeed(schema, { a: 1 })
      await assertions.make.fail(schema, null as any, `Expected { readonly [x: string]: number }, actual null`)
      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.fail(schema, null as any, `Expected { readonly [x: string]: number }, actual null`)

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.fail(schema, null, "Expected { readonly [x: string]: number }, actual null")
      await assertions.decoding.fail(
        schema,
        { a: "b" },
        `{ readonly [x: string]: number }
└─ ["a"]
   └─ Expected number, actual "b"`
      )

      await assertions.encoding.succeed(schema, { a: 1 })
      await assertions.encoding.fail(
        schema,
        { a: "b" } as any,
        `{ readonly [x: string]: number }
└─ ["a"]
   └─ Expected number, actual "b"`
      )
      await assertions.encoding.fail(schema, null as any, "Expected { readonly [x: string]: number }, actual null")
    })

    it("ReadonlyRecord(SnakeToCamel, NumberFromString)", async () => {
      const schema = Schema.ReadonlyRecord(SnakeToCamel, NumberFromString)

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string <-> string]: number <-> string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1" }, { expected: { aB: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1", aB: "2" }, { expected: { aB: 2 } })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, { aB: 1 }, { expected: { a_b: "1" } })
      await assertions.encoding.succeed(schema, { a_b: 1, aB: 2 }, { expected: { a_b: "2" } })
    })

    it("ReadonlyRecord(SnakeToCamel, Number, { key: ... })", async () => {
      const schema = Schema.ReadonlyRecord(SnakeToCamel, NumberFromString, {
        key: {
          decode: {
            combine: ([_, v1], [k2, v2]) => [k2, v1 + v2]
          },
          encode: {
            combine: ([_, v1], [k2, v2]) => [k2, v1 + v2]
          }
        }
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string <-> string]: number <-> string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1" }, { expected: { aB: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1", aB: "2" }, { expected: { aB: 3 } })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, { aB: 1 }, { expected: { a_b: "1" } })
      await assertions.encoding.succeed(schema, { a_b: 1, aB: 2 }, { expected: { a_b: "12" } })
    })
  })

  describe("Union", () => {
    it("empty", async () => {
      const schema = Schema.Union([])

      strictEqual(SchemaAST.format(schema.ast), `never`)

      await assertions.decoding.fail(schema, null, `Expected never, actual null`)
    })

    it(`string`, async () => {
      const schema = Schema.Union([Schema.String])

      strictEqual(SchemaAST.format(schema.ast), `string`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, null, `Expected string, actual null`)
    })

    it(`string | number`, async () => {
      const schema = Schema.Union([Schema.String, Schema.Number])

      strictEqual(SchemaAST.format(schema.ast), `string | number`)

      deepStrictEqual(schema.members, [Schema.String, Schema.Number])

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        null,
        `Expected string | number, actual null`
      )
    })

    it(`string & minLength(1) | number & greaterThan(0)`, async () => {
      const schema = Schema.Union([
        Schema.NonEmptyString,
        Schema.Number.pipe(Schema.check(SchemaFilter.greaterThan(0)))
      ])

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) | number & greaterThan(0)`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1)
└─ minLength(1)
   └─ Invalid value ""`
      )
      await assertions.decoding.fail(
        schema,
        -1,
        `number & greaterThan(0)
└─ greaterThan(0)
   └─ Invalid value -1`
      )
    })
  })

  describe("StructAndRest", () => {
    it("StructAndRest(Struct, [ReadonlyRecord(String, Number)])", async () => {
      const schema = Schema.StructAndRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.ReadonlyRecord(Schema.String, Schema.Number)]
      )

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": number; readonly [x: string]: number }`)

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, b: 2 })
      await assertions.decoding.fail(
        schema,
        { a: 1, b: "" },
        `{ readonly "a": number; readonly [x: string]: number }
└─ ["b"]
   └─ Expected number, actual ""`
      )
    })
  })

  describe("NullOr", () => {
    it("NullOr(String)", async () => {
      const schema = Schema.NullOr(Schema.NonEmptyString)

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) | null`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null)
      await assertions.decoding.fail(schema, undefined, `Expected string & minLength(1) | null, actual undefined`)
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1)
└─ minLength(1)
   └─ Invalid value ""`
      )
    })
  })

  describe("UndefinedOr", () => {
    it("UndefinedOr(String)", async () => {
      const schema = Schema.UndefinedOr(Schema.NonEmptyString)

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) | undefined`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, undefined)
      await assertions.decoding.fail(schema, null, `Expected string & minLength(1) | undefined, actual null`)
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1)
└─ minLength(1)
   └─ Invalid value ""`
      )
    })
  })

  describe("catch", () => {
    it("ok", async () => {
      const fallback = Effect.succeed(Option.some("b"))
      const schema = Schema.String.pipe(Schema.catch(() => fallback))

      strictEqual(SchemaAST.format(schema.ast), `string`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
    })

    it("effect", async () => {
      const fallback = Effect.succeed(Option.some("b")).pipe(Effect.delay(100))
      const schema = Schema.String.pipe(Schema.catch(() => fallback))

      strictEqual(SchemaAST.format(schema.ast), `string`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
    })
  })

  describe("decodeMiddleware", () => {
    it("providing a service", async () => {
      class Service extends Context.Tag<Service, { value: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          new SchemaTransformation.Transformation(
            SchemaParser.parseSome((s) =>
              Effect.gen(function*() {
                const service = yield* Service
                return Option.some(s + (yield* service.value))
              })
            ),
            SchemaParser.identity()
          )
        ),
        Schema.decodeMiddleware(
          SchemaMiddleware.onEffect(
            Effect.provideService(Service, { value: Effect.succeed("b") }),
            { title: "Service provider" }
          )
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.decoding.succeed(schema, "a", { expected: "ab" })
    })

    it("forced failure", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeMiddleware(
          SchemaMiddleware.fail("my message", { title: "my middleware" })
        )
      )

      await assertions.decoding.fail(
        schema,
        "a",
        `my middleware
└─ my message`
      )
    })
  })

  it("Date", async () => {
    const schema = Schema.Date

    strictEqual(SchemaAST.format(schema.ast), `Date`)

    await assertions.decoding.succeed(schema, new Date("2021-01-01"))
    await assertions.decoding.fail(schema, null, `Expected Date, actual null`)
    await assertions.decoding.fail(schema, 0, `Expected Date, actual 0`)
  })

  it("Map", async () => {
    const schema = Schema.Map(Schema.String, Schema.Number)

    strictEqual(SchemaAST.format(schema.ast), `Map<string, number>`)

    await assertions.decoding.succeed(schema, new Map([["a", 1]]))
    await assertions.decoding.fail(schema, null, `Expected Map<string, number>, actual null`)
    await assertions.decoding.fail(
      schema,
      new Map([["a", "b"]]),
      `Map<string, number>
└─ ReadonlyArray<readonly [string, number]>
   └─ [0]
      └─ readonly [string, number]
         └─ [1]
            └─ Expected number, actual "b"`
    )
    await assertions.encoding.succeed(schema, new Map([["a", 1]]))
  })

  describe("Transformations", () => {
    it("toLowerCase", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          SchemaTransformation.toLowerCase
        )
      )

      await assertions.decoding.succeed(schema, "A", { expected: "a" })
      await assertions.decoding.succeed(schema, "B", { expected: "b" })
    })

    it("toUpperCase", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(Schema.String, SchemaTransformation.toUpperCase)
      )

      await assertions.decoding.succeed(schema, "a", { expected: "A" })
      await assertions.decoding.succeed(schema, "b", { expected: "B" })
    })
  })

  describe("Opaque", () => {
    it("Struct", () => {
      class A extends Schema.Opaque<A>()(Schema.Struct({ a: Schema.String })) {}

      const schema = A

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string }`)

      const instance = schema.makeUnsafe({ a: "a" })
      strictEqual(instance.a, "a")
      deepStrictEqual(A.fields, { a: Schema.String })
    })
  })

  describe("instanceOf", () => {
    it("arg: message: string", async () => {
      class MyError extends Error {
        constructor(message?: string) {
          super(message)
          this.name = "MyError"
          Object.setPrototypeOf(this, MyError.prototype)
        }
      }

      const schema = Schema.instanceOf({
        constructor: MyError,
        serialization: {
          json: {
            to: Schema.String,
            encode: (e) => e.message,
            decode: (message) => new MyError(message)
          }
        },
        annotations: { title: "MyError" }
      })

      strictEqual(SchemaAST.format(schema.ast), `MyError`)

      await assertions.decoding.succeed(schema, new MyError("a"))
      await assertions.decoding.fail(schema, null, `Expected MyError, actual null`)

      await assertions.encoding.succeed(schema, new MyError("a"))
      await assertions.encoding.fail(schema, null, `Expected MyError, actual null`)
    })
  })

  describe("tag", () => {
    it("decoding: required & encoding: required & constructor: required", async () => {
      const schema = Schema.Struct({
        _tag: Schema.Literal("a"),
        a: FiniteFromString
      })

      await assertions.decoding.succeed(schema, { _tag: "a", a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.encoding.succeed(schema, { _tag: "a", a: 1 }, { expected: { _tag: "a", a: "1" } })
      assertions.makeUnsafe.succeed(schema, { _tag: "a", a: 1 })
    })

    it("decoding: required & encoding: required & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a"),
        a: FiniteFromString
      })

      await assertions.decoding.succeed(schema, { _tag: "a", a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.encoding.succeed(schema, { _tag: "a", a: 1 }, { expected: { _tag: "a", a: "1" } })
      assertions.makeUnsafe.succeed(schema, { _tag: "a", a: 1 })
      assertions.makeUnsafe.succeed(schema, { a: 1 }, { _tag: "a", a: 1 })
    })

    it("decoding: default & encoding: never & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a").pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.Literal("a")),
            new SchemaTransformation.Transformation(
              SchemaParser.withDefault(() => "a" as const),
              SchemaParser.omit()
            )
          )
        ),
        a: FiniteFromString
      })

      await assertions.decoding.succeed(schema, { _tag: "a", a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.encoding.succeed(schema, { _tag: "a", a: 1 }, { expected: { a: "1" } })
      assertions.makeUnsafe.succeed(schema, { _tag: "a", a: 1 })
      assertions.makeUnsafe.succeed(schema, { a: 1 }, { _tag: "a", a: 1 })
    })
  })

  describe("UnknownFromJsonString", () => {
    it("use case: Unknown <-> JSON string", async () => {
      const schema = Schema.UnknownFromJsonString

      await assertions.decoding.succeed(schema, `{"a":1}`, { expected: { a: 1 } })
      await assertions.decoding.fail(
        schema,
        `{"a"`,
        `unknown <-> string
└─ parseJson
   └─ Expected ':' after property name in JSON at position 4 (line 1 column 5)`
      )

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: `{"a":1}` })
    })

    it("use case: create a JSON string serializer for an existing schema", async () => {
      const schema = Schema.Struct({ b: Schema.Number })

      const jsonSerializer = schema.pipe(
        Schema.encodeTo(
          Schema.UnknownFromJsonString,
          SchemaTransformation.composeSubtype()
        )
      )

      await assertions.decoding.succeed(jsonSerializer, `{"b":1}`, { expected: { b: 1 } })
      await assertions.decoding.fail(
        jsonSerializer,
        `{"a":null}`,
        `{ readonly "b": number } <-> string
└─ ["b"]
   └─ Missing value`
      )
    })

    it("use case: parse / stringify a nested schema", async () => {
      const schema = Schema.Struct({
        a: Schema.UnknownFromJsonString.pipe(
          Schema.decodeTo(
            Schema.Struct({ b: Schema.Number }),
            SchemaTransformation.composeSubtype()
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: `{"b":2}` }, { expected: { a: { b: 2 } } })
      await assertions.decoding.fail(
        schema,
        { a: `{"a":null}` },
        `{ readonly "a": { readonly "b": number } <-> string }
└─ ["a"]
   └─ { readonly "b": number } <-> string
      └─ ["b"]
         └─ Missing value`
      )
    })
  })

  it("transformOrFail", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String,
        SchemaTransformation.transformOrFail(
          (s) =>
            s === "a"
              ? SchemaResult.fail(new SchemaIssue.ForbiddenIssue(Option.some(s), "not a"))
              : SchemaResult.succeedSome(s),
          (s) =>
            s === "b"
              ? SchemaResult.fail(new SchemaIssue.ForbiddenIssue(Option.some(s), "not b"))
              : SchemaResult.succeedSome(s)
        )
      )
    )

    await assertions.decoding.succeed(schema, "b")
    await assertions.decoding.fail(
      schema,
      "a",
      `string <-> string
└─ transformOrFail
   └─ not a`
    )

    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(
      schema,
      "b",
      `string <-> string
└─ transformOrFail
   └─ not b`
    )
  })

  describe("TemplateLiteral", () => {
    it(`"a"`, async () => {
      const schema = Schema.TemplateLiteral("a")

      strictEqual(SchemaAST.format(schema.ast), "`a`")

      await assertions.decoding.succeed(schema, "a")

      await assertions.decoding.fail(schema, "ab", `Expected \`a\`, actual "ab"`)
      await assertions.decoding.fail(schema, "", `Expected \`a\`, actual ""`)
      await assertions.decoding.fail(schema, null, `Expected \`a\`, actual null`)
    })

    it(`"a b"`, async () => {
      const schema = Schema.TemplateLiteral("a", " ", "b")

      await assertions.decoding.succeed(schema, "a b")

      await assertions.decoding.fail(schema, "a  b", `Expected \`a b\`, actual "a  b"`)
    })

    it(`"[" + string + "]"`, async () => {
      const schema = Schema.TemplateLiteral("[", Schema.String, "]")

      await assertions.decoding.succeed(schema, "[a]")

      await assertions.decoding.fail(schema, "a", "Expected `[${string}]`, actual \"a\"")
    })

    it(`"a" + string`, async () => {
      const schema = Schema.TemplateLiteral("a", Schema.String)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, "ab")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${string}`, actual null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${string}`, actual \"\""
      )
    })

    it(`"a" + number`, async () => {
      const schema = Schema.TemplateLiteral("a", Schema.Number)

      await assertions.decoding.succeed(schema, "a1")
      await assertions.decoding.succeed(schema, "a1.2")

      await assertions.decoding.succeed(schema, "a-1.401298464324817e-45")
      await assertions.decoding.succeed(schema, "a1.401298464324817e-45")
      await assertions.decoding.succeed(schema, "a+1.401298464324817e-45")
      await assertions.decoding.succeed(schema, "a-1.401298464324817e+45")
      await assertions.decoding.succeed(schema, "a1.401298464324817e+45")
      await assertions.decoding.succeed(schema, "a+1.401298464324817e+45")

      await assertions.decoding.succeed(schema, "a-1.401298464324817E-45")
      await assertions.decoding.succeed(schema, "a1.401298464324817E-45")
      await assertions.decoding.succeed(schema, "a+1.401298464324817E-45")
      await assertions.decoding.succeed(schema, "a-1.401298464324817E+45")
      await assertions.decoding.succeed(schema, "a1.401298464324817E+45")
      await assertions.decoding.succeed(schema, "a+1.401298464324817E+45")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${number}`, actual null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${number}`, actual \"\""
      )
      await assertions.decoding.fail(
        schema,
        "aa",
        "Expected `a${number}`, actual \"aa\""
      )
    })

    it(`string`, async () => {
      const schema = Schema.TemplateLiteral(Schema.String)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, "ab")
      await assertions.decoding.succeed(schema, "")
      await assertions.decoding.succeed(schema, "\n")
      await assertions.decoding.succeed(schema, "\r")
      await assertions.decoding.succeed(schema, "\r\n")
      await assertions.decoding.succeed(schema, "\t")
    })

    it(`\\n + string`, async () => {
      const schema = Schema.TemplateLiteral("\n", Schema.String)

      await assertions.decoding.succeed(schema, "\n")
      await assertions.decoding.succeed(schema, "\na")
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `\n${string}`, actual \"a\""
      )
    })

    it(`a\\nb  + string`, async () => {
      const schema = Schema.TemplateLiteral("a\nb ", Schema.String)

      await assertions.decoding.succeed(schema, "a\nb ")
      await assertions.decoding.succeed(schema, "a\nb c")
    })

    it(`"a" + string + "b"`, async () => {
      const schema = Schema.TemplateLiteral("a", Schema.String, "b")

      await assertions.decoding.succeed(schema, "ab")
      await assertions.decoding.succeed(schema, "acb")
      await assertions.decoding.succeed(schema, "abb")
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${string}b`, actual \"\""
      )
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `a${string}b`, actual \"a\""
      )
      await assertions.decoding.fail(
        schema,
        "b",
        "Expected `a${string}b`, actual \"b\""
      )
      await assertions.encoding.succeed(schema, "acb")
    })

    it(`"a" + string + "b" + string`, async () => {
      const schema = Schema.TemplateLiteral("a", Schema.String, "b", Schema.String)

      await assertions.decoding.succeed(schema, "ab")
      await assertions.decoding.succeed(schema, "acb")
      await assertions.decoding.succeed(schema, "acbd")

      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `a${string}b${string}`, actual \"a\""
      )
      await assertions.decoding.fail(
        schema,
        "b",
        "Expected `a${string}b${string}`, actual \"b\""
      )
    })

    it("https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html", async () => {
      const EmailLocaleIDs = Schema.Literals(["welcome_email", "email_heading"])
      const FooterLocaleIDs = Schema.Literals(["footer_title", "footer_sendoff"])
      const schema = Schema.TemplateLiteral(Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), "_id")

      await assertions.decoding.succeed(schema, "welcome_email_id")
      await assertions.decoding.succeed(schema, "email_heading_id")
      await assertions.decoding.succeed(schema, "footer_title_id")
      await assertions.decoding.succeed(schema, "footer_sendoff_id")

      await assertions.decoding.fail(
        schema,
        "_id",
        `Expected \`\${"welcome_email" | "email_heading" | "footer_title" | "footer_sendoff"}_id\`, actual "_id"`
      )
    })

    it(`string + 0`, async () => {
      const schema = Schema.TemplateLiteral(Schema.String, 0)

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.fail(schema, "a", "Expected `${string}0`, actual \"a\"")
    })

    it(`string + true`, async () => {
      const schema = Schema.TemplateLiteral(Schema.String, true)

      await assertions.decoding.succeed(schema, "atrue")
      await assertions.decoding.fail(schema, "a", "Expected `${string}true`, actual \"a\"")
    })

    it(`string + 1n`, async () => {
      const schema = Schema.TemplateLiteral(Schema.String, 1n)

      await assertions.decoding.succeed(schema, "a1")
      await assertions.decoding.fail(schema, "a", "Expected `${string}1`, actual \"a\"")
    })

    it(`string + ("a" | 0)`, async () => {
      const schema = Schema.TemplateLiteral(Schema.String, Schema.Literals(["a", 0]))

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.succeed(schema, "aa")
      await assertions.decoding.fail(
        schema,
        "b",
        `Expected \`\${string}\${"a" | "0"}\`, actual "b"`
      )
    })

    it(`(string | 1) + (number | true)`, async () => {
      const schema = Schema.TemplateLiteral(
        Schema.Union([Schema.String, Schema.Literal(1)]),
        Schema.Union([Schema.Number, Schema.Literal(true)])
      )

      await assertions.decoding.succeed(schema, "atrue")
      await assertions.decoding.succeed(schema, "-2")
      await assertions.decoding.succeed(schema, "10.1")
      await assertions.decoding.fail(
        schema,
        "",
        `Expected \`\${string | "1"}\${number | "true"}\`, actual ""`
      )
    })

    it("`c${`a${string}b` | \"e\"}d`", async () => {
      const schema = Schema.TemplateLiteral(
        "c",
        Schema.Union([Schema.TemplateLiteral("a", Schema.String, "b"), Schema.Literal("e")]),
        "d"
      )

      await assertions.decoding.succeed(schema, "ced")
      await assertions.decoding.succeed(schema, "cabd")
      await assertions.decoding.succeed(schema, "casbd")
      await assertions.decoding.succeed(schema, "ca  bd")
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `c${`a${string}b` | \"e\"}d`, actual \"\""
      )
    })

    it("< + h + (1|2) + >", async () => {
      const schema = Schema.TemplateLiteral("<", Schema.TemplateLiteral("h", Schema.Literals([1, 2])), ">")

      await assertions.decoding.succeed(schema, "<h1>")
      await assertions.decoding.succeed(schema, "<h2>")
      await assertions.decoding.fail(schema, "<h3>", "Expected `<${`h${\"1\" | \"2\"}`}>`, actual \"<h3>\"")
    })
  })
})
