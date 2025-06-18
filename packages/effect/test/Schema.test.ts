import {
  BigInt,
  Context,
  Effect,
  Equal,
  flow,
  Option,
  Order,
  Predicate,
  Result,
  Schema,
  SchemaAST,
  SchemaCheck,
  SchemaGetter,
  SchemaIssue,
  SchemaResult,
  SchemaToParser,
  SchemaTransformation,
  String as Str,
  Struct,
  Tuple
} from "effect"
import { produce } from "immer"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { assertFalse, assertInclude, assertTrue, deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

const Trim = Schema.String.pipe(Schema.decode(SchemaTransformation.trim()))

const SnakeToCamel = Schema.String.pipe(
  Schema.decode(
    SchemaTransformation.snakeToCamel()
  )
)

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    {
      decode: SchemaGetter.Number(),
      encode: SchemaGetter.String()
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
    it("should throw an error if the literal is not a finite number", () => {
      throws(
        () => Schema.Literal(Infinity),
        new Error("LiteralType must be a finite number")
      )
      throws(
        () => Schema.Literal(-Infinity),
        new Error("LiteralType must be a finite number")
      )
      throws(
        () => Schema.Literal(NaN),
        new Error("LiteralType must be a finite number")
      )
    })

    it(`"a"`, async () => {
      const schema = Schema.Literal("a")

      strictEqual(SchemaAST.format(schema.ast), `"a"`)

      await assertions.make.succeed(schema, "a")
      await assertions.make.fail(schema, null as any, `Expected "a", actual null`)
      assertions.makeSync.succeed(schema, "a")
      assertions.makeSync.fail(schema, null as any)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, 1, `Expected "a", actual 1`)

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.fail(schema, 1 as any, `Expected "a", actual 1`)
    })

    it(`1`, async () => {
      const schema = Schema.Literal(1)

      strictEqual(SchemaAST.format(schema.ast), `1`)

      await assertions.make.succeed(schema, 1)
      await assertions.make.fail(schema, null as any, `Expected 1, actual null`)
      assertions.makeSync.succeed(schema, 1)
      assertions.makeSync.fail(schema, null as any)

      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(schema, "1", `Expected 1, actual "1"`)

      await assertions.encoding.succeed(schema, 1)
      await assertions.encoding.fail(schema, "1" as any, `Expected 1, actual "1"`)
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
    assertions.makeSync.fail(schema, null as never)

    strictEqual(SchemaAST.format(schema.ast), `never`)

    await assertions.decoding.fail(schema, "a", `Expected never, actual "a"`)
    await assertions.encoding.fail(schema, "a", `Expected never, actual "a"`)
  })

  it("Any", async () => {
    const schema = Schema.Any

    strictEqual(SchemaAST.format(schema.ast), `any`)

    await assertions.make.succeed(schema, "a")
    assertions.makeSync.succeed(schema, "a")

    await assertions.decoding.succeed(schema, "a")
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
    assertions.makeSync.fail(schema, undefined as any)
  })

  it("Undefined", async () => {
    const schema = Schema.Undefined

    strictEqual(SchemaAST.format(schema.ast), `undefined`)

    await assertions.make.succeed(schema, undefined)
    await assertions.make.fail(schema, null as any, `Expected undefined, actual null`)
    assertions.makeSync.succeed(schema, undefined)
    assertions.makeSync.fail(schema, null as any)
  })

  it("String", async () => {
    const schema = Schema.String

    strictEqual(SchemaAST.format(schema.ast), `string`)

    await assertions.make.succeed(schema, "a")
    await assertions.make.fail(schema, null as any, `Expected string, actual null`)
    assertions.makeSync.succeed(schema, "a")
    assertions.makeSync.fail(schema, null as any)

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
    assertions.makeSync.fail(schema, null as any)

    await assertions.decoding.succeed(schema, 1)
    await assertions.decoding.fail(schema, "a", `Expected number, actual "a"`)

    await assertions.encoding.succeed(schema, 1)
    await assertions.encoding.fail(schema, "a" as any, `Expected number, actual "a"`)
  })

  it("Symbol", async () => {
    const schema = Schema.Symbol

    strictEqual(SchemaAST.format(schema.ast), `symbol`)

    await assertions.make.succeed(schema, Symbol("a"))
    await assertions.make.fail(schema, null as any, `Expected symbol, actual null`)
    assertions.makeSync.succeed(schema, Symbol("a"))
    assertions.makeSync.fail(schema, null as any)

    await assertions.decoding.succeed(schema, Symbol("a"))
    await assertions.decoding.fail(schema, "a", `Expected symbol, actual "a"`)

    await assertions.encoding.succeed(schema, Symbol("a"))
    await assertions.encoding.fail(schema, "a" as any, `Expected symbol, actual "a"`)
  })

  it("UniqueSymbol", async () => {
    const a = Symbol("a")
    const schema = Schema.UniqueSymbol(a)

    strictEqual(SchemaAST.format(schema.ast), `Symbol(a)`)

    await assertions.make.succeed(schema, a)
    await assertions.make.fail(schema, Symbol("b") as any, `Expected Symbol(a), actual Symbol(b)`)
    assertions.makeSync.succeed(schema, a)
    assertions.makeSync.fail(schema, Symbol("b") as any)

    await assertions.decoding.succeed(schema, a)
    await assertions.decoding.fail(schema, Symbol("b"), `Expected Symbol(a), actual Symbol(b)`)
  })

  it("BigInt", async () => {
    const schema = Schema.BigInt

    strictEqual(SchemaAST.format(schema.ast), `bigint`)

    await assertions.make.succeed(schema, 1n)
    await assertions.make.fail(schema, null as any, `Expected bigint, actual null`)
    assertions.makeSync.succeed(schema, 1n)
    assertions.makeSync.fail(schema, null as any)

    await assertions.decoding.succeed(schema, 1n)
    await assertions.decoding.fail(schema, "1" as any, `Expected bigint, actual "1"`)

    await assertions.encoding.succeed(schema, 1n)
    await assertions.encoding.fail(schema, "1" as any, `Expected bigint, actual "1"`)
  })

  it("Void", async () => {
    const schema = Schema.Void

    strictEqual(SchemaAST.format(schema.ast), `void`)

    await assertions.make.succeed(schema, undefined)
    await assertions.make.fail(schema, null as any, `Expected void, actual null`)
    assertions.makeSync.succeed(schema, undefined)
    assertions.makeSync.fail(schema, null as any)

    await assertions.decoding.succeed(schema, undefined)
    await assertions.decoding.fail(schema, "1" as any, `Expected void, actual "1"`)

    await assertions.encoding.succeed(schema, undefined)
    await assertions.encoding.fail(schema, "1" as any, `Expected void, actual "1"`)
  })

  it("Object", async () => {
    const schema = Schema.Object

    strictEqual(SchemaAST.format(schema.ast), `object`)

    await assertions.make.succeed(schema, {})
    await assertions.make.succeed(schema, [])
    await assertions.make.fail(schema, null as any, `Expected object, actual null`)
    assertions.makeSync.succeed(schema, {})
    assertions.makeSync.succeed(schema, [])
    assertions.makeSync.fail(schema, null as any)

    await assertions.decoding.succeed(schema, {})
    await assertions.decoding.succeed(schema, [])
    await assertions.decoding.fail(schema, "1" as any, `Expected object, actual "1"`)

    await assertions.encoding.succeed(schema, {})
    await assertions.encoding.succeed(schema, [])
    await assertions.encoding.fail(schema, "1" as any, `Expected object, actual "1"`)
  })

  describe("Struct", () => {
    it("should throw an error if there are duplicate property signatures", () => {
      throws(
        () =>
          new SchemaAST.TypeLiteral(
            [
              new SchemaAST.PropertySignature("a", Schema.String.ast),
              new SchemaAST.PropertySignature("b", Schema.String.ast),
              new SchemaAST.PropertySignature("c", Schema.String.ast),
              new SchemaAST.PropertySignature("a", Schema.String.ast),
              new SchemaAST.PropertySignature("c", Schema.String.ast)
            ],
            [],
            undefined,
            undefined,
            undefined,
            undefined
          ),
        new Error(`Duplicate identifiers: ["a","c"]. ts(2300)`)
      )
    })

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
      assertions.makeSync.fail(schema, null as any)

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

    it(`{ readonly "a": <transformation> }`, async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString
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
         └─ Expected a finite number, actual NaN`
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

    it(`Schema.optionalKey: { readonly "a"?: string }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String)
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

    it(`Schema.optional: { readonly "a"?: string | undefined }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.String)
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: string | undefined }`)

      await assertions.make.succeed(schema, { a: "a" })
      await assertions.make.succeed(schema, { a: undefined })
      await assertions.make.succeed(schema, {})
      assertions.makeSync.succeed(schema, { a: "a" })
      assertions.makeSync.succeed(schema, { a: undefined })
      assertions.makeSync.succeed(schema, {})

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, { a: undefined })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.fail(
        schema,
        { a: 1 },
        `{ readonly "a"?: string | undefined }
└─ ["a"]
   └─ Expected string | undefined, actual 1`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, { a: undefined })
      await assertions.encoding.succeed(schema, {})
      await assertions.encoding.fail(
        schema,
        { a: 1 } as any,
        `{ readonly "a"?: string | undefined }
└─ ["a"]
   └─ Expected string | undefined, actual 1`
      )
    })

    it(`{ readonly "a"?: <transformation> }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.FiniteFromString)
      })

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: number & finite <-> readonly ?: string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.fail(
        schema,
        { a: undefined },
        `{ readonly "a"?: number & finite <-> readonly ?: string }
└─ ["a"]
   └─ number & finite <-> readonly ?: string
      └─ Expected string, actual undefined`
      )

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
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

    describe("merge", () => {
      it("Struct", async () => {
        const from = Schema.Struct({
          a: Schema.String
        })
        const schema = from.mapFields(Struct.merge({ b: Schema.String }))

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
        const schema = from.mapFields(Struct.merge({ b: Schema.Number, c: Schema.Number }))

        await assertions.decoding.succeed(schema, { a: "a", b: 1, c: 2 })
        await assertions.decoding.fail(
          schema,
          { a: "a", b: "b" },
          `{ readonly "a": string; readonly "b": number; readonly "c": number }
└─ ["b"]
   └─ Expected number, actual "b"`
        )
      })

      it("Struct & check & preserveChecks: true", async () => {
        const from = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).check(
          SchemaCheck.make(({ a, b }) => a === b, { title: "a === b" })
        )
        const schema = from.mapFields(Struct.merge({ c: Schema.String }), { preserveChecks: true })

        await assertions.decoding.succeed(schema, { a: "a", b: "a", c: "c" })
        await assertions.decoding.fail(
          schema,
          { a: "", b: "b", c: "c" },
          `{ readonly "a": string; readonly "b": string; readonly "c": string } & a === b
└─ a === b
   └─ Expected a === b, actual {"a":"","b":"b","c":"c"}`
        )
      })
    })

    describe("pick", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).mapFields(Struct.pick(["a"]))

        await assertions.decoding.succeed(schema, { a: "a" })
      })
    })

    describe("omit", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).mapFields(Struct.omit(["b"]))

        await assertions.decoding.succeed(schema, { a: "a" })
      })
    })
  })

  describe("Tuple", () => {
    it("A required element cannot follow an optional element", () => {
      throws(
        () => Schema.Tuple([Schema.optionalKey(Schema.String), Schema.String]),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
      throws(
        () => Schema.Tuple([Schema.optional(Schema.String), Schema.String]),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
    })

    it(`readonly [string]`, async () => {
      const schema = Schema.Tuple([Schema.NonEmptyString])

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
         └─ Expected a value with a length of at least 1, actual ""`
      )
      assertions.makeSync.succeed(schema, ["a"])
      assertions.makeSync.fail(schema, [""])

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
      const schema = Schema.Tuple([Schema.String.pipe(Schema.optionalKey)])

      strictEqual(SchemaAST.format(schema.ast), `readonly [string?]`)

      assertions.makeSync.succeed(schema, ["a"])
      assertions.makeSync.succeed(schema, [])

      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.succeed(schema, [])

      await assertions.encoding.succeed(schema, ["a"])
      await assertions.encoding.succeed(schema, [])
    })
  })

  describe("Array", () => {
    it("should expose the item schema", () => {
      const schema = Schema.Array(Schema.String)
      strictEqual(schema.schema, Schema.String)
    })

    it("readonly string[]", async () => {
      const schema = Schema.Array(Schema.String)

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

  describe("NonEmptyArray", () => {
    it("should expose the item schema", () => {
      const schema = Schema.NonEmptyArray(Schema.String)
      strictEqual(schema.schema, Schema.String)
    })

    it("readonly string[]", async () => {
      const schema = Schema.NonEmptyArray(Schema.String)

      strictEqual(SchemaAST.format(schema.ast), `readonly [string, ...Array<string>]`)

      await assertions.make.succeed(schema, ["a"])
      await assertions.make.succeed(schema, ["a", "b"])
      assertions.makeSync.succeed(schema, ["a"])
      assertions.makeSync.succeed(schema, ["a", "b"])

      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.succeed(schema, ["a", "b"])
      await assertions.decoding.fail(
        schema,
        [],
        `readonly [string, ...Array<string>]
└─ [0]
   └─ Missing key`
      )
      await assertions.decoding.fail(
        schema,
        ["a", 1],
        `readonly [string, ...Array<string>]
└─ [1]
   └─ Expected string, actual 1`
      )

      await assertions.encoding.succeed(schema, ["a"])
      await assertions.encoding.succeed(schema, ["a", "b"])
      await assertions.encoding.fail(
        schema,
        [] as any,
        `readonly [string, ...Array<string>]
└─ [0]
   └─ Missing key`
      )
      await assertions.encoding.fail(
        schema,
        ["a", 1] as any,
        `readonly [string, ...Array<string>]
└─ [1]
   └─ Expected string, actual 1`
      )
    })
  })

  describe("Checks", () => {
    describe("check", () => {
      it("single check", async () => {
        const schema = Schema.String.check(SchemaCheck.minLength(3))

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3)
└─ minLength(3)
   └─ Expected a value with a length of at least 3, actual "ab"`
        )
      })

      it("multiple checks", async () => {
        const schema = Schema.String.check(
          SchemaCheck.minLength(3),
          SchemaCheck.includes("c")
        )

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3) & includes("c")
└─ minLength(3)
   └─ Expected a value with a length of at least 3, actual "ab"`
        )
        await assertions.decoding.fail(
          schema,
          "ab",
          `string & minLength(3) & includes("c")
├─ minLength(3)
│  └─ Expected a value with a length of at least 3, actual "ab"
└─ includes("c")
   └─ Expected a string including "c", actual "ab"`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("aborting checks", async () => {
        const schema = Schema.String.check(
          SchemaCheck.abort(SchemaCheck.minLength(2)),
          SchemaCheck.includes("b")
        )

        await assertions.decoding.fail(
          schema,
          "a",
          `string & minLength(2) & includes("b")
└─ minLength(2)
   └─ Expected a value with a length of at least 2, actual "a"`
        )
      })
    })

    describe("refinement", () => {
      it("guard", async () => {
        const schema = Schema.Option(Schema.String).pipe(
          Schema.guard(Option.isSome, { title: "isSome" }),
          Schema.check(
            SchemaCheck.make(({ value }) => value.length > 0, { title: "length > 0" })
          )
        )

        strictEqual(SchemaAST.format(schema.ast), `Option<string> & isSome & length > 0`)

        await assertions.decoding.succeed(schema, Option.some("a"))
        await assertions.decoding.fail(
          schema,
          Option.some(""),
          `Option<string> & isSome & length > 0
└─ length > 0
   └─ Expected length > 0, actual {
  "_id": "Option",
  "_tag": "Some",
  "value": ""
}`
        )
        await assertions.decoding.fail(
          schema,
          Option.none(),
          `Option<string> & isSome & length > 0
└─ isSome
   └─ Expected Option<string> & isSome & length > 0, actual {
  "_id": "Option",
  "_tag": "None"
}`
        )
      })

      describe("brand", () => {
        it("single brand", () => {
          const schema = Schema.Number.pipe(Schema.brand("MyBrand"))

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.["~brand.type"], "MyBrand")
        })

        it("double brand", () => {
          const schema = Schema.Number.pipe(
            Schema.brand("MyBrand"),
            Schema.brand("MyBrand2")
          )

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.["~brand.type"], "MyBrand")
          deepStrictEqual(schema.ast.checks?.[1]?.annotations?.["~brand.type"], "MyBrand2")
        })
      })

      it("group", async () => {
        const usernameGroup = new SchemaCheck.FilterGroup(
          [
            SchemaCheck.minLength(3),
            SchemaCheck.regex(/^[a-zA-Z0-9]+$/, {
              title: "alphanumeric",
              description: "must contain only letters and numbers"
            }),
            SchemaCheck.trimmed
          ],
          {
            title: "username",
            description: "a valid username"
          }
        ).and(SchemaCheck.branded("Username"))

        const Username = Schema.String.pipe(Schema.refine(usernameGroup))

        strictEqual(SchemaAST.format(Username.ast), `string & username & Brand<"Username">`)

        await assertions.decoding.succeed(Username, "abc")
        await assertions.decoding.fail(
          Username,
          "",
          `string & username & Brand<"Username">
└─ minLength(3)
   └─ Expected a value with a length of at least 3, actual ""`
        )
      })
    })

    describe("String checks", () => {
      it("regex", async () => {
        const schema = Schema.String.check(SchemaCheck.regex(/^a/))

        strictEqual(SchemaAST.format(schema.ast), `string & regex(^a)`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & regex(^a)
└─ regex(^a)
   └─ Expected a string matching the pattern ^a, actual "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & regex(^a)
└─ regex(^a)
   └─ Expected a string matching the pattern ^a, actual "b"`
        )
      })

      it("startsWith", async () => {
        const schema = Schema.String.check(SchemaCheck.startsWith("a"))

        strictEqual(SchemaAST.format(schema.ast), `string & startsWith("a")`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & startsWith("a")
└─ startsWith("a")
   └─ Expected a string starting with "a", actual "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & startsWith("a")
└─ startsWith("a")
   └─ Expected a string starting with "a", actual "b"`
        )
      })

      it("endsWith", async () => {
        const schema = Schema.String.check(SchemaCheck.endsWith("a"))

        strictEqual(SchemaAST.format(schema.ast), `string & endsWith("a")`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `string & endsWith("a")
└─ endsWith("a")
   └─ Expected a string ending with "a", actual "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `string & endsWith("a")
└─ endsWith("a")
   └─ Expected a string ending with "a", actual "b"`
        )
      })

      it("lowercased", async () => {
        const schema = Schema.String.check(SchemaCheck.lowercased)

        strictEqual(SchemaAST.format(schema.ast), `string & lowercased`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "A",
          `string & lowercased
└─ lowercased
   └─ Expected a string with all characters in lowercase, actual "A"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "A",
          `string & lowercased
└─ lowercased
   └─ Expected a string with all characters in lowercase, actual "A"`
        )
      })

      it("uppercased", async () => {
        const schema = Schema.String.check(SchemaCheck.uppercased)

        strictEqual(SchemaAST.format(schema.ast), `string & uppercased`)

        await assertions.decoding.succeed(schema, "A")
        await assertions.decoding.fail(
          schema,
          "a",
          `string & uppercased
└─ uppercased
   └─ Expected a string with all characters in uppercase, actual "a"`
        )

        await assertions.encoding.succeed(schema, "A")
        await assertions.encoding.fail(
          schema,
          "a",
          `string & uppercased
└─ uppercased
   └─ Expected a string with all characters in uppercase, actual "a"`
        )
      })

      it("trimmed", async () => {
        const schema = Schema.String.check(SchemaCheck.trimmed)

        strictEqual(SchemaAST.format(schema.ast), `string & trimmed`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          " a ",
          `string & trimmed
└─ trimmed
   └─ Expected a string with no leading or trailing whitespace, actual " a "`
        )
      })

      it("minLength", async () => {
        const schema = Schema.String.check(SchemaCheck.minLength(1))

        strictEqual(SchemaAST.format(schema.ast), `string & minLength(1)`)

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "",
          `string & minLength(1)
└─ minLength(1)
   └─ Expected a value with a length of at least 1, actual ""`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "",
          `string & minLength(1)
└─ minLength(1)
   └─ Expected a value with a length of at least 1, actual ""`
        )
      })

      it("minEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(SchemaCheck.minEntries(1))

        strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string]: number & finite } & minEntries(1)`)

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
        await assertions.decoding.fail(
          schema,
          {},
          `{ readonly [x: string]: number & finite } & minEntries(1)
└─ minEntries(1)
   └─ Expected an object with at least 1 entries, actual {}`
        )
      })

      it("maxEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(SchemaCheck.maxEntries(2))

        strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string]: number & finite } & maxEntries(2)`)

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
        await assertions.decoding.fail(
          schema,
          { a: 1, b: 2, c: 3 },
          `{ readonly [x: string]: number & finite } & maxEntries(2)
└─ maxEntries(2)
   └─ Expected an object with at most 2 entries, actual {"a":1,"b":2,"c":3}`
        )
      })
    })

    describe("Number checks", () => {
      it("greaterThan", async () => {
        const schema = Schema.Number.check(SchemaCheck.greaterThan(1))

        strictEqual(SchemaAST.format(schema.ast), `number & greaterThan(1)`)

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          1,
          `number & greaterThan(1)
└─ greaterThan(1)
   └─ Expected a value greater than 1, actual 1`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          1,
          `number & greaterThan(1)
└─ greaterThan(1)
   └─ Expected a value greater than 1, actual 1`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.Number.check(SchemaCheck.greaterThanOrEqualTo(1))

        strictEqual(SchemaAST.format(schema.ast), `number & greaterThanOrEqualTo(1)`)

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          0,
          `number & greaterThanOrEqualTo(1)
└─ greaterThanOrEqualTo(1)
   └─ Expected a value greater than or equal to 1, actual 0`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.Number.check(SchemaCheck.lessThan(1))

        strictEqual(SchemaAST.format(schema.ast), `number & lessThan(1)`)

        await assertions.decoding.succeed(schema, 0)
        await assertions.decoding.fail(
          schema,
          1,
          `number & lessThan(1)
└─ lessThan(1)
   └─ Expected a value less than 1, actual 1`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.Number.check(SchemaCheck.lessThanOrEqualTo(1))

        strictEqual(SchemaAST.format(schema.ast), `number & lessThanOrEqualTo(1)`)

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          2,
          `number & lessThanOrEqualTo(1)
└─ lessThanOrEqualTo(1)
   └─ Expected a value less than or equal to 1, actual 2`
        )
      })

      it("multipleOf", async () => {
        const schema = Schema.Number.check(SchemaCheck.multipleOf(2))

        strictEqual(SchemaAST.format(schema.ast), `number & multipleOf(2)`)

        await assertions.decoding.succeed(schema, 4)
        await assertions.decoding.fail(
          schema,
          3,
          `number & multipleOf(2)
└─ multipleOf(2)
   └─ Expected a value that is a multiple of 2, actual 3`
        )
      })

      it("between", async () => {
        const schema = Schema.Number.check(SchemaCheck.between(1, 3))

        strictEqual(SchemaAST.format(schema.ast), `number & between(1, 3)`)

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          0,
          `number & between(1, 3)
└─ between(1, 3)
   └─ Expected a value between 1 and 3, actual 0`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          0,
          `number & between(1, 3)
└─ between(1, 3)
   └─ Expected a value between 1 and 3, actual 0`
        )
      })

      it("int", async () => {
        const schema = Schema.Number.check(SchemaCheck.int)

        strictEqual(SchemaAST.format(schema.ast), `number & int`)

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          1.1,
          `number & int
└─ int
   └─ Expected an integer, actual 1.1`
        )

        await assertions.encoding.succeed(schema, 1)
        await assertions.encoding.fail(
          schema,
          1.1,
          `number & int
└─ int
   └─ Expected an integer, actual 1.1`
        )
      })

      it("int32", async () => {
        const schema = Schema.Number.check(SchemaCheck.int32)

        strictEqual(SchemaAST.format(schema.ast), `number & int32`)

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          1.1,
          `number & int32
└─ int
   └─ Expected an integer, actual 1.1`
        )
        await assertions.decoding.fail(
          schema,
          Number.MAX_SAFE_INTEGER + 1,
          `number & int32
└─ int
   └─ Expected an integer, actual 9007199254740992`
        )
        await assertions.decoding.fail(
          schema,
          Number.MAX_SAFE_INTEGER + 1,
          `number & int32
├─ int
│  └─ Expected an integer, actual 9007199254740992
└─ between(-2147483648, 2147483647)
   └─ Expected a value between -2147483648 and 2147483647, actual 9007199254740992`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.encoding.succeed(schema, 1)
        await assertions.encoding.fail(
          schema,
          1.1,
          `number & int32
└─ int
   └─ Expected an integer, actual 1.1`
        )
        await assertions.encoding.fail(
          schema,
          Number.MAX_SAFE_INTEGER + 1,
          `number & int32
└─ int
   └─ Expected an integer, actual 9007199254740992`
        )
      })
    })

    describe("BigInt Checks", () => {
      const options = { order: Order.bigint, format: (value: bigint) => `${value}n` }

      const between = SchemaCheck.deriveBetween(options)
      const greaterThan = SchemaCheck.deriveGreaterThan(options)
      const greaterThanOrEqualTo = SchemaCheck.deriveGreaterThanOrEqualTo(options)
      const lessThan = SchemaCheck.deriveLessThan(options)
      const lessThanOrEqualTo = SchemaCheck.deriveLessThanOrEqualTo(options)
      const multipleOf = SchemaCheck.deriveMultipleOf({
        remainder: BigInt.remainder,
        zero: 0n,
        format: (value: bigint) => `${value}n`
      })

      const positive = greaterThan(0n)
      const nonNegative = greaterThanOrEqualTo(0n)
      const negative = lessThan(0n)
      const nonPositive = lessThanOrEqualTo(0n)

      it("between", async () => {
        const schema = Schema.BigInt.check(between(5n, 10n))

        strictEqual(SchemaAST.format(schema.ast), `bigint & between(5n, 10n)`)

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 7n)
        await assertions.decoding.succeed(schema, 10n)
        await assertions.decoding.fail(
          schema,
          4n,
          `bigint & between(5n, 10n)
└─ between(5n, 10n)
   └─ Expected a value between 5n and 10n, actual 4n`
        )
      })

      it("greaterThan", async () => {
        const schema = Schema.BigInt.check(greaterThan(5n))

        strictEqual(SchemaAST.format(schema.ast), `bigint & greaterThan(5n)`)

        await assertions.decoding.succeed(schema, 6n)
        await assertions.decoding.fail(
          schema,
          5n,
          `bigint & greaterThan(5n)
└─ greaterThan(5n)
   └─ Expected a value greater than 5n, actual 5n`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.BigInt.check(greaterThanOrEqualTo(5n))

        strictEqual(SchemaAST.format(schema.ast), `bigint & greaterThanOrEqualTo(5n)`)

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 6n)
        await assertions.decoding.fail(
          schema,
          4n,
          `bigint & greaterThanOrEqualTo(5n)
└─ greaterThanOrEqualTo(5n)
   └─ Expected a value greater than or equal to 5n, actual 4n`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.BigInt.check(lessThan(5n))

        strictEqual(SchemaAST.format(schema.ast), `bigint & lessThan(5n)`)

        await assertions.decoding.succeed(schema, 4n)
        await assertions.decoding.fail(
          schema,
          5n,
          `bigint & lessThan(5n)
└─ lessThan(5n)
   └─ Expected a value less than 5n, actual 5n`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.BigInt.check(lessThanOrEqualTo(5n))

        strictEqual(SchemaAST.format(schema.ast), `bigint & lessThanOrEqualTo(5n)`)

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 4n)
        await assertions.decoding.fail(
          schema,
          6n,
          `bigint & lessThanOrEqualTo(5n)
└─ lessThanOrEqualTo(5n)
   └─ Expected a value less than or equal to 5n, actual 6n`
        )
      })

      it("multipleOf", async () => {
        const schema = Schema.BigInt.check(multipleOf(5n))

        strictEqual(SchemaAST.format(schema.ast), `bigint & multipleOf(5n)`)
      })

      it("positive", async () => {
        const schema = Schema.BigInt.check(positive)

        strictEqual(SchemaAST.format(schema.ast), `bigint & greaterThan(0n)`)
      })

      it("nonNegative", async () => {
        const schema = Schema.BigInt.check(nonNegative)

        strictEqual(SchemaAST.format(schema.ast), `bigint & greaterThanOrEqualTo(0n)`)
      })

      it("negative", async () => {
        const schema = Schema.BigInt.check(negative)

        strictEqual(SchemaAST.format(schema.ast), `bigint & lessThan(0n)`)
      })

      it("nonPositive", async () => {
        const schema = Schema.BigInt.check(nonPositive)

        strictEqual(SchemaAST.format(schema.ast), `bigint & lessThanOrEqualTo(0n)`)
      })
    })

    describe("Record checks", () => {
      it("entries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Number).check(SchemaCheck.entries(2))

        strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string]: number } & entries(2)`)

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
        await assertions.decoding.succeed(schema, { ["__proto__"]: 0, "": 0 })
        await assertions.decoding.fail(
          schema,
          { a: 1 },
          `{ readonly [x: string]: number } & entries(2)
└─ entries(2)
   └─ Expected an object with exactly 2 entries, actual {"a":1}`
        )
        await assertions.decoding.fail(
          schema,
          { a: 1, b: 2, c: 3 },
          `{ readonly [x: string]: number } & entries(2)
└─ entries(2)
   └─ Expected an object with exactly 2 entries, actual {"a":1,"b":2,"c":3}`
        )
      })
    })

    describe("Structural checks", () => {
      it("Array + minLength", async () => {
        const schema = Schema.Struct({
          tags: Schema.Array(Schema.NonEmptyString).check(SchemaCheck.minLength(3))
        })

        await assertions.decoding.fail(
          schema,
          {},
          `{ readonly "tags": ReadonlyArray<string & minLength(1)> & minLength(3) }
└─ ["tags"]
   └─ Missing key`
        )
        await assertions.decoding.fail(
          schema,
          { tags: ["a", ""] },
          `{ readonly "tags": ReadonlyArray<string & minLength(1)> & minLength(3) }
└─ ["tags"]
   └─ ReadonlyArray<string & minLength(1)> & minLength(3)
      ├─ [1]
      │  └─ string & minLength(1)
      │     └─ minLength(1)
      │        └─ Expected a value with a length of at least 1, actual ""
      └─ minLength(3)
         └─ Expected a value with a length of at least 3, actual ["a",""]`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("Record + maxEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(SchemaCheck.maxEntries(2))

        await assertions.decoding.fail(
          schema,
          null,
          `Expected { readonly [x: string]: number & finite } & maxEntries(2), actual null`
        )
        await assertions.decoding.fail(
          schema,
          { a: 1, b: NaN, c: 3 },
          `{ readonly [x: string]: number & finite } & maxEntries(2)
├─ ["b"]
│  └─ number & finite
│     └─ finite
│        └─ Expected a finite number, actual NaN
└─ maxEntries(2)
   └─ Expected an object with at most 2 entries, actual {"a":1,"b":NaN,"c":3}`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("Map + maxSize", async () => {
        const schema = Schema.Map(Schema.String, Schema.Finite).check(SchemaCheck.maxSize(2))

        await assertions.decoding.fail(
          schema,
          null,
          `Expected Map<string, number & finite> & maxSize(2), actual null`
        )
        await assertions.decoding.fail(
          schema,
          new Map([["a", 1], ["b", NaN], ["c", 3]]),
          `Map<string, number & finite> & maxSize(2)
├─ ReadonlyArray<readonly [string, number & finite]>
│  └─ [1]
│     └─ readonly [string, number & finite]
│        └─ [1]
│           └─ number & finite
│              └─ finite
│                 └─ Expected a finite number, actual NaN
└─ maxSize(2)
   └─ Expected a value with a size of at most 2, actual Map([["a",1],["b",NaN],["c",3]])`,
          { parseOptions: { errors: "all" } }
        )
      })
    })
  })

  describe("Transformations", () => {
    it("annotations on both sides", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          {
            decode: SchemaGetter.fail((o) => new SchemaIssue.InvalidData(o, { title: "a valid decoding" })),
            encode: SchemaGetter.fail((o) => new SchemaIssue.InvalidData(o, { title: "a valid encoding" }))
          }
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `string <-> string`)

      await assertions.decoding.fail(
        schema,
        "a",
        `string <-> string
└─ Expected a valid decoding, actual "a"`
      )

      await assertions.encoding.fail(
        schema,
        "a",
        `string <-> string
└─ Expected a valid encoding, actual "a"`
      )
    })

    describe("String transformations", () => {
      it("trim", async () => {
        const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.trim()))

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
      const schema = Schema.FiniteFromString

      strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string`)

      await assertions.decoding.succeed(schema, "1", { expected: 1 })
      await assertions.decoding.fail(
        schema,
        "a",
        `number & finite <-> string
└─ finite
   └─ Expected a finite number, actual NaN`
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
      const schema = Schema.FiniteFromString.check(SchemaCheck.greaterThan(2))

      strictEqual(SchemaAST.format(schema.ast), `number & finite & greaterThan(2) <-> string`)

      await assertions.decoding.succeed(schema, "3", { expected: 3 })
      await assertions.decoding.fail(
        schema,
        "1",
        `number & finite & greaterThan(2) <-> string
└─ greaterThan(2)
   └─ Expected a value greater than 2, actual 1`
      )

      await assertions.encoding.succeed(schema, 3, { expected: "3" })
      await assertions.encoding.fail(
        schema,
        1,
        `string <-> number & finite & greaterThan(2)
└─ number & finite & greaterThan(2)
   └─ greaterThan(2)
      └─ Expected a value greater than 2, actual 1`
      )
    })
  })

  describe("decodeTo", () => {
    it("should expose the source and the target schemas", () => {
      const schema = Schema.FiniteFromString

      strictEqual(schema.from, Schema.String)
      strictEqual(schema.to, Schema.Finite)
    })

    it("transformation with checks", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.FiniteFromString,
          SchemaTransformation.trim()
        )
      )

      strictEqual(SchemaAST.format(schema.ast), `number & finite <-> string`)
    })

    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.String,
            SchemaTransformation.passthrough()
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
              encode: SchemaGetter.transformOptional(Option.orElseSome(() => "default"))
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
              decode: SchemaGetter.transformOptional(Option.orElseSome(() => "default")),
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
        Schema.FiniteFromString,
        SchemaTransformation.passthrough()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Expected a finite number, actual NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.check(SchemaCheck.minLength(2)).pipe(
          Schema.decodeTo(
            Schema.String.check(SchemaCheck.minLength(3)),
            SchemaTransformation.passthrough()
          ),
          Schema.decodeTo(
            Schema.String,
            SchemaTransformation.passthrough()
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
            └─ Expected a value with a length of at least 3, actual "aa"`
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
            └─ Expected a value with a length of at least 3, actual "aa"`
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
                  decode: SchemaGetter.withDefault(() => "default-b"),
                  encode: SchemaGetter.passthrough()
                })
              )
            )
          }),
          SchemaTransformation.make({
            decode: SchemaGetter.withDefault(() => ({})),
            encode: SchemaGetter.passthrough()
          })
        ))
      })

      await assertions.decoding.succeed(schema, { a: { b: "b" } })
      await assertions.decoding.succeed(schema, { a: {} }, { expected: { a: { b: "default-b" } } })
      await assertions.decoding.succeed(schema, {}, { expected: { a: { b: "default-b" } } })
    })
  })

  describe("decode", () => {
    it("double transformation", async () => {
      const schema = Schema.String.pipe(
        Schema.decode(
          SchemaTransformation.trim().compose(
            SchemaTransformation.toLowerCase()
          )
        )
      )

      await assertions.decoding.succeed(schema, " A ", { expected: "a" })

      await assertions.encoding.succeed(schema, " A ", { expected: " A " })
    })
  })

  describe("encodeTo", () => {
    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String,
            SchemaTransformation.passthrough()
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
              decode: SchemaGetter.withDefault(() => "default"),
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
              encode: SchemaGetter.withDefault(() => "default")
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
      const schema = Schema.FiniteFromString.pipe(Schema.encodeTo(
        Trim,
        SchemaTransformation.passthrough()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number & finite <-> string
└─ finite
   └─ Expected a finite number, actual NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String.check(SchemaCheck.minLength(3)),
            SchemaTransformation.passthrough()
          ),
          Schema.encodeTo(
            Schema.String.check(SchemaCheck.minLength(2)),
            SchemaTransformation.passthrough()
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
            └─ Expected a value with a length of at least 3, actual "aa"`
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
            └─ Expected a value with a length of at least 3, actual "aa"`
      )
    })
  })

  describe("encode", () => {
    it("double transformation", async () => {
      const schema = Schema.String.pipe(
        Schema.encode(
          SchemaTransformation.trim().compose(
            SchemaTransformation.toLowerCase()
          ).flip()
        )
      )

      await assertions.decoding.succeed(schema, " A ", { expected: " A " })

      await assertions.encoding.succeed(schema, " A ", { expected: "a" })
    })
  })

  describe("flip", () => {
    it("should expose the schema", () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      const flipped = schema.pipe(Schema.flip)
      strictEqual(flipped.schema, schema)
    })

    it("string & minLength(3) <-> number & greaterThan(2)", async () => {
      const schema = Schema.FiniteFromString.pipe(
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
      └─ Expected a value greater than 2, actual 2`
      )
      await assertions.decoding.fail(
        schema,
        3,
        `string & minLength(3) <-> number & finite & greaterThan(2)
└─ minLength(3)
   └─ Expected a value with a length of at least 3, actual "3"`
      )
    })

    it("should work with withConstructorDefault", () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
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
      const schema = Schema.Option(Schema.FiniteFromString)

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
        a: Schema.FiniteFromString.check(SchemaCheck.greaterThan(0)),
        categories: Schema.Array(Schema.suspend((): Schema.Codec<CategoryType, CategoryEncoded> => schema))
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
                     └─ Expected a finite number, actual NaN`
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
                        └─ Expected a value greater than 0, actual -1`
      )
    })
  })

  describe("withConstructorDefault", () => {
    describe("Struct", () => {
      it("should not apply defaults when decoding / encoding", async () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.optionalKey, Schema.withConstructorDefault(() => Option.some("a")))
        })

        await assertions.decoding.succeed(schema, {})
        await assertions.encoding.succeed(schema, {}, {})
      })

      it("should pass the input to the default value", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(
            Schema.UndefinedOr,
            Schema.withConstructorDefault((o) => {
              if (Option.isSome(o)) {
                return Option.some("undefined-default")
              }
              return Option.some("otherwise-default")
            })
          )
        })

        assertions.makeSync.succeed(schema, { a: "a" })
        assertions.makeSync.succeed(schema, {}, { a: "otherwise-default" })
        assertions.makeSync.succeed(schema, { a: undefined }, { a: "undefined-default" })
      })

      it("Struct & Some", () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
        })

        assertions.makeSync.succeed(schema, { a: 1 })
        assertions.makeSync.succeed(schema, {}, { a: -1 })
      })

      it("Struct & None", () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.none()))
        })

        assertions.makeSync.succeed(schema, { a: 1 })
        assertions.makeSync.fail(schema, {})
      })

      describe("nested defaults", () => {
        it("Struct", () => {
          const schema = Schema.Struct({
            a: Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          })

          assertions.makeSync.succeed(schema, { a: { b: 1 } })
          assertions.makeSync.succeed(schema, { a: {} }, { a: { b: -1 } })
          assertions.makeSync.succeed(schema, {}, { a: { b: -1 } })
        })

        it("Class", () => {
          class A extends Schema.Class<A>("A")(Schema.Struct({
            a: Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          })) {}

          assertions.makeSync.succeed(A, { a: { b: 1 } }, new A({ a: { b: 1 } }))
          assertions.makeSync.succeed(A, { a: {} }, new A({ a: { b: -1 } }))
          assertions.makeSync.succeed(A, {}, new A({ a: { b: -1 } }))
        })
      })

      it("Struct & Effect sync", () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Effect.succeed(Option.some(-1))))
        })

        assertions.makeSync.succeed(schema, { a: 1 })
        assertions.makeSync.succeed(schema, {}, { a: -1 })
      })

      it("Struct & Effect async", async () => {
        const schema = Schema.Struct({
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() =>
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
          a: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() =>
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
        const spr = SchemaToParser.makeSchemaResult(schema)({})
        const eff = SchemaResult.asEffect(spr)
        const provided = Effect.provideService(
          eff,
          Service,
          Service.of({ value: Effect.succeed(-1) })
        )
        await assertions.effect.succeed(provided, { a: -1 })
      })
    })

    describe("Tuple", () => {
      it("Tuple & Some", () => {
        const schema = Schema.Tuple(
          [Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))]
        )

        assertions.makeSync.succeed(schema, [1])
        assertions.makeSync.succeed(schema, [], [-1])
      })

      it("nested defaults (Struct)", () => {
        const schema = Schema.Tuple(
          [
            Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          ]
        )

        assertions.makeSync.succeed(schema, [{ b: 1 }])
        assertions.makeSync.succeed(schema, [{}], [{ b: -1 }])
        assertions.makeSync.succeed(schema, [], [{ b: -1 }])
      })

      it("nested defaults (Tuple)", () => {
        const schema = Schema.Tuple(
          [
            Schema.Tuple([
              Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            ]).pipe(Schema.withConstructorDefault(() => Option.some([] as const)))
          ]
        )

        assertions.makeSync.succeed(schema, [[1]])
        assertions.makeSync.succeed(schema, [[]], [[-1]])
        assertions.makeSync.succeed(schema, [], [[-1]])
      })
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", async () => {
      const schema = Schema.Record(Schema.String, Schema.Number)

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string]: number }`)

      await assertions.make.succeed(schema, { a: 1 })
      await assertions.make.fail(schema, null as any, `Expected { readonly [x: string]: number }, actual null`)
      assertions.makeSync.succeed(schema, { a: 1 })
      assertions.makeSync.fail(schema, null as any)

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

    it("Record(Symbol, Number)", async () => {
      const schema = Schema.Record(Schema.Symbol, Schema.Number)

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: symbol]: number }`)

      await assertions.make.succeed(schema, { [Symbol.for("a")]: 1 })
      await assertions.make.fail(schema, null as any, `Expected { readonly [x: symbol]: number }, actual null`)
      assertions.makeSync.succeed(schema, { [Symbol.for("a")]: 1 })
      assertions.makeSync.fail(schema, null as any)

      await assertions.decoding.succeed(schema, { [Symbol.for("a")]: 1 })
      await assertions.decoding.fail(schema, null, "Expected { readonly [x: symbol]: number }, actual null")
      await assertions.decoding.fail(
        schema,
        { [Symbol.for("a")]: "b" },
        `{ readonly [x: symbol]: number }
└─ [Symbol(a)]
   └─ Expected number, actual "b"`
      )

      await assertions.encoding.succeed(schema, { [Symbol.for("a")]: 1 })
      await assertions.encoding.fail(
        schema,
        { [Symbol.for("a")]: "b" } as any,
        `{ readonly [x: symbol]: number }
└─ [Symbol(a)]
   └─ Expected number, actual "b"`
      )
      await assertions.encoding.fail(schema, null as any, "Expected { readonly [x: symbol]: number }, actual null")
    })

    it("Record(SnakeToCamel, NumberFromString)", async () => {
      const schema = Schema.Record(SnakeToCamel, NumberFromString)

      strictEqual(SchemaAST.format(schema.ast), `{ readonly [x: string <-> string]: number <-> string }`)

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1" }, { expected: { aB: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1", aB: "2" }, { expected: { aB: 2 } })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, { aB: 1 }, { expected: { a_b: "1" } })
      await assertions.encoding.succeed(schema, { a_b: 1, aB: 2 }, { expected: { a_b: "2" } })
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
        Schema.Number.check(SchemaCheck.greaterThan(0))
      ])

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) | number & greaterThan(0)`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1)
└─ minLength(1)
   └─ Expected a value with a length of at least 1, actual ""`
      )
      await assertions.decoding.fail(
        schema,
        -1,
        `number & greaterThan(0)
└─ greaterThan(0)
   └─ Expected a value greater than 0, actual -1`
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

  describe("TupleWithRest", () => {
    it("A required element cannot follow an optional element", () => {
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([Schema.optionalKey(Schema.String)]),
            [Schema.Boolean, Schema.String]
          ),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([Schema.optional(Schema.String)]),
            [Schema.Boolean, Schema.String]
          ),
        new Error("A required element cannot follow an optional element. ts(1257)")
      )
    })

    it("An optional element cannot follow a rest element", () => {
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([]),
            [Schema.Boolean, Schema.optionalKey(Schema.String)]
          ),
        new Error("An optional element cannot follow a rest element. ts(1266)")
      )
      throws(
        () =>
          Schema.TupleWithRest(
            Schema.Tuple([]),
            [Schema.Boolean, Schema.optional(Schema.String)]
          ),
        new Error("An optional element cannot follow a rest element. ts(1266)")
      )
    })

    it("[FiniteFromString, String] + [Boolean, String]", async () => {
      const schema = Schema.TupleWithRest(
        Schema.Tuple([Schema.FiniteFromString, Schema.String]),
        [Schema.Boolean, Schema.String]
      )

      strictEqual(
        SchemaAST.format(schema.ast),
        `readonly [number & finite <-> string, string, ...Array<boolean>, string]`
      )

      await assertions.decoding.succeed(schema, ["1", "a", true, "b"], { expected: [1, "a", true, "b"] })
    })
  })

  describe("StructWithRest", () => {
    it("should throw an error if there are duplicate index signatures", () => {
      throws(
        () =>
          Schema.StructWithRest(
            Schema.Struct({}),
            [
              Schema.Record(Schema.String, Schema.Number),
              Schema.Record(Schema.Symbol, Schema.Number),
              Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number),
              Schema.Record(Schema.TemplateLiteral(["b", Schema.String]), Schema.Number),
              Schema.Record(Schema.String, Schema.Number),
              Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Number)
            ]
          ),
        new Error(`Duplicate index signatures: ["StringKeyword","a\${StringKeyword}"]. ts(2374)`)
      )
    })

    it("should throw an error if there are encodings", () => {
      throws(
        () =>
          Schema.StructWithRest(
            Schema.Struct({}).pipe(Schema.encodeTo(Schema.String)),
            [Schema.Record(Schema.String, Schema.Number)]
          ),
        new Error(`StructWithRest does not support encodings`)
      )
    })

    it("Record(String, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.String, Schema.Number)]
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

    it("Record(Symbol, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.Symbol, Schema.Number)]
      )

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": number; readonly [x: symbol]: number }`)

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, [Symbol.for("b")]: 2 })
      await assertions.decoding.fail(
        schema,
        { a: 1, [Symbol.for("b")]: "c" },
        `{ readonly "a": number; readonly [x: symbol]: number }
└─ [Symbol(b)]
   └─ Expected number, actual "c"`
      )
    })

    it("Record(`a${string}`, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Finite)]
      )

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "a": number; readonly [x: \`a\${string}\`]: number & finite }`
      )

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, "ab": 2 })
      await assertions.decoding.fail(
        schema,
        { a: NaN, "ab": 2 },
        `{ readonly "a": number; readonly [x: \`a\${string}\`]: number & finite }
└─ ["a"]
   └─ number & finite
      └─ finite
         └─ Expected a finite number, actual NaN`
      )
      await assertions.decoding.fail(
        schema,
        { a: 1, "ab": "c" },
        `{ readonly "a": number; readonly [x: \`a\${string}\`]: number & finite }
└─ ["ab"]
   └─ Expected number & finite, actual "c"`
      )
    })

    it("should preserve both checks", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }).check(
          SchemaCheck.make((s) => s.a > 0, { title: "agt(0)" })
        ),
        [
          Schema.Record(Schema.String, Schema.Number).check(
            SchemaCheck.make((s) => s.b === undefined || s.b > 1, { title: "bgt(1)" })
          )
        ]
      )

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "a": number; readonly [x: string]: number } & agt(0) & bgt(1)`
      )

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, b: 2 })
      await assertions.decoding.fail(
        schema,
        { a: 0 },
        `{ readonly "a": number; readonly [x: string]: number } & agt(0) & bgt(1)
