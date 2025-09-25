import { Cause, Effect, Exit, flow, pipe, ServiceMap } from "effect"
import { Option, Order, Predicate, Redacted, Result, Struct, Tuple } from "effect/data"
import { Equal } from "effect/interfaces"
import { String as Str } from "effect/primitives"
import { AST, Check, Getter, Issue, Schema, ToParser, Transformation } from "effect/schema"
import { DateTime } from "effect/time"
import { produce } from "immer"
import { describe, it } from "vitest"
import { assertFalse, assertInclude, assertTrue, deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"
import { assertions } from "../utils/schema.ts"

const Trim = Schema.String.pipe(Schema.decode(Transformation.trim()))

const SnakeToCamel = Schema.String.pipe(
  Schema.decode(
    Transformation.snakeToCamel()
  )
)

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    {
      decode: Getter.Number(),
      encode: Getter.String()
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

  it("toString", () => {
    const schema = Schema.String
    const result = Schema.decodeUnknownExit(schema)(null)
    assertTrue(Exit.isFailure(result))
    strictEqual(String(result.cause.failures[0]), "Fail(SchemaError(Expected string, got null))")
  })

  describe("annotate", () => {
    it("should remove any existing id annotation", () => {
      const schema = Schema.String.annotate({ identifier: "a" })
      strictEqual(schema.ast.annotations?.identifier, "a")
      strictEqual(schema.annotate({}).ast.annotations?.identifier, undefined)
    })
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

    it("should expose the literal", () => {
      const schema = Schema.Literal("a")
      strictEqual(schema.literal, "a")
      strictEqual(schema.annotate({}).literal, "a")
    })

    it(`"a"`, async () => {
      const schema = Schema.Literal("a")

      await assertions.make.succeed(schema, "a")
      await assertions.make.fail(schema, null, `Expected "a", got null`)
      assertions.makeSync.succeed(schema, "a")
      assertions.makeSync.fail(schema, null, `Expected "a", got null`)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, 1, `Expected "a", got 1`)

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.fail(schema, 1, `Expected "a", got 1`)
    })

    it(`1`, async () => {
      const schema = Schema.Literal(1)

      await assertions.make.succeed(schema, 1)
      await assertions.make.fail(schema, null, `Expected 1, got null`)
      assertions.makeSync.succeed(schema, 1)
      assertions.makeSync.fail(schema, null, `Expected 1, got null`)

      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(schema, "1", `Expected 1, got "1"`)

      await assertions.encoding.succeed(schema, 1)
      await assertions.encoding.fail(schema, "1", `Expected 1, got "1"`)
    })
  })

  describe("Literals", () => {
    it("red, green, blue", async () => {
      const schema = Schema.Literals(["red", "green", "blue"])

      deepStrictEqual(schema.literals, ["red", "green", "blue"])

      await assertions.make.succeed(schema, "red")
      await assertions.make.succeed(schema, "green")
      await assertions.make.succeed(schema, "blue")
      await assertions.make.fail(
        schema,
        "yellow",
        `Expected "red" | "green" | "blue", got "yellow"`
      )
    })

    it("pick", () => {
      const schema = Schema.Literals(["a", "b", "c"]).pick(["a", "b"])

      deepStrictEqual(schema.literals, ["a", "b"])
    })
  })

  it("Never", async () => {
    const schema = Schema.Never

    await assertions.make.fail(schema, null as never, `Expected never, got null`)
    assertions.makeSync.fail(schema, null as never, `Expected never, got null`)

    await assertions.decoding.fail(schema, "a", `Expected never, got "a"`)
    await assertions.encoding.fail(schema, "a", `Expected never, got "a"`)
  })

  it("Any", async () => {
    const schema = Schema.Any

    await assertions.make.succeed(schema, "a")
    assertions.makeSync.succeed(schema, "a")

    await assertions.decoding.succeed(schema, "a")
  })

  it("Unknown", async () => {
    const schema = Schema.Unknown

    await assertions.make.succeed(schema, "a")
    assertions.makeSync.succeed(schema, "a")

    await assertions.decoding.succeed(schema, "a")
  })

  it("Null", async () => {
    const schema = Schema.Null

    await assertions.make.succeed(schema, null)
    await assertions.make.fail(schema, undefined, `Expected null, got undefined`)
    assertions.makeSync.succeed(schema, null)
    assertions.makeSync.fail(schema, undefined, `Expected null, got undefined`)
  })

  it("Undefined", async () => {
    const schema = Schema.Undefined

    await assertions.make.succeed(schema, undefined)
    await assertions.make.fail(schema, null, `Expected undefined, got null`)
    assertions.makeSync.succeed(schema, undefined)
    assertions.makeSync.fail(schema, null, `Expected undefined, got null`)
  })

  it("String", async () => {
    const schema = Schema.String

    await assertions.make.succeed(schema, "a")
    await assertions.make.fail(schema, null, `Expected string, got null`)
    assertions.makeSync.succeed(schema, "a")
    assertions.makeSync.fail(schema, null, `Expected string, got null`)

    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(schema, 1, "Expected string, got 1")

    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(schema, 1, "Expected string, got 1")
  })

  it("Number", async () => {
    const schema = Schema.Number

    await assertions.make.succeed(schema, 1)
    await assertions.make.fail(schema, null, `Expected number, got null`)
    assertions.makeSync.succeed(schema, 1)
    assertions.makeSync.fail(schema, null, `Expected number, got null`)

    await assertions.decoding.succeed(schema, 1)
    await assertions.decoding.fail(schema, "a", `Expected number, got "a"`)

    await assertions.encoding.succeed(schema, 1)
    await assertions.encoding.fail(schema, "a", `Expected number, got "a"`)
  })

  it("Boolean", async () => {
    const schema = Schema.Boolean

    await assertions.make.succeed(schema, true)
    await assertions.make.succeed(schema, false)
    await assertions.make.fail(schema, null, `Expected boolean, got null`)

    await assertions.decoding.succeed(schema, true)
    await assertions.decoding.succeed(schema, false)
    await assertions.decoding.fail(schema, "a", `Expected boolean, got "a"`)

    await assertions.encoding.succeed(schema, true)
    await assertions.encoding.succeed(schema, false)
    await assertions.encoding.fail(schema, "a", `Expected boolean, got "a"`)
  })

  it("Symbol", async () => {
    const schema = Schema.Symbol

    await assertions.make.succeed(schema, Symbol("a"))
    await assertions.make.fail(schema, null, `Expected symbol, got null`)
    assertions.makeSync.succeed(schema, Symbol("a"))
    assertions.makeSync.fail(schema, null, `Expected symbol, got null`)

    await assertions.decoding.succeed(schema, Symbol("a"))
    await assertions.decoding.fail(schema, "a", `Expected symbol, got "a"`)

    await assertions.encoding.succeed(schema, Symbol("a"))
    await assertions.encoding.fail(schema, "a", `Expected symbol, got "a"`)
  })

  it("UniqueSymbol", async () => {
    const a = Symbol("a")
    const schema = Schema.UniqueSymbol(a)

    await assertions.make.succeed(schema, a)
    await assertions.make.fail(schema, Symbol("b"), `Expected Symbol(a), got Symbol(b)`)
    assertions.makeSync.succeed(schema, a)
    assertions.makeSync.fail(schema, Symbol("b"), `Expected Symbol(a), got Symbol(b)`)

    await assertions.decoding.succeed(schema, a)
    await assertions.decoding.fail(schema, Symbol("b"), `Expected Symbol(a), got Symbol(b)`)
  })

  it("BigInt", async () => {
    const schema = Schema.BigInt

    await assertions.make.succeed(schema, 1n)
    await assertions.make.fail(schema, null, `Expected bigint, got null`)
    assertions.makeSync.succeed(schema, 1n)
    assertions.makeSync.fail(schema, null, `Expected bigint, got null`)

    await assertions.decoding.succeed(schema, 1n)
    await assertions.decoding.fail(schema, "1", `Expected bigint, got "1"`)

    await assertions.encoding.succeed(schema, 1n)
    await assertions.encoding.fail(schema, "1", `Expected bigint, got "1"`)
  })

  it("Void", async () => {
    const schema = Schema.Void

    await assertions.make.succeed(schema, undefined)
    await assertions.make.fail(schema, null, `Expected void, got null`)
    assertions.makeSync.succeed(schema, undefined)
    assertions.makeSync.fail(schema, null, `Expected void, got null`)

    await assertions.decoding.succeed(schema, undefined)
    await assertions.decoding.fail(schema, "1", `Expected void, got "1"`)

    await assertions.encoding.succeed(schema, undefined)
    await assertions.encoding.fail(schema, "1", `Expected void, got "1"`)
  })

  it("Object", async () => {
    const schema = Schema.Object

    await assertions.make.succeed(schema, {})
    await assertions.make.succeed(schema, [])
    await assertions.make.fail(schema, null, `Expected object | array | function, got null`)
    assertions.makeSync.succeed(schema, {})
    assertions.makeSync.succeed(schema, [])
    assertions.makeSync.fail(schema, null, `Expected object | array | function, got null`)

    await assertions.decoding.succeed(schema, {})
    await assertions.decoding.succeed(schema, [])
    await assertions.decoding.fail(schema, "1", `Expected object | array | function, got "1"`)

    await assertions.encoding.succeed(schema, {})
    await assertions.encoding.succeed(schema, [])
    await assertions.encoding.fail(schema, "1", `Expected object | array | function, got "1"`)
  })

  describe("Struct", () => {
    it("should throw an error if there are duplicate property signatures", () => {
      throws(
        () =>
          new AST.TypeLiteral(
            [
              new AST.PropertySignature("a", Schema.String.ast),
              new AST.PropertySignature("b", Schema.String.ast),
              new AST.PropertySignature("c", Schema.String.ast),
              new AST.PropertySignature("a", Schema.String.ast),
              new AST.PropertySignature("c", Schema.String.ast)
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

    describe("propertyOrder", () => {
      it("all required fields", () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        })

        const input = { c: "c", b: "b", a: "a", d: "d" }
        const output = Schema.decodeUnknownSync(schema)(input, {
          propertyOrder: "original",
          onExcessProperty: "preserve"
        })
        deepStrictEqual(Reflect.ownKeys(output), ["c", "b", "a", "d"])
      })

      it("optional field with default", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.encode({
            decode: Getter.withDefault(() => "default-a"),
            encode: Getter.passthrough()
          })),
          b: Schema.String
        })

        const input = { c: "c", b: "b", d: "d" }
        const output = Schema.decodeUnknownSync(schema)(input, {
          propertyOrder: "original",
          onExcessProperty: "preserve"
        })
        deepStrictEqual(Reflect.ownKeys(output), ["c", "b", "d", "a"])
      })
    })

    describe("onExcessProperty", () => {
      it("error", async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        await assertions.decoding.fail(
          schema,
          { a: "a", b: "b" },
          `Unexpected key
  at ["b"]`,
          {
            parseOptions: { onExcessProperty: "error" }
          }
        )
        await assertions.decoding.fail(
          schema,
          { a: "a", b: "b", c: "c" },
          `Unexpected key
  at ["b"]
Unexpected key
  at ["c"]`,
          {
            parseOptions: { onExcessProperty: "error", errors: "all" }
          }
        )
        const sym = Symbol("sym")
        await assertions.decoding.fail(
          schema,
          { a: "a", [sym]: "sym" },
          `Unexpected key
  at [Symbol(sym)]`,
          {
            parseOptions: { onExcessProperty: "error" }
          }
        )
      })

      it("preserve", async () => {
        const schema = Schema.Struct({
          a: Schema.String
        })

        const sym = Symbol("sym")
        await assertions.decoding.succeed(
          schema,
          { a: "a", b: "b", c: "c", [sym]: "sym" },
          { parseOptions: { onExcessProperty: "preserve" } }
        )
      })
    })

    it("should corectly handle __proto__", async () => {
      const schema = Schema.Struct({
        ["__proto__"]: Schema.String
      })
      await assertions.decoding.succeed(schema, { ["__proto__"]: "a" })
      await assertions.decoding.fail(
        schema,
        { __proto__: "a" },
        `Missing key
  at ["__proto__"]`
      )
    })

    it(`{ readonly "a": string }`, async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })

      // Should be able to access the fields
      deepStrictEqual(schema.fields, { a: Schema.String })

      await assertions.make.succeed(schema, { a: "a" })
      await assertions.make.fail(schema, null, `Expected object, got null`)
      assertions.makeSync.succeed(schema, { a: "a" })
      assertions.makeSync.fail(schema, null, `Expected object, got null`)

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )
      await assertions.decoding.fail(
        schema,
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )
      await assertions.encoding.fail(
        schema,
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )
    })

    it(`{ readonly "a": <transformation> }`, async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.fail(
        schema,
        { a: "a" },
        `Expected a finite number, got NaN
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.fail(
        schema,
        { a: "a" },
        `Expected number, got "a"
  at ["a"]`
      )
    })

    it(`Schema.optionalKey: { readonly "a"?: string }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String)
      })

      await assertions.make.succeed(schema, { a: "a" })
      await assertions.make.succeed(schema, {})
      assertions.makeSync.succeed(schema, { a: "a" })
      assertions.makeSync.succeed(schema, {})

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.fail(
        schema,
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {})
      await assertions.encoding.fail(
        schema,
        { a: 1 },
        `Expected string, got 1
  at ["a"]`
      )
    })

    it(`Schema.optional: { readonly "a"?: string | undefined }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.String)
      })

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
        `Expected string | undefined, got 1
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, { a: undefined })
      await assertions.encoding.succeed(schema, {})
      await assertions.encoding.fail(
        schema,
        { a: 1 },
        `Expected string | undefined, got 1
  at ["a"]`
      )
    })

    it(`{ readonly "a"?: <transformation> }`, async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.FiniteFromString)
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, {})
      await assertions.decoding.fail(
        schema,
        { a: undefined },
        `Expected string, got undefined
  at ["a"]`
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
          {},
          `Missing key
  at ["a"]
Missing key
  at ["b"]`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.decoding.fail(
          schema,
          {},
          `Missing key
  at ["a"]
Missing key
  at ["b"]`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.encoding.fail(
          schema,
          {},
          `Missing key
  at ["a"]
Missing key
  at ["b"]`,
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
          `Missing key
  at ["a"]`
        )
        await assertions.decoding.fail(
          schema,
          { a: "a" },
          `Missing key
  at ["b"]`
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
          `Expected number, got "b"
  at ["b"]`
        )
      })

      it("Struct & check & preserveChecks: true", async () => {
        const from = Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }).check(
          Check.make(({ a, b }) => a === b, { title: "a === b" })
        )
        const schema = from.mapFields(Struct.merge({ c: Schema.String }), { preserveChecks: true })

        await assertions.decoding.succeed(schema, { a: "a", b: "a", c: "c" })
        await assertions.decoding.fail(
          schema,
          { a: "", b: "b", c: "c" },
          `Expected a === b, got {"a":"","b":"b","c":"c"}`
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

    it("should fail on unexpected indexes", async () => {
      const schema = Schema.Tuple([Schema.String])
      await assertions.decoding.fail(
        schema,
        ["a", "b"],
        `Unexpected key
  at [1]`
      )
      await assertions.decoding.fail(
        schema,
        ["a", "b", "c"],
        `Unexpected key
  at [1]
Unexpected key
  at [2]`,
        { parseOptions: { errors: "all" } }
      )
    })

    it(`readonly [string]`, async () => {
      const schema = Schema.Tuple([Schema.NonEmptyString])

      // should be able to access the elements
      deepStrictEqual(schema.elements, [Schema.NonEmptyString])

      await assertions.make.succeed(schema, ["a"])
      await assertions.make.fail(
        schema,
        [""],
        `Expected a value with a length of at least 1, got ""
  at [0]`
      )
      assertions.makeSync.succeed(schema, ["a"])
      assertions.makeSync.fail(
        schema,
        [""],
        `Expected a value with a length of at least 1, got ""
  at [0]`
      )

      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.fail(schema, null, `Expected array, got null`)
      await assertions.decoding.fail(
        schema,
        [],
        `Missing key
  at [0]`
      )
      await assertions.decoding.fail(
        schema,
        [1],
        `Expected string, got 1
  at [0]`
      )

      await assertions.encoding.succeed(schema, ["a"])
      await assertions.encoding.fail(
        schema,
        [],
        `Missing key
  at [0]`
      )
      await assertions.decoding.fail(
        schema,
        [],
        `Missing key
  at [0]`
      )
      await assertions.encoding.fail(
        schema,
        [1],
        `Expected string, got 1
  at [0]`
      )
    })

    it(`readonly [string?]`, async () => {
      const schema = Schema.Tuple([Schema.String.pipe(Schema.optionalKey)])

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
      strictEqual(schema.annotate({}).schema, Schema.String)
    })

    it("readonly string[]", async () => {
      const schema = Schema.Array(Schema.String)

      await assertions.make.succeed(schema, ["a", "b"])
      assertions.makeSync.succeed(schema, ["a", "b"])

      await assertions.decoding.succeed(schema, ["a", "b"])
      await assertions.decoding.fail(
        schema,
        ["a", 1],
        `Expected string, got 1
  at [1]`
      )

      await assertions.encoding.succeed(schema, ["a", "b"])
      await assertions.encoding.fail(
        schema,
        ["a", 1],
        `Expected string, got 1
  at [1]`
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

      await assertions.make.succeed(schema, ["a"])
      await assertions.make.succeed(schema, ["a", "b"])
      assertions.makeSync.succeed(schema, ["a"])
      assertions.makeSync.succeed(schema, ["a", "b"])

      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.succeed(schema, ["a", "b"])
      await assertions.decoding.fail(
        schema,
        [],
        `Missing key
  at [0]`
      )
      await assertions.decoding.fail(
        schema,
        ["a", 1],
        `Expected string, got 1
  at [1]`
      )

      await assertions.encoding.succeed(schema, ["a"])
      await assertions.encoding.succeed(schema, ["a", "b"])
      await assertions.encoding.fail(
        schema,
        [],
        `Missing key
  at [0]`
      )
      await assertions.encoding.fail(
        schema,
        ["a", 1],
        `Expected string, got 1
  at [1]`
      )
    })
  })

  describe("Checks", () => {
    describe("check", () => {
      it("single check", async () => {
        const schema = Schema.String.check(Check.minLength(3))

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `Expected a value with a length of at least 3, got "ab"`
        )
      })

      it("multiple checks", async () => {
        const schema = Schema.String.check(
          Check.minLength(3),
          Check.includes("c")
        )

        await assertions.decoding.succeed(schema, "abc")
        await assertions.decoding.fail(
          schema,
          "ab",
          `Expected a value with a length of at least 3, got "ab"`
        )
        await assertions.decoding.fail(
          schema,
          "ab",
          `Expected a value with a length of at least 3, got "ab"
Expected a string including "c", got "ab"`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("aborting checks", async () => {
        const schema = Schema.String.check(
          Check.abort(Check.minLength(2)),
          Check.includes("b")
        )

        await assertions.decoding.fail(
          schema,
          "a",
          `Expected a value with a length of at least 2, got "a"`
        )
      })
    })

    describe("refinements", () => {
      it("refineByGuard", async () => {
        const schema = Schema.Option(Schema.String).pipe(
          Schema.refineByGuard(Option.isSome, { title: "isSome" }),
          Schema.check(
            Check.make(({ value }) => value.length > 0, { title: "length > 0" })
          )
        )

        await assertions.decoding.succeed(schema, Option.some("a"))
        await assertions.decoding.fail(
          schema,
          Option.some(""),
          `Expected length > 0, got some("")`
        )
        await assertions.decoding.fail(
          schema,
          Option.none(),
          `Expected isSome, got none()`
        )
      })

      describe("brand", () => {
        it("single brand", () => {
          const schema = Schema.Number.pipe(Schema.brand("MyBrand"))

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.["~effect/schema/Check/brand"], "MyBrand")
        })

        it("double brand", () => {
          const schema = Schema.Number.pipe(
            Schema.brand("MyBrand"),
            Schema.brand("MyBrand2")
          )

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.["~effect/schema/Check/brand"], "MyBrand")
          deepStrictEqual(schema.ast.checks?.[1]?.annotations?.["~effect/schema/Check/brand"], "MyBrand2")
        })

        it("annotate should support getters", () => {
          const schema = Schema.String.pipe(Schema.brand("brand")).annotate({
            get examples() {
              return [
                schema.makeSync("a"),
                schema.makeSync("b")
              ]
            }
          })

          deepStrictEqual(schema.ast.checks?.[0]?.annotations?.examples, ["a", "b"])
        })

        it("annotateKey should support getters", () => {
          const schema = Schema.String.pipe(
            Schema.brand("brand")
          ).annotateKey({
            get examples() {
              return [
                schema.makeSync("a"),
                schema.makeSync("b")
              ]
            }
          })

          deepStrictEqual(schema.ast.context?.annotations?.examples, ["a", "b"])
        })
      })

      it("group", async () => {
        const usernameGroup = Check.makeGroup(
          [
            Check.minLength(3),
            Check.regex(/^[a-zA-Z0-9]+$/, {
              title: "alphanumeric",
              description: "must contain only letters and numbers"
            }),
            Check.trimmed()
          ],
          {
            title: "username",
            description: "a valid username"
          }
        ).pipe(Check.brand("Username"))

        const Username = Schema.String.pipe(Schema.refine(usernameGroup))

        await assertions.decoding.succeed(Username, "abc")
        await assertions.decoding.fail(
          Username,
          "",
          `Expected a value with a length of at least 3, got ""`
        )
      })
    })

    describe("String checks", () => {
      it("regex", async () => {
        const schema = Schema.String.check(Check.regex(/^a/))

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `Expected a string matching the regex ^a, got "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `Expected a string matching the regex ^a, got "b"`
        )
      })

      it("startsWith", async () => {
        const schema = Schema.String.check(Check.startsWith("a"))

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `Expected a string starting with "a", got "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `Expected a string starting with "a", got "b"`
        )
      })

      it("endsWith", async () => {
        const schema = Schema.String.check(Check.endsWith("a"))

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "b",
          `Expected a string ending with "a", got "b"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "b",
          `Expected a string ending with "a", got "b"`
        )
      })

      it("lowercased", async () => {
        const schema = Schema.String.check(Check.lowercased())

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "A",
          `Expected a string with all characters in lowercase, got "A"`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "A",
          `Expected a string with all characters in lowercase, got "A"`
        )
      })

      it("uppercased", async () => {
        const schema = Schema.String.check(Check.uppercased())

        await assertions.decoding.succeed(schema, "A")
        await assertions.decoding.fail(
          schema,
          "a",
          `Expected a string with all characters in uppercase, got "a"`
        )

        await assertions.encoding.succeed(schema, "A")
        await assertions.encoding.fail(
          schema,
          "a",
          `Expected a string with all characters in uppercase, got "a"`
        )
      })

      it("capitalized", async () => {
        const schema = Schema.String.check(Check.capitalized())

        await assertions.decoding.succeed(schema, "Abc")
        await assertions.decoding.fail(
          schema,
          "abc",
          `Expected a string with the first character in uppercase, got "abc"`
        )

        await assertions.encoding.succeed(schema, "Abc")
        await assertions.encoding.fail(
          schema,
          "abc",
          `Expected a string with the first character in uppercase, got "abc"`
        )
      })

      it("uncapitalized", async () => {
        const schema = Schema.String.check(Check.uncapitalized())

        await assertions.decoding.succeed(schema, "aBC")
        await assertions.decoding.fail(
          schema,
          "ABC",
          `Expected a string with the first character in lowercase, got "ABC"`
        )

        await assertions.encoding.succeed(schema, "aBC")
        await assertions.encoding.fail(
          schema,
          "ABC",
          `Expected a string with the first character in lowercase, got "ABC"`
        )
      })

      it("trimmed", async () => {
        const schema = Schema.String.check(Check.trimmed())

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          " a ",
          `Expected a string with no leading or trailing whitespace, got " a "`
        )
      })

      it("minLength", async () => {
        const schema = Schema.String.check(Check.minLength(1))

        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
          schema,
          "",
          `Expected a value with a length of at least 1, got ""`
        )

        await assertions.encoding.succeed(schema, "a")
        await assertions.encoding.fail(
          schema,
          "",
          `Expected a value with a length of at least 1, got ""`
        )
      })

      it("minEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(Check.minEntries(1))

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
        await assertions.decoding.fail(
          schema,
          {},
          `Expected an object with at least 1 entries, got {}`
        )
        await assertions.decoding.fail(
          schema,
          {},
          `Expected an object with at least 1 entries, got {}`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("maxEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(Check.maxEntries(2))

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
        await assertions.decoding.fail(
          schema,
          { a: 1, b: 2, c: 3 },
          `Expected an object with at most 2 entries, got {"a":1,"b":2,"c":3}`,
          { parseOptions: { errors: "all" } }
        )
        await assertions.decoding.fail(
          schema,
          { a: 1, b: 2, c: 3 },
          `Expected an object with at most 2 entries, got {"a":1,"b":2,"c":3}`,
          { parseOptions: { errors: "all" } }
        )
      })
    })

    describe("Number checks", () => {
      it("greaterThan", async () => {
        const schema = Schema.Number.check(Check.greaterThan(1))

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          1,
          `Expected a value greater than 1, got 1`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          1,
          `Expected a value greater than 1, got 1`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.Number.check(Check.greaterThanOrEqualTo(1))

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          0,
          `Expected a value greater than or equal to 1, got 0`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.Number.check(Check.lessThan(1))

        await assertions.decoding.succeed(schema, 0)
        await assertions.decoding.fail(
          schema,
          1,
          `Expected a value less than 1, got 1`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.Number.check(Check.lessThanOrEqualTo(1))

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          2,
          `Expected a value less than or equal to 1, got 2`
        )
      })

      it("multipleOf", async () => {
        const schema = Schema.Number.check(Check.multipleOf(2))

        await assertions.decoding.succeed(schema, 4)
        await assertions.decoding.fail(
          schema,
          3,
          `Expected a value that is a multiple of 2, got 3`
        )
      })

      it("between", async () => {
        const schema = Schema.Number.check(Check.between(1, 3))

        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
          schema,
          0,
          `Expected a value between 1 and 3, got 0`
        )

        await assertions.encoding.succeed(schema, 2)
        await assertions.encoding.fail(
          schema,
          0,
          `Expected a value between 1 and 3, got 0`
        )
      })

      it("int", async () => {
        const schema = Schema.Number.check(Check.int())

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          1.1,
          `Expected an integer, got 1.1`
        )

        await assertions.encoding.succeed(schema, 1)
        await assertions.encoding.fail(
          schema,
          1.1,
          `Expected an integer, got 1.1`
        )
        await assertions.decoding.fail(
          schema,
          NaN,
          `Expected an integer, got NaN`
        )
        await assertions.decoding.fail(
          schema,
          Infinity,
          `Expected an integer, got Infinity`
        )
        await assertions.decoding.fail(
          schema,
          -Infinity,
          `Expected an integer, got -Infinity`
        )
      })

      it("int32", async () => {
        const schema = Schema.Number.check(Check.int32())

        await assertions.decoding.succeed(schema, 1)
        await assertions.decoding.fail(
          schema,
          1.1,
          `Expected an integer, got 1.1`
        )
        await assertions.decoding.fail(
          schema,
          Number.MAX_SAFE_INTEGER + 1,
          `Expected an integer, got 9007199254740992`
        )
        await assertions.decoding.fail(
          schema,
          1.1,
          `Expected an integer, got 1.1`
        )
        await assertions.decoding.fail(
          schema,
          Number.MIN_SAFE_INTEGER - 1,
          `Expected an integer, got -9007199254740992`
        )
        await assertions.decoding.fail(
          schema,
          Number.MAX_SAFE_INTEGER + 1,
          `Expected an integer, got 9007199254740992
Expected a value between -2147483648 and 2147483647, got 9007199254740992`,
          { parseOptions: { errors: "all" } }
        )

        await assertions.encoding.succeed(schema, 1)
        await assertions.encoding.fail(
          schema,
          1.1,
          `Expected an integer, got 1.1`
        )
        await assertions.encoding.fail(
          schema,
          Number.MAX_SAFE_INTEGER + 1,
          `Expected an integer, got 9007199254740992`
        )
      })
    })

    describe("BigInt Checks", () => {
      const options = { order: Order.bigint, format: (value: bigint) => `${value}n` }

      const between = Check.deriveBetween(options)
      const greaterThan = Check.deriveGreaterThan(options)
      const greaterThanOrEqualTo = Check.deriveGreaterThanOrEqualTo(options)
      const lessThan = Check.deriveLessThan(options)
      const lessThanOrEqualTo = Check.deriveLessThanOrEqualTo(options)

      it("between", async () => {
        const schema = Schema.BigInt.check(between(5n, 10n))

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 7n)
        await assertions.decoding.succeed(schema, 10n)
        await assertions.decoding.fail(
          schema,
          4n,
          `Expected a value between 5n and 10n, got 4n`
        )
      })

      it("greaterThan", async () => {
        const schema = Schema.BigInt.check(greaterThan(5n))

        await assertions.decoding.succeed(schema, 6n)
        await assertions.decoding.fail(
          schema,
          5n,
          `Expected a value greater than 5n, got 5n`
        )
      })

      it("greaterThanOrEqualTo", async () => {
        const schema = Schema.BigInt.check(greaterThanOrEqualTo(5n))

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 6n)
        await assertions.decoding.fail(
          schema,
          4n,
          `Expected a value greater than or equal to 5n, got 4n`
        )
      })

      it("lessThan", async () => {
        const schema = Schema.BigInt.check(lessThan(5n))

        await assertions.decoding.succeed(schema, 4n)
        await assertions.decoding.fail(
          schema,
          5n,
          `Expected a value less than 5n, got 5n`
        )
      })

      it("lessThanOrEqualTo", async () => {
        const schema = Schema.BigInt.check(lessThanOrEqualTo(5n))

        await assertions.decoding.succeed(schema, 5n)
        await assertions.decoding.succeed(schema, 4n)
        await assertions.decoding.fail(
          schema,
          6n,
          `Expected a value less than or equal to 5n, got 6n`
        )
      })
    })

    describe("Record checks", () => {
      it("entries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Number).check(Check.entries(2))

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
        await assertions.decoding.succeed(schema, { ["__proto__"]: 0, "": 0 })
        await assertions.decoding.fail(
          schema,
          { a: 1 },
          `Expected an object with exactly 2 entries, got {"a":1}`
        )
        await assertions.decoding.fail(
          schema,
          { a: 1, b: 2, c: 3 },
          `Expected an object with exactly 2 entries, got {"a":1,"b":2,"c":3}`
        )
      })
    })

    describe("Structural checks", () => {
      it("Array + minLength", async () => {
        const schema = Schema.Struct({
          tags: Schema.Array(Schema.NonEmptyString).check(Check.minLength(3))
        })

        await assertions.decoding.fail(
          schema,
          {},
          `Missing key
  at ["tags"]`
        )
        await assertions.decoding.fail(
          schema,
          { tags: ["a", ""] },
          `Expected a value with a length of at least 1, got ""
  at ["tags"][1]
Expected a value with a length of at least 3, got ["a",""]
  at ["tags"]`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("Record + maxEntries", async () => {
        const schema = Schema.Record(Schema.String, Schema.Finite).check(Check.maxEntries(2))

        await assertions.decoding.fail(
          schema,
          null,
          `Expected object, got null`
        )
        await assertions.decoding.fail(
          schema,
          { a: 1, b: NaN, c: 3 },
          `Expected a finite number, got NaN
  at ["b"]
Expected an object with at most 2 entries, got {"a":1,"b":NaN,"c":3}`,
          { parseOptions: { errors: "all" } }
        )
      })

      it("Map + maxSize", async () => {
        const schema = Schema.Map(Schema.String, Schema.Finite).check(Check.maxSize(2))

        await assertions.decoding.fail(
          schema,
          null,
          `Expected Map, got null`
        )
        await assertions.decoding.fail(
          schema,
          new Map([["a", 1], ["b", NaN], ["c", 3]]),
          `Expected a finite number, got NaN
  at ["entries"][1][1]
Expected a value with a size of at most 2, got Map([["a",1],["b",NaN],["c",3]])`,
          { parseOptions: { errors: "all" } }
        )
      })
    })

    describe("Array checks", () => {
      it("UniqueArray", async () => {
        const schema = Schema.UniqueArray(Schema.Struct({
          a: Schema.String,
          b: Schema.String
        }))

        await assertions.decoding.succeed(schema, [{ a: "a", b: "b" }, { a: "c", b: "d" }])
        await assertions.decoding.fail(
          schema,
          [{ a: "a", b: "b" }, { a: "a", b: "b" }],
          `Expected an array with unique items, got [{"a":"a","b":"b"},{"a":"a","b":"b"}]`
        )
      })
    })
  })

  describe("Transformations", () => {
    describe("String transformations", () => {
      it("trim", async () => {
        const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, Transformation.trim()))

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

      await assertions.decoding.succeed(schema, "1", { expected: 1 })
      await assertions.decoding.fail(
        schema,
        "a",
        `Expected a finite number, got NaN`
      )

      await assertions.encoding.succeed(schema, 1, { expected: "1" })
      await assertions.encoding.fail(
        schema,
        "a",
        `Expected number, got "a"`
      )
    })

    it("NumberToString & greaterThan", async () => {
      const schema = Schema.FiniteFromString.check(Check.greaterThan(2))

      await assertions.decoding.succeed(schema, "3", { expected: 3 })
      await assertions.decoding.fail(
        schema,
        "1",
        `Expected a value greater than 2, got 1`
      )

      await assertions.encoding.succeed(schema, 3, { expected: "3" })
      await assertions.encoding.fail(
        schema,
        1,
        `Expected a value greater than 2, got 1`
      )
    })
  })

  describe("decodeTo", () => {
    it("should expose the source and the target schemas", () => {
      const schema = Schema.FiniteFromString

      strictEqual(schema.from.ast._tag, "StringKeyword")
      strictEqual(schema.to, Schema.Finite)
    })

    it("required to required", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.String,
            Transformation.passthrough()
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )
    })

    it("required to optional", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.decodeTo(
            Schema.optionalKey(Schema.String),
            {
              decode: Getter.required(),
              encode: Getter.withDefault(() => "default")
            }
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { expected: { a: "default" } })
    })

    it("optionalKey to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.decodeTo(
            Schema.String,
            {
              decode: Getter.withDefault(() => "default"),
              encode: Getter.passthrough()
            }
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { expected: { a: "default" } })

      await assertions.encoding.succeed(schema, { a: "a" })
    })

    it("double transformation", async () => {
      const schema = Trim.pipe(Schema.decodeTo(
        Schema.FiniteFromString,
        Transformation.passthrough()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `Expected a finite number, got NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.check(Check.minLength(2)).pipe(
          Schema.decodeTo(
            Schema.String.check(Check.minLength(3)),
            Transformation.passthrough()
          ),
          Schema.decodeTo(
            Schema.String,
            Transformation.passthrough()
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "aaa" })
      await assertions.decoding.fail(
        schema,
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "aaa" })
      await assertions.encoding.fail(
        schema,
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
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
                {
                  decode: Getter.withDefault(() => "default-b"),
                  encode: Getter.passthrough()
                }
              )
            )
          }),
          {
            decode: Getter.withDefault(() => ({})),
            encode: Getter.passthrough()
          }
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
          Transformation.trim().compose(
            Transformation.toLowerCase()
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
            Transformation.passthrough()
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )
    })

    it("required to optionalKey", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.optionalKey(Schema.String),
            {
              decode: Getter.withDefault(() => "default"),
              encode: Getter.passthrough()
            }
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { expected: { a: "default" } })

      await assertions.encoding.succeed(schema, { a: "a" })
    })

    it("optionalKey to required", async () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.String).pipe(
          Schema.encodeTo(
            Schema.String,
            {
              decode: Getter.required(),
              encode: Getter.withDefault(() => "default")
            }
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `Missing key
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { expected: { a: "default" } })
    })

    it("double transformation", async () => {
      const schema = Schema.FiniteFromString.pipe(Schema.encodeTo(
        Trim,
        Transformation.passthrough()
      ))
      await assertions.decoding.succeed(schema, " 2 ", { expected: 2 })
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `Expected a finite number, got NaN`
      )

      await assertions.encoding.succeed(schema, 2, { expected: "2" })
    })

    it("double transformation with checks", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String.check(Check.minLength(3)),
            Transformation.passthrough()
          ),
          Schema.encodeTo(
            Schema.String.check(Check.minLength(2)),
            Transformation.passthrough()
          )
        )
      })
      await assertions.decoding.succeed(schema, { a: "aaa" })
      await assertions.decoding.fail(
        schema,
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: "aaa" })
      await assertions.encoding.fail(
        schema,
        { a: "aa" },
        `Expected a value with a length of at least 3, got "aa"
  at ["a"]`
      )
    })
  })

  describe("encode", () => {
    it("double transformation", async () => {
      const schema = Schema.String.pipe(
        Schema.encode(
          Transformation.trim().compose(
            Transformation.toLowerCase()
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
        Schema.check(Check.greaterThan(2)),
        Schema.flip,
        Schema.check(Check.minLength(3))
      )

      await assertions.encoding.succeed(schema, "123", { expected: 123 })

      await assertions.decoding.fail(
        schema,
        2,
        `Expected a value greater than 2, got 2`
      )
      await assertions.decoding.fail(
        schema,
        3,
        `Expected a value with a length of at least 3, got "3"`
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
    const schema = Schema.declare(
      (u) => u instanceof File,
      { title: "File" }
    )

    await assertions.decoding.succeed(schema, new File([], "a.txt"))
    await assertions.decoding.fail(schema, "a", `Expected File, got "a"`)
  })

  describe("Redacted", () => {
    it("should expose the value", () => {
      const schema = Schema.Redacted(Schema.String)
      strictEqual(schema.value, Schema.String)
      strictEqual(schema.annotate({}).value, Schema.String)
    })

    it("Redacted(Finite)", async () => {
      const schema = Schema.Redacted(Schema.Finite)
      await assertions.decoding.succeed(schema, Redacted.make(123))
      await assertions.decoding.fail(schema, null, `Expected Redacted, got null`)
      await assertions.decoding.fail(
        schema,
        Redacted.make("a"),
        `Invalid data <redacted>
  at ["value"]`
      )

      await assertions.encoding.succeed(schema, Redacted.make(123))
      await assertions.encoding.fail(schema, null, `Expected Redacted, got null`)
      await assertions.encoding.fail(
        schema,
        Redacted.make("a"),
        `Invalid data <redacted>
  at ["value"]`
      )
    })

    it("with label", async () => {
      const schema = Schema.Redacted(Schema.String, { label: "password" })
      await assertions.decoding.succeed(schema, Redacted.make("a", { label: "password" }))
      await assertions.decoding.fail(
        schema,
        Redacted.make("a", { label: "API key" }),
        `Expected "password", got "API key"
  at ["label"]`
      )
      await assertions.decoding.fail(
        schema,
        Redacted.make(1, { label: "API key" }),
        `Expected "password", got "API key"
  at ["label"]`
      )
      await assertions.decoding.fail(
        schema,
        Redacted.make(1, { label: "password" }),
        `Invalid data <redacted:password>
  at ["value"]`
      )
    })
  })

  describe("Option", () => {
    it("should expose the value", () => {
      const schema = Schema.Option(Schema.String)
      strictEqual(schema.value, Schema.String)
      strictEqual(schema.annotate({}).value, Schema.String)
    })

    it("Option(FiniteFromString)", async () => {
      const schema = Schema.Option(Schema.FiniteFromString)

      await assertions.decoding.succeed(schema, Option.none())
      await assertions.decoding.succeed(schema, Option.some("123"), { expected: Option.some(123) })
      await assertions.decoding.fail(schema, null, `Expected Option, got null`)
      await assertions.decoding.fail(
        schema,
        Option.some(null),
        `Expected string, got null
  at ["value"]`
      )

      await assertions.encoding.succeed(schema, Option.none())
      await assertions.encoding.succeed(schema, Option.some(123), { expected: Option.some("123") })
      await assertions.encoding.fail(schema, null, `Expected Option, got null`)
      await assertions.encoding.fail(
        schema,
        Option.some(null),
        `Expected number, got null
  at ["value"]`
      )
    })
  })

  it("OptionFromNullOr", async () => {
    const schema = Schema.OptionFromNullOr(Schema.FiniteFromString)
    await assertions.decoding.succeed(schema, null, { expected: Option.none() })
    await assertions.decoding.succeed(schema, "1", { expected: Option.some(1) })
    await assertions.decoding.fail(schema, "a", `Expected a finite number, got NaN`)

    await assertions.encoding.succeed(schema, Option.none(), { expected: null })
    await assertions.encoding.succeed(schema, Option.some(1), { expected: "1" })
  })

  it("OptionFromOptionalKey", async () => {
    const schema = Schema.Struct({
      a: Schema.OptionFromOptionalKey(Schema.FiniteFromString)
    })

    await assertions.decoding.succeed(schema, {}, { expected: { a: Option.none() } })
    await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: Option.some(1) } })
    await assertions.decoding.fail(
      schema,
      { a: undefined },
      `Expected string, got undefined
  at ["a"]`
    )
    await assertions.decoding.fail(
      schema,
      { a: "a" },
      `Expected a finite number, got NaN
  at ["a"]`
    )

    await assertions.encoding.succeed(schema, { a: Option.none() }, { expected: {} })
    await assertions.encoding.succeed(schema, { a: Option.some(1) }, { expected: { a: "1" } })
  })

  it("OptionFromOptional", async () => {
    const schema = Schema.Struct({
      a: Schema.OptionFromOptional(Schema.FiniteFromString)
    })

    await assertions.decoding.succeed(schema, {}, { expected: { a: Option.none() } })
    await assertions.decoding.succeed(schema, { a: undefined }, { expected: { a: Option.none() } })
    await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: Option.some(1) } })
    await assertions.decoding.fail(
      schema,
      { a: "a" },
      `Expected a finite number, got NaN
  at ["a"]`
    )

    await assertions.encoding.succeed(schema, { a: Option.none() }, { expected: {} })
    await assertions.encoding.succeed(schema, { a: Option.some(1) }, { expected: { a: "1" } })
  })

  describe("Result", () => {
    it("should expose the values", () => {
      const schema = Schema.Result(Schema.String, Schema.Number)
      strictEqual(schema.success, Schema.String)
      strictEqual(schema.annotate({}).success, Schema.String)
      strictEqual(schema.failure, Schema.Number)
      strictEqual(schema.annotate({}).failure, Schema.Number)
    })

    it("Result(FiniteFromString, FiniteFromString)", async () => {
      const schema = Schema.Result(Schema.FiniteFromString, Schema.FiniteFromString)
      await assertions.decoding.succeed(schema, Result.succeed("1"), { expected: Result.succeed(1) })
      await assertions.decoding.succeed(schema, Result.fail("2"), { expected: Result.fail(2) })
      await assertions.decoding.fail(schema, null, `Expected Result, got null`)
      await assertions.decoding.fail(
        schema,
        Result.succeed("a"),
        `Expected a finite number, got NaN
  at ["success"]`
      )
      await assertions.decoding.fail(
        schema,
        Result.fail("b"),
        `Expected a finite number, got NaN
  at ["failure"]`
      )

      await assertions.encoding.succeed(schema, Result.succeed(1), { expected: Result.succeed("1") })
      await assertions.encoding.succeed(schema, Result.fail(2), { expected: Result.fail("2") })
    })
  })

  describe("Defect", () => {
    const noPrototypeObject = Object.create(null)
    noPrototypeObject.message = "a"

    it("decoding", async () => {
      const schema = Schema.Defect

      // Error: message only
      await assertions.decoding.succeed(schema, { message: "a" }, {
        expected: new Error("a", { cause: { message: "a" } })
      })
      await assertions.decoding.succeed(schema, noPrototypeObject, {
        expected: new Error("a", { cause: { message: "a" } })
      })
      // Error: message and name
      await assertions.decoding.succeed(schema, { message: "a", name: "b" }, {
        expected: (() => {
          const err = new Error("a", { cause: { message: "a", name: "b" } })
          err.name = "b"
          return err
        })()
      })
      // Error: message, name, and stack
      await assertions.decoding.succeed(schema, { message: "a", name: "b", stack: "c" }, {
        expected: (() => {
          const err = new Error("a", { cause: { message: "a", name: "b", stack: "c" } })
          err.name = "b"
          err.stack = "c"
          return err
        })()
      })
      // string
      await assertions.decoding.succeed(schema, "a", { expected: "a" })
    })

    it("encoding", async () => {
      const schema = Schema.Defect

      // Error
      await assertions.encoding.succeed(schema, new Error("a"), { expected: { name: "Error", message: "a" } })
      // string
      await assertions.encoding.succeed(schema, "a")
      // a value with a custom toString method
      await assertions.encoding.succeed(schema, { toString: () => "a" }, { expected: "a" })
      // anything else
      await assertions.encoding.succeed(schema, { a: 1 }, { expected: `{"a":1}` })
      await assertions.encoding.succeed(schema, noPrototypeObject, { expected: "a" })
    })
  })

  describe("CauseFailure", () => {
    it("should expose the values", () => {
      const schema = Schema.CauseFailure(Schema.String, Schema.Number)
      strictEqual(schema.error, Schema.String)
      strictEqual(schema.annotate({}).error, Schema.String)
      strictEqual(schema.defect, Schema.Number)
      strictEqual(schema.annotate({}).defect, Schema.Number)
    })
  })

  describe("Cause", () => {
    it("should expose the values", () => {
      const schema = Schema.Cause(Schema.String, Schema.Number)
      strictEqual(schema.error, Schema.String)
      strictEqual(schema.annotate({}).error, Schema.String)
      strictEqual(schema.defect, Schema.Number)
      strictEqual(schema.annotate({}).defect, Schema.Number)
    })

    it("Cause(FiniteFromString, FiniteFromString)", async () => {
      const schema = Schema.Cause(Schema.FiniteFromString, Schema.FiniteFromString)
      await assertions.decoding.succeed(schema, Cause.fail("1"), { expected: Cause.fail(1) })
      await assertions.decoding.succeed(schema, Cause.die("2"), { expected: Cause.die(2) })
      await assertions.decoding.succeed(schema, Cause.interrupt(3))

      await assertions.decoding.fail(
        schema,
        Cause.fail("a"),
        `Expected a finite number, got NaN
  at ["failures"][0]["error"]`
      )
      await assertions.decoding.fail(
        schema,
        Cause.die("a"),
        `Expected a finite number, got NaN
  at ["failures"][0]["defect"]`
      )

      await assertions.encoding.succeed(schema, Cause.fail(1), { expected: Cause.fail("1") })
      await assertions.encoding.succeed(schema, Cause.die(2), { expected: Cause.die("2") })
      await assertions.encoding.succeed(schema, Cause.interrupt(3))

      await assertions.encoding.fail(
        schema,
        Cause.fail("a"),
        `Expected number, got "a"
  at ["failures"][0]["error"]`
      )
      await assertions.encoding.fail(
        schema,
        Cause.die("a"),
        `Expected number, got "a"
  at ["failures"][0]["defect"]`
      )
    })
  })

  describe("Exit", () => {
    it("should expose the values", () => {
      const schema = Schema.Exit(Schema.String, Schema.Number, Schema.Boolean)
      strictEqual(schema.value, Schema.String)
      strictEqual(schema.annotate({}).value, Schema.String)
      strictEqual(schema.error, Schema.Number)
      strictEqual(schema.annotate({}).error, Schema.Number)
      strictEqual(schema.defect, Schema.Boolean)
      strictEqual(schema.annotate({}).defect, Schema.Boolean)
    })

    it("Exit(FiniteFromString, String, Unknown)", async () => {
      const schema = Schema.Exit(Schema.FiniteFromString, Schema.String, Schema.Unknown)

      await assertions.decoding.succeed(schema, Exit.succeed("123"), { expected: Exit.succeed(123) })
      await assertions.decoding.succeed(schema, Exit.fail("boom"))
      await assertions.decoding.fail(
        schema,
        null,
        `Expected Exit, got null`
      )
      await assertions.decoding.fail(
        schema,
        Exit.succeed(123),
        `Expected string, got 123
  at ["value"]`
      )
      await assertions.decoding.fail(
        schema,
        Exit.fail(null),
        `Expected string, got null
  at ["cause"]["failures"][0]["error"]`
      )
    })

    it("Exit(FiniteFromString, String, Defect)", async () => {
      const schema = Schema.Exit(Schema.FiniteFromString, Schema.String, Schema.Defect)
      const boomError = new Error("boom message", {
        cause: {
          name: "boom",
          message: "boom message"
        }
      })
      boomError.name = "boom"

      await assertions.decoding.succeed(
        schema,
        Exit.die({
          name: "boom",
          message: "boom message"
        }),
        { expected: Exit.die(boomError) }
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
        a: Schema.FiniteFromString.check(Check.greaterThan(0)),
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
        `Expected a finite number, got NaN
  at ["categories"][0]["a"]`
      )

      await assertions.encoding.succeed(schema, { a: 1, categories: [] }, { expected: { a: "1", categories: [] } })
      await assertions.encoding.succeed(schema, { a: 1, categories: [{ a: 2, categories: [] }] }, {
        expected: { a: "1", categories: [{ a: "2", categories: [] }] }
      })
      await assertions.encoding.fail(
        schema,
        { a: 1, categories: [{ a: -1, categories: [] }] },
        `Expected a value greater than 0, got -1
  at ["categories"][0]["a"]`
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
        assertions.makeSync.fail(
          schema,
          {},
          `Missing key
  at ["a"]`
        )
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
        class Service extends ServiceMap.Key<Service, { value: Effect.Effect<number> }>()("Service") {}

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
        const sr = ToParser.makeEffect(schema)({})
        const provided = Effect.provideService(
          sr,
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

      await assertions.make.succeed(schema, { a: 1 })
      await assertions.make.fail(schema, null, `Expected object, got null`)
      assertions.makeSync.succeed(schema, { a: 1 })
      assertions.makeSync.fail(schema, null, `Expected object, got null`)

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.fail(schema, null, "Expected object, got null")
      await assertions.decoding.fail(
        schema,
        { a: "b" },
        `Expected number, got "b"
  at ["a"]`
      )

      await assertions.encoding.succeed(schema, { a: 1 })
      await assertions.encoding.fail(
        schema,
        { a: "b" },
        `Expected number, got "b"
  at ["a"]`
      )
      await assertions.encoding.fail(schema, null, "Expected object, got null")
    })

    it("Record(String, optionalKey(Number)) should throw", async () => {
      throws(
        () => Schema.Record(Schema.String, Schema.optionalKey(Schema.Number)),
        new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.")
      )
    })

    it("Record(String, optional(Number))", async () => {
      const schema = Schema.Record(Schema.String, Schema.optional(Schema.Number))

      await assertions.make.succeed(schema, { a: 1 })
      await assertions.make.succeed(schema, { a: undefined })
      await assertions.make.fail(schema, null, `Expected object, got null`)

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: undefined })
      await assertions.encoding.succeed(schema, { a: 1 })
      await assertions.encoding.succeed(schema, { a: undefined })
    })

    it("Record(Symbol, Number)", async () => {
      const schema = Schema.Record(Schema.Symbol, Schema.Number)

      await assertions.make.succeed(schema, { [Symbol.for("a")]: 1 })
      await assertions.make.fail(schema, null, `Expected object, got null`)
      assertions.makeSync.succeed(schema, { [Symbol.for("a")]: 1 })
      assertions.makeSync.fail(schema, null, `Expected object, got null`)

      await assertions.decoding.succeed(schema, { [Symbol.for("a")]: 1 })
      await assertions.decoding.fail(schema, null, "Expected object, got null")
      await assertions.decoding.fail(
        schema,
        { [Symbol.for("a")]: "b" },
        `Expected number, got "b"
  at [Symbol(a)]`
      )

      await assertions.encoding.succeed(schema, { [Symbol.for("a")]: 1 })
      await assertions.encoding.fail(
        schema,
        { [Symbol.for("a")]: "b" },
        `Expected number, got "b"
  at [Symbol(a)]`
      )
      await assertions.encoding.fail(schema, null, "Expected object, got null")
    })

    it("Record(SnakeToCamel, NumberFromString)", async () => {
      const schema = Schema.Record(SnakeToCamel, NumberFromString)

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1" }, { expected: { aB: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1", aB: "2" }, { expected: { aB: 2 } })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, { aB: 1 }, { expected: { a_b: "1" } })
      await assertions.encoding.succeed(schema, { a_b: 1, aB: 2 }, { expected: { a_b: "2" } })
    })

    it("Record(SnakeToCamel, Number, { keyValueCombiner: ... })", async () => {
      const schema = Schema.Record(SnakeToCamel, NumberFromString, {
        keyValueCombiner: {
          decode: {
            combine: ([_, v1], [k2, v2]) => [k2, v1 + v2]
          },
          encode: {
            combine: ([_, v1], [k2, v2]) => [k2, v1 + "e" + v2]
          }
        }
      })

      await assertions.decoding.succeed(schema, { a: "1" }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1" }, { expected: { aB: 1 } })
      await assertions.decoding.succeed(schema, { a_b: "1", aB: "2" }, { expected: { aB: 3 } })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
      await assertions.encoding.succeed(schema, { aB: 1 }, { expected: { a_b: "1" } })
      await assertions.encoding.succeed(schema, { a_b: 1, aB: 2 }, { expected: { a_b: "1e2" } })
    })

    describe("Literals keys", () => {
      it("Record(Literals, Number)", async () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.Number)

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
        await assertions.decoding.fail(
          schema,
          { a: 1 },
          `Missing key
  at ["b"]`
        )
        await assertions.decoding.fail(
          schema,
          { b: 2 },
          `Missing key
  at ["a"]`
        )
      })

      it("Record(Literals, optionalKey(Number))", async () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.optionalKey(Schema.Number))

        await assertions.decoding.succeed(schema, {})
        await assertions.decoding.succeed(schema, { a: 1 })
        await assertions.decoding.succeed(schema, { b: 2 })
        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
      })

      it("Record(Literals, mutableKey(Number))", async () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.mutableKey(Schema.Number))

        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
      })

      it("Record(Literals, mutableKey(optionalKey(Number)))", async () => {
        const schema = Schema.Record(
          Schema.Literals(["a", "b"]),
          Schema.mutableKey(Schema.optionalKey(Schema.Number))
        )

        await assertions.decoding.succeed(schema, {})
        await assertions.decoding.succeed(schema, { a: 1 })
        await assertions.decoding.succeed(schema, { b: 2 })
        await assertions.decoding.succeed(schema, { a: 1, b: 2 })
      })
    })
  })

  describe("Union", () => {
    it("empty", async () => {
      const schema = Schema.Union([])

      await assertions.decoding.fail(schema, null, `Expected never, got null`)
    })

    it(`String`, async () => {
      const schema = Schema.Union([Schema.String])

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, null, `Expected string, got null`)
    })

    it(`String | Number`, async () => {
      const schema = Schema.Union([Schema.String, Schema.Number])

      deepStrictEqual(schema.members, [Schema.String, Schema.Number])

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        null,
        `Expected string | number, got null`
      )
    })

    it(`String | Never`, async () => {
      const schema = Schema.Union([Schema.String, Schema.Never])

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(schema, null, `Expected string | never, got null`)
    })

    it(`String & minLength(1) | number & greaterThan(0)`, async () => {
      const schema = Schema.Union([
        Schema.NonEmptyString,
        Schema.Number.check(Check.greaterThan(0))
      ])

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, 1)
      await assertions.decoding.fail(
        schema,
        "",
        `Expected a value with a length of at least 1, got ""`
      )
      await assertions.decoding.fail(
        schema,
        -1,
        `Expected a value greater than 0, got -1`
      )
    })

    it(`mode: "oneOf"`, async () => {
      const schema = Schema.Union([
        Schema.Struct({ a: Schema.String }),
        Schema.Struct({ b: Schema.Number })
      ], { mode: "oneOf" })

      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, { b: 1 })
      await assertions.decoding.fail(
        schema,
        { a: "a", b: 1 },
        `Expected exactly one member to match the input {"a":"a","b":1}`
      )
    })

    it("{} & Literal", async () => {
      const schema = Schema.Union([
        Schema.Struct({}),
        Schema.Literal("a")
      ])
      await assertions.decoding.succeed(schema, [])
    })

    describe("should exclude members based on failed sentinels", () => {
      it("string | struct", async () => {
        const schema = Schema.Union([
          Schema.String,
          Schema.Struct({ _tag: Schema.Literal("a"), a: Schema.String })
        ])
        await assertions.decoding.fail(
          schema,
          {},
          `Expected string | { _tag: "a", ... }, got {}`
        )
      })

      it("tagged union", async () => {
        const schema = Schema.Union([
          Schema.Struct({ _tag: Schema.Literal("a"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.Literal("b"), b: Schema.Number })
        ])
        await assertions.decoding.fail(
          schema,
          { _tag: "a" },
          `Missing key
  at ["a"]`
        )
        await assertions.decoding.fail(
          schema,
          { _tag: "b" },
          `Missing key
  at ["b"]`
        )
        await assertions.decoding.fail(
          schema,
          { _tag: "c" },
          `Expected { _tag: "a", ... } | { _tag: "b", ... }, got {"_tag":"c"}`
        )
      })
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

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, b: 2 })
      await assertions.decoding.fail(
        schema,
        { a: 1, b: "" },
        `Expected number, got ""
  at ["b"]`
      )
    })

    it("Record(Symbol, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.Symbol, Schema.Number)]
      )

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, [Symbol.for("b")]: 2 })
      await assertions.decoding.fail(
        schema,
        { a: 1, [Symbol.for("b")]: "c" },
        `Expected number, got "c"
  at [Symbol(b)]`
      )
    })

    it("Record(`a${string}`, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.TemplateLiteral(["a", Schema.String]), Schema.Finite)]
      )

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, "ab": 2 })
      await assertions.decoding.fail(
        schema,
        { a: NaN, "ab": 2 },
        `Expected a finite number, got NaN
  at ["a"]`
      )
      await assertions.decoding.fail(
        schema,
        { a: 1, "ab": "c" },
        `Expected number, got "c"
  at ["ab"]`
      )
    })

    it("should preserve both checks", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }).check(
          Check.make((s) => s.a > 0, { title: "agt(0)" })
        ),
        [
          Schema.Record(Schema.String, Schema.Number).check(
            Check.make((s) => s.b === undefined || s.b > 1, { title: "bgt(1)" })
          )
        ]
      )

      await assertions.decoding.succeed(schema, { a: 1 })
      await assertions.decoding.succeed(schema, { a: 1, b: 2 })
      await assertions.decoding.fail(
        schema,
        { a: 0 },
        `Expected agt(0), got {"a":0}`
      )
      await assertions.decoding.fail(
        schema,
        { a: 1, b: 1 },
        `Expected bgt(1), got {"a":1,"b":1}`
      )
    })
  })

  describe("NullOr", () => {
    it("NullOr(String)", async () => {
      const schema = Schema.NullOr(Schema.NonEmptyString)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null)
      await assertions.decoding.fail(schema, undefined, `Expected string | null, got undefined`)
      await assertions.decoding.fail(
        schema,
        "",
        `Expected a value with a length of at least 1, got ""`
      )
    })
  })

  describe("UndefinedOr", () => {
    it("UndefinedOr(String)", async () => {
      const schema = Schema.UndefinedOr(Schema.NonEmptyString)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, undefined)
      await assertions.decoding.fail(schema, null, `Expected string | undefined, got null`)
      await assertions.decoding.fail(
        schema,
        "",
        `Expected a value with a length of at least 1, got ""`
      )
    })
  })

  describe("NullishOr", () => {
    it("NullishOr(String)", async () => {
      const schema = Schema.NullishOr(Schema.NonEmptyString)

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null)
      await assertions.decoding.succeed(schema, undefined)
      await assertions.decoding.fail(
        schema,
        "",
        `Expected a value with a length of at least 1, got ""`
      )
    })
  })

  it("Date", async () => {
    const schema = Schema.Date

    await assertions.decoding.succeed(schema, new Date("2021-01-01"))
    await assertions.decoding.fail(schema, null, `Expected Date, got null`)
    await assertions.decoding.fail(schema, 0, `Expected Date, got 0`)
  })

  it("DateTimeUtc", async () => {
    const schema = Schema.DateTimeUtc
    await assertions.decoding.succeed(schema, DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))
    await assertions.encoding.succeed(schema, DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"))
  })

  it("DateTimeUtcFromValidDate", async () => {
    const schema = Schema.DateTimeUtcFromDate
    await assertions.decoding.succeed(schema, new Date("2021-01-01T00:00:00.000Z"), {
      expected: DateTime.makeUnsafe("2021-01-01T00:00:00.000Z")
    })
    await assertions.decoding.fail(schema, new Date("invalid date"), `Expected a valid date, got Invalid Date`)
    await assertions.encoding.succeed(schema, DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"), {
      expected: new Date("2021-01-01T00:00:00.000Z")
    })
  })

  it("DateTimeUtcFromString", async () => {
    const schema = Schema.DateTimeUtcFromString
    await assertions.decoding.succeed(schema, "2021-01-01T00:00:00.000Z", {
      expected: DateTime.makeUnsafe("2021-01-01T00:00:00.000Z")
    })
    await assertions.decoding.fail(schema, null, `Expected string, got null`)
    await assertions.encoding.succeed(schema, DateTime.makeUnsafe("2021-01-01T00:00:00.000Z"), {
      expected: "2021-01-01T00:00:00.000Z"
    })
  })

  it("Map", async () => {
    const schema = Schema.Map(Schema.String, Schema.Number)

    strictEqual(schema.key, Schema.String)
    strictEqual(schema.annotate({}).key, Schema.String)
    strictEqual(schema.value, Schema.Number)
    strictEqual(schema.annotate({}).value, Schema.Number)

    await assertions.decoding.succeed(schema, new Map([["a", 1]]))
    await assertions.decoding.fail(schema, null, `Expected Map, got null`)
    await assertions.decoding.fail(
      schema,
      new Map([["a", "b"]]),
      `Expected number, got "b"
  at ["entries"][0][1]`
    )
    await assertions.encoding.succeed(schema, new Map([["a", 1]]))
  })

  describe("Transformations", () => {
    it("toLowerCase", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(
          Schema.String,
          Transformation.toLowerCase()
        )
      )

      await assertions.decoding.succeed(schema, "A", { expected: "a" })
      await assertions.decoding.succeed(schema, "B", { expected: "b" })
    })

    it("toUpperCase", async () => {
      const schema = Schema.String.pipe(
        Schema.decodeTo(Schema.String, Transformation.toUpperCase())
      )

      await assertions.decoding.succeed(schema, "a", { expected: "A" })
      await assertions.decoding.succeed(schema, "b", { expected: "B" })
    })
  })

  describe("Opaque", () => {
    it("Struct", () => {
      class A extends Schema.Opaque<A>()(Schema.Struct({ a: Schema.String })) {}

      const schema = A

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

      const schema = Schema.instanceOf(
        MyError,
        {
          title: "MyError",
          defaultIsoSerializer: () =>
            Schema.link<MyError>()(
              Schema.String,
              Transformation.transform({
                decode: (message) => new MyError(message),
                encode: (e) => e.message
              })
            )
        }
      )

      await assertions.decoding.succeed(schema, new MyError("a"))
      await assertions.decoding.fail(schema, null, `Expected MyError, got null`)

      await assertions.encoding.succeed(schema, new MyError("a"))
      await assertions.encoding.fail(schema, null, `Expected MyError, got null`)
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
              decode: Getter.withDefault(() => "a" as const),
              encode: Getter.omit()
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
        "SyntaxError: Expected ':' after property name in JSON at position 4 (line 1 column 5)"
      )

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: `{"a":1}` })
    })

    it("use case: create a JSON string serializer for an existing schema", async () => {
      const schema = Schema.Struct({ b: Schema.Number })

      const schemaFromJsonString = Schema.fromJsonString(schema)

      await assertions.decoding.succeed(schemaFromJsonString, `{"b":1}`, { expected: { b: 1 } })
      await assertions.decoding.fail(
        schemaFromJsonString,
        `{"a":null}`,
        `Missing key
  at ["b"]`
      )
    })

    it("use case: parse / stringify a nested schema", async () => {
      const schema = Schema.Struct({
        a: Schema.fromJsonString(Schema.Struct({ b: Schema.Number }))
      })

      await assertions.decoding.succeed(schema, { a: `{"b":2}` }, { expected: { a: { b: 2 } } })
      await assertions.decoding.fail(
        schema,
        { a: `{"a":null}` },
        `Missing key
  at ["a"]["b"]`
      )
    })
  })

  it("Trim", async () => {
    const schema = Schema.Trim

    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.succeed(schema, "a ", { expected: "a" })
    await assertions.decoding.succeed(schema, " a", { expected: "a" })
    await assertions.decoding.succeed(schema, " a ", { expected: "a" })
    await assertions.decoding.succeed(schema, "a\n", { expected: "a" })

    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(
      schema,
      "a ",
      `Expected a string with no leading or trailing whitespace, got "a "`
    )
  })

  it("transformOrFail", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String,
        Transformation.transformOrFail({
          decode: (s) =>
            s === "a"
              ? Effect.fail(new Issue.Forbidden(Option.some(s), { message: `input should not be "a"` }))
              : Effect.succeed(s),
          encode: (s) =>
            s === "b"
              ? Effect.fail(new Issue.Forbidden(Option.some(s), { message: `input should not be "b"` }))
              : Effect.succeed(s)
        })
      )
    )

    await assertions.decoding.succeed(schema, "b")
    await assertions.decoding.fail(
      schema,
      "a",
      `input should not be "a"`
    )

    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(
      schema,
      "b",
      `input should not be "b"`
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
        strictEqual(AST.getTemplateLiteralRegExp(Schema.TemplateLiteral(parts).ast).source, source)
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
        "^(a|b)([\\s\\S]*?)(d|e)$"
      )
      assertSource(["a", Schema.String], "^(a)([\\s\\S]*?)$")
      assertSource(["a", Schema.String, "b"], "^(a)([\\s\\S]*?)(b)$")
      assertSource(
        ["a", Schema.String, "b", Schema.Number],
        "^(a)([\\s\\S]*?)(b)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)$"
      )
      assertSource(["a", Schema.Number], "^(a)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)$")
      assertSource([Schema.String, "a"], "^([\\s\\S]*?)(a)$")
      assertSource([Schema.Number, "a"], "^([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?)(a)$")
      assertSource(
        [Schema.Union([Schema.String, Schema.Literal(1)]), Schema.Union([Schema.Number, Schema.Literal("true")])],
        "^([\\s\\S]*?|1)([+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?|true)$"
      )
      assertSource(
        [Schema.Union([Schema.Literals(["a", "b"]), Schema.Literals([1, 2])])],
        "^(a|b|1|2)$"
      )
      assertSource(
        ["c", Schema.Union([Schema.TemplateLiteral(["a", Schema.String, "b"]), Schema.Literal("e")]), "d"],
        "^(c)(a[\\s\\S]*?b|e)(d)$"
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

      await assertions.decoding.succeed(schema, "a")

      await assertions.decoding.fail(schema, null, "Expected `a`, got null")
      await assertions.decoding.fail(
        schema,
        "ab",
        "Expected `a`, got \"ab\""
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a`, got \"\""
      )
    })

    it(`"a b"`, async () => {
      const schema = Schema.TemplateLiteral(["a", " ", "b"])

      await assertions.decoding.succeed(schema, "a b")

      await assertions.decoding.fail(
        schema,
        "a  b",
        "Expected `a b`, got \"a  b\""
      )
    })

    it(`"[" + string + "]"`, async () => {
      const schema = Schema.TemplateLiteral(["[", Schema.String, "]"])

      await assertions.decoding.succeed(schema, "[a]")

      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `[${string}]`, got \"a\""
      )
    })

    it(`"a" + string`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String])

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, "ab")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${string}`, got null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${string}`, got \"\""
      )
    })

    it(`"a" + number`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.Number])

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
        "Expected `a${number}`, got null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${number}`, got \"\""
      )
      await assertions.decoding.fail(
        schema,
        "aa",
        "Expected `a${number}`, got \"aa\""
      )
    })

    it(`"a" + bigint`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.BigInt])

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.succeed(schema, "a1")
      await assertions.decoding.succeed(schema, "a-1")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${bigint}`, got null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${bigint}`, got \"\""
      )
      await assertions.decoding.fail(
        schema,
        "aa",
        "Expected `a${bigint}`, got \"aa\""
      )
      await assertions.decoding.fail(
        schema,
        "a1.2",
        "Expected `a${bigint}`, got \"a1.2\""
      )
      await assertions.decoding.fail(
        schema,
        "a+1",
        "Expected `a${bigint}`, got \"a+1\""
      )
    })

    it(`string`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String])

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

      await assertions.decoding.succeed(schema, "\n")
      await assertions.decoding.succeed(schema, "\na")
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `\n${string}`, got \"a\""
      )
    })

    it(`a\\nb  + string`, async () => {
      const schema = Schema.TemplateLiteral(["a\nb ", Schema.String])

      await assertions.decoding.succeed(schema, "a\nb ")
      await assertions.decoding.succeed(schema, "a\nb c")
    })

    it(`"a" + string + "b"`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String, "b"])

      await assertions.decoding.succeed(schema, "ab")
      await assertions.decoding.succeed(schema, "acb")
      await assertions.decoding.succeed(schema, "abb")
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${string}b`, got \"\""
      )
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `a${string}b`, got \"a\""
      )
      await assertions.decoding.fail(
        schema,
        "b",
        "Expected `a${string}b`, got \"b\""
      )
      await assertions.encoding.succeed(schema, "acb")
    })

    it(`"a" + string + "b" + string`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.String, "b", Schema.String])

      await assertions.decoding.succeed(schema, "ab")
      await assertions.decoding.succeed(schema, "acb")
      await assertions.decoding.succeed(schema, "acbd")

      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `a${string}b${string}`, got \"a\""
      )
      await assertions.decoding.fail(
        schema,
        "b",
        "Expected `a${string}b${string}`, got \"b\""
      )
    })

    it("https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html", async () => {
      const EmailLocaleIDs = Schema.Literals(["welcome_email", "email_heading"])
      const FooterLocaleIDs = Schema.Literals(["footer_title", "footer_sendoff"])
      const schema = Schema.TemplateLiteral([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), "_id"])

      await assertions.decoding.succeed(schema, "welcome_email_id")
      await assertions.decoding.succeed(schema, "email_heading_id")
      await assertions.decoding.succeed(schema, "footer_title_id")
      await assertions.decoding.succeed(schema, "footer_sendoff_id")

      await assertions.decoding.fail(
        schema,
        "_id",
        "Expected `${\"welcome_email\" | \"email_heading\" | \"footer_title\" | \"footer_sendoff\"}_id`, got \"_id\""
      )
    })

    it(`string + 0`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, 0])

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `${string}0`, got \"a\""
      )
    })

    it(`string + 1n`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, 1n])

      await assertions.decoding.succeed(schema, "a1")
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `${string}1`, got \"a\""
      )
    })

    it(`string + ("a" | 0)`, async () => {
      const schema = Schema.TemplateLiteral([Schema.String, Schema.Literals(["a", 0])])

      await assertions.decoding.succeed(schema, "a0")
      await assertions.decoding.succeed(schema, "aa")
      await assertions.decoding.fail(
        schema,
        "b",
        "Expected `${string}${\"a\" | 0}`, got \"b\""
      )
    })

    it(`(string | 1) + (number | true)`, async () => {
      const schema = Schema.TemplateLiteral([
        Schema.Union([Schema.String, Schema.Literal(1)]),
        Schema.Union([Schema.Number, Schema.Literal("true")])
      ])

      await assertions.decoding.succeed(schema, "atrue")
      await assertions.decoding.succeed(schema, "-2")
      await assertions.decoding.succeed(schema, "10.1")
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `${string | 1}${number | \"true\"}`, got \"\""
      )
    })

    it("`c${`a${string}b` | \"e\"}d`", async () => {
      const schema = Schema.TemplateLiteral(
        ["c", Schema.Union([Schema.TemplateLiteral(["a", Schema.String, "b"]), Schema.Literal("e")]), "d"]
      )

      await assertions.decoding.succeed(schema, "ced")
      await assertions.decoding.succeed(schema, "cabd")
      await assertions.decoding.succeed(schema, "casbd")
      await assertions.decoding.succeed(schema, "ca  bd")
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `c${`a${string}b` | \"e\"}d`, got \"\""
      )
    })

    it("< + h + (1|2) + >", async () => {
      const schema = Schema.TemplateLiteral(["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2n])]), ">"])

      await assertions.decoding.succeed(schema, "<h1>")
      await assertions.decoding.succeed(schema, "<h2>")
      await assertions.decoding.fail(
        schema,
        "<h3>",
        "Expected `<${`h${1 | 2}`}>`, got \"<h3>\""
      )
    })

    it(`"a" + check`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.NonEmptyString])

      await assertions.decoding.succeed(schema, "ab")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${string}`, got null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${string}`, got \"\""
      )
      await assertions.decoding.fail(
        schema,
        "a",
        "Expected `a${string}`, got \"a\""
      )
    })

    it(`"a" + transformation`, async () => {
      const schema = Schema.TemplateLiteral(["a", Schema.FiniteFromString])

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, "a1")

      await assertions.decoding.fail(
        schema,
        null,
        "Expected `a${string}`, got null"
      )
      await assertions.decoding.fail(
        schema,
        "",
        "Expected `a${string}`, got \"\""
      )
      await assertions.decoding.fail(
        schema,
        "ab",
        "Expected `a${string}`, got \"ab\""
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

      await assertions.decoding.succeed(schema, "a", { expected: ["a"] })

      await assertions.decoding.fail(
        schema,
        "ab",
        `Missing key
  at [0]`
      )
      await assertions.decoding.fail(
        schema,
        "",
        `Missing key
  at [0]`
      )
      await assertions.decoding.fail(
        schema,
        null,
        "Expected string, got null"
      )
    })

    it(`"a b"`, async () => {
      const schema = Schema.TemplateLiteralParser(["a", " ", "b"])

      await assertions.decoding.succeed(schema, "a b", { expected: ["a", " ", "b"] })

      await assertions.decoding.fail(
        schema,
        "a  b",
        `Missing key
  at [0]`
      )
    })

    it(`Int + "a"`, async () => {
      const schema = Schema.TemplateLiteralParser([Schema.Int, "a"])

      await assertions.decoding.succeed(schema, "1a", { expected: [1, "a"] })
      await assertions.decoding.fail(
        schema,
        "1.1a",
        `Expected an integer, got 1.1
  at [0]`
      )

      await assertions.encoding.succeed(schema, [1, "a"], { expected: "1a" })
      await assertions.encoding.fail(
        schema,
        [1.1, "a"],
        `Expected an integer, got 1.1
  at [0]`
      )
    })

    it(`NumberFromString + "a" + NonEmptyString`, async () => {
      const schema = Schema.TemplateLiteralParser([Schema.FiniteFromString, "a", Schema.NonEmptyString])

      await assertions.decoding.succeed(schema, "100ab", { expected: [100, "a", "b"] })
      await assertions.decoding.succeed(schema, "100ab23a", { expected: [100, "a", "b23a"] })
      await assertions.decoding.fail(
        schema,
        "-ab",
        `Expected a finite number, got NaN
  at [0]`
      )

      await assertions.encoding.succeed(schema, [100, "a", "b"], { expected: "100ab" })
      await assertions.encoding.fail(
        schema,
        [100, "a", ""],
        `Expected a value with a length of at least 1, got ""
  at [2]`
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
        `Expected a value with a length of at least 1, got ""
  at [1][1]`
      )
      await assertions.decoding.fail(
        schema,
        "ed",
        `Missing key
  at [0]`
      )
    })

    it(`"c" + (\`a\${number}b\`|"e") + "d"`, async () => {
      const schema = Schema.TemplateLiteralParser([
        "c",
        Schema.Union([
          Schema.TemplateLiteralParser(["a", Schema.Finite.check(Check.int()), "b"]),
          Schema.Literal("e")
        ]),
        "d"
      ])
      await assertions.decoding.succeed(schema, "ced", { expected: ["c", "e", "d"] })
      await assertions.decoding.succeed(schema, "ca1bd", { expected: ["c", ["a", 1, "b"], "d"] })
      await assertions.decoding.fail(
        schema,
        "ca1.1bd",
        `Expected an integer, got 1.1
  at [1][1]`
      )
      await assertions.decoding.fail(
        schema,
        "ca-bd",
        `Missing key
  at [1][0]`
      )
    })

    it(`readonly ["<", \`h\${1 | 2}\`, ">"]`, async () => {
      const schema = Schema.TemplateLiteralParser(["<", Schema.TemplateLiteral(["h", Schema.Literals([1, 2])]), ">"])
      await assertions.decoding.succeed(schema, "<h1>", { expected: ["<", "h1", ">"] })
      await assertions.decoding.succeed(schema, "<h2>", { expected: ["<", "h2", ">"] })
      await assertions.decoding.fail(
        schema,
        "<h3>",
        `Missing key
  at [0]`
      )
    })

    it(`readonly ["<", readonly ["h", 1 | 2], ">"]`, async () => {
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
        `Missing key
  at [1][0]`
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

    it("should memoize the ast", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      assertTrue(A.ast === A.ast)
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
        `Expected string, got 1
  at ["a"]`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { expected: { a: "a" } })
      await assertions.encoding.fail(
        A,
        null,
        "Expected A, got null"
      )
      await assertions.encoding.fail(
        A,
        { a: "a" },
        `Expected A, got {"a":"a"}`
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
        `Expected string, got 1
  at ["a"]`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { expected: { a: "a" } })
      await assertions.encoding.fail(
        A,
        null,
        "Expected A, got null"
      )
      await assertions.encoding.fail(
        A,
        { a: "a" },
        `Expected A, got {"a":"a"}`
      )
    })

    it("annotate", async () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}

      const Annotated = A.annotate({})

      // should be a schema
      assertTrue(Schema.isSchema(Annotated))
      // should expose the fields
      deepStrictEqual(Annotated.from.fields, { a: Schema.String })

      assertTrue(Annotated.makeSync(new A({ a: "a" })) instanceof A)
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
          `Expected 0 | 1, got 3`
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
          `Expected "apple" | "banana" | 0, got "Cantaloupe"`
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
          `Expected "apple" | "banana" | 3, got "Cantaloupe"`
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
    it("sync fallback", async () => {
      const fallback = Effect.succeed(Option.some("b"))
      const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback)).check(Check.nonEmpty())

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
      await assertions.decoding.fail(
        schema,
        "",
        `Expected a value with a length of at least 1, got ""`
      )

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.fail(
        schema,
        null,
        "Expected string, got null"
      )
    })

    it("async fallback", async () => {
      const fallback = Effect.succeed(Option.some("b")).pipe(Effect.delay(100))
      const schema = Schema.String.pipe(Schema.catchDecoding(() => fallback))

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
    })
  })

  it("catchDecodingWithContext", async () => {
    class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

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
      class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

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

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.succeed(schema, null, { expected: "b" })
    })

    it("forced failure", async () => {
      const schema = Schema.String.pipe(
        Schema.decodingMiddleware(() => Effect.fail(new Issue.Forbidden(Option.none(), { message: "my message" })))
      )

      await assertions.decoding.fail(
        schema,
        "a",
        "my message"
      )
    })
  })

  describe("encodingMiddleware", () => {
    it("providing a service", async () => {
      class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

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

      await assertions.encoding.succeed(schema, "a")
      await assertions.encoding.succeed(schema, null, { expected: "b" })
    })

    it("forced failure", async () => {
      const schema = Schema.String.pipe(
        Schema.encodingMiddleware(() => Effect.fail(new Issue.Forbidden(Option.none(), { message: "my message" })))
      )

      await assertions.encoding.fail(
        schema,
        "a",
        "my message"
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
          decode: Getter.transformOptional(Option.filter(Predicate.isNotUndefined)),
          encode: Getter.passthrough()
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
            decode: Getter.transformOptional(Option.filter(Predicate.isNotNull)),
            encode: Getter.passthrough()
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
            Transformation.transformOptional({
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
            Transformation.transformOptional({
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
      `Expected a finite number, got NaN
  at ["b"]`
    )
    await assertions.encoding.fail(
      schema,
      { a: 1, b: undefined },
      `Expected number, got undefined
  at ["b"]`
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
    await assertions.decoding.fail(
      schema,
      { a: "1", b: null },
      `Expected string, got null
  at ["b"]`
    )

    await assertions.encoding.succeed(schema, { a: 1, b: 2 }, { expected: { a: "1", b: "2" } })
    await assertions.encoding.fail(
      schema,
      { a: 1, b: NaN },
      `Expected a finite number, got NaN
  at ["b"]`
    )
    await assertions.encoding.fail(
      schema,
      { a: 1, b: undefined },
      `Expected number, got undefined
  at ["b"]`
    )
  })

  describe("checkEffect", () => {
    it("no context", async () => {
      const schema = Schema.String.pipe(
        Schema.decode({
          decode: Getter.checkEffect((s) =>
            Effect.gen(function*() {
              if (s.length === 0) {
                return new Issue.InvalidValue(Option.some(s), { message: "input should not be empty string" })
              }
            }).pipe(Effect.delay(100))
          ),
          encode: Getter.passthrough()
        })
      )

      await assertions.decoding.succeed(schema, "a")
      await assertions.decoding.fail(
        schema,
        "",
        "input should not be empty string"
      )
    })

    it("with context", async () => {
      class Service extends ServiceMap.Key<Service, { fallback: Effect.Effect<string> }>()("Service") {}

      const schema = Schema.String.pipe(
        Schema.decode({
          decode: Getter.checkEffect((s) =>
            Effect.gen(function*() {
              yield* Service
              if (s.length === 0) {
                return new Issue.InvalidValue(Option.some(s), { message: "input should not be empty string" })
              }
            })
          ),
          encode: Getter.passthrough()
        })
      )

      await assertions.decoding.succeed(schema, "a", {
        provide: [[Service, { fallback: Effect.succeed("b") }]]
      })
      await assertions.decoding.fail(
        schema,
        "",
        "input should not be empty string",
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
      assertions.asserts.fail(schema, "a", `Expected number, got "a"`)
    })
  })

  describe("decodeUnknownPromise", () => {
    it("FiniteFromString", async () => {
      const schema = Schema.FiniteFromString
      await assertions.promise.succeed(Schema.decodeUnknownPromise(schema)("1"), 1)
      await assertions.promise.fail(
        Schema.decodeUnknownPromise(schema)(null),
        "Expected string, got null"
      )
    })
  })

  describe("encodeUnknownPromise", () => {
    it("FiniteFromString", async () => {
      const schema = Schema.FiniteFromString
      await assertions.promise.succeed(Schema.encodeUnknownPromise(schema)(1), "1")
      await assertions.promise.fail(
        Schema.encodeUnknownPromise(schema)(null),
        "Expected number, got null"
      )
    })
  })

  describe("decodeUnknownExit", () => {
    it("should throw on async decoding", () => {
      const AsyncString = Schema.String.pipe(Schema.decode({
        decode: new Getter.Getter((os: Option.Option<string>) =>
          Effect.gen(function*() {
            yield* Effect.sleep("10 millis")
            return os
          })
        ),
        encode: Getter.passthrough()
      }))
      const schema = AsyncString

      throws(() => ToParser.decodeUnknownExit(schema)("1"))
    })

    it("should die on missing dependency", () => {
      class MagicNumber extends ServiceMap.Key<MagicNumber, number>()("MagicNumber") {}
      const DepString = Schema.Number.pipe(Schema.decode({
        decode: Getter.onSome((n) =>
          Effect.gen(function*() {
            const magicNumber = yield* MagicNumber
            return Option.some(n * magicNumber)
          })
        ),
        encode: Getter.passthrough()
      }))
      const schema = DepString
      const exit = ToParser.decodeUnknownExit(schema as any)(1)
      assertTrue(Exit.hasDie(exit))
    })
  })

  describe("annotateKey", () => {
    describe("the messageMissingKey annotation should be used as a error message", () => {
      it("Struct", async () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.annotateKey({ messageMissingKey: "this field is required" }))
        })

        await assertions.decoding.fail(
          schema,
          {},
          `this field is required
  at ["a"]`
        )
      })

      it("Tuple", async () => {
        const schema = Schema.Tuple([
          Schema.String.pipe(Schema.annotateKey({ messageMissingKey: "this element is required" }))
        ])

        await assertions.decoding.fail(
          schema,
          [],
          `this element is required
  at [0]`
        )
      })
    })
  })

  describe("Struct.mapFields", () => {
    it("evolve", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolve({ a: (v) => Schema.optionalKey(v) }))

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

      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Number])
    })

    it("appendElements", () => {
      const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.appendElements([Schema.Number, Schema.Boolean]))

      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Number, Schema.Boolean])
    })

    it("pick", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.pick([0, 2]))

      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Boolean])
    })

    it("omit", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.omit([1]))

      assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.Boolean])
    })

    describe("evolve", () => {
      it("readonly [string] -> readonly [string?]", () => {
        const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.evolve([(v) => Schema.optionalKey(v)]))

        assertions.schema.elements.equals(schema.elements, [Schema.optionalKey(Schema.String)])
      })

      it("readonly [string, number] -> readonly [string, number?]", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(
          Tuple.evolve([undefined, (v) => Schema.optionalKey(v)])
        )

        assertions.schema.elements.equals(schema.elements, [Schema.String, Schema.optionalKey(Schema.Number)])
      })
    })

    describe("renameIndices", () => {
      it("partial index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["1", "0"])
        )
        assertions.schema.elements.equals(schema.elements, [Schema.Number, Schema.String, Schema.Boolean])
      })

      it("full index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["2", "1", "0"])
        )
        assertions.schema.elements.equals(schema.elements, [Schema.Boolean, Schema.Number, Schema.String])
      })
    })

    it("NullOr", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(Tuple.map(Schema.NullOr))

      assertions.schema.elements.equals(schema.elements, [Schema.NullOr(Schema.String), Schema.NullOr(Schema.Number)])
    })
  })

  describe("Union.mapMembers", () => {
    it("appendElement", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.appendElement(Schema.Boolean))

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

      assertions.schema.elements.equals(schema.members, [
        Schema.Array(Schema.String),
        Schema.Number,
        Schema.Array(Schema.Boolean)
      ])
    })

    it("Array", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.map(Schema.Array))

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

    await assertions.decoding.succeed(schema, { c: "1", b: "b" }, { expected: { a: 1, b: "b" } })

    await assertions.encoding.succeed(schema, { a: 1, b: "b" }, { expected: { c: "1", b: "b" } })
  })

  describe("Check.make", () => {
    it("returns undefined", async () => {
      const schema = Schema.String.check(Check.make(() => undefined))
      await assertions.decoding.succeed(schema, "a")
    })

    it("returns true", async () => {
      const schema = Schema.String.check(Check.make(() => true))
      await assertions.decoding.succeed(schema, "a")
    })

    it("returns false", async () => {
      const schema = Schema.String.check(Check.make(() => false))
      await assertions.decoding.fail(
        schema,
        "a",
        `Expected <filter>, got "a"`
      )
    })

    it("returns string", async () => {
      const schema = Schema.String.check(Check.make(() => "error message"))
      await assertions.decoding.fail(
        schema,
        "a",
        `error message`
      )
    })

    describe("returns issue", () => {
      it("abort: false", async () => {
        const schema = Schema.String.check(
          Check.make((s) => new Issue.InvalidValue(Option.some(s), { message: "error message 1" }), {
            title: "filter title 1"
          }),
          Check.make(() => false, { title: "filter title 2", message: "error message 2" })
        )
        await assertions.decoding.fail(
          schema,
          "a",
          `error message 1
error message 2`,
          {
            parseOptions: { errors: "all" }
          }
        )
      })

      it("abort: true", async () => {
        const schema = Schema.String.check(
          Check.make((s) => new Issue.InvalidValue(Option.some(s), { message: "error message 1" }), {
            title: "filter title 1"
          }, true),
          Check.make(() => false, { title: "filter title 2", message: "error message 2" })
        )
        await assertions.decoding.fail(
          schema,
          "a",
          `error message 1`,
          {
            parseOptions: { errors: "all" }
          }
        )
      })
    })

    describe("returns object", () => {
      it("abort: false", async () => {
        const schema = Schema.String.check(
          Check.make(() => ({
            path: ["a"],
            message: "error message 1"
          }), { title: "filter title 1" }),
          Check.make(() => false, { title: "filter title 2", message: "error message 2" })
        )
        await assertions.decoding.fail(
          schema,
          "a",
          `error message 1
  at ["a"]
error message 2`,
          {
            parseOptions: { errors: "all" }
          }
        )
      })

      it("abort: true", async () => {
        const schema = Schema.String.check(
          Check.make(() => ({ path: ["a"], message: "error message 1" }), { title: "error title 1" }, true),
          Check.make(() => false, { title: "error title 2", message: "error message 2" })
        )
        await assertions.decoding.fail(
          schema,
          "a",
          `error message 1
  at ["a"]`,
          {
            parseOptions: { errors: "all" }
          }
        )
      })
    })
  })

  describe("extendTo", () => {
    it("Struct", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).pipe(Schema.extendTo({
        c: Schema.String
      }, {
        c: (value) => Option.some(value.a + "c" + value.b)
      }))

      await assertions.decoding.succeed(schema, { a: "1", b: 2 }, { expected: { a: "1", b: 2, c: "1c2" } })

      await assertions.encoding.succeed(schema, { a: "1", b: 2, c: "1c2" }, { expected: { a: "1", b: 2 } })
    })

    it("Union", async () => {
      const Circle = Schema.Struct({
        radius: Schema.Number
      })

      const Square = Schema.Struct({
        sideLength: Schema.Number
      })

      const DiscriminatedShape = Schema.Union([
        Circle.pipe(Schema.extendTo({ kind: Schema.tag("circle") }, { kind: () => Option.some("circle" as const) })),
        Square.pipe(Schema.extendTo({ kind: Schema.tag("square") }, { kind: () => Option.some("square" as const) }))
      ])

      await assertions.decoding.succeed(DiscriminatedShape, { radius: 1 }, { expected: { radius: 1, kind: "circle" } })
      await assertions.decoding.succeed(DiscriminatedShape, { sideLength: 1 }, {
        expected: { sideLength: 1, kind: "square" }
      })

      await assertions.encoding.succeed(DiscriminatedShape, { radius: 1, kind: "circle" }, { expected: { radius: 1 } })
      await assertions.encoding.succeed(DiscriminatedShape, { sideLength: 1, kind: "square" }, {
        expected: { sideLength: 1 }
      })
    })
  })

  describe("Tagged unions", () => {
    describe("asTaggedUnion", () => {
      it("should augment a union", () => {
        const b = Symbol.for("B")
        const schema = Schema.Union([
          Schema.Struct({ _tag: Schema.Literal("A"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.UniqueSymbol(b), b: Schema.FiniteFromString }),
          Schema.Union([
            Schema.Struct({ _tag: Schema.Literal(1), c: Schema.Boolean }),
            Schema.Struct({ _tag: Schema.Literal("D"), d: Schema.Date })
          ])
        ]).pipe(Schema.asTaggedUnion("_tag"))

        // cases
        deepStrictEqual(schema.cases.A, schema.members[0])
        deepStrictEqual(schema.cases[b], schema.members[1])
        deepStrictEqual(schema.cases[1], schema.members[2].members[0])
        deepStrictEqual(schema.cases["1"], schema.members[2].members[0])
        deepStrictEqual(schema.cases.D, schema.members[2].members[1])

        // isAnyOf
        const isAOr1 = schema.isAnyOf(["A", 1])
        assertTrue(isAOr1({ _tag: "A", a: "a" }))
        assertTrue(isAOr1({ _tag: 1, c: true }))
        assertFalse(isAOr1({ _tag: "D", d: new Date() }))
        assertFalse(isAOr1({ _tag: b, b: 1 }))

        // guards
        assertTrue(schema.guards.A({ _tag: "A", a: "a" }))
        assertFalse(schema.guards.A({ _tag: "A", a: 1 }))

        assertTrue(schema.guards[b]({ _tag: b, b: 1 }))
        assertFalse(schema.guards[b]({ _tag: b, b: "b" }))

        assertTrue(schema.guards[1]({ _tag: 1, c: true }))
        assertFalse(schema.guards[1]({ _tag: 1, c: 1 }))

        assertTrue(schema.guards.D({ _tag: "D", d: new Date() }))
        assertFalse(schema.guards.D({ _tag: "D", d: "d" }))

        // match
        deepStrictEqual(
          schema.match({ _tag: "A", a: "a" }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "A"
        )
        deepStrictEqual(
          pipe({ _tag: "A", a: "a" }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
          "A"
        )
        deepStrictEqual(
          schema.match({ _tag: b, b: 1 }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "B"
        )
        deepStrictEqual(
          pipe({ _tag: b, b: 1 }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
          "B"
        )
        deepStrictEqual(
          schema.match({ _tag: 1, c: true }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "C"
        )
        deepStrictEqual(
          pipe({ _tag: 1, c: true }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
          "C"
        )
        deepStrictEqual(
          schema.match({ _tag: "D", d: new Date() }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
          "D"
        )
        deepStrictEqual(
          pipe(
            { _tag: "D", d: new Date() },
            schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })
          ),
          "D"
        )
      })

      it("should support multiple tags", () => {
        const schema = Schema.Union([
          Schema.Struct({ _tag: Schema.tag("A"), type: Schema.tag("TypeA"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.tag("B"), type: Schema.tag("TypeB"), b: Schema.FiniteFromString })
        ]).pipe(Schema.asTaggedUnion("type"))

        // cases
        deepStrictEqual(schema.cases.TypeA, schema.members[0])
        deepStrictEqual(schema.cases.TypeB, schema.members[1])
      })
    })

    describe("TaggedUnion", () => {
      it("should create a tagged union", () => {
        const schema = Schema.TaggedUnion({
          A: { a: Schema.String },
          C: { c: Schema.Boolean },
          B: { b: Schema.FiniteFromString }
        }).annotate({})

        const { A, B, C } = schema.cases

        // cases
        strictEqual(A.fields._tag.ast.literal, "A")
        strictEqual(A.fields.a, Schema.String)
        strictEqual(B.fields._tag.ast.literal, "B")
        strictEqual(B.fields.b, Schema.FiniteFromString)
        strictEqual(C.fields._tag.ast.literal, "C")
        strictEqual(C.fields.c, Schema.Boolean)

        // isAnyOf
        const isAOrB = schema.isAnyOf(["A", "B"])
        assertTrue(isAOrB({ _tag: "A", a: "a" }))
        assertTrue(isAOrB({ _tag: "B", b: 1 }))
        assertFalse(isAOrB({ _tag: "C", c: true }))

        // guards
        assertTrue(schema.guards.A({ _tag: "A", a: "a" }))
        assertTrue(schema.guards.B({ _tag: "B", b: 1 }))
        assertTrue(schema.guards.C({ _tag: "C", c: true }))
        assertFalse(schema.guards.A({ _tag: "A", b: 1 }))
        assertFalse(schema.guards.B({ _tag: "B", a: "a" }))
        assertFalse(schema.guards.C({ _tag: "C", c: 1 }))

        // match
        deepStrictEqual(
          schema.match({ _tag: "A", a: "a" }, { A: () => "A", B: () => "B", C: () => "C" }),
          "A"
        )
        deepStrictEqual(
          pipe({ _tag: "A", a: "a" }, schema.match({ A: () => "A", B: () => "B", C: () => "C" })),
          "A"
        )
        deepStrictEqual(
          schema.match({ _tag: "B", b: 1 }, { A: () => "A", B: () => "B", C: () => "C" }),
          "B"
        )
        deepStrictEqual(
          pipe({ _tag: "B", b: 1 }, schema.match({ A: () => "A", B: () => "B", C: () => "C" })),
          "B"
        )
        deepStrictEqual(
          schema.match({ _tag: "C", c: true }, { A: () => "A", B: () => "B", C: () => "C" }),
          "C"
        )
        deepStrictEqual(
          pipe({ _tag: "C", c: true }, schema.match({ A: () => "A", B: () => "B", C: () => "C" })),
          "C"
        )
      })
    })
  })

  describe("withDecodingDefaultKey", () => {
    it("should return a decoding default value if the key is missing", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
      })

      await assertions.decoding.succeed(schema, {}, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a: "2" }, { expected: { a: 2 } })

      await assertions.decoding.fail(
        schema,
        { a: undefined },
        `Expected string, got undefined
  at ["a"]`
      )
    })

    it("by default should pass through the value", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
      })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
    })

    it("should omit the value if the encoding strategy is set to omit", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1", { encodingStrategy: "omit" }))
      })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: {} })
    })

    it("nested default values", async () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
        }).pipe(Schema.withDecodingDefaultKey(() => ({})))
      })

      await assertions.decoding.succeed(schema, {}, { expected: { a: { b: 1 } } })
      await assertions.decoding.succeed(schema, { a: {} }, { expected: { a: { b: 1 } } })
      await assertions.decoding.succeed(schema, { a: { b: "2" } }, { expected: { a: { b: 2 } } })

      await assertions.decoding.fail(
        schema,
        { a: { b: undefined } },
        `Expected string, got undefined
  at ["a"]["b"]`
      )
    })
  })

  describe("withDecodingDefault", () => {
    it("should return a decoding default value if the key is missing", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
      })

      await assertions.decoding.succeed(schema, {}, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a: undefined }, { expected: { a: 1 } })
      await assertions.decoding.succeed(schema, { a: "2" }, { expected: { a: 2 } })
    })

    it("by default should pass through the value", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
      })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: { a: "1" } })
    })

    it("should omit the value if the encoding strategy is set to omit", async () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1", { encodingStrategy: "omit" }))
      })

      await assertions.encoding.succeed(schema, { a: 1 }, { expected: {} })
    })

    it("nested default values", async () => {
      const schema = Schema.Struct({
        a: Schema.Struct({
          b: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
        }).pipe(Schema.withDecodingDefault(() => ({})))
      })

      await assertions.decoding.succeed(schema, {}, { expected: { a: { b: 1 } } })
      await assertions.decoding.succeed(schema, { a: {} }, { expected: { a: { b: 1 } } })
      await assertions.decoding.succeed(schema, { a: undefined }, { expected: { a: { b: 1 } } })
      await assertions.decoding.succeed(schema, { a: { b: undefined } }, { expected: { a: { b: 1 } } })
      await assertions.decoding.succeed(schema, { a: { b: "2" } }, { expected: { a: { b: 2 } } })
    })
  })

  it("NonEmptyString", async () => {
    const schema = Schema.NonEmptyString

    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(
      schema,
      "",
      `Expected a value with a length of at least 1, got ""`
    )
    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(
      schema,
      "",
      `Expected a value with a length of at least 1, got ""`
    )
  })

  it("Char", async () => {
    const schema = Schema.Char

    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(
      schema,
      "ab",
      `Expected a value with a length of 1, got "ab"`
    )
    await assertions.encoding.succeed(schema, "a")
    await assertions.encoding.fail(
      schema,
      "ab",
      `Expected a value with a length of 1, got "ab"`
    )
  })

  it("Int", async () => {
    const schema = Schema.Int

    await assertions.decoding.succeed(schema, 1)
    await assertions.decoding.fail(
      schema,
      1.1,
      `Expected an integer, got 1.1`
    )
    await assertions.decoding.fail(
      schema,
      NaN,
      `Expected an integer, got NaN`
    )
    await assertions.decoding.fail(
      schema,
      Infinity,
      `Expected an integer, got Infinity`
    )
    await assertions.decoding.fail(
      schema,
      -Infinity,
      `Expected an integer, got -Infinity`
    )
    await assertions.encoding.succeed(schema, 1)
    await assertions.encoding.fail(
      schema,
      1.1,
      `Expected an integer, got 1.1`
    )
  })
})

