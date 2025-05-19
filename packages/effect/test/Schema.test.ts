import {
  BigInt,
  Context,
  Effect,
  Equal,
  Option,
  Order,
  Predicate,
  Result,
  Schema,
  SchemaAST,
  SchemaCheck,
  SchemaGetter,
  SchemaIssue,
  SchemaParser,
  SchemaResult,
  SchemaTransformation
} from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { assertFalse, assertInclude, assertTrue, deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

const Trim = Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.trim))

const FiniteFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Finite,
    {
      decode: SchemaGetter.Number,
      encode: SchemaGetter.String
    }
  )
)

const SnakeToCamel = Schema.String.pipe(
  Schema.decodeTo(
    Schema.String,
    SchemaTransformation.snakeToCamel
  )
)

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    {
      decode: SchemaGetter.Number,
      encode: SchemaGetter.String
    }
  )
)

describe("Schema", () => {
  it("isSchema", () => {
    class A extends Schema.Class<A>("A")(Schema.Struct({
      a: Schema.String
    })) {}
    class B extends Schema.Opaque<B>()(Schema.Struct({ a: Schema.String })) {}
    assertTrue(Schema.isSchema(Schema.String))
    assertTrue(Schema.isSchema(A))
    assertTrue(Schema.isSchema(B))
    assertFalse(Schema.isSchema({}))
  })

  describe("Literal", () => {
    it(`"a"`, async () => {
      const schema = Schema.Literal("a")

      strictEqual(SchemaAST.format(schema.ast), `"a"`)

      await assertions.make.succeed(schema, "a")
      await assertions.make.fail(schema, null as any, `Expected "a", actual null`)
      assertions.makeSync.succeed(schema, "a")
      assertions.makeSync.fail(schema, null as any, "makeSync failure")

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
    assertions.makeSync.fail(schema, null as never, "makeSync failure")

    strictEqual(SchemaAST.format(schema.ast), `never`)

    await assertions.decoding.fail(schema, "a", `Expected never, actual "a"`)
    await assertions.encoding.fail(schema, "a", `Expected never, actual "a"`)
  })

  it("Unknown", async () => {
    const schema = Schema.Unknown

    strictEqual(SchemaAST.format(schema.ast), `unknown`)

    await assertions.make.succeed(schema, "a")
    assertions.makeSync.succeed(schema, "a")

    await assertions.decoding.succeed(schema, "a")
  })

  it("Null", async () => {
    const schema = Schema.Null

    strictEqual(SchemaAST.format(schema.ast), `null`)

    await assertions.make.succeed(schema, null)
    await assertions.make.fail(schema, undefined as any, `Expected null, actual undefined`)
    assertions.makeSync.succeed(schema, null)
    assertions.makeSync.fail(schema, undefined as any, "makeSync failure")
  })

  it("Undefined", async () => {
    const schema = Schema.Undefined

    strictEqual(SchemaAST.format(schema.ast), `undefined`)

    await assertions.make.succeed(schema, undefined)
    await assertions.make.fail(schema, null as any, `Expected undefined, actual null`)
    assertions.makeSync.succeed(schema, undefined)
    assertions.makeSync.fail(schema, null as any, "makeSync failure")
  })

  it("String", async () => {
    const schema = Schema.String

    strictEqual(SchemaAST.format(schema.ast), `string`)

    await assertions.make.succeed(schema, "a")
    await assertions.make.fail(schema, null as any, `Expected string, actual null`)
    assertions.makeSync.succeed(schema, "a")
    assertions.makeSync.fail(schema, null as any, "makeSync failure")

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
    assertions.makeSync.succeed(schema, 1)
    assertions.makeSync.fail(schema, null as any, "makeSync failure")

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
    assertions.makeSync.succeed(schema, a)
    assertions.makeSync.fail(schema, Symbol("b") as any, "makeSync failure")

    await assertions.decoding.succeed(schema, a)
    await assertions.decoding.fail(schema, Symbol("b"), `Expected Symbol(a), actual Symbol(b)`)
  })

  it("BigInt", async () => {
    const schema = Schema.BigInt

    strictEqual(SchemaAST.format(schema.ast), `bigint`)

    await assertions.make.succeed(schema, 1n)
    await assertions.make.fail(schema, null as any, `Expected bigint, actual null`)
    assertions.makeSync.succeed(schema, 1n)
    assertions.makeSync.fail(schema, null as any, "makeSync failure")

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
      assertions.makeSync.succeed(schema, { a: "a" })
      assertions.makeSync.fail(schema, null as any, "makeSync failure")

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a": string }
└─ ["a"]
   └─ Missing key`
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
   └─ Missing key`
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
│  └─ Missing key
└─ ["b"]
   └─ Missing key`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.decoding.fail(
          schema,
          {},
          `{ readonly "a": string; readonly "b": number }
├─ ["a"]
│  └─ Missing key
└─ ["b"]
   └─ Missing key`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.encoding.fail(
          schema,
          {} as any,
          `{ readonly "a": string; readonly "b": number }
├─ ["a"]
│  └─ Missing key
└─ ["b"]
   └─ Missing key`,
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
         └─ Invalid data NaN`
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
        assertions.makeSync.succeed(schema, { a: "a" })
        assertions.makeSync.succeed(schema, {})

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

      it(`{ readonly "a"?: number <-> readonly ?: string }`, async () => {
        const schema = Schema.Struct({
          a: Schema.NumberFromString.pipe(Schema.optionalKey)
        })

        strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: number <-> readonly ?: string }`)

        await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
        await assertions.decoding.succeed(schema, {})
        await assertions.decoding.fail(
          schema,
          { a: undefined },
          `{ readonly "a"?: number <-> readonly ?: string }
└─ ["a"]
   └─ number <-> readonly ?: string
      └─ Expected string, actual undefined`
        )

        await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
        await assertions.encoding.succeed(schema, {})
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
   └─ Missing key`
        )
        await assertions.decoding.fail(
          schema,
          { a: "a" },
          `{ readonly "a": string; readonly "b": string }
└─ ["b"]
   └─ Missing key`
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

      it("Struct & check", async () => {
        const from = Schema.Struct({
          a: Schema.String
        })
        const schema = from.pipe(
          Schema.check(SchemaCheck.makeFilter(({ a }: { a: string }) => a.length > 0)),
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
   └─ Invalid data {"a":"","b":"b"}`
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

      // should be able to access the elements
      deepStrictEqual(schema.elements, [Schema.NonEmptyString])

      await assertions.make.succeed(schema, ["a"])
      await assertions.make.fail(
        schema,
        [""],
        `readonly [string & minLength(1)]
└─ [0]
   └─ string & minLength(1)
      └─ minLength(1)
         └─ Invalid data ""`
      )
      assertions.makeSync.succeed(schema, ["a"])
      assertions.makeSync.fail(schema, [""], "makeSync failure")

      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.fail(
        schema,
        [],
        `readonly [string & minLength(1)]
└─ [0]
   └─ Missing key`
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
   └─ Missing key`
      )
      await assertions.decoding.fail(
        schema,
        [],
        `readonly [string & minLength(1)]
└─ [0]
   └─ Missing key`
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

      assertions.makeSync.succeed(schema, ["a"])
      assertions.makeSync.succeed(schema, [])

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
      assertions.makeSync.succeed(schema, ["a", "b"])

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

  describe("Checks", () => {
    describe("check", () => {
      it("single check", async () => {
        const schema = Schema.String.pipe(Schema.check(
          SchemaCheck.minLength(3)
        ))

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3)
└─ minLength(3)
   └─ Invalid data "ab"`
        )
      })

      it("multiple checks", async () => {
        const schema = Schema.String.pipe(Schema.check(
          SchemaCheck.minLength(3),
          SchemaCheck.includes("c")
        ))

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3) & includes("c")
└─ minLength(3)
   └─ Invalid data "ab"`
        )
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3) & includes("c")
├─ minLength(3)
│  └─ Invalid data "ab"
└─ includes("c")
   └─ Invalid data "ab"`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("aborting checks", async () => {
        const schema = Schema.String.pipe(Schema.check(
          SchemaCheck.abort(SchemaCheck.minLength(2)),
          SchemaCheck.includes("b")
        ))

        await assertions.decoding.fail(
          schema,
          "a",
          `string & minLength(2) & includes("b")
└─ minLength(2)
   └─ Invalid data "a"`
        )
      })
    })

    describe("checkEncoded", () => {
      it("single check", async () => {
        const schema = FiniteFromString.pipe(
          Schema.checkEncoded(SchemaCheck.minLength(3))
        )

        strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string & minLength(3)`)

        await assertions.encoding.succeed(schema, 123, { expected: "123" })
        await assertions.encoding.fail(
          schema,
          12,
          `string & minLength(3) <-> number & finite
└─ minLength(3)
   └─ Invalid data "12"`
        )
      })

      it("multiple checks", async () => {
        const schema = FiniteFromString.pipe(
          Schema.checkEncoded(SchemaCheck.minLength(3), SchemaCheck.includes("1"))
        )

        strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string & minLength(3) & includes("1")`)

        await assertions.encoding.succeed(schema, 123, { expected: "123" })
        await assertions.encoding.fail(
          schema,
          12,
          `string & minLength(3) & includes("1") <-> number & finite
└─ minLength(3)
   └─ Invalid data "12"`
        )
        await assertions.encoding.fail(
          schema,
          234,
          `string & minLength(3) & includes("1") <-> number & finite
└─ includes("1")
   └─ Invalid data "234"`
        )
      })
    })

    it("refine", async () => {
      const schema = Schema.Option(Schema.String).pipe(
        Schema.refine((os) => Option.isSome(os), { title: "Some" }),
        Schema.check(
          SchemaCheck.makeFilter(({ value }: { value: string }) => value.length > 0, { title: "length > 0" })
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `Option<string> & Some & length > 0`)

      await assertions.decoding.succeed(schema, Option.some("a"))
      await assertions.decoding.fail(
        schema,
        Option.some(""),
        `Option<string> & Some & length > 0
└─ length > 0
   └─ Invalid data {
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

    describe("String checks", () => {
      it("regex", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.regex(/^a/)))

        strictEqual(SchemaAST.format(schema.ast), `string & regex(^a)`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & regex(^a)
└─ regex(^a)
   └─ Invalid data "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & regex(^a)
└─ regex(^a)
   └─ Invalid data "b"`
        )
      })

      it("startsWith", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.startsWith("a")))

        strictEqual(SchemaAST.format(schema.ast), `string & startsWith("a")`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & startsWith("a")
└─ startsWith("a")
   └─ Invalid data "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & startsWith("a")
└─ startsWith("a")
   └─ Invalid data "b"`
        )
      })

      it("endsWith", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.endsWith("a")))

        strictEqual(SchemaAST.format(schema.ast), `string & endsWith("a")`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & endsWith("a")
└─ endsWith("a")
   └─ Invalid data "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & endsWith("a")
└─ endsWith("a")
   └─ Invalid data "b"`
        )
      })

      it("lowercased", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.lowercased))

        strictEqual(SchemaAST.format(schema.ast), `string & lowercased`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "A",
          `string & lowercased
└─ lowercased
   └─ Invalid data "A"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "A",
          `string & lowercased
└─ lowercased
   └─ Invalid data "A"`
        )
      })

      it("uppercased", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.uppercased))

        strictEqual(SchemaAST.format(schema.ast), `string & uppercased`)

        await assertions.decoding.succeed(schema, "A")
        await assertions.decoding.fail(
          schema,
          "a",
          `string & uppercased
└─ uppercased
   └─ Invalid data "a"`
        )

        await assertions.encoding.succeed(schema, "A")
        await assertions.encoding.fail(
          schema,
          "a",
          `string & uppercased
└─ uppercased
   └─ Invalid data "a"`
        )
      })

      it("trimmed", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.trimmed))

        strictEqual(SchemaAST.format(schema.ast), `string & trimmed`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          " a ",
          `string & trimmed
└─ trimmed
   └─ Invalid data " a "`
        )
      })

      it("minLength", async () => {
        const schema = Schema.String.pipe(Schema.check(SchemaCheck.minLength(1)))

        strictEqual(SchemaAST.format(schema.ast), `string & minLength(1)`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "",
          `string & minLength(1)
└─ minLength(1)
   └─ Invalid data ""`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "",
          `string & minLength(1)
└─ minLength(1)
   └─ Invalid data ""`
        )
      })
    })

    describe("Number checks", () => {
      it("greaterThan", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaCheck.greaterThan(1)))

        strictEqual(SchemaAST.format(schema.ast), `number & greaterThan(1)`)

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          1,
          `number & greaterThan(1)
└─ greaterThan(1)
   └─ Invalid data 1`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          1,
          `number & greaterThan(1)
└─ greaterThan(1)
   └─ Invalid data 1`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaCheck.greaterThanOrEqualTo(1)))

        strictEqual(SchemaAST.format(schema.ast), `number & greaterThanOrEqualTo(1)`)

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          0,
          `number & greaterThanOrEqualTo(1)
└─ greaterThanOrEqualTo(1)
   └─ Invalid data 0`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaCheck.lessThan(1)))

        strictEqual(SchemaAST.format(schema.ast), `number & lessThan(1)`)

        await assertions.decoding.succeed(schema, 0)
        await assertions.decoding.fail(
          schema,
          1,
          `number & lessThan(1)
└─ lessThan(1)
   └─ Invalid data 1`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaCheck.lessThanOrEqualTo(1)))

        strictEqual(SchemaAST.format(schema.ast), `number & lessThanOrEqualTo(1)`)

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          2,
          `number & lessThanOrEqualTo(1)
└─ lessThanOrEqualTo(1)
   └─ Invalid data 2`
        )
      })

      it("multipleOf", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaCheck.multipleOf(2)))

        strictEqual(SchemaAST.format(schema.ast), `number & multipleOf(2)`)

        await assertions.decoding.succeed(schema, 4)
        await assertions.decoding.fail(
          schema,
          3,
          `number & multipleOf(2)
└─ multipleOf(2)
   └─ Invalid data 3`
        )
      })

      it("between", async () => {
        const schema = Schema.Number.pipe(Schema.check(SchemaCheck.between(1, 3)))

        strictEqual(SchemaAST.format(schema.ast), `number & between(1, 3)`)

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          0,
          `number & between(1, 3)
└─ between(1, 3)
   └─ Invalid data 0`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          0,
          `number & between(1, 3)
└─ between(1, 3)
   └─ Invalid data 0`
        )
      })
    })

    it("int", async () => {
      const schema = Schema.Number.pipe(Schema.check(SchemaCheck.int))

      strictEqual(SchemaAST.format(schema.ast), `number & int`)

      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        1.1,
        `number & int
└─ int
   └─ Invalid data 1.1`
      )

      await assertions.encoding.succeed(schema, 1)
      await assertions.encoding.fail(
        schema,
        1.1,
        `number & int
└─ int
   └─ Invalid data 1.1`
      )
    })

    it("int32", async () => {
      const schema = Schema.Number.pipe(Schema.check(SchemaCheck.int32))

      strictEqual(SchemaAST.format(schema.ast), `number & int32`)

      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        1.1,
        `number & int32
└─ int
   └─ Invalid data 1.1`
      )
      await assertions.decoding.fail(
        schema,
        Number.MAX_SAFE_INTEGER + 1,
        `number & int32
└─ int
   └─ Invalid data 9007199254740992`
      )
      await assertions.decoding.fail(
        schema,
        Number.MAX_SAFE_INTEGER + 1,
        `number & int32
├─ int
│  └─ Invalid data 9007199254740992
└─ between(-2147483648, 2147483647)
   └─ Invalid data 9007199254740992`,
        { parseOptions: { errors: "all" } }
      )

      await assertions.encoding.succeed(schema, 1)
      await assertions.encoding.fail(
        schema,
        1.1,
        `number & int32
└─ int
   └─ Invalid data 1.1`
      )
      await assertions.encoding.fail(
        schema,
        Number.MAX_SAFE_INTEGER + 1,
        `number & int32
└─ int
   └─ Invalid data 9007199254740992`
      )
    })

    describe("BigInt Checks", () => {
      const options = { order: Order.bigint }

      const between = SchemaCheck.deriveBetween(options)
      const greaterThan = SchemaCheck.deriveGreaterThan(options)
      const greaterThanOrEqualTo = SchemaCheck.deriveGreaterThanOrEqualTo(options)
      const lessThan = SchemaCheck.deriveLessThan(options)
      const lessThanOrEqualTo = SchemaCheck.deriveLessThanOrEqualTo(options)
      const multipleOf = SchemaCheck.deriveMultipleOf({
        remainder: BigInt.remainder,
        zero: 0n
      })

      const positive = greaterThan(0n)
      const nonNegative = greaterThanOrEqualTo(0n)
      const negative = lessThan(0n)
      const nonPositive = lessThanOrEqualTo(0n)

      it("between", async () => {
        const schema = Schema.BigInt.pipe(Schema.check(between(5n, 10n)))

        strictEqual(SchemaAST.format(schema.ast), `bigint & between(5, 10)`)

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 7n)
        await assertions.decoding.succeed(schema, 10n)
        await assertions.decoding.fail(
          schema,
          4n,
          `bigint & between(5, 10)
└─ between(5, 10)
   └─ Invalid data 4n`
        )
      })

      it("greaterThan", async () => {
        const schema = Schema.BigInt.pipe(Schema.check(greaterThan(5n)))

        strictEqual(SchemaAST.format(schema.ast), `bigint & greaterThan(5)`)

        await assertions.decoding.succeed(schema, 6n)
        await assertions.decoding.fail(
          schema,
          5n,
          `bigint & greaterThan(5)
└─ greaterThan(5)
   └─ Invalid data 5n`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.BigInt.pipe(Schema.check(greaterThanOrEqualTo(5n)))

        strictEqual(SchemaAST.format(schema.ast), `bigint & greaterThanOrEqualTo(5)`)

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 6n)
        await assertions.decoding.fail(
          schema,
          4n,
          `bigint & greaterThanOrEqualTo(5)
└─ greaterThanOrEqualTo(5)
   └─ Invalid data 4n`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.BigInt.pipe(Schema.check(lessThan(5n)))

        strictEqual(SchemaAST.format(schema.ast), `bigint & lessThan(5)`)

        await assertions.decoding.succeed(schema, 4n)
        await assertions.decoding.fail(
          schema,
          5n,
          `bigint & lessThan(5)
└─ lessThan(5)
   └─ Invalid data 5n`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.BigInt.pipe(Schema.check(lessThanOrEqualTo(5n)))

        strictEqual(SchemaAST.format(schema.ast), `bigint & lessThanOrEqualTo(5)`)

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 4n)
        await assertions.decoding.fail(
          schema,
          6n,
          `bigint & lessThanOrEqualTo(5)
└─ lessThanOrEqualTo(5)
   └─ Invalid data 6n`
        )
      })

      it("multipleOf", async () => {
        const schema = Schema.BigInt.pipe(Schema.check(multipleOf(5n)))

        strictEqual(SchemaAST.format(schema.ast), `bigint & multipleOf(5)`)
      })

      it("positive", async () => {
        const schema = Schema.BigInt.pipe(Schema.check(positive))

        strictEqual(SchemaAST.format(schema.ast), `bigint & greaterThan(0)`)
      })

      Schema.BigInt.pipe(Schema.check(positive))
      Schema.BigInt.pipe(Schema.check(nonNegative))
      Schema.BigInt.pipe(Schema.check(negative))
      Schema.BigInt.pipe(Schema.check(nonPositive))
      Schema.BigInt.pipe(Schema.check(multipleOf(5n)))
    })
  })

  describe("Transformations", () => {
    it("annotations on both sides", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          {
            decode: SchemaGetter.fail((o) => new SchemaIssue.InvalidData(o, { title: "err decoding" })),
            encode: SchemaGetter.fail((o) => new SchemaIssue.InvalidData(o, { title: "err encoding" }))
          }
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.decoding.fail(
        schema,
        "a",
        `string <-> string
└─ err decoding`
      )

      await assertions.encoding.fail(
        schema,
        "a",
        `string <-> string
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
   └─ Invalid data NaN`
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
      const schema = FiniteFromString.pipe(Schema.check(SchemaCheck.greaterThan(2)))

      strictEqual(SchemaAST.format(schema.ast), `number & finite & greaterThan(2) <-> string`)

      await assertions.decoding.succeed(schema, "3", { expected: 3 })
      await assertions.decoding.fail(
        schema,
        "1",
        `number & finite & greaterThan(2) <-> string
└─ greaterThan(2)
   └─ Invalid data 1`
      )

      await assertions.encoding.succeed(schema, 3, { expected: "3" })
      await assertions.encoding.fail(
        schema,
        1,
        `string <-> number & finite & greaterThan(2)
└─ number & finite & greaterThan(2)
   └─ greaterThan(2)
      └─ Invalid data 1`
      )
    })
  })

  describe("decodeTo", () => {
    it("should expose the source and the target schemas", () => {
      const schema = FiniteFromString

      strictEqual(schema.from, Schema.String)
      strictEqual(schema.to, Schema.Finite)
    })

    it("transformation with checks", async () => {
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
            SchemaTransformation.compose()
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
   └─ Missing key`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a": string <-> string }
└─ ["a"]
   └─ Missing key`
      )
    })

    it("required to optional", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.optionalKey(Schema.String),
            SchemaTransformation.make({
              decode: SchemaGetter.required(),
              encode: SchemaGetter.transformOption(Option.orElseSome(() => "default"))
            })
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
      └─ Missing key`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { expected: { a: "default" } })
    })

    it("optionalKey to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.decodeTo(
            Schema.String,
            SchemaTransformation.make({
              decode: SchemaGetter.default(() => "default"),
              encode: SchemaGetter.passthrough()
            })
          )
        )
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string <-> readonly ?: string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { expected: { a: "default" } })

      await assertions.encoding.succeed(schema, { a: "a" })
    })

    it("double transformation", async () => {
      const schema = Trim.pipe(Schema.decodeTo(
        FiniteFromString,
        SchemaTransformation.compose()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Invalid data NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.check(SchemaCheck.minLength(2))).pipe(
          Schema.decodeTo(
            Schema.String.pipe(Schema.check(SchemaCheck.minLength(3))),
            SchemaTransformation.compose()
          ),
          Schema.decodeTo(
            Schema.String,
            SchemaTransformation.compose()
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
            └─ Invalid data "aa"`
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
            └─ Invalid data "aa"`
      )
    })

    it("nested defaults", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.Struct({
          b: Schema.optionalKey(Schema.String)
        })).pipe(Schema.decodeTo(
          Schema.Struct({
            b: Schema.optionalKey(Schema.String).pipe(
              Schema.decodeTo(
                Schema.String,
                SchemaTransformation.make({
                  decode: SchemaGetter.default(() => "default-b"),
                  encode: SchemaGetter.passthrough()
                })
              )
            )
          }),
          SchemaTransformation.make({
            decode: SchemaGetter.default(() => ({})),
            encode: SchemaGetter.passthrough()
          })
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
            SchemaTransformation.compose()
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a": string <-> string }
└─ ["a"]
   └─ Missing key`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a": string <-> string }
└─ ["a"]
   └─ Missing key`
      )
    })

    it("required to optionalKey", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.String),
            SchemaTransformation.make({
              decode: SchemaGetter.default(() => "default"),
              encode: SchemaGetter.passthrough()
            })
          )
        )
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string <-> readonly ?: string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { expected: { a: "default" } })

      await assertions.encoding.succeed(schema, { a: "a" })
    })

    it("optionalKey to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.encodeTo(
            Schema.String,
            SchemaTransformation.make({
              decode: SchemaGetter.required(),
              encode: SchemaGetter.default(() => "default")
            })
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
      └─ Missing key`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { expected: { a: "default" } })
    })

    it("double transformation", async () => {
      const schema = FiniteFromString.pipe(Schema.encodeTo(
        Trim,
        SchemaTransformation.compose()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Invalid data NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String.pipe(Schema.check(SchemaCheck.minLength(3))),
            SchemaTransformation.compose()
          ),
          Schema.encodeTo(
            Schema.String.pipe(Schema.check(SchemaCheck.minLength(2))),
            SchemaTransformation.compose()
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
            └─ Invalid data "aa"`
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
            └─ Invalid data "aa"`
      )
    })
  })

  describe("flip", () => {
    it("string & minLength(3) <-> number & greaterThan(2)", async () => {
      const schema = FiniteFromString.pipe(
        Schema.check(SchemaCheck.greaterThan(2)),
        Schema.flip,
        Schema.check(SchemaCheck.minLength(3))
      )

      await assertions.encoding.succeed(schema, "123", { expected: 123 })

      await assertions.decoding.fail(
        schema,
        2,
        `string & minLength(3) <-> number & finite & greaterThan(2)
└─ number & finite & greaterThan(2)
   └─ greaterThan(2)
      └─ Invalid data 2`
      )
      await assertions.decoding.fail(
        schema,
        3,
        `string & minLength(3) <-> number & finite & greaterThan(2)
└─ minLength(3)
   └─ Invalid data "3"`
      )
    })

    it("withConstructorDefault", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.constructorDefault(() => Result.succeedSome(-1)))
      })

      assertions.makeSync.succeed(schema, { a: 1 })
      assertions.makeSync.succeed(schema, {}, { a: -1 })

      const flipped = schema.pipe(Schema.flip)
      throws(() => flipped.makeSync({} as any))
      assertions.makeSync.succeed(flipped, { a: "1" })

      const flipped2 = flipped.pipe(Schema.flip)
      deepStrictEqual(flipped2.fields, schema.fields)
      assertions.makeSync.succeed(flipped2, { a: 1 })
      assertions.makeSync.succeed(flipped2, {}, { a: -1 })
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
        a: FiniteFromString.pipe(Schema.check(SchemaCheck.greaterThan(0))),
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
                     └─ Invalid data NaN`
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
                        └─ Invalid data -1`
      )
    })
  })

  describe("withConstructorDefault", () => {
    it("by default should not apply defaults when decoding / encoding", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optionalKey, Schema.constructorDefault(() => Result.succeedSome("a")))
      })

      await assertions.decoding.succeed(schema, {})
      await assertions.encoding.succeed(schema, {}, {})
    })

    it("Struct & Some", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.constructorDefault(() => Result.succeedSome(-1)))
      })

      assertions.makeSync.succeed(schema, { a: 1 })
      assertions.makeSync.succeed(schema, {}, { a: -1 })
    })

    describe("nested defaults", () => {
      it("Struct", () => {
        const schema = Schema.Struct({
          a: Schema.Struct({
            b: FiniteFromString.pipe(Schema.constructorDefault(() => Result.succeedSome(-1)))
          }).pipe(Schema.constructorDefault(() => Result.succeedSome({})))
        })

        assertions.makeSync.succeed(schema, { a: { b: 1 } })
        assertions.makeSync.succeed(schema, { a: {} }, { a: { b: -1 } })
        assertions.makeSync.succeed(schema, {}, { a: { b: -1 } })
      })

      it("Class", () => {
        class A extends Schema.Class<A>("A")(Schema.Struct({
          a: Schema.Struct({
            b: FiniteFromString.pipe(Schema.constructorDefault(() => Result.succeedSome(-1)))
          }).pipe(Schema.constructorDefault(() => Result.succeedSome({})))
        })) {}

        assertions.makeSync.succeed(A, { a: { b: 1 } }, new A({ a: { b: 1 } }))
        assertions.makeSync.succeed(A, { a: {} }, new A({ a: { b: -1 } }))
        assertions.makeSync.succeed(A, {}, new A({ a: { b: -1 } }))
      })
    })

    it("Struct & Effect sync", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.constructorDefault(() => Effect.succeed(Option.some(-1))))
      })

      assertions.makeSync.succeed(schema, { a: 1 })
      assertions.makeSync.succeed(schema, {}, { a: -1 })
    })

    it("Struct & Effect async", async () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.constructorDefault(() =>
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
        a: FiniteFromString.pipe(Schema.constructorDefault(() =>
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
      const spr = SchemaParser.make(schema)({})
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
      assertions.makeSync.succeed(schema, { a: 1 })
      assertions.makeSync.fail(schema, null as any, "makeSync failure")

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
        Schema.Number.pipe(Schema.check(SchemaCheck.greaterThan(0)))
      ])

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) | number & greaterThan(0)`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1)
└─ minLength(1)
   └─ Invalid data ""`
      )
      await assertions.decoding.fail(
        schema,
        -1,
        `number & greaterThan(0)
└─ greaterThan(0)
   └─ Invalid data -1`
      )
    })

    it(`mode: "oneOf"`, async () => {
      const schema = Schema.Union([
        Schema.Struct({ a: Schema.String }),
        Schema.Struct({ b: Schema.Number })
      ], { mode: "oneOf" })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string } ⊻ { readonly "b": number }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, { b: 1 })
      await assertions.decoding.fail(
        schema,
        { a: "a", b: 1 },
        `Expected exactly one successful result for { readonly "a": string } ⊻ { readonly "b": number }, actual {"a":"a","b":1}`
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
   └─ Invalid data ""`
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
   └─ Invalid data ""`
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

      const instance = schema.makeSync({ a: "a" })
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

        annotations: {
          title: "MyError",
          defaultJsonSerializer: () =>
            Schema.link<MyError>()(
              Schema.String,
              SchemaTransformation.transform({
                decode: (message) => new MyError(message),
                encode: (e) => e.message
              })
            )
        }
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
      assertions.makeSync.succeed(schema, { _tag: "a", a: 1 })
    })

    it("decoding: required & encoding: required & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a"),
        a: FiniteFromString
      })

      await assertions.decoding.succeed(schema, { _tag: "a", a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.encoding.succeed(schema, { _tag: "a", a: 1 }, { expected: { _tag: "a", a: "1" } })
      assertions.makeSync.succeed(schema, { _tag: "a", a: 1 })
      assertions.makeSync.succeed(schema, { a: 1 }, { _tag: "a", a: 1 })
    })

    it("decoding: default & encoding: never & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a").pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.Literal("a")),
            {
              decode: SchemaGetter.default(() => "a" as const),
              encode: SchemaGetter.omit()
            }
          )
        ),
        a: FiniteFromString
      })

      await assertions.decoding.succeed(schema, { _tag: "a", a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.encoding.succeed(schema, { _tag: "a", a: 1 }, { expected: { a: "1" } })
      assertions.makeSync.succeed(schema, { _tag: "a", a: 1 })
      assertions.makeSync.succeed(schema, { a: 1 }, { _tag: "a", a: 1 })
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
   └─ Missing key`
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
         └─ Missing key`
      )
    })
  })

  it("transformOrFail", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String,
        SchemaTransformation.transformOrFail({
          decode: (s) =>
            s === "a"
              ? SchemaResult.fail(new SchemaIssue.Forbidden(Option.some(s), { title: "not a" }))
              : SchemaResult.succeed(s),
          encode: (s) =>
            s === "b"
              ? SchemaResult.fail(new SchemaIssue.Forbidden(Option.some(s), { title: "not b" }))
              : SchemaResult.succeed(s)
        })
      )
    )

    await assertions.decoding.succeed(schema, "b")
    await assertions.decoding.fail(
      schema,
      "a",
      `string <-> string
└─ not a`
    )

    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(
      schema,
      "b",
      `string <-> string
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

  describe("Class", () => {
    it("suspend before initialization", async () => {
      const schema = Schema.suspend(() => string)
      class A extends Schema.Class<A>("A")(Schema.Struct({ a: schema })) {}
      const string = Schema.String
      await assertions.decoding.succeed(A, new A({ a: "a" }))
    })

    it("Fields argument", async () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {
        readonly _a = 1
      }

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(A.name, "A")

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeSync({ a: "a" }) instanceof A)

      // test additional fields
      strictEqual(new A({ a: "a" })._a, 1)
      strictEqual(A.makeSync({ a: "a" })._a, 1)

      // test Equal.equals
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new A({ a: "a" }), new A({ a: "b" })))

      await assertions.decoding.succeed(A, { a: "a" }, { expected: new A({ a: "a" }) })
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `A <-> { readonly "a": string }
└─ { readonly "a": string }
   └─ ["a"]
      └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { expected: { a: "a" } })
      await assertions.encoding.fail(
        A,
        null,
        `{ readonly "a": string } <-> A
└─ Expected A, actual null`
      )
      await assertions.encoding.fail(
        A,
        { a: "a" } as any,
        `{ readonly "a": string } <-> A
└─ Expected A, actual {"a":"a"}`
      )
    })

    it("Struct argument", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly _a = 1
      }

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(A.name, "A")

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeSync({ a: "a" }) instanceof A)

      // test additional fields
      strictEqual(new A({ a: "a" })._a, 1)
      strictEqual(A.makeSync({ a: "a" })._a, 1)

      // test Equal.equals
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new A({ a: "a" }), new A({ a: "b" })))

      await assertions.decoding.succeed(A, { a: "a" }, { expected: new A({ a: "a" }) })
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `A <-> { readonly "a": string }
└─ { readonly "a": string }
   └─ ["a"]
      └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { expected: { a: "a" } })
      await assertions.encoding.fail(
        A,
        null,
        `{ readonly "a": string } <-> A