└─ agt(0)
   └─ Expected agt(0), actual {"a":0}`
      )
      await assertions.decoding.fail(
        schema,
        { a: 1, b: 1 },
        `{ readonly "a": number; readonly [x: string]: number } & agt(0) & bgt(1)
└─ bgt(1)
   └─ Expected bgt(1), actual {"a":1,"b":1}`
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
   └─ Expected a value with a length of at least 1, actual ""`
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
   └─ Expected a value with a length of at least 1, actual ""`
      )
    })
  })

  describe("NullishOr", () => {
    it("NullishOr(String)", async () => {
      const schema = Schema.NullishOr(Schema.NonEmptyString)

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) | null | undefined`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null)
      await assertions.decoding.succeed(schema, undefined)
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1)
└─ minLength(1)
   └─ Expected a value with a length of at least 1, actual ""`
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
          SchemaTransformation.toLowerCase()
        )
      )

      await assertions.decoding.succeed(schema, "A", { expected: "a" })
      await assertions.decoding.succeed(schema, "B", { expected: "b" })
    })

    it("toUpperCase", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(Schema.String, SchemaTransformation.toUpperCase())
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
        a: Schema.FiniteFromString
      })

      await assertions.decoding.succeed(schema, { _tag: "a", a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.encoding.succeed(schema, { _tag: "a", a: 1 }, { expected: { _tag: "a", a: "1" } })
      assertions.makeSync.succeed(schema, { _tag: "a", a: 1 })
    })

    it("decoding: required & encoding: required & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a"),
        a: Schema.FiniteFromString
      })

      await assertions.decoding.succeed(schema, { _tag: "a", a: "1" }, { expected: { _tag: "a", a: 1 } })
      await assertions.encoding.succeed(schema, { _tag: "a", a: 1 }, { expected: { _tag: "a", a: "1" } })
      assertions.makeSync.succeed(schema, { _tag: "a", a: 1 })
      assertions.makeSync.succeed(schema, { a: 1 }, { _tag: "a", a: 1 })
    })

    it("decoding: default & encoding: omit & constructor: optional", async () => {
      const schema = Schema.Struct({
        _tag: Schema.tag("a").pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.Literal("a")),
            {
              decode: SchemaGetter.withDefault(() => "a" as const),
              encode: SchemaGetter.omit()
            }
          )
        ),
        a: Schema.FiniteFromString
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
          SchemaTransformation.passthroughSupertype()
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
            SchemaTransformation.passthroughSupertype()
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
              ? SchemaResult.fail(new SchemaIssue.Forbidden(Option.some(s), { message: "not a" }))
              : SchemaResult.succeed(s),
          encode: (s) =>
            s === "b"
              ? SchemaResult.fail(new SchemaIssue.Forbidden(Option.some(s), { message: "not b" }))
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
    it("should expose the parts", () => {
      const parts = ["a", Schema.String] as const
      const schema = Schema.TemplateLiteral(parts)
      deepStrictEqual(schema.parts, parts)
    })

    it("getTemplateLiteralRegExp", () => {
      const assertSource = (
        parts: Schema.TemplateLiteral.Parts,
        source: string
      ) => {
        strictEqual(SchemaAST.getTemplateLiteralRegExp(Schema.TemplateLiteral(parts).ast).source, source)
      }

      assertSource(["a"], "^(a)$")
      assertSource(["a", "b"], "^(a)(b)$")
      assertSource([Schema.Literals(["a", "b"]), "c"], "^(a|b)(c)$")
      assertSource(
        [Schema.Literals(["a", "b"]), "c", Schema.Literals(["d", "e"])],
        "^(a|b)(c)(d|e)$"
      )
      assertSource(
        [Schema.Literals(["a", "b"]), Schema.String, Schema.Literals(["d", "e"])],
        "^(a|b)([\\s\\S]*)(d|e)$"
      )
      assertSource(["a", Schema.String], "^(a)([\\s\\S]*)$")
      assertSource(["a", Schema.String, "b"], "^(a)([\\s\\S]*)(b)$")
      assertSource(
        ["a", Schema.String, "b", Schema.Number],
        "^(a)([\\s\\S]*)(b)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)$"
      )
      assertSource(["a", Schema.Number], "^(a)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)$")
      assertSource([Schema.String, "a"], "^([\\s\\S]*)(a)$")
      assertSource([Schema.Number, "a"], "^([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)(a)$")
      assertSource(
        [Schema.Union([Schema.String, Schema.Literal(1)]), Schema.Union([Schema.Number, Schema.Literal("true")])],
        "^([\\s\\S]*|1)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|true)$"
      )
      assertSource(
        [Schema.Union([Schema.Literals(["a", "b"]), Schema.Literals([1, 2])])],
        "^(a|b|1|2)$"
      )
      assertSource(
        ["c", Schema.Union([Schema.TemplateLiteral(["a", Schema.String, "b"]), Schema.Literal("e")]), "d"],
        "^(c)(a[\\s\\S]*b|e)(d)$"
      )
      assertSource(
        ["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2])]), ">"],
        "^(<)(h(?:1|2))(>)$"
      )
      assertSource(
        [
          "-",
          Schema.Union([
            Schema.TemplateLiteral(["a", Schema.Literals(["b", "c"])]),
            Schema.TemplateLiteral(["d", Schema.Literals(["e", "f"])])
          ])
        ],
        "^(-)(a(?:b|c)|d(?:e|f))$"
      )
    })

    it(`"a"`, async () => {
      const schema = Schema.TemplateLiteral(["a"])

      strictEqual(SchemaAST.format(schema.ast), "`a`")

      await assertions.decoding.succeed(schema, "a")

      await assertions.decoding.fail(schema, "ab", `Expected \`a\`, actual "ab"`)
      await assertions.decoding.fail(schema, "", `Expected \`a\`, actual ""`)
      await assertions.decoding.fail(schema, null, `Expected \`a\`, actual null`)
    })

    it(`"a b"`, async () => {
      const schema = Schema.TemplateLiteral(["a", " ", "b"])

      strictEqual(SchemaAST.format(schema.ast), "`a b`")

      await assertions.decoding.succeed(schema, "a b")

      await assertions.decoding.fail(schema, "a  b", `Expected \`a b\`, actual "a  b"`)
    })

    it(`"[" + string + "]"`, async () => {
      const schema = Schema.TemplateLiteral(["[", Schema.String, "]"])

      strictEqual(SchemaAST.format(schema.ast), "`[${string}]`")

      await assertions.decoding.succeed(schema, "[a]")

      await assertions.decoding.fail(schema, "a", "Expected `[${string}]`, actual \"a\"")
    })

    it(`"a" + string`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String])

      strictEqual(SchemaAST.format(schema.ast), "`a${string}`")

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
      const schema = Schema.TemplateLiteral(["a", Schema.Number])

      strictEqual(SchemaAST.format(schema.ast), "`a${number}`")

      await assertions.decoding.succeed(schema, "a1")
      await assertions.decoding.succeed(schema, "a+1")
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

    it(`"a" + bigint`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.BigInt])

      strictEqual(SchemaAST.format(schema.ast), "`a${bigint}`")

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.succeed(schema, "a1")
      await assertions.decoding.succeed(schema, "a-1")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${bigint}`, actual null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${bigint}`, actual \"\""
      )
      await assertions.decoding.fail(
        schema,
        "aa",
        "Expected `a${bigint}`, actual \"aa\""
      )
      await assertions.decoding.fail(
        schema,
        "a1.2",
        "Expected `a${bigint}`, actual \"a1.2\""
      )
      await assertions.decoding.fail(
        schema,
        "a+1",
        "Expected `a${bigint}`, actual \"a+1\""
      )
    })

    it(`string`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String])

      strictEqual(SchemaAST.format(schema.ast), "`${string}`")

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, "ab")
      await assertions.decoding.succeed(schema, "")
      await assertions.decoding.succeed(schema, "\n")
      await assertions.decoding.succeed(schema, "\r")
      await assertions.decoding.succeed(schema, "\r\n")
      await assertions.decoding.succeed(schema, "\t")
    })

    it(`\\n + string`, async () => {
      const schema = Schema.TemplateLiteral(["\n", Schema.String])

      strictEqual(SchemaAST.format(schema.ast), "`\n${string}`")

      await assertions.decoding.succeed(schema, "\n")
      await assertions.decoding.succeed(schema, "\na")
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `\n${string}`, actual \"a\""
      )
    })

    it(`a\\nb  + string`, async () => {
      const schema = Schema.TemplateLiteral(["a\nb ", Schema.String])

      strictEqual(SchemaAST.format(schema.ast), "`a\nb ${string}`")

      await assertions.decoding.succeed(schema, "a\nb ")
      await assertions.decoding.succeed(schema, "a\nb c")
    })

    it(`"a" + string + "b"`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String, "b"])

      strictEqual(SchemaAST.format(schema.ast), "`a${string}b`")

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
      const schema = Schema.TemplateLiteral(["a", Schema.String, "b", Schema.String])

      strictEqual(SchemaAST.format(schema.ast), "`a${string}b${string}`")

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
      const schema = Schema.TemplateLiteral([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), "_id"])

      strictEqual(
        SchemaAST.format(schema.ast),
        "`${\"welcome_email\" | \"email_heading\" | \"footer_title\" | \"footer_sendoff\"}_id`"
      )

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
      const schema = Schema.TemplateLiteral([Schema.String, 0])

      strictEqual(SchemaAST.format(schema.ast), "`${string}0`")

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.fail(schema, "a", "Expected `${string}0`, actual \"a\"")
    })

    it(`string + 1n`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, 1n])

      strictEqual(SchemaAST.format(schema.ast), "`${string}1`")

      await assertions.decoding.succeed(schema, "a1")
      await assertions.decoding.fail(schema, "a", "Expected `${string}1`, actual \"a\"")
    })

    it(`string + ("a" | 0)`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, Schema.Literals(["a", 0])])

      strictEqual(SchemaAST.format(schema.ast), "`${string}${\"a\" | 0}`")

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.succeed(schema, "aa")
      await assertions.decoding.fail(
        schema,
        "b",
        `Expected \`\${string}\${"a" | 0}\`, actual "b"`
      )
    })

    it(`(string | 1) + (number | true)`, async () => {
      const schema = Schema.TemplateLiteral([
        Schema.Union([Schema.String, Schema.Literal(1)]),
        Schema.Union([Schema.Number, Schema.Literal("true")])
      ])

      strictEqual(SchemaAST.format(schema.ast), "`${string | 1}${number | \"true\"}`")

      await assertions.decoding.succeed(schema, "atrue")
      await assertions.decoding.succeed(schema, "-2")
      await assertions.decoding.succeed(schema, "10.1")
      await assertions.decoding.fail(
        schema,
        "",
        `Expected \`\${string | 1}\${number | "true"}\`, actual ""`
      )
    })

    it("`c${`a${string}b` | \"e\"}d`", async () => {
      const schema = Schema.TemplateLiteral(
        ["c", Schema.Union([Schema.TemplateLiteral(["a", Schema.String, "b"]), Schema.Literal("e")]), "d"]
      )

      strictEqual(SchemaAST.format(schema.ast), "`c${`a${string}b` | \"e\"}d`")

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
      const schema = Schema.TemplateLiteral(["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2])]), ">"])

      strictEqual(SchemaAST.format(schema.ast), "`<${`h${1 | 2}`}>`")

      await assertions.decoding.succeed(schema, "<h1>")
      await assertions.decoding.succeed(schema, "<h2>")
      await assertions.decoding.fail(schema, "<h3>", "Expected `<${`h${1 | 2}`}>`, actual \"<h3>\"")
    })

    it(`"a" + check`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.NonEmptyString])

      strictEqual(SchemaAST.format(schema.ast), "`a${string & minLength(1)}`")

      await assertions.decoding.succeed(schema, "ab")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${string & minLength(1)}`, actual null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${string & minLength(1)}`, actual \"\""
      )
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `a${string & minLength(1)}`, actual \"a\""
      )
    })

    it(`"a" + transformation`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.FiniteFromString])

      strictEqual(SchemaAST.format(schema.ast), "`a${string}`")

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, "a1")

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
      await assertions.decoding.fail(
        schema,
        "ab",
        "Expected `a${string}`, actual \"ab\""
      )
    })
  })

  describe("TemplateLiteralParser", () => {
    it("should expose the parts", () => {
      const parts = ["a", Schema.String] as const
      const schema = Schema.TemplateLiteralParser(parts)
      deepStrictEqual(schema.parts, parts)
    })

    it(`"a"`, async () => {
      const schema = Schema.TemplateLiteralParser(["a"])

      strictEqual(SchemaAST.format(schema.ast), `readonly ["a"] <-> string`)

      await assertions.decoding.succeed(schema, "a", { expected: ["a"] })

      await assertions.decoding.fail(
        schema,
        "ab",
        `readonly ["a"] <-> string
└─ [0]
   └─ Missing key`
      )
      await assertions.decoding.fail(
        schema,
        "",
        `readonly ["a"] <-> string
└─ [0]
   └─ Missing key`
      )
      await assertions.decoding.fail(
        schema,
        null,
        `readonly ["a"] <-> string
└─ Expected string, actual null`
      )
    })

    it(`"a b"`, async () => {
      const schema = Schema.TemplateLiteralParser(["a", " ", "b"])

      strictEqual(SchemaAST.format(schema.ast), `readonly ["a", " ", "b"] <-> string`)

      await assertions.decoding.succeed(schema, "a b", { expected: ["a", " ", "b"] })

      await assertions.decoding.fail(
        schema,
        "a  b",
        `readonly ["a", " ", "b"] <-> string
└─ [0]
   └─ Missing key`
      )
    })

    it(`"h" + (1 | 2 | 3)`, async () => {
      const schema = Schema.TemplateLiteralParser(["h", Schema.Literals([1, 2, 3])])
      await assertions.decoding.succeed(schema, "h1", { expected: ["h", 1] })
    })

    it(`"c" + (\`a\${string}b\`|"e") + "d"`, async () => {
      const schema = Schema.TemplateLiteralParser([
        "c",
        Schema.Union([Schema.TemplateLiteralParser(["a", Schema.NonEmptyString, "b"]), Schema.Literal("e")]),
        "d"
      ])
      await assertions.decoding.succeed(schema, "ca bd", { expected: ["c", ["a", " ", "b"], "d"] })
      await assertions.decoding.succeed(schema, "ced", { expected: ["c", "e", "d"] })
      await assertions.decoding.fail(
        schema,
        "cabd",
        `readonly ["c", (readonly ["a", string & minLength(1), "b"] <-> string) | "e", "d"] <-> string
└─ [1]
   └─ (readonly ["a", string & minLength(1), "b"] <-> string) | "e"
      ├─ readonly ["a", string & minLength(1), "b"] <-> string
      │  └─ [1]
      │     └─ string & minLength(1)
      │        └─ minLength(1)
      │           └─ Expected a value with a length of at least 1, actual ""
      └─ Expected "e", actual "ab"`
      )
      await assertions.decoding.fail(
        schema,
        "ed",
        `readonly ["c", (readonly ["a", string & minLength(1), "b"] <-> string) | "e", "d"] <-> string
└─ [0]
   └─ Missing key`
      )
    })

    it(`"c" + (\`a\${number}b\`|"e") + "d"`, async () => {
      const schema = Schema.TemplateLiteralParser([
        "c",
        Schema.Union([
          Schema.TemplateLiteralParser(["a", Schema.Finite.check(SchemaCheck.int), "b"]),
          Schema.Literal("e")
        ]),
        "d"
      ])
      await assertions.decoding.succeed(schema, "ced", { expected: ["c", "e", "d"] })
      await assertions.decoding.succeed(schema, "ca1bd", { expected: ["c", ["a", 1, "b"], "d"] })
      await assertions.decoding.fail(
        schema,
        "ca1.1bd",
        `readonly ["c", (readonly ["a", number & finite & int <-> string, "b"] <-> string) | "e", "d"] <-> string
└─ [1]
   └─ (readonly ["a", number & finite & int <-> string, "b"] <-> string) | "e"
      ├─ readonly ["a", number & finite & int <-> string, "b"] <-> string
      │  └─ [1]
      │     └─ number & finite & int <-> string
      │        └─ int
      │           └─ Expected an integer, actual 1.1
      └─ Expected "e", actual "a1.1b"`
      )
      await assertions.decoding.fail(
        schema,
        "ca-bd",
        `readonly ["c", (readonly ["a", number & finite & int <-> string, "b"] <-> string) | "e", "d"] <-> string
└─ [1]
   └─ (readonly ["a", number & finite & int <-> string, "b"] <-> string) | "e"
      ├─ readonly ["a", number & finite & int <-> string, "b"] <-> string
      │  └─ [0]
      │     └─ Missing key
      └─ Expected "e", actual "a-b"`
      )
    })

    it("(`<${`h${\"1\" | \"2\"}`}>` <-> readonly [\"<\", `h${\"1\" | \"2\"}`, \">\"])", async () => {
      const schema = Schema.TemplateLiteralParser(["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2])]), ">"])
      await assertions.decoding.succeed(schema, "<h1>", { expected: ["<", "h1", ">"] })
      await assertions.decoding.succeed(schema, "<h2>", { expected: ["<", "h2", ">"] })
      await assertions.decoding.fail(
        schema,
        "<h3>",
        `readonly ["<", \`h\${1 | 2}\`, ">"] <-> string
└─ [0]
   └─ Missing key`
      )
    })

    it("(`<${`h${\"1\" | \"2\"}`}>` <-> readonly [\"<\", `h${\"1\" | \"2\"}`, \">\"])", async () => {
      const schema = Schema.TemplateLiteralParser([
        "<",
        Schema.TemplateLiteralParser(["h", Schema.Literals([1, 2])]),
        ">"
      ])
      await assertions.decoding.succeed(schema, "<h1>", { expected: ["<", ["h", 1], ">"] })
      await assertions.decoding.succeed(schema, "<h2>", { expected: ["<", ["h", 2], ">"] })
      await assertions.decoding.fail(
        schema,
        "<h3>",
        `readonly ["<", readonly ["h", (1 <-> string) | (2 <-> string)] <-> string, ">"] <-> string
└─ [1]
   └─ readonly ["h", (1 <-> string) | (2 <-> string)] <-> string
      └─ [0]
         └─ Missing key`
      )
    })
  })

  describe("Class", () => {
    it("suspend before initialization", async () => {
      const schema = Schema.suspend(() => string)
      class A extends Schema.Class<A>("A")(Schema.Struct({ a: schema })) {}
      const string = Schema.String

      assertions.makeSync.succeed(A, new A({ a: "a" }))
      assertions.makeSync.succeed(A, { a: "a" }, new A({ a: "a" }))

      await assertions.decoding.succeed(A, new A({ a: "a" }))
    })

    describe("should be compatible with `immer`", () => {
      it("`[immerable]`", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.Struct({ b: Schema.FiniteFromString }).pipe(Schema.optional),
          c: Schema.FiniteFromString
        }) {}

        const a = new A({ a: { b: 1 }, c: 2 })

        const modified = produce(a, (draft) => {
          if (draft.a) {
            draft.a.b = 2
          }
        })

        assertTrue(modified instanceof A)
        strictEqual(modified.a?.b, 2)
        strictEqual(modified.c, 2)
        strictEqual(a.a?.b, 1)
      })

      it("Equality", () => {
        class A extends Schema.Class<A>("A")({
          a: Schema.String
        }) {}

        const a = new A({ a: "a" })
        const a1 = produce(a, (draft) => {
          draft.a = "a1"
        })
        const a2 = produce(a, (draft) => {
          draft.a = "a1"
        })
        assertTrue(Equal.equals(a1, new A({ a: "a1" })))
        assertTrue(Equal.equals(a1, a2))
      })
    })

    it("Struct with nested Class", () => {
      class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
        a: Schema.String
      })) {}
      const schema = Schema.Struct({
        a: A.pipe(Schema.withConstructorDefault(() => Option.some(new A({ a: "default" }))))
      })

      assertions.makeSync.succeed(schema, { a: new A({ a: "a" }) })
      assertions.makeSync.succeed(schema, {}, { a: new A({ a: "default" }) })
    })

    it("Class with nested Class", () => {
      class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
        a: Schema.String
      })) {}
      class B extends Schema.Class<B, { readonly brand: unique symbol }>("B")(Schema.Struct({
        a: A.pipe(Schema.withConstructorDefault(() => Option.some(new A({ a: "default" }))))
      })) {}
      const schema = B

      assertions.makeSync.succeed(schema, { a: new A({ a: "a" }) }, new B({ a: new A({ a: "a" }) }))
      assertions.makeSync.succeed(schema, {}, new B({ a: new A({ a: "default" }) }))
    })

    it("should be possible to define a class with a mutable field", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.mutableKey(Schema.String)
      }) {
        public update() {
          this.a = "b"
        }
      }

      assertions.makeSync.succeed(A, new A({ a: "a" }))
      assertions.makeSync.succeed(A, { a: "a" }, new A({ a: "a" }))

      const a = new A({ a: "a" })
      a.update()
      strictEqual(a.a, "b")
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

      assertions.makeSync.succeed(A, new A({ a: "a" }))
      assertions.makeSync.succeed(A, { a: "a" }, new A({ a: "a" }))

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

      assertions.makeSync.succeed(A, new A({ a: "a" }))
      assertions.makeSync.succeed(A, { a: "a" }, new A({ a: "a" }))

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
      const A = A_.annotate({})

      // should be a schema
      assertTrue(Schema.isSchema(A))
      // should expose the fields
      deepStrictEqual(A.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      strictEqual(SchemaAST.format(A.ast), `A <-> { readonly "a": string }`)

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeSync({ a: "a" }) instanceof A)

      // test additional fields
      strictEqual(new A({ a: "a" })._a, 1)
      strictEqual(A.makeSync({ a: "a" })._a, 1)

      // test Equal.equals
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new A({ a: "a" }), new A({ a: "b" })))

      assertions.makeSync.succeed(A, new A({ a: "a" }))
      assertions.makeSync.succeed(A, { a: "a" }, new A({ a: "a" }))

      await assertions.decoding.succeed(A, { a: "a" }, { expected: new A({ a: "a" }) })
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `A <-> { readonly "a": string }
└─ A <-> { readonly "a": string }
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

    it("check", async () => {
      class A_ extends Schema.Class<A_>("A")({
        a: Schema.String
      }) {
        readonly _a = 1
      }
      const A = A_.check(SchemaCheck.make(() => true))

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

      assertions.makeSync.succeed(A, new A({ a: "a" }))
      assertions.makeSync.succeed(A, { a: "a" }, new A({ a: "a" }))

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

      assertions.makeSync.succeed(B, new B({ a: "a", b: 2 }))
      assertions.makeSync.succeed(B, { a: "a", b: 2 }, new B({ a: "a", b: 2 }))

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

      assertions.makeSync.succeed(E, new E({ id: 1 }))
      assertions.makeSync.succeed(E, { id: 1 }, new E({ id: 1 }))
    })

    it("Struct argument", () => {
      class E extends Schema.ErrorClass<E>("E")(Schema.Struct({
        id: Schema.Number
      })) {}

      const err = new E({ id: 1 })

      strictEqual(String(err), `Error`)
      assertInclude(err.stack, "Schema.test.ts:")
      strictEqual(err.id, 1)

      assertions.makeSync.succeed(E, new E({ id: 1 }))
      assertions.makeSync.succeed(E, { id: 1 }, new E({ id: 1 }))
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

      assertions.makeSync.succeed(B, new B({ a: "a", b: 2 }))
      assertions.makeSync.succeed(B, { a: "a", b: 2 }, new B({ a: "a", b: 2 }))

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
      const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback)).check(SchemaCheck.nonEmpty)

      strictEqual(SchemaAST.format(schema.ast), `string & minLength(1) <-> string`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
      await assertions.decoding.fail(
        schema,
        "",
        `string & minLength(1) <-> string
