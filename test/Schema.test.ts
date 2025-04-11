import { Effect, Equal, Option, Result, Schema, SchemaAST } from "effect"
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
    assertTrue(Schema.isSchema(Schema.String))
    assertFalse(Schema.isSchema(""))
  })

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
    it("filterEffect", async () => {
      const schema = Schema.String.pipe(
        Schema.filterEffect((s) => Effect.succeed(s.length > 2).pipe(Effect.delay(10)), {
          title: "my-filter"
        })
      )
      await assertions.decoding.succeed(schema, "abc")
    })

    it("filterEncoded", async () => {
      const schema = Schema.NumberFromString.pipe(Schema.filterEncoded((s) => s.length > 2, {
        title: "my-filter"
      }))
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
        const schema = Schema.String.pipe(Schema.decode(Schema.trim))
        await assertions.decoding.succeed(schema, "a")
        await assertions.decoding.succeed(schema, " a", "a")
        await assertions.decoding.succeed(schema, "a ", "a")
        await assertions.decoding.succeed(schema, " a ", "a")

        await assertions.encoding.succeed(schema, " a ", " a ")
      })
    })

    it("NumberToString", async () => {
      const schema = Schema.NumberFromString
      await assertions.decoding.succeed(schema, "1", 1)
      await assertions.decoding.fail(
        schema,
        "a",
        `number <-> string
└─ decoding / encoding issue...
   └─ Cannot convert "a" to a number`
      )
    })

    it("NumberToString + greaterThan", async () => {
      const schema = Schema.NumberFromString.pipe(Schema.greaterThan(2))
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

  describe("decodeTo", () => {
    it("double transformation", async () => {
      const schema = Trim.pipe(Schema.decodeTo(
        Schema.NumberFromString,
        Schema.identity()
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
    it("double transformation", async () => {
      const schema = Schema.NumberFromString.pipe(Schema.encodeTo(
        Trim,
        Schema.identity()
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
        a: Schema.String.pipe(Schema.encodeTo(Schema.String.pipe(Schema.minLength(3)), Schema.identity())).pipe(
          Schema.encodeTo(
            Schema.String.pipe(Schema.minLength(2)),
            Schema.identity()
          )
        )
      })
      await assertions.decoding.succeed(schema, { a: "aaa" })
      await assertions.decoding.fail(
        schema,
        { a: "aa" },
        `{ readonly a: string <-> string & minLength(3) & minLength(2) }
└─ ["a"]
   └─ string & minLength(3) & minLength(2)
      └─ minLength(3)
         └─ Invalid value "aa"`
      )

      await assertions.encoding.succeed(schema, { a: "aaa" }, { a: "aaa" })
      await assertions.encoding.fail(
        schema,
        { a: "aa" },
        `{ readonly a: string & minLength(3) & minLength(2) <-> string }
└─ ["a"]
   └─ string & minLength(3) & minLength(2) <-> string
      └─ minLength(3)
         └─ Invalid value "aa"`
      )
    })
  })

  describe("encode", () => {
    it("double transformation", async () => {
      const t = new SchemaAST.PartialIso(
        (s: string) => Result.ok(s),
        (s: string) => Result.ok(s + "!")
      )

      const schema = Schema.String.pipe(
        Schema.encode(t),
        Schema.encode(t)
      )

      await assertions.encoding.succeed(schema, "a", "a!!")
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
    it("suspend before initialization", async () => {
      const schema = Schema.suspend(() => string)
      class A extends Schema.Class<A>("A")(Schema.Struct({ a: Schema.optional(schema) })) {}
      const string = Schema.String
      await assertions.decoding.succeed(A, new A({ a: "a" }))
    })

    it("A extends Struct", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      assertTrue(Schema.isSchema(A))
      strictEqual(A.toString(), "A({ readonly a: string })")
      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeUnsafe({ a: "a" }) instanceof A)

      // should expose the fields
      deepStrictEqual(A.schema.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      await assertions.decoding.succeed(A, { a: "a" }, new A({ a: "a" }))
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `A({ readonly a: string })
└─ ["a"]
   └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { a: "a" })
      await assertions.encoding.fail(A, null, `Expected A({ readonly a: string }), actual null`)
      await assertions.encoding.fail(A, { a: "a" }, `Expected A({ readonly a: string }), actual {"a":"a"}`)
    })

    it("A extends Fields", async () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}

      assertTrue(Schema.isSchema(A))
      strictEqual(A.toString(), "A({ readonly a: string })")
      assertTrue(new A({ a: "a" }) instanceof A)
      assertTrue(A.makeUnsafe({ a: "a" }) instanceof A)

      // should expose the fields
      deepStrictEqual(A.schema.fields, { a: Schema.String })
      // should expose the identifier
      strictEqual(A.identifier, "A")

      await assertions.decoding.succeed(A, { a: "a" }, new A({ a: "a" }))
      await assertions.decoding.fail(
        A,
        { a: 1 },
        `A({ readonly a: string })
└─ ["a"]
   └─ Expected string, actual 1`
      )
      await assertions.encoding.succeed(A, new A({ a: "a" }), { a: "a" })
      await assertions.encoding.fail(A, null, `Expected A({ readonly a: string }), actual null`)
      await assertions.encoding.fail(A, { a: "a" }, `Expected A({ readonly a: string }), actual {"a":"a"}`)
    })

    it("A extends Struct & annotate", async () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {
        readonly propA = 1
      }

      class B extends Schema.Class<B>("B")(A.annotate({ title: "B" }).annotate({ description: "B" })) {
        readonly propC = 3
      }

      strictEqual(A.toString(), "A({ readonly a: string })")
      strictEqual(B.toString(), "B(A({ readonly a: string }))")

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
      strictEqual(new B({ a: "a" }).propC, 3)
      strictEqual(B.makeUnsafe({ a: "a" }).propC, 3)

      // test equality
      assertTrue(Equal.equals(new A({ a: "a" }), new A({ a: "a" })))
      assertTrue(Equal.equals(new B({ a: "a" }), new B({ a: "a" })))
      assertTrue(Equal.equals(new B({ a: "a" }), new B({ a: "a" })))

      assertFalse(Equal.equals(new A({ a: "a1" }), new A({ a: "a2" })))
      assertFalse(Equal.equals(new B({ a: "a" }), new A({ a: "a" })))
      assertFalse(Equal.equals(new B({ a: "a1" }), new B({ a: "a2" })))
    })

    it("extends Struct & custom constructor", async () => {
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

      strictEqual(A.toString(), "A({ readonly a: string })")
      strictEqual(B.toString(), "B(A({ readonly a: string }))")

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
        `B(A({ readonly a: string }))
└─ ["a"]
   └─ Expected string, actual 1`
      )
    })

    it("extends (A & <filter>) extends Struct", async () => {
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

  it("encodeRequiredToOptional", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(
        Schema.encodeRequiredToOptional(
          Schema.String,
          new SchemaAST.PartialIso<Option.Option<string>, string, never, never>(
            (o) => Result.ok(Option.getOrElse(o, () => "default")),
            (s) => Result.ok(Option.some(s))
          )
        )
      )
    })

    await assertions.decoding.succeed(schema, { a: "a" })
    await assertions.decoding.succeed(schema, {}, { a: "default" })

    await assertions.encoding.succeed(schema, { a: "a" }, { a: "a" })
  })

  describe("encodeOptionalToRequired", () => {
    it("should work", async () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.String).pipe(
          Schema.encodeOptionalToRequired(
            Schema.String,
            new SchemaAST.PartialIso<string, Option.Option<string>, never, never>(
              (s) => Result.ok(Option.some(s)),
              (os) => Result.ok(Option.getOrElse(os, () => "default"))
            )
          )
        )
      })

      await assertions.decoding.succeed(schema, { a: "a" }, { a: "a" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly a?: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ decoding / encoding issue...
         └─ No value provided`
      )

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
              Schema.encodeTo(
                Schema.String,
                Schema.identity()
              ),
              Schema.encodeToKey("c")
            ),
            Schema.identity()
          ),
          Schema.encodeToKey("b")
        )
      })

      await assertions.decoding.succeed(schema, { b: "b" }, { a: "b" })
      await assertions.decoding.fail(
        schema,
        {},
        `{ readonly a: string <-> string }
└─ ["a"]
   └─ string <-> string
      └─ decoding / encoding issue...
         └─ No value provided`
      )
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

    it("Struct & withConstructorDefault", () => {
      const schema = Schema.Struct({
        a: Schema.NumberFromString.pipe(Schema.withConstructorDefault(() => -1))
      })

      assertions.makeUnsafe.succeed(schema, { a: 1 })
      assertions.makeUnsafe.succeed(schema, {}, { a: -1 })

      const flipped = schema.pipe(Schema.flip)
      throws(() => flipped.makeUnsafe({} as any))
      assertions.makeUnsafe.succeed(flipped, { a: "1" })

      const flipped2 = flipped.pipe(Schema.flip)
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
      await assertions.decoding.fail(schema, null, `Expected Declaration, actual null`)
      await assertions.decoding.fail(
        schema,
        Option.some(null),
        `Declaration
└─ Expected string, actual null`
      )

      await assertions.encoding.succeed(schema, Option.none(), Option.none())
      await assertions.encoding.succeed(schema, Option.some(123), Option.some("123"))
      await assertions.encoding.fail(schema, null, `Expected Declaration, actual null`)
      await assertions.encoding.fail(
        schema,
        Option.some(null) as any,
        `Declaration
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
        `{ readonly a: number & <filter> <-> string; readonly categories: ReadonlyArray<Suspend> }
└─ ["categories"]
   └─ ReadonlyArray<Suspend>
      └─ [0]
         └─ { readonly a: number & <filter> <-> string; readonly categories: ReadonlyArray<Suspend> }
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
        `{ readonly a: string <-> number & <filter>; readonly categories: ReadonlyArray<Suspend> }
└─ ["categories"]
   └─ ReadonlyArray<Suspend>
      └─ [0]
         └─ { readonly a: string <-> number & <filter>; readonly categories: ReadonlyArray<Suspend> }
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
})
