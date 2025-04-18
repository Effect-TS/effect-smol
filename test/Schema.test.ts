import { Context, Effect, Equal, Option, Result, Schema, SchemaAST, SchemaParserResult } from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { assertFalse, assertInclude, assertTrue, deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

const Trim = Schema.String.pipe(Schema.decode(Schema.trim))

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

      strictEqual(String(schema.ast), `"a"`)

      await assertions.make.succeed(schema, "a")
      await assertions.make.fail(schema, null as any, `Expected "a", actual null`)
      assertions.makeUnsafe.succeed(schema, "a")
      assertions.makeUnsafe.fail(schema, null as any, `Failed to makeUnsafe "a"`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, 1, `Expected "a", actual 1`)

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.fail(schema, 1 as any, `Expected "a", actual 1`)
    })
  })

  it("Never", async () => {
    const schema = Schema.Never

    await assertions.make.fail(schema, null as never, `Expected never, actual null`)
    assertions.makeUnsafe.fail(schema, null as never, `Failed to makeUnsafe never`)

    strictEqual(String(schema.ast), `never`)

    await assertions.decoding.fail(schema, "a", `Expected never, actual "a"`)
    await assertions.encoding.fail(schema, "a", `Expected never, actual "a"`)
  })

  it("Unknown", async () => {
    const schema = Schema.Unknown

    strictEqual(String(schema.ast), `unknown`)

    await assertions.make.succeed(schema, "a")
    assertions.makeUnsafe.succeed(schema, "a")

    await assertions.decoding.succeed(schema, "a")
  })

  it("String", async () => {
    const schema = Schema.String

    strictEqual(String(schema.ast), `string`)

    await assertions.make.succeed(schema, "a")
    await assertions.make.fail(schema, null as any, `Expected string, actual null`)
    assertions.makeUnsafe.succeed(schema, "a")
    assertions.makeUnsafe.fail(schema, null as any, `Failed to makeUnsafe string`)

    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(schema, 1, "Expected string, actual 1")

    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(schema, 1 as any, "Expected string, actual 1")
  })

  it("Number", async () => {
    const schema = Schema.Number

    strictEqual(String(schema.ast), `number`)

    await assertions.make.succeed(schema, 1)
    await assertions.make.fail(schema, null as any, `Expected number, actual null`)
    assertions.makeUnsafe.succeed(schema, 1)
    assertions.makeUnsafe.fail(schema, null as any, `Failed to makeUnsafe number`)

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

      strictEqual(String(schema.ast), `{ readonly "a": string }`)

      // Should be able to access the fields
      deepStrictEqual(schema.fields, { a: Schema.String })

      await assertions.make.succeed(schema, { a: "a" })
      await assertions.make.fail(schema, null as any, `Expected { readonly "a": string }, actual null`)
      assertions.makeUnsafe.succeed(schema, { a: "a" })
      assertions.makeUnsafe.fail(schema, null as any, `Failed to makeUnsafe { readonly "a": string }`)

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
        assertions.makeUnsafe.fail(
          schema,
          {} as any,
          `Failed to makeUnsafe { readonly "a": string; readonly "b": number }`,
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

    it(`{ readonly "a": NumberFromString }`, async () => {
      const schema = Schema.Struct({
        a: Schema.NumberFromString
      })

      strictEqual(String(schema.ast), `{ readonly "a": number <-> string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { a: 1 })
      await assertions.decoding.fail(
        schema,
        { a: "a" },
        `{ readonly "a": number <-> string }
└─ ["a"]
   └─ number <-> string
      └─ decoding / encoding issue...
         └─ Cannot convert "a" to a number`
      )

      await assertions.encoding.succeed(schema, { a: 1 }, { a: "1" })
      await assertions.encoding.fail(
        schema,
        { a: "a" } as any,
        `{ readonly "a": string <-> number }
└─ ["a"]
   └─ Expected number, actual "a"`
      )
    })

    describe("optionalKey", () => {
      it(`{ readonly "a"?: string }`, async () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.optionalKey)
        })

        strictEqual(String(schema.ast), `{ readonly "a"?: string }`)

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

      strictEqual(String(schema.ast), `readonly [string & minLength(1)]`)

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
      assertions.makeUnsafe.fail(schema, [""], `Failed to makeUnsafe readonly [string & minLength(1)]`)

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

      strictEqual(String(schema.ast), `ReadonlyArray<string>`)

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
    it("filterEffect", async () => {
      const schema = Schema.String.pipe(
        Schema.filterEffect((s) => Effect.succeed(s.length > 2).pipe(Effect.delay(10)), {
          title: "my-filter"
        })
      )

      strictEqual(String(schema.ast), `string & my-filter`)

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
      const schema = Schema.NumberFromString.pipe(Schema.filterEncoded((s) => s.length > 2, {
        title: "my-filter"
      }))

      strictEqual(String(schema.ast), `number <-> string & my-filter`)

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
        `string & my-filter <-> number
└─ my-filter
   └─ Invalid value "12"`
      )
    })

    describe("String filters", () => {
      it("minLength", async () => {
        const schema = Schema.String.pipe(Schema.minLength(1))

        strictEqual(String(schema.ast), `string & minLength(1)`)

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
        const schema = Schema.Number.pipe(Schema.greaterThan(1))

        strictEqual(String(schema.ast), `number & greaterThan(1)`)

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
        Schema.decode(
          new SchemaAST.Transformation(
            Schema.failParsing((o) => new SchemaAST.InvalidValueIssue(o, "err decoding")),
            Schema.failParsing((o) => new SchemaAST.InvalidValueIssue(o, "err encoding"))
          )
        )
      )

      strictEqual(String(schema.ast), `string <-> string`)

      await assertions.decoding.fail(
        schema,
        "a",
        `string <-> string
└─ decoding / encoding issue...
   └─ err decoding`
      )

      await assertions.encoding.fail(
        schema,
        "a",
        `string <-> string
└─ decoding / encoding issue...
   └─ err encoding`
      )
    })

    describe("String transformations", () => {
      it("trim", async () => {
        const schema = Schema.String.pipe(Schema.decode(Schema.trim))

        strictEqual(String(schema.ast), `string <-> string`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.succeed(schema, " a", "a")
        await assertions.decoding.succeed(schema, "a ", "a")
        await assertions.decoding.succeed(schema, " a ", "a")

        await assertions.encoding.succeed(schema, " a ", " a ")
      })
    })

    it("NumberToString", async () => {
      const schema = Schema.NumberFromString

      strictEqual(String(schema.ast), `number <-> string`)

      await assertions.decoding.succeed(schema, "1", 1)
      await assertions.decoding.fail(
        schema,
        "a",
        `number <-> string
└─ decoding / encoding issue...
   └─ Cannot convert "a" to a number`
      )

      await assertions.encoding.succeed(schema, 1, "1")
      await assertions.encoding.fail(
        schema,
        "a" as any,
        `Expected number, actual "a"`
      )
    })

    it("NumberToString & greaterThan", async () => {
      const schema = Schema.NumberFromString.pipe(Schema.greaterThan(2))

      strictEqual(String(schema.ast), `number & greaterThan(2) <-> string`)

      await assertions.decoding.succeed(schema, "3", 3)
      await assertions.decoding.fail(
        schema,
        "1",
        `number & greaterThan(2) <-> string
└─ greaterThan(2)
   └─ Invalid value 1`
      )

      await assertions.encoding.succeed(schema, 3, "3")
      await assertions.encoding.fail(
        schema,
        1,
        `number & greaterThan(2)
└─ greaterThan(2)
   └─ Invalid value 1`
      )
    })
  })

  describe("decodeTo", () => {
    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.String,
            Schema.identityTransformation()
          )
        )
      })

      strictEqual(String(schema.ast), `{ readonly "a": string <-> string }`)

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
            Schema.withEncodingDefault(() => "default")
          )
        )
      })

      strictEqual(String(schema.ast), `{ readonly "a"?: string <-> string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ decoding / encoding issue...
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
            Schema.withDecodingDefault(() => "default")
          )
        )
      })

      strictEqual(String(schema.ast), `{ readonly "a": string <-> readonly ?: string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { a: "default" })

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ decoding / encoding issue...
         └─ Missing value`
      )
    })

    it("double transformation", async () => {
      const schema = Trim.pipe(Schema.decodeTo(
        Schema.NumberFromString,
        Schema.identityTransformation()
      ))
      await assertions.decoding.succeed(schema, " 2 ", 2)
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number <-> string
└─ decoding / encoding issue...
   └─ Cannot convert "a2" to a number`
      )

      await assertions.encoding.succeed(schema, 2, "2")
    })
  })

  describe("encodeTo", () => {
    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String,
            Schema.identityTransformation()
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
            Schema.withDecodingDefault(() => "default")
          )
        )
      })

      strictEqual(String(schema.ast), `{ readonly "a": string <-> readonly ?: string }`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { a: "default" })

      await assertions.encoding.succeed(schema, { a: "a" }, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {} as any,
        `{ readonly "a"?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ decoding / encoding issue...
         └─ Missing value`
      )
    })

    it("optional to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.encodeTo(
            Schema.String,
            Schema.withEncodingDefault(() => "default")
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
      └─ decoding / encoding issue...
         └─ Missing value`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { a: "default" })
    })

    it("double transformation", async () => {
      const schema = Schema.NumberFromString.pipe(Schema.encodeTo(
        Trim,
        Schema.identityTransformation()
      ))
      await assertions.decoding.succeed(schema, " 2 ", 2)
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number <-> string
└─ decoding / encoding issue...
   └─ Cannot convert "a2" to a number`
      )

      await assertions.encoding.succeed(schema, 2, "2")
    })

    it("double transformation with filters", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.encodeTo(Schema.String.pipe(Schema.minLength(3)), Schema.identityTransformation()))
          .pipe(
            Schema.encodeTo(
              Schema.String.pipe(Schema.minLength(2)),
              Schema.identityTransformation()
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

  describe("encode", () => {
    it("double transformation", async () => {
      const t = new SchemaAST.Transformation<string, string>(
        new SchemaAST.Parsing((os) => {
          if (Option.isNone(os)) {
            return Result.none
          }
          return Result.ok(Option.some(os.value))
        }, undefined),
        new SchemaAST.Parsing((os) => {
          if (Option.isNone(os)) {
            return Result.none
          }
          return Result.ok(Option.some(os.value + "!"))
        }, undefined)
      )

      const schema = Schema.String.pipe(
        Schema.encode(t),
        Schema.encode(t)
      )

      await assertions.encoding.succeed(schema, "a", "a!!")
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

      strictEqual(A.toString(), `A <-> { readonly "a": string }`)

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

      strictEqual(A.toString(), `A <-> { readonly "a": string }`)

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

      strictEqual(A.toString(), `A <-> { readonly "a": string }`)
      strictEqual(B.toString(), `B <-> { readonly "a": string }`)

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

      strictEqual(A.toString(), `A <-> { readonly "a": string }`)
      strictEqual(B.toString(), `B <-> { readonly "a": string }`)

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
      class B extends Schema.Class<B>("B")(A.pipe(Schema.filter(({ a }) => a.length > 0))) {}

      strictEqual(A.toString(), `A <-> { readonly "a": string }`)
      strictEqual(B.toString(), `B <-> { readonly "a": string }`)

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
    it("string & s.length > 2 <-> number & n > 2", async () => {
      const schema = Schema.NumberFromString.pipe(
        Schema.filter((n) => n > 2, { title: "n > 2" }),
        Schema.flip,
        Schema.filter((s) => s.length > 2, { title: "s.length > 2" })
      )

      await assertions.encoding.succeed(schema, "123", 123)

      await assertions.decoding.fail(
        schema,
        2,
        `number & n > 2
└─ n > 2
   └─ Invalid value 2`
      )
      await assertions.decoding.fail(
        schema,
        3,
        `string & s.length > 2 <-> number & n > 2
└─ s.length > 2
   └─ Invalid value "3"`
      )
    })

    it("withConstructorDefault", () => {
      const schema = Schema.Struct({
        a: Schema.NumberFromString.pipe(Schema.withConstructorDefault(() => Result.some(-1)))
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
    it("Option(NumberToString)", async () => {
      const schema = Schema.Option(Schema.NumberFromString)

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
└─ Expected number, actual null`
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
        a: Schema.NumberFromString.pipe(Schema.filter((n) => n > 0)),
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
        `{ readonly "a": number & <filter> <-> string; readonly "categories": ReadonlyArray<Suspend> }
└─ ["categories"]
   └─ ReadonlyArray<Suspend>
      └─ [0]
         └─ { readonly "a": number & <filter> <-> string; readonly "categories": ReadonlyArray<Suspend> }
            └─ ["a"]
               └─ number & <filter> <-> string
                  └─ decoding / encoding issue...
                     └─ Cannot convert "a" to a number`
      )

      await assertions.encoding.succeed(schema, { a: 1, categories: [] }, { a: "1", categories: [] })
      await assertions.encoding.succeed(schema, { a: 1, categories: [{ a: 2, categories: [] }] }, {
        a: "1",
        categories: [{ a: "2", categories: [] }]
      })
      await assertions.encoding.fail(
        schema,
        { a: 1, categories: [{ a: -1, categories: [] }] },
        `{ readonly "a": string <-> number & <filter>; readonly "categories": ReadonlyArray<Suspend> }
└─ ["categories"]
   └─ ReadonlyArray<Suspend>
      └─ [0]
         └─ { readonly "a": string <-> number & <filter>; readonly "categories": ReadonlyArray<Suspend> }
            └─ ["a"]
               └─ number & <filter>
                  └─ <filter>
                     └─ Invalid value -1`
      )
    })
  })

  it("filterGroup", async () => {
    const schema = Schema.String.pipe(Schema.filterGroup([
      {
        filter: (s) => s.length > 2 || `${JSON.stringify(s)} should be > 2`,
        annotations: { title: "> 2" }
      },
      {
        filter: (s) => !s.includes("d") || `${JSON.stringify(s)} should not include d`,
        annotations: { title: "no d" }
      }
    ]))

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
      const schema = from.pipe(Schema.filter(({ a }) => a.length > 0)).extend({ b: Schema.String })

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

      strictEqual(A.toString(), `A <-> { readonly "a": string }`)
      strictEqual(B.toString(), `B <-> { readonly "a": string; readonly "b": string }`)

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
        a: Schema.NumberFromString.pipe(Schema.withConstructorDefault(() => Result.some(-1)))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })
    })

    it("nested defaults", () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: Schema.NumberFromString.pipe(Schema.withConstructorDefault(() => Result.some(-1)))
        }).pipe(Schema.withConstructorDefault(() => Result.some({})))
      })

      assertions.makeUnsafe.succeed(schema, { a: { b: 1 } })
      assertions.makeUnsafe.succeed(schema, {}, { a: { b: -1 } })
    })

    it("Struct & Effect sync", () => {
      const schema = Schema.Struct({
        a: Schema.NumberFromString.pipe(Schema.withConstructorDefault(() => Effect.succeed(Option.some(-1))))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })
    })

    it("Struct & Effect async", async () => {
      const schema = Schema.Struct({
        a: Schema.NumberFromString.pipe(Schema.withConstructorDefault(() =>
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
        a: Schema.NumberFromString.pipe(Schema.withConstructorDefault(() =>
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
})
