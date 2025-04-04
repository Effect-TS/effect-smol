import { Option, Schema, SchemaAST } from "effect"
import { describe, it } from "vitest"
import * as Util from "./SchemaTest.js"
import { assertTrue, deepStrictEqual, fail, strictEqual, throws } from "./utils/assert.js"

const assertions = Util.assertions({
  deepStrictEqual,
  strictEqual,
  throws,
  fail
})

describe("Schema", () => {
  it("Literal", async () => {
    const schema = Schema.Literal("a")
    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(schema, 1, `Expected "a", actual 1`)
  })

  it("String", async () => {
    const schema = Schema.String
    await assertions.decoding.succeed(schema, "a")
    await assertions.decoding.fail(schema, 1, "Expected string, actual 1")
  })

  it("Number", async () => {
    const schema = Schema.Number
    await assertions.decoding.succeed(schema, 1)
    await assertions.decoding.fail(schema, "a", `Expected number, actual "a"`)
  })

  describe("Struct", () => {
    it("success", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await assertions.decoding.succeed(schema, { a: "a" })
    })

    it("missing key", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly a: string }
└─ ["a"]
   └─ Missing key / index`
      )
    })

    it("first error", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      await assertions.decoding.fail(
        schema,
        { a: 1, b: "b" },
        `{ readonly a: string; readonly b: number }
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("all errors", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })
      await assertions.decoding.fail(
        schema,
        { a: 1, b: "b" },
        `{ readonly a: string; readonly b: number }
├─ ["a"]
│  └─ Expected string, actual 1
└─ ["b"]
   └─ Expected number, actual "b"`,
        { parseOptions: { errors: "all" } }
      )
    })

    it.todo(`onExcessProperty: "error"`, async () => {
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

  describe("Tuple", () => {
    it("success", async () => {
      const schema = Schema.Tuple([Schema.String])
      await assertions.decoding.succeed(schema, ["a"])
      await assertions.decoding.fail(
        schema,
        [],
        `readonly [string]
└─ [0]
   └─ Missing key / index`
      )
    })
  })

  describe("Array", () => {
    it("success", async () => {
      const schema = Schema.Array(Schema.String)
      await assertions.decoding.succeed(schema, ["a", "b"])
      await assertions.decoding.fail(
        schema,
        ["a", 1],
        `ReadonlyArray<string>
└─ [1]
   └─ Expected string, actual 1`
      )
    })
  })

  describe("Filters", () => {
    it("filterEncoded", async () => {
      const schema = Schema.NumberToString.pipe(Schema.filterEncoded((s) => s.length > 2, {
        title: "my-filter"
      }))
      await assertions.encoding.succeed(schema, 123, "123")
      await assertions.encoding.fail(
        schema,
        12,
        `string & my-filter
└─ my-filter
   └─ Invalid value "12"`
      )
    })

    describe("String filters", () => {
      it("minLength", async () => {
        const schema = Schema.String.pipe(Schema.minLength(1))
        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.fail(
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
        await assertions.decoding.succeed(schema, 2)
        await assertions.decoding.fail(
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
    describe("String transformations", () => {
      it("Trim", async () => {
        const schema = Schema.Trim
        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.succeed(schema, " a", "a")
        await assertions.decoding.succeed(schema, "a ", "a")
        await assertions.decoding.succeed(schema, " a ", "a")
      })
    })

    it("NumberToString", async () => {
      const schema = Schema.NumberToString
      await assertions.decoding.succeed(schema, "1", 1)
      await assertions.decoding.fail(
        schema,
        "a",
        `number <-> string
└─ decoding
   └─ Cannot convert "a" to a number`
      )
    })

    it("NumberToString + greaterThan", async () => {
      const schema = Schema.NumberToString.pipe(Schema.greaterThan(2))
      await assertions.decoding.succeed(schema, "3", 3)
      await assertions.decoding.fail(
        schema,
        "1",
        `number & greaterThan(2) <-> string
└─ greaterThan(2)
   └─ Invalid value 1`
      )
    })
  })

  describe("decodeFrom", () => {
    it("double transformation", async () => {
      const schema = Schema.Trim.pipe(Schema.decodeTo(Schema.NumberToString, {
        decode: (s) => s,
        encode: (s) => s
      }))
      await assertions.decoding.succeed(schema, " 2 ", 2)
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number <-> string <-> string
└─ decoding
   └─ Cannot convert "a2" to a number`
      )
    })
  })

  describe("encodeTo", () => {
    it("double transformation", async () => {
      const schema = Schema.NumberToString.pipe(Schema.encodeTo(Schema.Trim, {
        encode: (s) => s,
        decode: (s) => s
      }))
      await assertions.decoding.succeed(schema, " 2 ", 2)
      await assertions.decoding.fail(
        schema,
        " a2 ",
        `number <-> string <-> string
└─ decoding
   └─ Cannot convert "a2" to a number`
      )
    })
  })

  it("optional", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.optional)
    })
    await assertions.decoding.succeed(schema, { a: "a" })
    await assertions.decoding.succeed(schema, {})
  })

  describe("Class", () => {
    it("decoding", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      strictEqual(A.toString(), "A({ readonly a: string })")

      await assertions.decoding.succeed(A, { a: "a" }, new A({ a: "a" }))
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `A({ readonly a: string })
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("constructors", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      strictEqual(A.toString(), "A({ readonly a: string })")

      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.make({ a: "a" }) instanceof A)
    })

    it("extends (abstract A)", async () => {
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

      strictEqual(A.toString(), "A({ readonly a: string })")
      strictEqual(B.toString(), "B(A({ readonly a: string }))")

      assertTrue(new B({ a: "a" }) instanceof B)
      assertTrue(new B({ a: "a" }) instanceof A)
      assertTrue(B.make({ a: "a" }) instanceof B)
      assertTrue(B.make({ a: "a" }) instanceof A)

      strictEqual(new B({ a: "a" }).foo(), "a-foo-")
      strictEqual(new B({ a: "a" }).bar(), "a-bar-a-foo-")
      strictEqual(B.make({ a: "a" }).foo(), "a-foo-")
      strictEqual(B.make({ a: "a" }).bar(), "a-bar-a-foo-")

      await assertions.decoding.succeed(B, { a: "a" }, new B({ a: "a" }))
      await assertions.decoding.fail(
        B,
        { a: 1 },
        `B(A({ readonly a: string }))
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("extends custom constructor", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly b: string
        constructor(props: (typeof A)["~make.in"]) {
          super(props)
          this.b = props.a + "-b"
        }
      }
      class B extends Schema.Class<B>("B")(A) {}

      strictEqual(new A({ a: "a" }).b, "a-b")
      strictEqual(A.make({ a: "a" }).b, "a-b")
      strictEqual(new B({ a: "a" }).b, "a-b")
      strictEqual(B.make({ a: "a" }).b, "a-b")
    })

    it("extends (A & <filter>)", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}
      class B extends Schema.Class<B>("B")(A.pipe(Schema.filter(({ a }) => a.length > 0))) {}

      strictEqual(A.toString(), "A({ readonly a: string })")
      strictEqual(B.toString(), "B(A({ readonly a: string }) & <filter>)")

      await assertions.decoding.succeed(B, { a: "a" }, new B({ a: "a" }))
      await assertions.decoding.fail(
        B,
        { a: 1 },
        `B(A({ readonly a: string }) & <filter>)
└─ ["a"]
   └─ Expected string, actual 1`
      )
      await assertions.decoding.fail(
        B,
        { a: "" },
        `B(A({ readonly a: string }) & <filter>)
└─ <filter>
   └─ Invalid value A({"a":""})`
      )
    })
  })

  describe("PropertySignature", () => {
    it("encoding", async () => {
      const t = new SchemaAST.PropertySignatureStep<string, string>(
        new SchemaAST.FinalTransformation((o) => o),
        new SchemaAST.FinalTransformation((o) => Option.orElse(o, () => Option.some("default")))
      )
      const ast = new SchemaAST.TypeLiteral(
        [
          new SchemaAST.PropertySignature(
            "a",
            SchemaAST.appendStep(
              SchemaAST.stringKeyword,
              t,
              SchemaAST.stringKeyword
            ),
            {}
          )
        ],
        [],
        {},
        [],
        undefined,
        undefined
      )
      const schema = Schema.make<
        SchemaAST.TypeLiteral,
        { a: string },
        { a?: string },
        never,
        { a: string }
      >(
        ast
      )
      await assertions.decoding.succeed(schema, { a: "c" }, { a: "c" })
      await assertions.decoding.succeed(schema, {}, { a: "default" })
    })
  })

  describe("encodeToOptional", () => {
    const ps = Schema.String.pipe(Schema.encodeToOptional(Schema.String, {
      encode: (s) => Option.some(s),
      decode: (o) => Option.getOrElse(o, () => "default")
    }))
    const schema = Schema.Struct({
      a: ps
    })

    it("decoding", async () => {
      await assertions.decoding.succeed(schema, { a: "a" })
      await assertions.decoding.succeed(schema, {}, { a: "default" })
    })

    it("encoding", async () => {
      await assertions.encoding.succeed(schema, { a: "a" }, { a: "a" })
    })
  })

  describe("encodeToRequired", () => {
    const ps = Schema.String.pipe(
      Schema.optional,
      Schema.encodeToRequired(Schema.String, {
        encode: (o) => Option.getOrElse(o, () => "default"),
        decode: (s) => Option.some(s)
      })
    )
    const schema = Schema.Struct({
      a: ps
    })

    it("decoding", async () => {
      await assertions.decoding.succeed(schema, { a: "a" }, { a: "a" })
    })

    it("encoding", async () => {
      await assertions.encoding.succeed(schema, { a: "a" })
      await assertions.encoding.succeed(schema, {}, { a: "default" })
    })
  })

  describe("encodeToKey", () => {
    it("top level", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.encodeToKey("b"))
      })

      await assertions.decoding.succeed(schema, { b: "b" }, { a: "b" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly a: string }
└─ ["a"]
   └─ Missing key / index`
      )
    })

    it("nested", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(
          Schema.encodeTo(
            Schema.String.pipe(
              Schema.encodeTo(Schema.String, {
                encode: (s) => s,
                decode: (s) => s
              }),
              Schema.encodeToKey("c")
            ),
            {
              encode: (s) => s,
              decode: (s) => s
            }
          ),
          Schema.encodeToKey("b")
        )
      })

      await assertions.decoding.succeed(schema, { b: "b" }, { a: "b" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly a: string <-> string <-> string }
└─ ["a"]
   └─ Missing key / index`
      )
    })
  })
})