└─ minLength(1)
   └─ Expected a value with a length of at least 1, actual ""`
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
          SchemaResult.fail(new SchemaIssue.Forbidden(Option.none(), { message: "my message" }))
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
          SchemaResult.fail(new SchemaIssue.Forbidden(Option.none(), { message: "my message" }))
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

  describe("Optional Fields", () => {
    it("Exact Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.FiniteFromString)
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, {})
    })

    it("Optional Property", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.FiniteFromString)
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
        a: Schema.optionalKey(Schema.NullOr(Schema.FiniteFromString))
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
        a: Schema.optional(Schema.NullOr(Schema.FiniteFromString))
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
        a: Schema.optional(Schema.FiniteFromString).pipe(Schema.decodeTo(Schema.optionalKey(Schema.Number), {
          decode: SchemaGetter.transformOptional(Option.filter(Predicate.isNotUndefined)),
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
        a: Schema.optional(Schema.NullOr(Schema.FiniteFromString)).pipe(
          Schema.decodeTo(Schema.optional(Schema.Number), {
            decode: SchemaGetter.transformOptional(Option.filter(Predicate.isNotNull)),
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
        a: Schema.optionalKey(Schema.FiniteFromString).pipe(
          Schema.decodeTo(
            Schema.Option(Schema.Number),
            SchemaTransformation.transformOptional({
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
        a: Schema.optional(Schema.FiniteFromString).pipe(
          Schema.decodeTo(
            Schema.Option(Schema.Number),
            SchemaTransformation.transformOptional({
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

  describe("mutable", () => {
    it("Array", () => {
      const schema = Schema.mutable(Schema.Array(Schema.String))

      strictEqual(SchemaAST.format(schema.ast), `Array<string>`)
    })

    it("NonEmptyArray", () => {
      const schema = Schema.mutable(Schema.NonEmptyArray(Schema.String))

      strictEqual(SchemaAST.format(schema.ast), `[string, ...Array<string>]`)
    })

    it("Tuple", () => {
      const schema = Schema.mutable(Schema.Tuple([Schema.String, Schema.FiniteFromString]))

      strictEqual(SchemaAST.format(schema.ast), `[string, number & finite <-> string]`)
    })
  })

  it("decodeTo as composition", async () => {
    const From = Schema.Struct({
      a: Schema.String,
      b: Schema.FiniteFromString
    })

    const To = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.UndefinedOr(Schema.Number)
    })

    const schema = From.pipe(Schema.decodeTo(To))

    await assertions.decoding.succeed(schema, { a: "1", b: "2" }, { expected: { a: 1, b: 2 } })

    await assertions.encoding.succeed(schema, { a: 1, b: 2 }, { expected: { a: "1", b: "2" } })
    await assertions.encoding.fail(
      schema,
      { a: 1, b: NaN },
      `{ readonly "a": string; readonly "b": string <-> number & finite } <-> { readonly "a": number & finite; readonly "b": number | undefined }
