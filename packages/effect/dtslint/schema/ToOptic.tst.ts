import type { Brand, Option } from "effect/data"
import type { Optic } from "effect/optic"
import { Check, Schema, ToOptic } from "effect/schema"
import { describe, expect, it } from "tstyche"

class Value extends Schema.Class<Value, { readonly brand: unique symbol }>("Value")({
  a: Schema.ValidDate
}) {}

describe("ToOptic", () => {
  describe("makeIso", () => {
    it("Class", () => {
      const schema = Value
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<Optic.Iso<Value, { readonly a: Date }>>()
    })

    it("typeCodec(Class)", () => {
      const schema = Schema.typeCodec(Value)
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<Optic.Iso<Value, { readonly a: Date }>>()
    })

    it("encodedCodec(Class)", () => {
      const schema = Schema.encodedCodec(Value)
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<Optic.Iso<{ readonly a: Date }, { readonly a: Date }>>()
    })

    describe("brand", () => {
      it("Number & positive", () => {
        const schema = Schema.Number.check(Check.positive()).pipe(Schema.brand("positive"))
        const optic = ToOptic.makeIso(schema)

        expect(optic).type.toBe<Optic.Iso<number & Brand.Brand<"positive">, number & Brand.Brand<"positive">>>()
      })
    })

    it("Tuple", () => {
      const schema = Schema.Tuple([Value, Schema.optionalKey(Value)])
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<
        Optic.Iso<
          readonly [Value, Value?],
          readonly [{ readonly a: Date }, { readonly a: Date }?]
        >
      >()
    })

    it("Array", () => {
      const schema = Schema.Array(Value)
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<Optic.Iso<ReadonlyArray<Value>, ReadonlyArray<{ readonly a: Date }>>>()
    })

    it("TupleWithRest", () => {
      const schema = Schema.TupleWithRest(Schema.Tuple([Value]), [Value, Value])
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBeAssignableTo<
        Optic.Iso<
          readonly [Value, ...Array<Value>, Value],
          readonly [{ readonly a: Date }, ...Array<{ readonly a: Date }>, { readonly a: Date }]
        >
      >()
      expect(optic).type.toBeAssignableWith<
        Optic.Iso<
          readonly [Value, ...Array<Value>, Value],
          readonly [{ readonly a: Date }, ...Array<{ readonly a: Date }>, { readonly a: Date }]
        >
      >()
      // TODO: fix me, this should be true
      // expect(optic).type.toBe<
      //   Optic.Iso<
      //     readonly [Value, ...Array<Value>, Value],
      //     readonly [{ readonly a: Date }, ...Array<{ readonly a: Date }>, { readonly a: Date }]
      //   >
      // >()
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        a: Value,
        b: Schema.mutableKey(Value),
        c: Schema.optionalKey(Value),
        d: Schema.mutableKey(Schema.optionalKey(Value))
      })
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<
        Optic.Iso<{
          b: Value
          readonly a: Value
          readonly c?: Value
          d?: Value
        }, {
          b: { readonly a: Date }
          readonly a: { readonly a: Date }
          readonly c?: { readonly a: Date }
          d?: { readonly a: Date }
        }>
      >()
    })

    it("Record", () => {
      const schema = Schema.Record(Schema.String, Value)
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<
        Optic.Iso<{ readonly [x: string]: Value }, { readonly [x: string]: { readonly a: Date } }>
      >()
    })

    it("StructWithRest", () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Value }),
        [Schema.Record(Schema.String, Value)]
      )
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<
        Optic.Iso<
          { readonly a: Value; readonly [x: string]: Value },
          { readonly a: { readonly a: Date }; readonly [x: string]: { readonly a: Date } }
        >
      >()
    })

    it("Opaque", () => {
      class Value extends Schema.Opaque<Value>()(Schema.Struct({ a: Schema.Date })) {}
      const schema = Value
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<Optic.Iso<Value, { readonly a: Date }>>()
    })

    it("Option", () => {
      const schema = Schema.Option(Value)
      const optic = ToOptic.makeIso(schema)

      expect(optic).type.toBe<
        Optic.Iso<
          Option.Option<Value>,
          {
            readonly _tag: "None"
          } | {
            readonly _tag: "Some"
            readonly value: {
              readonly a: Date
            }
          }
        >
      >()
    })
  })
})
