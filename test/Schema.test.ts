import {
  Context,
  Effect,
  Equal,
  Option,
  Result,
  Schema,
  SchemaAST,
  SchemaParser,
  SchemaParserResult,
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

describe("Schema", () => {
  it("isSchema", () => {
    class A extends Schema.Class<A>("A")(Schema.Struct({
      a: Schema.String
    })) {}
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
      assertions.makeUnsafe.fail(schema, null as any)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, 1, `Expected "a", actual 1`)

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.fail(schema, 1 as any, `Expected "a", actual 1`)
    })
  })

  it("Never", async () => {
    const schema = Schema.Never

    await assertions.make.fail(schema, null as never, `Expected never, actual null`)
    assertions.makeUnsafe.fail(schema, null as never)

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
    assertions.makeUnsafe.fail(schema, undefined as any)
  })

  it("Undefined", async () => {
    const schema = Schema.Undefined

    strictEqual(SchemaAST.format(schema.ast), `undefined`)

    await assertions.make.succeed(schema, undefined)
    await assertions.make.fail(schema, null as any, `Expected undefined, actual null`)
    assertions.makeUnsafe.succeed(schema, undefined)
    assertions.makeUnsafe.fail(schema, null as any)
  })

  it("String", async () => {
    const schema = Schema.String

    strictEqual(SchemaAST.format(schema.ast), `string`)

    await assertions.make.succeed(schema, "a")
    await assertions.make.fail(schema, null as any, `Expected string, actual null`)
    assertions.makeUnsafe.succeed(schema, "a")
    assertions.makeUnsafe.fail(schema, null as any)

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
    assertions.makeUnsafe.fail(schema, null as any)

    await assertions.decoding.succeed(schema, 1)
    await assertions.decoding.fail(schema, "a", `Expected number, actual "a"`)

    await assertions.encoding.succeed(schema, 1)
    await assertions.encoding.fail(schema, "a" as any, `Expected number, actual "a"`)
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
      assertions.makeUnsafe.fail(schema, null as any)

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

      it.todo(`{ onExcessProperty: "error" }`, async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })

        await assertions.decoding.fail(
          schema,
          { a: "a", b: "b" },
          `{ readonly a: string; readonly b: number }
└─ ["b"]
   └─ Unexpected property key`,
          { parseOptions: { onExcessProperty: "error" } }
        )
      })
    })

    it(`{ readonly "a": FiniteFromString }`, async () => {
      const schema = Schema.Struct({
        a: FiniteFromString
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": number & finite <-> string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { a: 1 })
      await assertions.decoding.fail(
        schema,
        { a: "a" },
        `{ readonly "a": number & finite <-> string }
└─ ["a"]
   └─ number & finite <-> string
      └─ finite
         └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, { a: 1 }, { a: "1" })
      await assertions.encoding.fail(
        schema,
        { a: "a" } as any,
        `{ readonly "a": string <-> number & finite }
└─ ["a"]
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
  })

  describe("Tuple", () => {
    it(`readonly [string]`, async () => {
      const schema = Schema.Tuple([Schema.NonEmptyString])

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
      assertions.makeUnsafe.fail(schema, [""])

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
  })

  describe("Array", () => {
    it("success", async () => {
      const schema = Schema.Array(Schema.String)

      strictEqual(SchemaAST.format(schema.ast), `readonly string[]`)

      await assertions.make.succeed(schema, ["a", "b"])
      assertions.makeUnsafe.succeed(schema, ["a", "b"])

      await assertions.decoding.succeed(schema, ["a", "b"])
      await assertions.decoding.fail(
        schema,
        ["a", 1],
        `readonly string[]
└─ [1]
   └─ Expected string, actual 1`
      )

      await assertions.encoding.succeed(schema, ["a", "b"])
      await assertions.encoding.fail(
        schema,
        ["a", 1] as any,
        `readonly string[]
└─ [1]
   └─ Expected string, actual 1`
      )
    })
  })

  describe("Filters", () => {
    it("filter group", async () => {
      const schema = Schema.String.pipe(Schema.check(
        Schema.predicate((s) => s.length > 2 || `${JSON.stringify(s)} should be > 2`, { title: "> 2" }),
        Schema.predicate((s) => !s.includes("d") || `${JSON.stringify(s)} should not include d`, { title: "no d" })
      ))

      await assertions.decoding.succeed(schema, "abc")
      await assertions.decoding.fail(
        schema,
        "ad",
        `string & > 2 & no d
├─ > 2
│  └─ "ad" should be > 2
└─ no d
   └─ "ad" should not include d`
      )
    })

    it("aborting filters", async () => {
      const schema = Schema.String.pipe(Schema.check(
        Schema.minLength(4).stop(),
        Schema.minLength(3)
      ))

      await assertions.decoding.fail(
        schema,
        "ab",
        `string & minLength(4) & minLength(3)
└─ minLength(4)
   └─ Invalid value "ab"`
      )
    })

    it("filterEffect", async () => {
      const schema = Schema.String.pipe(
        Schema.checkEffect((s) => Effect.succeed(s.length > 2).pipe(Effect.delay(10)), { title: "my-filter" })
      )

      strictEqual(SchemaAST.format(schema.ast), `string & my-filter`)

      await assertions.decoding.succeed(schema, "abc")
      await assertions.decoding.fail(
        schema,
        "ab",
        `string & my-filter
└─ my-filter
   └─ Invalid value "ab"`
      )

      await assertions.encoding.succeed(schema, "abc")
      await assertions.encoding.fail(
        schema,
        "ab",
        `string & my-filter
└─ my-filter
   └─ Invalid value "ab"`
      )
    })

    it("filterEncoded", async () => {
      const schema = FiniteFromString.pipe(Schema.checkEncoded((s) => s.length > 2, { title: "my-filter" }))

      strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string & my-filter`)

      await assertions.decoding.succeed(schema, "123", 123)
      await assertions.decoding.fail(
        schema,
        "12",
        `string & my-filter
└─ my-filter
   └─ Invalid value "12"`
      )

      await assertions.encoding.succeed(schema, 123, "123")
      await assertions.encoding.fail(
        schema,
        12,
        `string & my-filter <-> number & finite
└─ my-filter
   └─ Invalid value "12"`
      )
    })

    describe("String filters", () => {
      it("trimmed", async () => {
        const schema = Schema.String.pipe(Schema.check(Schema.trimmed))

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
        const schema = Schema.String.pipe(Schema.check(Schema.minLength(1)))

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
        const schema = Schema.Number.pipe(Schema.check(Schema.greaterThan(1)))

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
    })
  })

  describe("Transformations", () => {
    it("annotations on both sides", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          new SchemaTransformation.Transformation(
            SchemaParser.fail((o) => new SchemaAST.InvalidIssue(o, "err decoding")),
            SchemaParser.fail((o) => new SchemaAST.InvalidIssue(o, "err encoding"))
          )
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.decoding.fail(
        schema,
        "a",
        `string <-> string
└─ decoding / encoding failure
   └─ err decoding`
      )

      await assertions.encoding.fail(
        schema,
        "a",
        `string <-> string
└─ decoding / encoding failure
   └─ err encoding`
      )
    })

    describe("String transformations", () => {
      it("trim", async () => {
        const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.trim))

        strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.succeed(schema, " a", "a")
        await assertions.decoding.succeed(schema, "a ", "a")
        await assertions.decoding.succeed(schema, " a ", "a")

        await assertions.encoding.succeed(schema, "a", "a")
        await assertions.encoding.succeed(schema, " a ")
      })
    })

    it("NumberToString", async () => {
      const schema = FiniteFromString

      strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string`)

      await assertions.decoding.succeed(schema, "1", 1)
      await assertions.decoding.fail(
        schema,
        "a",
        `number & finite <-> string
└─ finite
   └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, 1, "1")
      await assertions.encoding.fail(
        schema,
        "a" as any,
        `Expected number & finite, actual "a"`
      )
    })

    it("NumberToString & greaterThan", async () => {
      const schema = FiniteFromString.pipe(Schema.check(Schema.greaterThan(2)))

      strictEqual(SchemaAST.format(schema.ast), `number & finite & greaterThan(2) <-> string`)

      await assertions.decoding.succeed(schema, "3", 3)
      await assertions.decoding.fail(
        schema,
        "1",
        `number & finite & greaterThan(2) <-> string
└─ greaterThan(2)
   └─ Invalid value 1`
      )

      await assertions.encoding.succeed(schema, 3, "3")
      await assertions.encoding.fail(
        schema,
        1,
        `number & finite & greaterThan(2)
└─ greaterThan(2)
   └─ Invalid value 1`
      )
    })
  })

  describe("decodeTo", () => {
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

      await assertions.encoding.succeed(schema, { a: "a" }, { a: "a" })
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
      └─ decoding / encoding failure
         └─ Missing value`
      )

      await assertions.encoding.succeed(schema, { a: "a" }, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { a: "default" })
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
      await assertions.decoding.succeed(schema, {}, { a: "default" })

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ decoding / encoding failure
         └─ Missing value`
      )
    })

    it("double transformation", async () => {
      const schema = Trim.pipe(Schema.decodeTo(
        FiniteFromString,
        SchemaTransformation.identity()
      ))
      await assertions.decoding.succeed(schema, " 2 ", 2)
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, 2, "2")
    })

    it("double transformation with filters", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.check(Schema.minLength(2))).pipe(
          Schema.decodeTo(
            Schema.String.pipe(Schema.check(Schema.minLength(3))),
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
   └─ string & minLength(3) <-> string & minLength(2)
      └─ minLength(3)
         └─ Invalid value "aa"`
      )

      await assertions.encoding.succeed(schema, { a: "aaa" }, { a: "aaa" })
      await assertions.encoding.fail(
        schema,
        { a: "aa" },
        `{ readonly "a": string & minLength(2) <-> string }
└─ ["a"]
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
      await assertions.decoding.succeed(schema, { a: {} }, { a: { b: "default-b" } })
      await assertions.decoding.succeed(schema, {}, { a: { b: "default-b" } })
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

      await assertions.encoding.succeed(schema, { a: "a" }, { a: "a" })
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
      await assertions.decoding.succeed(schema, {}, { a: "default" })

      await assertions.encoding.succeed(schema, { a: "a" }, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ decoding / encoding failure
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
      └─ decoding / encoding failure
         └─ Missing value`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { a: "default" })
    })

    it("double transformation", async () => {
      const schema = FiniteFromString.pipe(Schema.encodeTo(
        Trim,
        SchemaTransformation.identity()
      ))
      await assertions.decoding.succeed(schema, " 2 ", 2)
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, 2, "2")
    })

    it("double transformation with filters", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String.pipe(Schema.check(Schema.minLength(3))),
            SchemaTransformation.identity()
          ),
          Schema.encodeTo(
            Schema.String.pipe(Schema.check(Schema.minLength(2))),
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
   └─ string & minLength(3)
      └─ minLength(3)
         └─ Invalid value "aa"`
      )

      await assertions.encoding.succeed(schema, { a: "aaa" }, { a: "aaa" })
      await assertions.encoding.fail(
        schema,
        { a: "aa" },
        `{ readonly "a": string & minLength(2) <-> string }
└─ ["a"]
   └─ string & minLength(3)
      └─ minLength(3)
         └─ Invalid value "aa"`
      )
    })
  })

  describe("Class", () => {
    it("suspend before initialization", async () => {
      const schema = Schema.suspend(() => string)
      class A extends Schema.Class<A>("A")(Schema.Struct({ a: Schema.optionalKey(schema) })) {}
      const string = Schema.String
      await assertions.decoding.succeed(A, new A({ a: "a" }))
    })

    it("A extends Struct", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeUnsafe({ a: "a" }) instanceof A)

      // test equality
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))

      await assertions.decoding.succeed(A, { a: "a" }, new A({ a: "a" }))
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `{ readonly "a": string }
└─ ["a"]
   └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { a: "a" })
      await assertions.encoding.fail(A, null, `Expected { readonly "a": string }, actual null`)
      await assertions.encoding.fail(A, { a: "a" }, `Expected { readonly "a": string }, actual {"a":"a"}`)
    })

    it("A extends Fields", async () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeUnsafe({ a: "a" }) instanceof A)

      // test equality
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))

      await assertions.decoding.succeed(A, { a: "a" }, new A({ a: "a" }))
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `{ readonly "a": string }
└─ ["a"]
   └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { a: "a" })
      await assertions.encoding.fail(A, null, `Expected { readonly "a": string }, actual null`)
      await assertions.encoding.fail(A, { a: "a" }, `Expected { readonly "a": string }, actual {"a":"a"}`)
    })

    it("A extends Struct & annotate", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly propA = 1
      }

      class B extends Schema.Class<B>("B")(A.annotate({ title: "B" }).annotate({ description: "B" })) {
        readonly propB = 2
      }

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)
      strictEqual(SchemaAST.format(B.ast), `B <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeUnsafe({ a: "a" }) instanceof A)
      strictEqual(new A({ a: "a" }).propA, 1)
      strictEqual(A.makeUnsafe({ a: "a" }).propA, 1)

      assertTrue(new B({ a: "a" }) instanceof A)
      assertTrue(B.makeUnsafe({ a: "a" }) instanceof A)
      assertTrue(new B({ a: "a" }) instanceof B)
      assertTrue(B.makeUnsafe({ a: "a" }) instanceof B)
      strictEqual(new B({ a: "a" }).propA, 1)
      strictEqual(B.makeUnsafe({ a: "a" }).propA, 1)
      strictEqual(new B({ a: "a" }).propB, 2)
      strictEqual(B.makeUnsafe({ a: "a" }).propB, 2)

      // test equality
      assertTrue(Equal.equals(new B({ a: "a" }), new B({ a: "a" })))

      assertFalse(Equal.equals(new B({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new B({ a: "a1" }), new B({ a: "a2" })))
    })

    it("extends Struct & custom constructor", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly b: string
        constructor(props: (typeof A)["~type.make.in"]) {
          super(props)
          this.b = props.a + "-b"
        }
      }
      class B extends Schema.Class<B>("B")(A) {}

      strictEqual(new A({ a: "a" }).b, "a-b")
      strictEqual(A.makeUnsafe({ a: "a" }).b, "a-b")
      strictEqual(new B({ a: "a" }).b, "a-b")
      strictEqual(B.makeUnsafe({ a: "a" }).b, "a-b")
    })

    it("extends abstract A extends Struct", async () => {
      abstract class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        abstract foo(): string
        bar() {
          return this.a + "-bar-" + this.foo()
        }
      }
      class B extends Schema.Class<B>("B")(A) {
        foo() {
          return this.a + "-foo-"
        }
      }

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)
      strictEqual(SchemaAST.format(B.ast), `B <-> { readonly "a": string }`)

      assertTrue(new B({ a: "a" }) instanceof B)
      assertTrue(new B({ a: "a" }) instanceof A)
      assertTrue(B.makeUnsafe({ a: "a" }) instanceof B)
      assertTrue(B.makeUnsafe({ a: "a" }) instanceof A)

      strictEqual(new B({ a: "a" }).foo(), "a-foo-")
      strictEqual(new B({ a: "a" }).bar(), "a-bar-a-foo-")
      strictEqual(B.makeUnsafe({ a: "a" }).foo(), "a-foo-")
      strictEqual(B.makeUnsafe({ a: "a" }).bar(), "a-bar-a-foo-")

      await assertions.decoding.succeed(B, { a: "a" }, new B({ a: "a" }))
      await assertions.decoding.fail(
        B,
        { a: 1 },
        `{ readonly "a": string }
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("extends (A & <filter>) extends Struct", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}
      class B extends Schema.Class<B>("B")(A.pipe(Schema.check(Schema.predicate(({ a }) => a.length > 0)))) {}

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)
      strictEqual(SchemaAST.format(B.ast), `B <-> { readonly "a": string }`)

      await assertions.decoding.succeed(B, { a: "a" }, new B({ a: "a" }))
      await assertions.decoding.fail(
        B,
        { a: 1 },
        `{ readonly "a": string }
└─ ["a"]
   └─ Expected string, actual 1`
      )
      await assertions.decoding.fail(
        B,
        { a: "" },
        `A & <filter> <-> { readonly "a": string }
└─ <filter>
   └─ Invalid value A({"a":""})`
      )
    })
  })

  describe("TaggedError", () => {
    it("baseline", () => {
      class E extends Schema.TaggedError<E>()("E", {
        id: Schema.Number
      }) {}

      strictEqual(E._tag, "E")

      const err = new E({ id: 1 })

      strictEqual(String(err), `E({"id":1,"_tag":"E"})`)
      assertInclude(err.stack, "Schema.test.ts:")
      strictEqual(err._tag, "E")
      strictEqual(err.id, 1)
    })
  })

  describe("flip", () => {
    it("string & minLength(3) <-> number & greaterThan(2)", async () => {
      const schema = FiniteFromString.pipe(
        Schema.check(Schema.greaterThan(2)),
        Schema.flip,
        Schema.check(Schema.minLength(3))
      )

      await assertions.encoding.succeed(schema, "123", 123)

      await assertions.decoding.fail(
        schema,
        2,
        `number & finite & greaterThan(2)
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

    it("withConstructorDefault", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.withConstructorDefault(() => Result.some(-1)))
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

  describe("declare", () => {
    it("refinement", async () => {
      const schema = Schema.declare({ guard: (u) => u instanceof File })

      await assertions.decoding.succeed(schema, new File([], "a.txt"))
      await assertions.decoding.fail(schema, "a", `Invalid value "a"`)
    })
  })

  describe("Option", () => {
    it("Option(FiniteFromString)", async () => {
      const schema = Schema.Option(FiniteFromString)

      await assertions.decoding.succeed(schema, Option.none(), Option.none())
      await assertions.decoding.succeed(schema, Option.some("123"), Option.some(123))
      await assertions.decoding.fail(schema, null, `Expected <Declaration>, actual null`)
      await assertions.decoding.fail(
        schema,
        Option.some(null),
        `<Declaration>
└─ Expected string, actual null`
      )

      await assertions.encoding.succeed(schema, Option.none(), Option.none())
      await assertions.encoding.succeed(schema, Option.some(123), Option.some("123"))
      await assertions.encoding.fail(schema, null, `Expected <Declaration>, actual null`)
      await assertions.encoding.fail(
        schema,
        Option.some(null) as any,
        `<Declaration>
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
        a: FiniteFromString.pipe(Schema.check(Schema.greaterThan(0))),
        categories: Schema.Array(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
      })

      await assertions.decoding.succeed(schema, { a: "1", categories: [] }, { a: 1, categories: [] })
      await assertions.decoding.succeed(schema, { a: "1", categories: [{ a: "2", categories: [] }] }, {
        a: 1,
        categories: [{ a: 2, categories: [] }]
      })
      await assertions.decoding.fail(
        schema,
        {
          a: "1",
          categories: [{ a: "a", categories: [] }]
        },
        `{ readonly "a": number & finite & greaterThan(0) <-> string; readonly "categories": readonly Suspend[] }
└─ ["categories"]
   └─ readonly Suspend[]
      └─ [0]
         └─ { readonly "a": number & finite & greaterThan(0) <-> string; readonly "categories": readonly Suspend[] }
            └─ ["a"]
               └─ number & finite & greaterThan(0) <-> string
                  └─ finite
                     └─ Invalid value NaN`
      )

      await assertions.encoding.succeed(schema, { a: 1, categories: [] }, { a: "1", categories: [] })
      await assertions.encoding.succeed(schema, { a: 1, categories: [{ a: 2, categories: [] }] }, {
        a: "1",
        categories: [{ a: "2", categories: [] }]
      })
      await assertions.encoding.fail(
        schema,
        { a: 1, categories: [{ a: -1, categories: [] }] },
        `{ readonly "a": string <-> number & finite & greaterThan(0); readonly "categories": readonly Suspend[] }
└─ ["categories"]
   └─ readonly Suspend[]
      └─ [0]
         └─ { readonly "a": string <-> number & finite & greaterThan(0); readonly "categories": readonly Suspend[] }
            └─ ["a"]
               └─ number & finite & greaterThan(0)
                  └─ greaterThan(0)
                     └─ Invalid value -1`
      )
    })
  })

  describe("extend", () => {
    it("Struct", async () => {
      const from = Schema.Struct({
        a: Schema.String
      })
      const schema = from.extend({ b: Schema.String })

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

    it("Struct & filter", async () => {
      const from = Schema.Struct({
        a: Schema.String
      })
      const schema = from.pipe(Schema.check(Schema.predicate(({ a }) => a.length > 0))).extend({
        b: Schema.String
      })

      await assertions.decoding.succeed(schema, { a: "a", b: "b" })
      await assertions.decoding.fail(
        schema,
        { a: "", b: "b" },
        `{ readonly "a": string; readonly "b": string } & <filter>
└─ <filter>
   └─ Invalid value {"a":"","b":"b"}`
      )
    })

    it("extend Class", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly propA = 1
      }
      class B extends Schema.Class<B>("B")(A.extend({ b: Schema.String })) {
        readonly propB = 2
      }

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)
      strictEqual(SchemaAST.format(B.ast), `B <-> { readonly "a": string; readonly "b": string }`)

      assertTrue(new B({ a: "a", b: "b" }) instanceof A)
      assertTrue(B.makeUnsafe({ a: "a", b: "b" }) instanceof A)
      assertTrue(new B({ a: "a", b: "b" }) instanceof B)
      assertTrue(B.makeUnsafe({ a: "a", b: "b" }) instanceof B)
      strictEqual(new B({ a: "a", b: "b" }).propA, 1)
      strictEqual(B.makeUnsafe({ a: "a", b: "b" }).propA, 1)
      strictEqual(new B({ a: "a", b: "b" }).propB, 2)
      strictEqual(B.makeUnsafe({ a: "a", b: "b" }).propB, 2)

      // test equality
      assertTrue(Equal.equals(new B({ a: "a", b: "b" }), new B({ a: "a", b: "b" })))

      assertFalse(Equal.equals(new B({ a: "a", b: "b" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new B({ a: "a1", b: "b" }), new B({ a: "a2", b: "b" })))
      assertFalse(Equal.equals(new B({ a: "a", b: "b1" }), new B({ a: "a", b: "b2" })))

      await assertions.decoding.succeed(B, { a: "a", b: "b" }, new B({ a: "a", b: "b" }))
      await assertions.decoding.fail(
        B,
        { b: "b" },
        `{ readonly "a": string; readonly "b": string }
└─ ["a"]
   └─ Missing value`
      )
      await assertions.decoding.fail(
        B,
        { a: "a" },
        `{ readonly "a": string; readonly "b": string }
└─ ["b"]
   └─ Missing value`
      )
    })
  })

  describe("pick", () => {
    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.String
      }).pick(["a"])

      await assertions.decoding.succeed(schema, { a: "a" })
    })
  })

  describe("omit", () => {
    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.String
      }).omit(["b"])

      await assertions.decoding.succeed(schema, { a: "a" })
    })
  })

  describe("withConstructorDefault", () => {
    it("by default should not apply defaults when decoding / encoding", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optionalKey, Schema.withConstructorDefault(() => Result.some("a")))
      })

      await assertions.decoding.succeed(schema, {})
      await assertions.encoding.succeed(schema, {}, {})
    })

    it("Struct & Some", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.withConstructorDefault(() => Result.some(-1)))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })
    })

    it("nested defaults", () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: FiniteFromString.pipe(Schema.withConstructorDefault(() => Result.some(-1)))
        }).pipe(Schema.withConstructorDefault(() => Result.some({})))
      })

      assertions.makeUnsafe.succeed(schema, { a: { b: 1 } })
      assertions.makeUnsafe.succeed(schema, {}, { a: { b: -1 } })
    })

    it("Struct & Effect sync", () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.withConstructorDefault(() => Effect.succeed(Option.some(-1))))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })
    })

    it("Struct & Effect async", async () => {
      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.withConstructorDefault(() =>
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
      class ConstructorService extends Context.Tag<
        ConstructorService,
        { defaultValue: Effect.Effect<number> }
      >()("ConstructorService") {}

      const schema = Schema.Struct({
        a: FiniteFromString.pipe(Schema.withConstructorDefault(() =>
          Effect.gen(function*() {
            yield* Effect.sleep(100)
            const oservice = yield* Effect.serviceOption(ConstructorService)
            if (Option.isNone(oservice)) {
              return Option.none()
            }
            return Option.some(yield* oservice.value.defaultValue)
          })
        ))
      })

      await assertions.make.succeed(schema, { a: 1 })
      const spr = schema.make({})
      const eff = SchemaParserResult.asEffect(spr)
      const provided = Effect.provideService(
        eff,
        ConstructorService,
        ConstructorService.of({ defaultValue: Effect.succeed(-1) })
      )
      await assertions.effect.succeed(provided, { a: -1 })
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", async () => {
      const schema = Schema.Record(Schema.String, Schema.Number)

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string]: number }`)

      await assertions.make.succeed(schema, { a: 1 })
      await assertions.make.fail(schema, null as any, `Expected { readonly [x: string]: number }, actual null`)
      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.fail(schema, null as any)

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

    it("Record(SnakeToCamel, NumberFromString)", async () => {
      const schema = Schema.Record(SnakeToCamel, NumberFromString)

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string <-> string]: number <-> string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { a: 1 })
      await assertions.decoding.succeed(schema, { a_b: "1" }, { aB: 1 })
      await assertions.decoding.succeed(schema, { a_b: "1", aB: "2" }, { aB: 2 })

      await assertions.encoding.succeed(schema, { a: 1 }, { a: "1" })
      await assertions.encoding.succeed(schema, { aB: 1 }, { a_b: "1" })
      await assertions.encoding.succeed(schema, { a_b: 1, aB: 2 }, { a_b: "2" })
    })

    it("Record(SnakeToCamel, Number, { key: ... })", async () => {
      const schema = Schema.Record(SnakeToCamel, NumberFromString, {
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

      await assertions.decoding.succeed(schema, { a: "1" }, { a: 1 })
      await assertions.decoding.succeed(schema, { a_b: "1" }, { aB: 1 })
      await assertions.decoding.succeed(schema, { a_b: "1", aB: "2" }, { aB: 3 })

      await assertions.encoding.succeed(schema, { a: 1 }, { a: "1" })
      await assertions.encoding.succeed(schema, { aB: 1 }, { a_b: "1" })
      await assertions.encoding.succeed(schema, { a_b: 1, aB: 2 }, { a_b: "12" })
    })
  })
})