└─ Expected A, actual null`
      )
      await assertions.encoding.fail(
        A,
        { a: "a" } as any,
        `{ readonly "a": string } <-> A
└─ Expected A, actual {"a":"a"}`
      )
    })

    it("annotate", async () => {
      class A_ extends Schema.Class<A_>("A")({
        a: Schema.String
      }) {
        readonly _a = 1
      }
      const A = A_.annotate({ title: "B" })

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(SchemaAST.format(A.ast), `B <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeSync({ a: "a" }) instanceof A)

      // test additional fields
      strictEqual(new A({ a: "a" })._a, 1)
      strictEqual(A.makeSync({ a: "a" })._a, 1)

      // test Equal.equals
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new A({ a: "a" }), new A({ a: "b" })))

      await assertions.decoding.succeed(A, { a: "a" }, { expected: new A({ a: "a" }) })
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `B <-> { readonly "a": string }
└─ A <-> { readonly "a": string }
   └─ { readonly "a": string }
      └─ ["a"]
         └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { expected: { a: "a" } })
      await assertions.encoding.fail(
        A,
        null,
        `{ readonly "a": string } <-> B
└─ Expected B, actual null`
      )
      await assertions.encoding.fail(
        A,
        { a: "a" } as any,
        `{ readonly "a": string } <-> B