└─ ["b"]
   └─ string <-> number & finite
      └─ number & finite
         └─ finite
            └─ Expected a finite number, actual NaN`
    )
    await assertions.encoding.fail(
      schema,
      { a: 1, b: undefined },
      `{ readonly "a": string; readonly "b": string <-> number & finite } <-> { readonly "a": number & finite; readonly "b": number | undefined }
└─ ["b"]
   └─ string <-> number & finite
      └─ Expected number & finite, actual undefined`
    )
  })

  it("encodeTo as composition", async () => {
    const From = Schema.Struct({
      a: Schema.String,
      b: Schema.FiniteFromString
    })

    const To = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.UndefinedOr(Schema.Number)
    })

    const schema = To.pipe(Schema.encodeTo(From))

    await assertions.decoding.succeed(schema, { a: "1", b: "2" }, { expected: { a: 1, b: 2 } })

    await assertions.encoding.succeed(schema, { a: 1, b: 2 }, { expected: { a: "1", b: "2" } })
    await assertions.encoding.fail(
      schema,
      { a: 1, b: NaN },
      `{ readonly "a": string; readonly "b": string <-> number & finite } <-> { readonly "a": number & finite; readonly "b": number | undefined }
└─ ["b"]
   └─ string <-> number & finite
      └─ number & finite
         └─ finite
            └─ Expected a finite number, actual NaN`
    )
    await assertions.encoding.fail(
      schema,
      { a: 1, b: undefined },
      `{ readonly "a": string; readonly "b": string <-> number & finite } <-> { readonly "a": number & finite; readonly "b": number | undefined }
