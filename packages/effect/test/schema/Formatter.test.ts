import { Effect, Option } from "effect"
import type { AST } from "effect/schema"
import { Check, Formatter, Getter, Issue, Schema, ToParser } from "effect/schema"
import { describe, it } from "vitest"
import { assertions } from "../utils/schema.js"

const assertStructuredIssue = async <T, E>(
  schema: Schema.Codec<T, E>,
  input: unknown,
  expected: ReadonlyArray<Formatter.StructuredIssue>,
  options?: {
    readonly parseOptions?: AST.ParseOptions | undefined
  } | undefined
) => {
  const r = await ToParser.decodeUnknownEffect(schema)(input, { errors: "all", ...options?.parseOptions }).pipe(
    Effect.mapError((issue) => Formatter.makeStructured().format(issue)),
    Effect.result,
    Effect.runPromise
  )

  return assertions.result.fail(r, expected)
}

describe("makeTree", () => {
  it("should use the id annotation if present", async () => {
    await assertions.decoding.fail(
      Schema.String.annotate({ id: "id" }),
      null,
      `Expected id, actual null`
    )
    await assertions.decoding.fail(
      Schema.NonEmptyString.annotate({ id: "id" }),
      null,
      `Expected id, actual null`
    )
    await assertions.decoding.fail(
      Schema.String.check(Check.nonEmpty({ id: "id" })),
      null,
      `Expected id, actual null`
    )
  })

  it("title", async () => {
    const getOrderId = (issue: Issue.Issue) => {
      const actual = Issue.getActual(issue)
      if (Option.isSome(actual)) {
        if (Schema.is(Schema.Struct({ id: Schema.Number }))(actual.value)) {
          return `Order with ID ${actual.value.id}`
        }
      }
    }

    const Order = Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      totalPrice: Schema.Number
    }).annotate({
      id: "Order",
      formatter: {
        Tree: {
          getTitle: getOrderId
        }
      }
    })

    await assertions.decoding.fail(
      Order,
      {},
      `Order
└─ ["id"]
   └─ Missing key`
    )
    await assertions.decoding.fail(
      Order,
      { id: 1 },
      `Order with ID 1
└─ ["name"]
   └─ Missing key`
    )
  })
})