└─ Expected B, actual {"a":"a"}`
      )
    })

    it("check", async () => {
      class A_ extends Schema.Class<A_>("A")({
        a: Schema.String
      }) {
        readonly _a = 1
      }
      const A = A_.pipe(Schema.check(SchemaCheck.makeFilter(() => true)))

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(SchemaAST.format(A.ast), `A & <filter> <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeSync({ a: "a" }) instanceof A)

      // test additional fields
      strictEqual(new A({ a: "a" })._a, 1)
      strictEqual(A.makeSync({ a: "a" })._a, 1)

      // test Equal.equals
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new A({ a: "a" }), new A({ a: "b" })))

      await assertions.decoding.succeed(A, { a: "a" }, { expected: new A({ a: "a" }) })
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `A & <filter> <-> { readonly "a": string }
└─ A <-> { readonly "a": string }
   └─ { readonly "a": string }
      └─ ["a"]
         └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { expected: { a: "a" } })
      await assertions.encoding.fail(
        A,
        null,
        `{ readonly "a": string } <-> A & <filter>
└─ Expected A & <filter>, actual null`
      )
      await assertions.encoding.fail(
        A,
        { a: "a" } as any,
        `{ readonly "a": string } <-> A & <filter>
└─ Expected A & <filter>, actual {"a":"a"}`
      )
    })

    it("extend", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly _a = 1
      }
      class B extends A.extend<B>("B")({
        b: Schema.Number
      }) {
        readonly _b = 2
      }

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)
      strictEqual(SchemaAST.format(B.ast), `B <-> { readonly "a": string; readonly "b": number }`)

      const instance = new B({ a: "a", b: 2 })

      assertTrue(instance instanceof A)
      assertTrue(B.makeSync({ a: "a", b: 2 }) instanceof A)
      assertTrue(instance instanceof B)
      assertTrue(B.makeSync({ a: "a", b: 2 }) instanceof B)

      strictEqual(instance.a, "a")
      strictEqual(instance._a, 1)
      strictEqual(instance.b, 2)
      strictEqual(instance._b, 2)

      await assertions.decoding.succeed(B, { a: "a", b: 2 }, { expected: new B({ a: "a", b: 2 }) })
    })
  })

  describe("ErrorClass", () => {
    it("fields argument", () => {
      class E extends Schema.ErrorClass<E>("E")({
        id: Schema.Number
      }) {}

      const err = new E({ id: 1 })

      strictEqual(String(err), `Error`)
      assertInclude(err.stack, "Schema.test.ts:")
      strictEqual(err.id, 1)
    })

    it("Struct argument", () => {
      class E extends Schema.ErrorClass<E>("E")(Schema.Struct({
        id: Schema.Number
      })) {}

      const err = new E({ id: 1 })

      strictEqual(String(err), `Error`)
      assertInclude(err.stack, "Schema.test.ts:")
      strictEqual(err.id, 1)
    })

    it("extend", async () => {
      class A extends Schema.ErrorClass<A>("A")({
        a: Schema.String
      }) {
        readonly _a = 1
      }
      class B extends A.extend<B>("B")({
        b: Schema.Number
      }) {
        readonly _b = 2
      }

      const instance = new B({ a: "a", b: 2 })

      strictEqual(String(instance), `Error`)
      assertInclude(instance.stack, "Schema.test.ts:")

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)
      strictEqual(SchemaAST.format(B.ast), `B <-> { readonly "a": string; readonly "b": number }`)

      assertTrue(instance instanceof A)
      assertTrue(B.makeSync({ a: "a", b: 2 }) instanceof A)
      assertTrue(instance instanceof B)
      assertTrue(B.makeSync({ a: "a", b: 2 }) instanceof B)

      strictEqual(instance.a, "a")
      strictEqual(instance._a, 1)
      strictEqual(instance.b, 2)
      strictEqual(instance._b, 2)

      await assertions.decoding.succeed(B, { a: "a", b: 2 }, { expected: new B({ a: "a", b: 2 }) })
    })
  })

  describe("Enum", () => {
    it("enums should be exposed", () => {
      enum Fruits {
        Apple,
        Banana
      }
      const schema = Schema.Enums(Fruits)
      strictEqual(schema.enums.Apple, 0)
      strictEqual(schema.enums.Banana, 1)
    })

    describe("Numeric enums", () => {
      enum Fruits {
        Apple,
        Banana
      }
      const schema = Schema.Enums(Fruits)

      it("decoding", async () => {
        await assertions.decoding.succeed(schema, Fruits.Apple)
        await assertions.decoding.succeed(schema, Fruits.Banana)
        await assertions.decoding.succeed(schema, 0)
        await assertions.decoding.succeed(schema, 1)

        await assertions.decoding.fail(
          schema,
          3,
          `Expected <enum 2 value(s): 0 | 1>, actual 3`
        )
      })

      it("encoding", async () => {
        await assertions.encoding.succeed(schema, Fruits.Apple, { expected: 0 })
        await assertions.encoding.succeed(schema, Fruits.Banana, { expected: 1 })
      })
    })

    describe("String enums", () => {
      enum Fruits {
        Apple = "apple",
        Banana = "banana",
        Cantaloupe = 0
      }
      const schema = Schema.Enums(Fruits)

      it("decoding", async () => {
        await assertions.decoding.succeed(schema, Fruits.Apple)
        await assertions.decoding.succeed(schema, Fruits.Cantaloupe)
        await assertions.decoding.succeed(schema, "apple")
        await assertions.decoding.succeed(schema, "banana")
        await assertions.decoding.succeed(schema, 0)

        await assertions.decoding.fail(
          schema,
          "Cantaloupe",
          `Expected <enum 3 value(s): "apple" | "banana" | 0>, actual "Cantaloupe"`
        )
      })

      it("encoding", async () => {
        await assertions.encoding.succeed(schema, Fruits.Apple)
        await assertions.encoding.succeed(schema, Fruits.Banana)
        await assertions.encoding.succeed(schema, Fruits.Cantaloupe)
      })
    })

    describe("Const enums", () => {
      const Fruits = {
        Apple: "apple",
        Banana: "banana",
        Cantaloupe: 3
      } as const
      const schema = Schema.Enums(Fruits)

      it("decoding", async () => {
        await assertions.decoding.succeed(schema, "apple")
        await assertions.decoding.succeed(schema, "banana")
        await assertions.decoding.succeed(schema, 3)

        await assertions.decoding.fail(
          schema,
          "Cantaloupe",
          `Expected <enum 3 value(s): "apple" | "banana" | 3>, actual "Cantaloupe"`
        )
      })

      it("encoding", async () => {
        await assertions.encoding.succeed(schema, Fruits.Apple, { expected: "apple" })
        await assertions.encoding.succeed(schema, Fruits.Banana, { expected: "banana" })
        await assertions.encoding.succeed(schema, Fruits.Cantaloupe, { expected: 3 })
      })
    })
  })

  describe("catchDecoding", () => {
    it("ok", async () => {
      const fallback = Result.ok(Option.some("b"))
      const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback)).pipe(Schema.check(SchemaCheck.nonEmpty))

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) <-> string`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1) <-> string
└─ minLength(1)
   └─ Invalid data ""`
      )

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.fail(
        schema,
        null,
        `string <-> string & minLength(1)