└─ ["b"]
   └─ string <-> number & finite
      └─ Expected number & finite, actual undefined`
    )
  })
})

describe("SchemaGetter", () => {
  describe("checkEffect", () => {
    it("no context", async () => {
      const schema = Schema.String.pipe(
        Schema.decode({
          decode: SchemaGetter.checkEffect((s) =>
            Effect.gen(function*() {
              if (s.length === 0) {
                return new SchemaIssue.InvalidData(Option.some(s), { title: "length > 0" })
              }
            }).pipe(Effect.delay(100))
          ),
          encode: SchemaGetter.passthrough()
        })
      )

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(
        schema,
        "",
        `string <-> string
└─ Expected length > 0, actual ""`
      )
    })

    it("with context", async () => {
      class Service extends Context.Tag<Service, { fallback: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.decode({
          decode: SchemaGetter.checkEffect((s) =>
            Effect.gen(function*() {
              yield* Service
              if (s.length === 0) {
                return new SchemaIssue.InvalidData(Option.some(s), { title: "length > 0" })
              }
            })
          ),
          encode: SchemaGetter.passthrough()
        })
      )

      await assertions.decoding.succeed(schema, "a", {
        provide: [[Service, { fallback: Effect.succeed("b") }]]
      })
      await assertions.decoding.fail(
        schema,
        "",
        `string <-> string