describe("makeStructured", () => {
  it("single InvalidType", async () => {
    const schema = Schema.Struct({
      a: Schema.String
    })

    await assertStructuredIssue(schema, { a: null }, [
      {
        _tag: "InvalidType",
        path: ["a"],
        actual: Option.some(null),
        annotations: schema.fields.a.ast.annotations
      }
    ])
  })

  it("multiple InvalidTypes", async () => {
    const schema = Schema.Struct({
      a: Schema.String,
      b: Schema.Number
    })

    await assertStructuredIssue(schema, { a: null, b: null }, [
      {
        _tag: "InvalidType",
        path: ["a"],
        actual: Option.some(null),
        annotations: schema.fields.a.ast.annotations
      },
      {
        _tag: "InvalidType",
        path: ["b"],
        actual: Option.some(null),
        annotations: schema.fields.b.ast.annotations
      }
    ])
  })

  it("InvalidValue", async () => {
    const schema = Schema.Struct({
      a: Schema.NonEmptyString
    })

    await assertStructuredIssue(schema, { a: "" }, [
      {
        _tag: "InvalidValue",
        path: ["a"],
        actual: Option.some(""),
        annotations: undefined,
        check: {
          annotations: schema.fields.a.ast.checks?.[0]?.annotations,
          abort: false
        }
      }
    ])
  })

  describe("MissingKey", () => {
    it("single missing key", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })

      await assertStructuredIssue(schema, {}, [
        {
          _tag: "MissingKey",
          path: ["a"],
          actual: Option.none(),
          annotations: undefined
        }
      ])
    })

    it("multiple missing keys", async () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })

      await assertStructuredIssue(schema, {}, [
        {
          _tag: "MissingKey",
          path: ["a"],
          actual: Option.none(),
          annotations: undefined
        },
        {
          _tag: "MissingKey",
          path: ["b"],
          actual: Option.none(),
          annotations: undefined
        }
      ])
    })

    it("annotated key", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.annotateKey({ missingKeyMessage: "Custom missing key message" }))
      })

      await assertStructuredIssue(schema, {}, [
        {
          _tag: "MissingKey",
          path: ["a"],
          actual: Option.none(),
          annotations: schema.fields.a.ast.context?.annotations
        }
      ])
    })
  })

  describe("UnexpectedKey", () => {
    it("single unexpected key", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })

      await assertStructuredIssue(schema, { a: "a", b: "b" }, [
        {
          _tag: "UnexpectedKey",
          path: ["b"],
          actual: Option.some("b"),
          annotations: schema.ast.context?.annotations
        }
      ], { parseOptions: { onExcessProperty: "error" } })
    })

    it("multiple unexpected keys", async () => {
      const schema = Schema.Struct({
        a: Schema.String
      })

      await assertStructuredIssue(schema, { a: "a", b: "b", c: "c" }, [
        {
          _tag: "UnexpectedKey",
          path: ["b"],
          actual: Option.some("b"),
          annotations: schema.ast.context?.annotations
        },
        {
          _tag: "UnexpectedKey",
          path: ["c"],
          actual: Option.some("c"),
          annotations: schema.ast.context?.annotations
        }
      ], { parseOptions: { onExcessProperty: "error" } })
    })

    it("annotated key", async () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.annotateKey({ unexpectedKeyMessage: "Custom unexpected key message" }))
      })

      await assertStructuredIssue(schema, { a: "a", b: "b", c: "c" }, [
        {
          _tag: "UnexpectedKey",
          path: ["b"],
          actual: Option.some("b"),
          annotations: schema.ast.context?.annotations
        },
        {
          _tag: "UnexpectedKey",
          path: ["c"],
          actual: Option.some("c"),
          annotations: schema.ast.context?.annotations
        }
      ], { parseOptions: { onExcessProperty: "error" } })
    })
  })

  it("Forbidden", async () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.decodeTo(Schema.String, {
        decode: Getter.fail((os) => new Issue.Forbidden(os, { message: "my message" })),
        encode: Getter.passthrough()
      }))
    })

    await assertStructuredIssue(schema, { a: "a" }, [
      {
        _tag: "Forbidden",
        path: ["a"],
        actual: Option.some("a"),
        annotations: { message: "my message" }
      }
    ])
  })

  it("Union", async () => {
    const schema = Schema.Union([
      Schema.Struct({ a: Schema.String }),
      Schema.Struct({ b: Schema.Number })
    ], { mode: "oneOf" })

    await assertStructuredIssue(schema, { a: "a", b: 1 }, [
      {
        _tag: "OneOf",
        path: [],
        actual: Option.some({ a: "a", b: 1 }),
        annotations: schema.ast.annotations
      }
    ])
  })

  it("uuid", async () => {
    const schema = Schema.String.check(Check.uuid())

    await assertStructuredIssue(schema, "", [
      {
        _tag: "InvalidValue",
        path: [],
        actual: Option.some(""),
        annotations: undefined,
        check: {
          annotations: schema.ast.checks?.[0]?.annotations,
          abort: false
        }
      }
    ])
  })

  describe("Structural checks", () => {
    it("Array + minLength", async () => {
      const schema = Schema.Struct({
        tags: Schema.Array(Schema.NonEmptyString).check(Check.minLength(3))
      })

      await assertStructuredIssue(schema, { tags: ["a", ""] }, [
        {
          _tag: "InvalidValue",
          path: ["tags", 1],
          actual: Option.some(""),
          annotations: undefined,
          check: {
            annotations: schema.fields.tags.ast.rest[0].checks?.[0]?.annotations,
            abort: false
          }
        },
        {
          _tag: "InvalidValue",
          path: ["tags"],
          actual: Option.some(["a", ""]),
          annotations: undefined,
          check: {
            annotations: schema.fields.tags.ast.checks?.[0]?.annotations,
            abort: false
          }
        }
      ])
    })
  })
})