└─ Expected string & minLength(1), actual null`
      )
    })

    it("async", async () => {
      const fallback = Effect.succeed(Option.some("b")).pipe(Effect.delay(100))
      const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback))

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
    })
  })

  it("catchDecodingWithContext", async () => {
    class Service extends Context.Tag<Service, { fallback: Effect.Effect<string> }>()("Service") {}

    const schema = Schema.String.pipe(Schema.catchDecodingWithContext(() =>
      Effect.gen(function*() {
        const service = yield* Service
        return Option.some(yield* service.fallback)
      })
    ))

    await assertions.decoding.succeed(schema, "a", {
      provide: [[Service, { fallback: Effect.succeed("b") }]]
    })
    await assertions.decoding.succeed(schema, null, {
      expected: "b",
      provide: [[Service, { fallback: Effect.succeed("b") }]]
    })
  })

  describe("decodingMiddleware", () => {
    it("providing a service", async () => {
      class Service extends Context.Tag<Service, { fallback: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.catchDecodingWithContext(() =>
          Effect.gen(function*() {
            const service = yield* Service
            return Option.some(yield* service.fallback)
          })
        ),
        Schema.decodingMiddleware((sr) =>
          Effect.isEffect(sr)
            ? Effect.provideService(sr, Service, { fallback: Effect.succeed("b") })
            : sr
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
    })

    it("forced failure", async () => {
      const schema = Schema.String.pipe(
        Schema.decodingMiddleware(() =>
          SchemaResult.fail(new SchemaIssue.Forbidden(Option.none(), { description: "my message" }))
        )
      )

      await assertions.decoding.fail(
        schema,
        "a",
        `string <-> string