└─ Expected length > 0, actual ""`,
        {
          provide: [[Service, { fallback: Effect.succeed("b") }]]
        }
      )
    })
  })

  describe("is", () => {
    it("FiniteFromString", () => {
      const schema = Schema.FiniteFromString
      const is = Schema.is(schema)
      assertTrue(is(1))
      assertFalse(is("a"))
    })
  })

  describe("asserts", () => {
    it("FiniteFromString", () => {
      const schema = Schema.FiniteFromString
      assertions.asserts.succeed(schema, 1)
      assertions.asserts.fail(schema, "a")
    })
  })

  describe("decodeUnknownPromise", () => {
    it("FiniteFromString", async () => {
      const schema = Schema.FiniteFromString
      await assertions.promise.succeed(Schema.decodeUnknownPromise(schema)("1"), 1)
      await assertions.promise.fail(
        Schema.decodeUnknownPromise(schema)(null),
        `number & finite <-> string
└─ Expected string, actual null`
      )
    })
  })

  describe("encodeUnknownPromise", () => {
    it("FiniteFromString", async () => {
      const schema = Schema.FiniteFromString
      await assertions.promise.succeed(Schema.encodeUnknownPromise(schema)(1), "1")
      await assertions.promise.fail(
        Schema.encodeUnknownPromise(schema)(null),
        `string <-> number & finite
