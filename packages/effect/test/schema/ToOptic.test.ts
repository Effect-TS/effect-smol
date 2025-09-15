import { Cause, Exit } from "effect"
import { Option, Predicate, Record } from "effect/data"
import { Check, Schema, ToOptic } from "effect/schema"
import { describe, it } from "vitest"
import {
  assertFailure,
  assertNone,
  assertSome,
  assertSuccess,
  deepStrictEqual,
  strictEqual,
  throws
} from "../utils/assert.ts"

class Value extends Schema.Class<Value, { readonly brand: unique symbol }>("Value")({
  a: Schema.ValidDate
}) {}

function addOne(date: Date): Date {
  const time = date.getTime()
  if (time === -1) {
    return new Date("")
  }
  return new Date(time + 1)
}

function addTwo(date: Date): Date {
  const time = date.getTime()
  return new Date(time + 2)
}

describe("ToOptic", () => {
  describe("makeIso", () => {
    it("Class", () => {
      const schema = Value
      const optic = ToOptic.makeIso(schema).key("a")
      const modifyResult = optic.modifyResult(addOne)

      assertSuccess(modifyResult(Value.makeSync({ a: new Date(0) })), Value.makeSync({ a: new Date(1) }))
      assertFailure(
        modifyResult(Value.makeSync({ a: new Date(-1) })),
        [
          `Expected a valid date, got Invalid Date
  at ["a"]`,
          Value.makeSync({ a: new Date(-1) })
        ]
      )
    })

    it("typeCodec(Class)", () => {
      const schema = Schema.typeCodec(Value)
      const optic = ToOptic.makeIso(schema).key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(modify(Value.makeSync({ a: new Date(0) })), Value.makeSync({ a: new Date(1) }))
    })

    it("encodedCodec(Class)", () => {
      const schema = Schema.encodedCodec(Value)
      const optic = ToOptic.makeIso(schema).key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(modify({ a: new Date(0) }), { a: new Date(1) })
    })

    describe("brand", () => {
      it("Number & positive", () => {
        const schema = Schema.Number.check(Check.positive()).pipe(Schema.brand("positive"))
        const optic = ToOptic.makeIso(schema)
        const modify = optic.modify((n) => schema.makeSync(n - 1))

        strictEqual(modify(schema.makeSync(2)), 1)
        throws(() => modify(schema.makeSync(1)), "Expected a value greater than 0, got 0")
      })
    })

    it("Tuple", () => {
      const schema = Schema.Tuple([Value, Schema.optionalKey(Value)])
      const optic = ToOptic.makeIso(schema).key("0").key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(
        modify([Value.makeSync({ a: new Date(0) })]),
        [Value.makeSync({ a: new Date(1) })]
      )
    })

    it("Array", () => {
      const schema = Schema.Array(Value)
      const optic = ToOptic.makeIso(schema)
      const item = ToOptic.getFocusIso(Value).key("a")
      const modify = optic.modify((as) => as.map(item.modify(addOne)))

      deepStrictEqual(modify([Value.makeSync({ a: new Date(0) })]), [Value.makeSync({ a: new Date(1) })])
    })

    it("NonEmptyArray", () => {
      const schema = Schema.NonEmptyArray(Value)
      const optic = ToOptic.makeIso(schema)
      const item = ToOptic.getFocusIso(Value).key("a")
      const modify = optic.modify(([a, ...rest]) => [item.modify(addOne)(a), ...rest.map(item.modify(addTwo))])

      deepStrictEqual(
        modify([
          Value.makeSync({ a: new Date(0) }),
          Value.makeSync({ a: new Date(1) }),
          Value.makeSync({ a: new Date(2) })
        ]),
        [
          Value.makeSync({ a: new Date(1) }),
          Value.makeSync({ a: new Date(3) }),
          Value.makeSync({ a: new Date(4) })
        ]
      )
    })

    it("TupleWithRest", () => {
      const schema = Schema.TupleWithRest(Schema.Tuple([Value]), [Value])
      const optic = ToOptic.makeIso(schema)
      const item = ToOptic.getFocusIso(Value).key("a")
      const modify = optic.modify((
        [value, ...rest]
      ) => [item.modify(addOne)(value), ...rest.map((r) => item.modify(addTwo)(r))])

      deepStrictEqual(
        modify([
          Value.makeSync({ a: new Date(0) }),
          Value.makeSync({ a: new Date(1) }),
          Value.makeSync({ a: new Date(2) })
        ]),
        [
          Value.makeSync({ a: new Date(1) }),
          Value.makeSync({ a: new Date(3) }),
          Value.makeSync({ a: new Date(4) })
        ]
      )
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        value: Value,
        optionalValue: Schema.optionalKey(Value)
      })
      const optic = ToOptic.makeIso(schema).key("value").key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(
        modify({
          value: Value.makeSync({ a: new Date(0) })
        }),
        {
          value: Value.makeSync({ a: new Date(1) })
        }
      )
      deepStrictEqual(
        modify({
          value: Value.makeSync({ a: new Date(0) }),
          optionalValue: Value.makeSync({ a: new Date(2) })
        }),
        {
          value: Value.makeSync({ a: new Date(1) }),
          optionalValue: Value.makeSync({ a: new Date(2) })
        }
      )
    })

    it("Record", () => {
      const schema = Schema.Record(Schema.String, Value)
      const optic = ToOptic.makeIso(schema)
      const item = ToOptic.getFocusIso(Value).key("a")
      const modify = optic.modify((rec) => Record.map(rec, item.modify(addOne)))

      deepStrictEqual(
        modify({
          a: Value.makeSync({ a: new Date(0) }),
          b: Value.makeSync({ a: new Date(1) })
        }),
        {
          a: Value.makeSync({ a: new Date(1) }),
          b: Value.makeSync({ a: new Date(2) })
        }
      )
    })

    it("StructWithRest", () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Value }),
        [Schema.Record(Schema.String, Value)]
      )
      const optic = ToOptic.makeIso(schema)
      const item = ToOptic.getFocusIso(Value).key("a")
      const modify = optic.modify(({ a, ...rest }) => ({
        a: item.modify(addOne)(a),
        ...Record.map(rest, item.modify(addTwo))
      }))

      deepStrictEqual(
        modify({ a: Value.makeSync({ a: new Date(0) }), b: Value.makeSync({ a: new Date(1) }) }),
        { a: Value.makeSync({ a: new Date(1) }), b: Value.makeSync({ a: new Date(3) }) }
      )
    })

    it("Union", () => {
      const schema = Schema.Union([Schema.String, Value])
      const optic = ToOptic.makeIso(schema)
      const item = ToOptic.getFocusIso(Value).key("a")
      const modify = optic.modify((x) => Predicate.isString(x) ? x : item.modify(addOne)(x))

      deepStrictEqual(modify("a"), "a")
      deepStrictEqual(modify(Value.makeSync({ a: new Date(0) })), Value.makeSync({ a: new Date(1) }))
    })

    it("suspend", () => {
      interface A {
        readonly a: Value
        readonly as: ReadonlyArray<A>
      }
      interface AIso {
        readonly a: typeof Value["Iso"]
        readonly as: ReadonlyArray<AIso>
      }
      const schema = Schema.Struct({
        a: Value,
        as: Schema.Array(Schema.suspend((): Schema.Optic<A, AIso> => schema))
      })
      const optic = ToOptic.makeIso(schema)
      const item = ToOptic.getFocusIso(Value).key("a")
      const f = ({ a, as }: AIso): AIso => ({
        a: item.modify(addOne)(a),
        as: as.map(f)
      })
      const modify = optic.modify(f)

      deepStrictEqual(
        modify({ a: Value.makeSync({ a: new Date(0) }), as: [{ a: Value.makeSync({ a: new Date(1) }), as: [] }] }),
        {
          a: Value.makeSync({ a: new Date(1) }),
          as: [{ a: Value.makeSync({ a: new Date(2) }), as: [] }]
        }
      )
    })

    it("flip(schema)", () => {
      const schema = Schema.flip(Value)
      const optic = ToOptic.makeIso(schema).key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(modify(Value.makeSync({ a: new Date(0) })), { a: new Date(1) })
    })

    it("flip(flip(schema))", () => {
      const schema = Schema.flip(Schema.flip(Value))
      const optic = ToOptic.makeIso(schema).key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(modify(Value.makeSync({ a: new Date(0) })), Value.makeSync({ a: new Date(1) }))
    })

    it("Opaque", () => {
      class S extends Schema.Opaque<S>()(Schema.Struct({ a: Schema.Date })) {}
      const schema = S
      const optic = ToOptic.makeIso(schema).key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(modify({ a: new Date(0) }), { a: new Date(1) })
    })

    it("Option", () => {
      const schema = Schema.Option(Value)
      const optic = ToOptic.makeIso(schema).tag("Some").key("value").key("a")
      const modify = optic.modify(addOne)

      assertSome(
        modify(Option.some(Value.makeSync({ a: new Date(0) }))),
        Value.makeSync({ a: new Date(1) })
      )
      assertNone(modify(Option.none()))
    })

    it("CauseFailure", () => {
      const schema = Schema.CauseFailure(Value, Schema.Defect)
      const optic = ToOptic.makeIso(schema).tag("Fail").key("error").key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(
        modify(Cause.failureFail(Value.makeSync({ a: new Date(0) }))),
        Cause.failureFail(Value.makeSync({ a: new Date(1) }))
      )
    })

    it("Cause", () => {
      const schema = Schema.Cause(Value, Value)
      const optic = ToOptic.makeIso(schema)
      const failure = ToOptic.getFocusIso(Schema.CauseFailure(Value, Value)).tag("Fail").key("error").key("a")
      const modify = optic.modify((failures) => failures.map(failure.modify(addOne)))

      deepStrictEqual(
        modify(Cause.fail(Value.makeSync({ a: new Date(0) }))),
        Cause.fail(Value.makeSync({ a: new Date(1) }))
      )
    })

    it("Error", () => {
      const schema = Schema.Error
      const optic = ToOptic.makeIso(schema)
      const modify = optic.modify((e) => new Error(e.message + "!"))

      deepStrictEqual(modify(new Error("a")), new Error("a!"))
    })

    it("Exit", () => {
      const schema = Schema.Exit(Value, Schema.Error, Schema.Defect)
      const optic = ToOptic.makeIso(schema).tag("Success").key("value").key("a")
      const modify = optic.modify(addOne)

      deepStrictEqual(
        modify(Exit.succeed(Value.makeSync({ a: new Date(0) }))),
        Exit.succeed(Value.makeSync({ a: new Date(1) }))
      )
    })
  })
})