describe("Getter", () => {
  it("succeed", async () => {
    const schema = Schema.Literal(0).pipe(Schema.decodeTo(Schema.Literal("a"), {
      decode: Getter.succeed("a"),
      encode: Getter.succeed(0)
    }))

    await assertions.decoding.succeed(schema, 0, { expected: "a" })
    await assertions.decoding.fail(schema, 1, `Expected 0, got 1`)
    await assertions.encoding.succeed(schema, "a", { expected: 0 })
    await assertions.encoding.fail(schema, "b", `Expected "a", got "b"`)
  })
})

describe("Check", () => {
  it("ULID", async () => {
    const schema = Schema.String.check(Check.ulid())

    await assertions.decoding.succeed(schema, "01H4PGGGJVN2DKP2K1H7EH996V")
    await assertions.decoding.fail(
      schema,
      "",
      `Expected a string matching the regex ^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$, got ""`
    )
  })
})

describe("Transformation", () => {
  it("Capitalize", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.capitalized()),
        Transformation.capitalize()
      )
    )

    await assertions.decoding.succeed(schema, "abc", { expected: "Abc" })
    await assertions.encoding.succeed(schema, "Abc")
    await assertions.encoding.fail(
      schema,
      "abc",
      `Expected a string with the first character in uppercase, got "abc"`
    )
  })

  it("Uncapitalize", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.uncapitalized()),
        Transformation.uncapitalize()
      )
    )

    await assertions.decoding.succeed(schema, "Abc", { expected: "abc" })
    await assertions.encoding.succeed(schema, "abc")
    await assertions.encoding.fail(
      schema,
      "Abc",
      `Expected a string with the first character in lowercase, got "Abc"`
    )
  })

  it("Lowercase", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.lowercased()),
        Transformation.toLowerCase()
      )
    )

    await assertions.decoding.succeed(schema, "ABC", { expected: "abc" })
    await assertions.encoding.succeed(schema, "abc")
    await assertions.encoding.fail(
      schema,
      "ABC",
      `Expected a string with all characters in lowercase, got "ABC"`
    )
  })

  it("Uppercase", async () => {
    const schema = Schema.String.pipe(
      Schema.decodeTo(
        Schema.String.check(Check.uppercased()),
        Transformation.toUpperCase()
      )
    )

    await assertions.decoding.succeed(schema, "abc", { expected: "ABC" })
    await assertions.encoding.succeed(schema, "ABC")
    await assertions.encoding.fail(
      schema,
      "abc",
      `Expected a string with all characters in uppercase, got "abc"`
    )
  })
})