└─ Expected number & finite, actual null`
      )
    })
  })

  describe("decodeUnknownResult", () => {
    it("should throw on async decoding", () => {
      const AsyncString = Schema.String.pipe(Schema.decode({
        decode: new SchemaGetter.SchemaGetter((os: Option.Option<string>) =>
          Effect.gen(function*() {
            yield* Effect.sleep("10 millis")
            return os
          })
        ),
        encode: SchemaGetter.passthrough()
      }))
      const schema = AsyncString
      const result = SchemaToParser.decodeUnknownResult(schema)("1")

      assertions.result.fail(
        result,
        `cannot be be resolved synchronously, this is caused by using runSync on an effect that performs async work`
      )
    })

    it("should throw on missing dependency", () => {
      class MagicNumber extends Context.Tag<MagicNumber, number>()("MagicNumber") {}
      const DepString = Schema.Number.pipe(Schema.decode({
        decode: SchemaGetter.onSome((n) =>
          Effect.gen(function*() {
            const magicNumber = yield* MagicNumber
            return Option.some(n * magicNumber)
          })
        ),
        encode: SchemaGetter.passthrough()
      }))
      const schema = DepString
      const result = SchemaToParser.decodeUnknownResult(schema as any)(1)

      assertions.result.fail(
        result,
        (message) => {
          assertTrue(message.includes("Service not found: MagicNumber"))
        }
      )
    })
  })

  describe("annotateKey", () => {
    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.annotateKey({ description: "description" }))
      })

      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly "a": string }
└─ ["a"] (description)
   └─ Missing key`
      )
    })

    it("Tuple", async () => {
      const schema = Schema.Tuple([Schema.String.pipe(Schema.annotateKey({ description: "description" }))])

      await assertions.decoding.fail(
        schema,
        [],
        `readonly [string]
└─ [0] (description)
   └─ Missing key`
      )
    })
  })

  describe("Struct.mapFields", () => {
    it("evolve", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolve({ a: (v) => Schema.optionalKey(v) }))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: string; readonly "b": number }`)

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("evolveKeys", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolveKeys({ a: (k) => Str.toUpperCase(k) }))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "A": string; readonly "b": number }`)

      assertions.schema.fields.equals(schema.fields, {
        A: Schema.String,
        b: Schema.Number
      })
    })

    it("renameKeys", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number,
        c: Schema.Boolean
      }).mapFields(Struct.renameKeys({ a: "A", b: "B" }))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "A": string; readonly "B": number; readonly "c": boolean }`)

      assertions.schema.fields.equals(schema.fields, {
        A: Schema.String,
        B: Schema.Number,
        c: Schema.Boolean
      })
    })

    it("evolveEntries", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolveEntries({ a: (k, v) => [Str.toUpperCase(k), Schema.optionalKey(v)] }))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "A"?: string; readonly "b": number }`)

      assertions.schema.fields.equals(schema.fields, {
        A: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("optionalKey", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.optionalKey))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: string; readonly "b"?: number }`)

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.optionalKey(Schema.Number)
      })
    })

    it("mapPick", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.mapPick(["a"], Schema.optionalKey))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: string; readonly "b": number }`)

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("mapOmit", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.mapOmit(["b"], Schema.optionalKey))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a"?: string; readonly "b": number }`)

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.optionalKey(Schema.String),
        b: Schema.Number
      })
    })

    it("optional", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.optional))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "a"?: string | undefined; readonly "b"?: number | undefined }`
      )

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.optional(Schema.String),
        b: Schema.optional(Schema.Number)
      })
    })

    it("mutableKey", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.mutableKey))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ "a": string; "b": number }`
      )

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.mutableKey(Schema.String),
        b: Schema.mutableKey(Schema.Number)
      })
    })

    it("mutable", () => {
      const schema = Schema.Struct({
        a: Schema.Array(Schema.String),
        b: Schema.Tuple([Schema.Number])
      }).mapFields(Struct.map(Schema.mutable))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "a": Array<string>; readonly "b": [number] }`
      )

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.mutable(Schema.Array(Schema.String)),
        b: Schema.mutable(Schema.Tuple([Schema.Number]))
      })
    })

    it("readonly", () => {
      const schema = Schema.Struct({
        a: Schema.Array(Schema.String),
        b: Schema.Tuple([Schema.Number])
      }).mapFields(Struct.map(Schema.mutable))
        .mapFields(Struct.map(Schema.readonly))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "a": Array<string>; readonly "b": [number] }`
      )

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.readonly(Schema.Array(Schema.String)),
        b: Schema.readonly(Schema.Tuple([Schema.Number]))
      })
    })

    it("NullOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.NullOr))

      strictEqual(SchemaAST.format(schema.ast), `{ readonly "a": string | null; readonly "b": number | null }`)

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.NullOr(Schema.String),
        b: Schema.NullOr(Schema.Number)
      })
    })

    it("UndefinedOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.UndefinedOr))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "a": string | undefined; readonly "b": number | undefined }`
      )

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.UndefinedOr(Schema.String),
        b: Schema.UndefinedOr(Schema.Number)
      })
    })

    it("NullishOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.NullishOr))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "a": string | null | undefined; readonly "b": number | null | undefined }`
      )

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.NullishOr(Schema.String),
        b: Schema.NullishOr(Schema.Number)
      })
    })

    it("should work with flow", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.FiniteFromString,
        c: Schema.Boolean
      }).mapFields(flow(
        Struct.map(Schema.NullOr),
        Struct.mapPick(["a", "c"], Schema.mutableKey)
      ))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ "a": string | null; readonly "b": (number & finite <-> string) | null; "c": boolean | null }`
      )

      assertions.schema.fields.equals(schema.fields, {
        a: Schema.mutableKey(Schema.NullOr(Schema.String)),
        b: Schema.NullOr(Schema.FiniteFromString),
        c: Schema.mutableKey(Schema.NullOr(Schema.Boolean))
      })
    })
  })

  describe("Tuple.mapElements", () => {
    it("appendElement", () => {
      const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.appendElement(Schema.Number))

      strictEqual(SchemaAST.format(schema.ast), `readonly [string, number]`)

      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Number])
    })

    it("appendElements", () => {
      const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.appendElements([Schema.Number, Schema.Boolean]))

      strictEqual(SchemaAST.format(schema.ast), `readonly [string, number, boolean]`)

      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Number, Schema.Boolean])
    })

    it("pick", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.pick([0, 2]))
      strictEqual(SchemaAST.format(schema.ast), `readonly [string, boolean]`)
      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Boolean])
    })

    it("omit", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.omit([1]))
      strictEqual(SchemaAST.format(schema.ast), `readonly [string, boolean]`)
      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Boolean])
    })

    describe("evolve", () => {
      it("readonly [string] -> readonly [string?]", () => {
        const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.evolve([(v) => Schema.optionalKey(v)]))

        strictEqual(SchemaAST.format(schema.ast), `readonly [string?]`)

        assertions.schema.elements.equals(schema.elements, [Schema.optionalKey(Schema.String)])
      })

      it("readonly [string, number] -> readonly [string, number?]", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(
          Tuple.evolve([undefined, (v) => Schema.optionalKey(v)])
        )

        strictEqual(SchemaAST.format(schema.ast), `readonly [string, number?]`)

        assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.optionalKey(Schema.Number)])
      })
    })

    describe("renameIndices", () => {
      it("partial index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["1", "0"])
        )
        strictEqual(SchemaAST.format(schema.ast), `readonly [number, string, boolean]`)
        assertions.schema.elements.equals(schema.elements, [Schema.Number, Schema.String, Schema.Boolean])
      })

      it("full index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["2", "1", "0"])
        )
        strictEqual(SchemaAST.format(schema.ast), `readonly [boolean, number, string]`)
        assertions.schema.elements.equals(schema.elements, [Schema.Boolean, Schema.Number, Schema.String])
      })
    })

    it("NullOr", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(Tuple.map(Schema.NullOr))

      strictEqual(SchemaAST.format(schema.ast), `readonly [string | null, number | null]`)

      assertions.schema.elements.equals(schema.elements, [Schema.NullOr(Schema.String), Schema.NullOr(Schema.Number)])
    })
  })

  describe("Union.mapMembers", () => {
    it("appendElement", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.appendElement(Schema.Boolean))

      strictEqual(SchemaAST.format(schema.ast), `string | number | boolean`)

      assertions.schema.elements.equals(schema.members, [Schema.String, Schema.Number, Schema.Boolean])
    })

    it("evolve", () => {
      const schema = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).mapMembers(
        Tuple.evolve([
          (v) => Schema.Array(v),
          undefined,
          (v) => Schema.Array(v)
        ])
      )

      strictEqual(SchemaAST.format(schema.ast), `ReadonlyArray<string> | number | ReadonlyArray<boolean>`)

      assertions.schema.elements.equals(schema.members, [
        Schema.Array(Schema.String),
        Schema.Number,
        Schema.Array(Schema.Boolean)
      ])
    })

    it("Array", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.map(Schema.Array))

      strictEqual(SchemaAST.format(schema.ast), `ReadonlyArray<string> | ReadonlyArray<number>`)

      assertions.schema.elements.equals(schema.members, [
        Schema.Array(Schema.String),
        Schema.Array(Schema.Number)
      ])
    })
  })

  describe("Literals.mapMembers", () => {
    it("evolve", () => {
      const schema = Schema.Literals(["a", "b", "c"]).mapMembers(Tuple.evolve([
        (a) => Schema.Struct({ _tag: a, a: Schema.String }),
        (b) => Schema.Struct({ _tag: b, b: Schema.Number }),
        (c) => Schema.Struct({ _tag: c, c: Schema.Boolean })
      ]))

      strictEqual(
        SchemaAST.format(schema.ast),
        `{ readonly "_tag": "a"; readonly "a": string } | { readonly "_tag": "b"; readonly "b": number } | { readonly "_tag": "c"; readonly "c": boolean }`
      )

      assertions.schema.elements.equals(schema.members, [
        Schema.Struct({ _tag: Schema.Literal("a"), a: Schema.String }),
        Schema.Struct({ _tag: Schema.Literal("b"), b: Schema.Number }),
        Schema.Struct({ _tag: Schema.Literal("c"), c: Schema.Boolean })
      ])
    })
  })

  it("encodeKeys", async () => {
    const schema = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.String
    }).pipe(Schema.encodeKeys({ a: "c" }))

    strictEqual(
      SchemaAST.format(schema.ast),
      `{ readonly "a": number & finite <-> string; readonly "b": string } <-> { readonly "c": string; readonly "b": string }`
    )

    await assertions.decoding.succeed(schema, { c: "1", b: "b" }, { expected: { a: 1, b: "b" } })

    await assertions.encoding.succeed(schema, { a: 1, b: "b" }, { expected: { c: "1", b: "b" } })
  })
})