└─ my message`
      )
    })
  })

  describe("encodingMiddleware", () => {
    it("providing a service", async () => {
      class Service extends Context.Tag<Service, { fallback: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.catchEncodingWithContext(() =>
          Effect.gen(function*() {
            const service = yield* Service
            return Option.some(yield* service.fallback)
          })
        ),
        Schema.encodingMiddleware((sr) =>
          Effect.isEffect(sr)
            ? Effect.provideService(sr, Service, { fallback: Effect.succeed("b") })
            : sr
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.succeed(schema, null, { expected: "b" })
    })

    it("forced failure", async () => {
      const schema = Schema.String.pipe(
        Schema.encodingMiddleware(() =>
          SchemaResult.fail(new SchemaIssue.Forbidden(Option.none(), { description: "my message" }))
        )
      )

      await assertions.encoding.fail(
        schema,
        "a",
        `string <-> string
└─ my message`
      )
    })
  })

  it("checkEffect", async () => {
    const schema = Schema.String.pipe(
      Schema.checkEffect((s) =>
        Effect.gen(function*() {
          if (s.length === 0) {
            return new SchemaIssue.InvalidData(Option.some(s), { title: "length > 0" })
          }
        }).pipe(Effect.delay(100))
      )
    )

    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(
      schema,
      "",
      `string <-> string
└─ length > 0`
    )
  })

  it("checkEffectWithContext", async () => {
    class Service extends Context.Tag<Service, { fallback: Effect.Effect<string> }>()("Service") {}

    const schema = Schema.String.pipe(
      Schema.checkEffectWithContext((s) =>
        Effect.gen(function*() {
          yield* Service
          if (s.length === 0) {
            return new SchemaIssue.InvalidData(Option.some(s), { title: "length > 0" })
          }
        })
      )
    )

    await assertions.decoding.succeed(schema, "a", {
      provide: [[Service, { fallback: Effect.succeed("b") }]]
    })
    await assertions.decoding.fail(
      schema,
      "",
      `string <-> string
└─ length > 0`,
      {
        provide: [[Service, { fallback: Effect.succeed("b") }]]
      }
    )
  })

  describe("brand", () => {
    it("should expose the branded schema", () => {
      const schema = Schema.Number.pipe(Schema.brand("MyBrand"))

      strictEqual(schema.schema, Schema.Number)

      deepStrictEqual(schema.ast.annotations?.brands, new Set(["MyBrand"]))
    })

    it("double brand", () => {
      const schema = Schema.Number.pipe(Schema.brand("MyBrand")).pipe(Schema.brand("MyBrand2"))

      deepStrictEqual(schema.ast.annotations?.brands, new Set(["MyBrand", "MyBrand2"]))
    })
  })

  describe("Optional Fields", () => {
    it("Exact Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.NumberFromString)
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
    })

    it("Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.NumberFromString)
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.succeed(schema, { a: undefined })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
      await assertions.encoding.succeed(schema, { a: undefined })
    })

    it("Exact Optional Property with Nullability", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.NullOr(Schema.NumberFromString))
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.succeed(schema, { a: null })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
      await assertions.encoding.succeed(schema, { a: null })
    })

    it("Optional Property with Nullability", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.NullOr(Schema.NumberFromString))
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.succeed(schema, { a: undefined })
      await assertions.decoding.succeed(schema, { a: null })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
      await assertions.encoding.succeed(schema, { a: null })
      await assertions.encoding.succeed(schema, { a: undefined })
    })

    it("Optional Property to Exact Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.NumberFromString).pipe(Schema.decodeTo(Schema.optionalKey(Schema.Number), {
          decode: SchemaGetter.transformOption(Option.filter(Predicate.isNotUndefined)),
          encode: SchemaGetter.passthrough()
        }))
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.succeed(schema, { a: undefined }, { expected: {} })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
    })

    it("Optional Property with Nullability to Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.NullOr(Schema.NumberFromString)).pipe(
          Schema.decodeTo(Schema.optional(Schema.Number), {
            decode: SchemaGetter.transformOption(Option.filter(Predicate.isNotNull)),
            encode: SchemaGetter.passthrough()
          })
        )
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.succeed(schema, { a: undefined })
      await assertions.decoding.succeed(schema, { a: null }, { expected: {} })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
    })
  })

  describe("asOption", () => {
    it("optionalKey -> Option", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.NumberFromString).pipe(
          Schema.decodeTo(
            Schema.Option(Schema.Number),
            SchemaTransformation.transformOption({
              decode: Option.some,
              encode: Option.flatten
            })
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: Option.some(1) } })
      await assertions.decoding.succeed(schema, {}, { expected: { a: Option.none() } })

      await assertions.encoding.succeed(schema, { a: Option.some(1) }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, { a: Option.none() }, { expected: {} })
    })

    it("optional -> Option", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.NumberFromString).pipe(
          Schema.decodeTo(
            Schema.Option(Schema.Number),
            SchemaTransformation.transformOption({
              decode: (on) => on.pipe(Option.filter((nu) => nu !== undefined), Option.some),
              encode: Option.flatten
            })
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: Option.some(1) } })
      await assertions.decoding.succeed(schema, {}, { expected: { a: Option.none() } })
      await assertions.decoding.succeed(schema, { a: undefined }, { expected: { a: Option.none() } })

      await assertions.encoding.succeed(schema, { a: Option.some(1) }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, { a: Option.none() }, { expected: {} })
    })
  })
})
