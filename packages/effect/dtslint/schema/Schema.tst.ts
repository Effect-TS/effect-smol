import type { Brand } from "effect/data"
import type { ServiceMap } from "effect"
import { Effect, flow, hole, String as Str  } from "effect"
import { Option, Predicate, Struct, Tuple } from "effect/data"
import { AST, Getter, Schema, Transformation } from 'effect/schema'
import type { Array } from "effect/collections"
import { immerable, produce } from "immer"
import { describe, expect, it, when } from "tstyche"

type MakeUnsafe<In, Out> = (input: In, options?: Schema.MakeOptions | undefined) => Out

const revealClass = <Self, S extends Schema.Struct<Schema.Struct.Fields>, Inherited>(
  klass: Schema.Class<Self, S, Inherited>
): Schema.Class<Self, S, Inherited> => klass

const FiniteFromString = Schema.String.pipe(Schema.decodeTo(
  Schema.Finite,
  new Transformation.Transformation(
    Getter.Number(),
    Getter.String()
  )
))

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    new Transformation.Transformation(
      Getter.Number(),
      Getter.String()
    )
  )
)

describe("Schema", () => {
  describe("variance", () => {
    it("Type", () => {
      const f1 = hole<
        <A extends string, S extends Schema.Codec<A, unknown, unknown>>(schema: S) => S
      >()
      const f2 = hole<
        <S extends Schema.Codec<string, unknown, unknown>>(schema: S) => S
      >()

      const schema = hole<Schema.Codec<"a", number, "ctx">>()

      f1(schema)
      f2(schema)
    })

    it("Encoded", () => {
      const f1 = hole<
        <A extends number, S extends Schema.Codec<unknown, A, unknown>>(schema: S) => S
      >()
      const f2 = hole<
        <S extends Schema.Codec<unknown, number, unknown>>(schema: S) => S
      >()

      const schema = hole<Schema.Codec<string, 1, "ctx">>()

      f1(schema)
      f2(schema)
    })
  })

  describe("makeUnsafe", () => {
    it("Never", () => {
      const schema = Schema.Never
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<never, never>>()
    })

    it("Unknown", () => {
      const schema = Schema.Unknown
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<unknown, unknown>>()
    })

    it("Any", () => {
      const schema = Schema.Any
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<any, any>>()
    })

    it("Null", () => {
      const schema = Schema.Null
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<null, null>>()
    })

    it("Undefined", () => {
      const schema = Schema.Undefined
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<undefined, undefined>>()
    })

    it("String", () => {
      const schema = Schema.String
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<string, string>>()
    })

    it("Number", () => {
      const schema = Schema.Number
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<number, number>>()
    })

    it("check", () => {
      const schema = Schema.String.check(Schema.isMinLength(1))
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<string, string>>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<string, string & Brand.Brand<"a">>>()
    })

    it("refineByGuard", () => {
      const schema = Schema.Option(Schema.String).pipe(Schema.refineByGuard(Option.isSome))
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<Option.Option<string>, Option.Some<string>>>()
    })

    describe("Struct", () => {
      it("simple field", () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<{ readonly a: string }, { readonly a: string }>>()
      })

      it("branded field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.brand("a"))
        })
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<{ readonly a: string & Brand.Brand<"a"> }, { readonly a: string & Brand.Brand<"a"> }>
        >()
      })

      it("refineByGuard field", () => {
        const schema = Schema.Struct({
          a: Schema.Option(Schema.String).pipe(Schema.refineByGuard(Option.isSome))
        })
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<{ readonly a: Option.Some<string> }, { readonly a: Option.Some<string> }>
        >()
      })

      it("defaulted field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("default")))
        })
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<{ readonly a?: string }, { readonly a: string }>>()
      })

      it("branded defaulted field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.brand("a"), Schema.withConstructorDefault(() => Option.some("default")))
        })
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<{ readonly a?: string & Brand.Brand<"a"> }, { readonly a: string & Brand.Brand<"a"> }>
        >()
      })

      it("defaulted branded field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("default")), Schema.brand("a"))
        })
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<{ readonly a?: string & Brand.Brand<"a"> }, { readonly a: string & Brand.Brand<"a"> }>
        >()
      })

      it("nested defaulted fields", () => {
        const schema = Schema.Struct({
          a: Schema.Struct({
            b: Schema.Finite.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
          }).pipe(Schema.withConstructorDefault(() => Option.some({})))
        })
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<{ readonly a?: { readonly b?: number } }, { readonly a: { readonly b: number } }>
        >()
      })

      it("nested defaulted & branded field", () => {
        const A = Schema.Struct({
          b: Schema.Finite.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
        }).pipe(Schema.brand("a"))
        const schema = Schema.Struct({
          a: A.pipe(Schema.withConstructorDefault(() => Option.some(A.makeUnsafe({}))))
        })
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<
            { readonly a?: { readonly b: number } & Brand.Brand<"a"> },
            { readonly a: { readonly b: number } & Brand.Brand<"a"> }
          >
        >()
      })

      it("Class field", () => {
        class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
          a: Schema.String
        })) {}
        const schema = Schema.Struct({
          a: A
        })
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<{ readonly a: A }, { readonly a: A }>>()
      })

      it("optional Class field", () => {
        class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
          a: Schema.String
        })) {}
        const schema = Schema.Struct({
          a: A.pipe(Schema.withConstructorDefault(() => Option.some(new A({ a: "default" }))))
        })
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<{ readonly a?: A }, { readonly a: A }>>()
      })
    })

    describe("Tuple", () => {
      it("simple element", () => {
        const schema = Schema.Tuple([Schema.String])
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<readonly [string], readonly [string]>>()
      })

      it("branded field", () => {
        const schema = Schema.Tuple([Schema.String.pipe(Schema.brand("a"))])
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<readonly [string & Brand.Brand<"a">], readonly [string & Brand.Brand<"a">]>
        >()
      })

      it("defaulted field", () => {
        const schema = Schema.Tuple([Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("default")))])
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<readonly [string?], readonly [string]>>()
      })

      it("nested defaults (Struct)", () => {
        const schema = Schema.Tuple(
          [
            Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          ]
        )
        expect(schema.makeUnsafe).type.toBe<
          MakeUnsafe<readonly [{ readonly b?: number }?], readonly [{ readonly b: number }]>
        >()
      })

      it("nested defaults (Tuple)", () => {
        const schema = Schema.Tuple(
          [
            Schema.Tuple([
              Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            ]).pipe(Schema.withConstructorDefault(() => Option.some([] as const)))
          ]
        )
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<readonly [(readonly [number?])?], readonly [readonly [number]]>>()
      })
    })

    describe("Class", () => {
      it("nested defaulted fields", () => {
        class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
          a: Schema.Struct({
            b: Schema.Finite.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
          }).pipe(Schema.withConstructorDefault(() => Option.some({})))
        })) {}
        expect(A.makeUnsafe).type.toBe<MakeUnsafe<{ readonly a?: { readonly b?: number } }, A>>()
        const schema = Schema.Struct({
          a: A
        })
        expect(schema.makeUnsafe).type.toBe<MakeUnsafe<{ readonly a: A }, { readonly a: A }>>()
      })
    })

    it("typeCodec", () => {
      const schema = Schema.typeCodec(Schema.FiniteFromString)
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<number, number>>()
    })

    it("encodedCodec", () => {
      const schema = Schema.encodedCodec(Schema.FiniteFromString)
      expect(schema.makeUnsafe).type.toBe<MakeUnsafe<string, string>>()
    })

    it("flip", () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString
      })
      const flipped = Schema.flip(schema)
      expect(flipped.makeUnsafe).type.toBe<MakeUnsafe<{ readonly a: string }, { readonly a: string }>>()
    })

    it("Array", () => {
      const schema = Schema.Array(Schema.FiniteFromString.pipe(Schema.brand("a")))
      expect(schema.makeUnsafe).type.toBe<
        MakeUnsafe<ReadonlyArray<number & Brand.Brand<"a">>, ReadonlyArray<number & Brand.Brand<"a">>>
      >()
    })

    it("NonEmptyArray", () => {
      const schema = Schema.NonEmptyArray(Schema.FiniteFromString.pipe(Schema.brand("a")))
      expect(schema.makeUnsafe).type.toBe<
        MakeUnsafe<
          readonly [number & Brand.Brand<"a">, ...Array<number & Brand.Brand<"a">>],
          readonly [number & Brand.Brand<"a">, ...Array<number & Brand.Brand<"a">>]
        >
      >()
    })

    it("Record", () => {
      const schema = Schema.Record(
        Schema.String.pipe(Schema.brand("k")),
        Schema.FiniteFromString.pipe(Schema.brand("a"))
      )

      expect(schema.makeUnsafe).type.toBe<
        MakeUnsafe<
          { readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a"> },
          { readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a"> }
        >
      >()
    })

    it("StructWithRest", () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.FiniteFromString.pipe(Schema.brand("a")) }),
        [Schema.Record(Schema.String.pipe(Schema.brand("k")), Schema.FiniteFromString.pipe(Schema.brand("a")))]
      )
      expect(schema.makeUnsafe).type.toBe<
        MakeUnsafe<{
          readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a">
          readonly a: number & Brand.Brand<"a">
        }, {
          readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a">
          readonly a: number & Brand.Brand<"a">
        }>
      >()
    })

    it("TupleWithRest", () => {
      const schema = Schema.TupleWithRest(
        Schema.Tuple([Schema.FiniteFromString.pipe(Schema.brand("a"))]),
        [Schema.FiniteFromString.pipe(Schema.brand("b")), Schema.FiniteFromString.pipe(Schema.brand("c"))]
      )
      expect(schema.makeUnsafe).type.toBe<
        MakeUnsafe<
          readonly [number & Brand.Brand<"a">, ...Array<number & Brand.Brand<"b">>, number & Brand.Brand<"c">],
          readonly [number & Brand.Brand<"a">, ...Array<number & Brand.Brand<"b">>, number & Brand.Brand<"c">]
        >
      >()
    })

    it("Union", () => {
      const schema = Schema.Union([
        Schema.Array(Schema.FiniteFromString.pipe(Schema.brand("a"))),
        Schema.FiniteFromString.pipe(Schema.brand("b"))
      ])
      expect(schema.makeUnsafe).type.toBe<
        MakeUnsafe<
          ReadonlyArray<number & Brand.Brand<"a">> | number & Brand.Brand<"b">,
          ReadonlyArray<number & Brand.Brand<"a">> | number & Brand.Brand<"b">
        >
      >()
    })

    it("Opaque", () => {
      class A extends Schema.Opaque<A>()(
        Schema.Struct({
          b: Schema.FiniteFromString.pipe(Schema.brand("a"), Schema.withConstructorDefault(() => Option.some(-1)))
        })
      ) {}
      const schema = Schema.Struct({
        a: A
      })

      expect(schema.makeUnsafe).type.toBe<
        MakeUnsafe<{ readonly a: { readonly b?: number & Brand.Brand<"a"> } }, { readonly a: A }>
      >()
    })
  })

  describe("typeCodec", () => {
    it("ast type", () => {
      const schema = Schema.typeCodec(Schema.FiniteFromString)
      expect(schema.ast).type.toBe<AST.NumberKeyword>()
    })

    it("revealCodec + annotate", () => {
      const schema = Schema.typeCodec(Schema.FiniteFromString)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<number, number, never, never>>()
      expect(schema).type.toBe<Schema.typeCodec<Schema.FiniteFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.typeCodec<Schema.FiniteFromString>>()
    })
  })

  describe("encodedCodec", () => {
    it("ast type", () => {
      const schema = Schema.FiniteFromString
      expect(schema.ast).type.toBe<AST.NumberKeyword>()
    })

    it("revealCodec + annotate", () => {
      const schema = Schema.encodedCodec(Schema.FiniteFromString)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never, never>>()
      expect(schema).type.toBe<Schema.encodedCodec<Schema.FiniteFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.encodedCodec<Schema.FiniteFromString>>()
    })
  })

  describe("Never", () => {
    const schema = Schema.Never

    it("ast type", () => {
      expect(schema.ast).type.toBe<AST.NeverKeyword>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<never>>()
      expect(schema).type.toBe<Schema.Never>()
      expect(schema.annotate({})).type.toBe<Schema.Never>()
    })
  })

  describe("Unknown", () => {
    const schema = Schema.Unknown

    it("ast type", () => {
      expect(schema.ast).type.toBe<AST.UnknownKeyword>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<unknown>>()
      expect(schema).type.toBe<Schema.Unknown>()
      expect(schema.annotate({})).type.toBe<Schema.Unknown>()
    })
  })

  describe("Null", () => {
    const schema = Schema.Null

    it("ast type", () => {
      expect(schema.ast).type.toBe<AST.NullKeyword>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<null>>()
      expect(schema).type.toBe<Schema.Null>()
      expect(schema.annotate({})).type.toBe<Schema.Null>()
    })
  })

  describe("Undefined", () => {
    const schema = Schema.Undefined

    it("ast type", () => {
      expect(schema.ast).type.toBe<AST.UndefinedKeyword>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<undefined>>()
      expect(schema).type.toBe<Schema.Undefined>()
      expect(schema.annotate({})).type.toBe<Schema.Undefined>()
    })
  })

  describe("String", () => {
    const schema = Schema.String

    it("ast type", () => {
      expect(schema.ast).type.toBe<AST.StringKeyword>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string>>()
      expect(schema).type.toBe<Schema.String>()
      expect(schema.annotate({})).type.toBe<Schema.String>()
    })
  })

  describe("Number", () => {
    const schema = Schema.Number

    it("ast type", () => {
      expect(schema.ast).type.toBe<AST.NumberKeyword>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<number>>()
      expect(schema).type.toBe<Schema.Number>()
      expect(schema.annotate({})).type.toBe<Schema.Number>()
    })
  })

  describe("Literal", () => {
    const schema = Schema.Literal("a")

    it("ast type", () => {
      expect(schema.ast).type.toBe<AST.LiteralType>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<"a">>()
      expect(schema).type.toBe<Schema.Literal<"a">>()
    })
  })

  describe("Struct", () => {
    it("ast type", () => {
      const schema = Schema.Struct({ a: Schema.String })
      expect(schema.ast).type.toBe<AST.TypeLiteral>()
    })

    it("Never should be usable as a field", () => {
      const schema = Schema.Struct({ a: Schema.Never })
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<{ readonly a: never }>>()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.Never }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.Never }>>()
    })

    it("branded field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: string & Brand.Brand<"a"> }, { readonly a: string }>
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.refine<string & Brand.Brand<"a">, Schema.String> }>
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.refine<string & Brand.Brand<"a">, Schema.String> }>
      >()
    })

    it("readonly & required field", () => {
      const schema = Schema.Struct({
        a: FiniteFromString
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: number }, { readonly a: string }>
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String> }>
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String> }>
      >()
    })

    it("readonly & optional field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optionalKey)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a?: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.optionalKey<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.optionalKey<Schema.String> }>
      >()
    })

    it("mutable & required field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.mutableKey)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.mutableKey<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.mutableKey<Schema.String> }>
      >()
    })

    it("mutable & optional field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.mutableKey, Schema.optionalKey)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a?: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.optionalKey<Schema.mutableKey<Schema.String>> }>>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.optionalKey<Schema.mutableKey<Schema.String>> }>
      >()
    })

    it("optional & mutable field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optionalKey, Schema.mutableKey)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a?: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.mutableKey<Schema.optionalKey<Schema.String>> }>>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.mutableKey<Schema.optionalKey<Schema.String>> }>
      >()
    })

    it("Programming with generics", () => {
      const f = <F extends { readonly a: Schema.String }>(schema: Schema.Struct<F>) => {
        const out = Schema.Struct({
          ...schema.fields,
          b: schema.fields.a
        })
        expect(out.fields.a).type.toBe<Schema.String>()
        return out
      }

      const schema = f(Schema.Struct({ a: Schema.String, c: Schema.String }))
      expect(schema.makeUnsafe).type.toBe<
        (
          input: { readonly a: string; readonly c: string; readonly b: string },
          options?: Schema.MakeOptions | undefined
        ) => { readonly a: string; readonly c: string; readonly b: string }
      >()
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: string; readonly c: string; readonly b: string }>
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.String; readonly c: Schema.String } & { readonly b: Schema.String }>
      >()
    })
  })

  describe("flip", () => {
    it("applying flip twice should return the original schema", () => {
      const schema = Schema.FiniteFromString
      expect(Schema.flip(Schema.flip(schema))).type.toBe<typeof schema>()
    })

    it("decodeTo", () => {
      const schema = Schema.FiniteFromString
      const flipped = Schema.flip(schema)
      expect(flipped).type.toBe<Schema.flip<Schema.decodeTo<Schema.Number, Schema.String>>>()
      expect(flipped.annotate({})).type.toBe<Schema.flip<Schema.decodeTo<Schema.Number, Schema.String>>>()
      expect(Schema.revealCodec(flipped)).type.toBe<Schema.Codec<string, number>>()
      expect(Schema.revealCodec(flipped.annotate({}))).type.toBe<Schema.Codec<string, number>>()
    })

    it("optionalKey", () => {
      const schema = Schema.Struct({
        a: Schema.optionalKey(Schema.FiniteFromString)
      })
      const flipped = Schema.flip(schema)
      expect(Schema.revealCodec(flipped)).type.toBe<Schema.Codec<{ readonly a?: string }, { readonly a?: number }>>()
    })

    it("optional", () => {
      const schema = Schema.Struct({
        a: Schema.optional(Schema.FiniteFromString)
      })
      const flipped = Schema.flip(schema)
      expect(Schema.revealCodec(flipped)).type.toBe<
        Schema.Codec<{ readonly a?: string | undefined }, { readonly a?: number | undefined }>
      >()
    })

    it("Struct & withConstructorDefault", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("c")))
      })
      expect(schema.makeUnsafe).type.toBe<
        (input: { readonly a?: string }, options?: Schema.MakeOptions | undefined) => { readonly a: string }
      >()

      const flipped = schema.pipe(Schema.flip)
      expect(flipped.makeUnsafe).type.toBe<
        (input: { readonly a: string }, options?: Schema.MakeOptions | undefined) => { readonly a: string }
      >()
    })
  })

  describe("Array", () => {
    it("Array<transformation>", () => {
      const schema = Schema.Array(FiniteFromString)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<ReadonlyArray<number>, ReadonlyArray<string>>>()
      expect(schema).type.toBe<Schema.Array$<typeof FiniteFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.Array$<typeof FiniteFromString>>()

      expect(schema.schema).type.toBe<typeof FiniteFromString>()
    })
  })

  describe("NonEmptyArray", () => {
    it("NonEmptyArray<transformation>", () => {
      const schema = Schema.NonEmptyArray(FiniteFromString)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [number, ...Array<number>], readonly [string, ...Array<string>]>
      >()
      expect(schema).type.toBe<Schema.NonEmptyArray<typeof FiniteFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.NonEmptyArray<typeof FiniteFromString>>()

      expect(schema.schema).type.toBe<typeof FiniteFromString>()
    })
  })

  describe("checks", () => {
    describe("and / annotate", () => {
      it("Filter + Filter", () => {
        const f1 = Schema.isInt()
        const f2 = Schema.isInt()

        expect(f1.and(f2)).type.toBe<AST.FilterGroup<number>>()
        expect(f1.and(f2).annotate({})).type.toBe<AST.FilterGroup<number>>()
      })

      it("Filter + FilterGroup", () => {
        const f1 = Schema.isInt()
        const f2 = Schema.isInt32()

        expect(f1.and(f2)).type.toBe<AST.FilterGroup<number>>()
        expect(f2.and(f1)).type.toBe<AST.FilterGroup<number>>()
        expect(f1.and(f2).annotate({})).type.toBe<AST.FilterGroup<number>>()
        expect(f2.and(f1).annotate({})).type.toBe<AST.FilterGroup<number>>()
      })

      it("FilterGroup + FilterGroup", () => {
        const f1 = Schema.isInt32()
        const f2 = Schema.isInt32()

        expect(f1.and(f2)).type.toBe<AST.FilterGroup<number>>()
        expect(f2.and(f1)).type.toBe<AST.FilterGroup<number>>()
        expect(f1.and(f2).annotate({})).type.toBe<AST.FilterGroup<number>>()
        expect(f2.and(f1).annotate({})).type.toBe<AST.FilterGroup<number>>()
      })

      it("RefinementGroup + Filter", () => {
        const f1 = Schema.isInt().pipe(Schema.isBranded("a"))
        const f2 = Schema.isInt()

        expect(f1.and(f2)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
        expect(f2.and(f1)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
        expect(f1.and(f2).annotate({})).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
        expect(f2.and(f1).annotate({})).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
      })

      it("RefinementGroup + RefinementGroup", () => {
        const f1 = Schema.isInt().pipe(Schema.isBranded("a"))
        const f2 = Schema.isInt().pipe(Schema.isBranded("b"))

        expect(f1.and(f2)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
        expect(f2.and(f1)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
        expect(f1.and(f2).annotate({})).type.toBe<
          AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
        >()
        expect(f2.and(f1).annotate({})).type.toBe<
          AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
        >()
      })
    })
  })


  describe("refinements", () => {
    describe("refineByGuard", () => {
      it("String & isString", () => {
        const schema = Schema.String.pipe(Schema.refineByGuard(Predicate.isString))
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<string, string, never, never>
        >()
      })

      it("String | Number & isString", () => {
        const schema = Schema.Union([Schema.String, Schema.Number]).pipe(
          Schema.refineByGuard(Predicate.isString)
        )
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<string, string | number, never, never>
        >()
      })

      it("Option(String) & isSome", () => {
        const schema = Schema.Option(Schema.String).pipe(Schema.refineByGuard(Option.isSome))
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<Option.Some<string>, Option.Option<string>, never, never>
        >()
        expect(schema).type.toBe<Schema.refine<Option.Some<string>, Schema.Option<Schema.String>>>()
        expect(schema.annotate({})).type.toBe<
          Schema.refine<Option.Some<string>, Schema.Option<Schema.String>>
        >()
      })
    })

    describe("brand", () => {
      it("single brand", () => {
        const schema = Schema.String.pipe(Schema.brand("a"))
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<string & Brand.Brand<"a">, string, never, never>
        >()
      })

      it("double brand", () => {
        const schema = Schema.String.pipe(Schema.brand("a"), Schema.brand("b"))

        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<string & Brand.Brand<"a"> & Brand.Brand<"b">, string, never, never>
        >()
      })
    })

    it("refine", () => {
      const min2 = Schema.isGreaterThanOrEqualTo(2).pipe(Schema.isBranded("min2"))
      const int = Schema.isInt().pipe(Schema.isBranded("int"))

      const schema = Schema.Number.pipe(
        Schema.refine(min2.and(int))
      )

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<number & Brand.Brand<"min2"> & Brand.Brand<"int">, number, never, never>
      >()
      expect(schema).type.toBe<Schema.refine<number & Brand.Brand<"min2"> & Brand.Brand<"int">, Schema.Number>>()
      expect(schema.annotate({})).type.toBe<
        Schema.refine<number & Brand.Brand<"min2"> & Brand.Brand<"int">, Schema.Number>
      >()
    })
  })

  describe("Record", () => {
    it("Record(String, Number)", () => {
      const schema = Schema.Record(Schema.String, Schema.Number)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number }, { readonly [x: string]: number }, never>
      >()
      expect(schema).type.toBe<Schema.Record$<Schema.String, Schema.Number>>()
      expect(schema.annotate({})).type.toBe<Schema.Record$<Schema.String, Schema.Number>>()
    })

    it("Record(String, optionalKey(Number))", () => {
      const schema = Schema.Record(Schema.String, Schema.optionalKey(Schema.Number))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number | undefined }, { readonly [x: string]: number | undefined }, never>
      >()
      expect(schema).type.toBe<Schema.Record$<Schema.String, Schema.optionalKey<Schema.Number>>>()
      expect(schema.annotate({})).type.toBe<Schema.Record$<Schema.String, Schema.optionalKey<Schema.Number>>>()
    })

    it("Record(Symbol, Number)", () => {
      const schema = Schema.Record(Schema.Symbol, Schema.Number)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: symbol]: number }, { readonly [x: symbol]: number }, never>
      >()
      expect(schema).type.toBe<Schema.Record$<Schema.Symbol, Schema.Number>>()
      expect(schema.annotate({})).type.toBe<Schema.Record$<Schema.Symbol, Schema.Number>>()
    })

    it("Record(String, NumberFromString)", () => {
      const schema = Schema.Record(Schema.String, NumberFromString)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number }, { readonly [x: string]: string }, never>
      >()
      expect(schema).type.toBe<Schema.Record$<Schema.String, typeof NumberFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.Record$<Schema.String, typeof NumberFromString>>()
    })

    it("Record(`${number}`, NumberFromString)", () => {
      const schema = Schema.Record(Schema.TemplateLiteral([Schema.Number]), NumberFromString)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: `${number}`]: number }, { readonly [x: `${number}`]: string }, never>
      >()
      expect(schema).type.toBe<Schema.Record$<Schema.TemplateLiteral<readonly [Schema.Number]>, typeof NumberFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.Record$<Schema.TemplateLiteral<readonly [Schema.Number]>, typeof NumberFromString>>()
    })

    describe("Literals keys", () => {
      it("Record(Literals, Number)", () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.FiniteFromString)
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<
            { readonly "a": number; readonly "b": number },
            { readonly "a": string; readonly "b": string },
            never
          >
        >()
        expect(schema).type.toBe<Schema.Record$<Schema.Literals<readonly ["a", "b"]>, typeof FiniteFromString>>()
        expect(schema.annotate({})).type.toBe<
          Schema.Record$<Schema.Literals<readonly ["a", "b"]>, typeof FiniteFromString>
        >()
      })

      it("Record(Literals, optionalKey(Number))", () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.optionalKey(Schema.FiniteFromString))
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<
            { readonly "a"?: number; readonly "b"?: number },
            { readonly "a"?: string; readonly "b"?: string },
            never
          >
        >()
        expect(schema).type.toBe<
          Schema.Record$<Schema.Literals<readonly ["a", "b"]>, Schema.optionalKey<typeof FiniteFromString>>
        >()
        expect(schema.annotate({})).type.toBe<
          Schema.Record$<Schema.Literals<readonly ["a", "b"]>, Schema.optionalKey<typeof FiniteFromString>>
        >()
      })

      it("Record(Literals, mutableKey(Number))", () => {
        const schema = Schema.Record(Schema.Literals(["a", "b"]), Schema.mutableKey(Schema.FiniteFromString))
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<{ "a": number; "b": number }, { "a": string; "b": string }, never>
        >()
        expect(schema).type.toBe<
          Schema.Record$<Schema.Literals<readonly ["a", "b"]>, Schema.mutableKey<typeof FiniteFromString>>
        >()
        expect(schema.annotate({})).type.toBe<
          Schema.Record$<Schema.Literals<readonly ["a", "b"]>, Schema.mutableKey<typeof FiniteFromString>>
        >()
      })

      it("Record(Literals, mutableKey(optionalKey(Number)))", () => {
        const schema = Schema.Record(
          Schema.Literals(["a", "b"]),
          Schema.mutableKey(Schema.optionalKey(Schema.FiniteFromString))
        )
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<{ "a"?: number; "b"?: number }, { "a"?: string; "b"?: string }, never>
        >()
        expect(schema).type.toBe<
          Schema.Record$<
            Schema.Literals<readonly ["a", "b"]>,
            Schema.mutableKey<Schema.optionalKey<typeof FiniteFromString>>
          >
        >()
        expect(schema.annotate({})).type.toBe<
          Schema.Record$<
            Schema.Literals<readonly ["a", "b"]>,
            Schema.mutableKey<Schema.optionalKey<typeof FiniteFromString>>
          >
        >()
      })
    })
  })

  describe("Tuple", () => {
    it("empty", () => {
      const schema = Schema.Tuple([])
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<readonly [], readonly []>>()
      expect(schema).type.toBe<Schema.Tuple<readonly []>>()
      expect(schema.annotate({})).type.toBe<Schema.Tuple<readonly []>>()

      expect(schema.elements).type.toBe<readonly []>()
    })

    it("defaulted element", () => {
      const schema = Schema.Tuple([Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("default")))])
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<readonly [string], readonly [string]>>()
      expect(schema).type.toBe<Schema.Tuple<readonly [Schema.withConstructorDefault<Schema.String>]>>()
      expect(schema.annotate({})).type.toBe<Schema.Tuple<readonly [Schema.withConstructorDefault<Schema.String>]>>()

      expect(schema.elements).type.toBe<readonly [Schema.withConstructorDefault<Schema.String>]>()
    })

    it("readonly [String, Number?]", () => {
      const schema = Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string, number?], readonly [string, number?]>
      >()
      expect(schema).type.toBe<Schema.Tuple<readonly [Schema.String, Schema.optionalKey<Schema.Number>]>>()
      expect(schema.annotate({})).type.toBe<
        Schema.Tuple<readonly [Schema.String, Schema.optionalKey<Schema.Number>]>
      >()

      expect(schema.elements).type.toBe<readonly [Schema.String, Schema.optionalKey<Schema.Number>]>()
    })
  })

  describe("Union", () => {
    it("empty", () => {
      const schema = Schema.Union([])
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<never, never, never>>()
      expect(schema).type.toBe<Schema.Union<readonly []>>()
      expect(schema.annotate({})).type.toBe<Schema.Union<readonly []>>()

      expect(schema.members).type.toBe<readonly []>()
    })

    it("string", () => {
      const schema = Schema.Union([Schema.String])
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never>>()
      expect(schema).type.toBe<Schema.Union<readonly [Schema.String]>>()
      expect(schema.annotate({})).type.toBe<Schema.Union<readonly [Schema.String]>>()

      expect(schema.members).type.toBe<readonly [Schema.String]>()
    })

    it("string | number", () => {
      const schema = Schema.Union([Schema.String, Schema.Number])
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string | number, string | number, never>>()
      expect(schema).type.toBe<Schema.Union<readonly [Schema.String, Schema.Number]>>()
      expect(schema.annotate({})).type.toBe<Schema.Union<readonly [Schema.String, Schema.Number]>>()

      expect(schema.members).type.toBe<readonly [Schema.String, Schema.Number]>()
    })
  })

  describe("Opaque", () => {
    it("Struct drop in", () => {
      const f = <Fields extends Schema.Struct.Fields>(struct: Schema.Struct<Fields>) => struct

      class Person extends Schema.Opaque<Person>()(
        Schema.Struct({
          name: Schema.String
        })
      ) {}

      const y = f(Person)
      expect(y).type.toBe<Schema.Struct<{ readonly name: Schema.String }>>()
    })

    it("Struct", () => {
      class A extends Schema.Opaque<A>()(Schema.Struct({ a: FiniteFromString })) {}
      const schema = A

      expect<typeof A["Type"]>().type.toBe<A>()
      expect<typeof A["Encoded"]>().type.toBe<{ readonly a: string }>()

      expect(A.makeUnsafe({ a: 1 })).type.toBe<A>()

      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<A, { readonly a: string }>>()
      expect(schema).type.toBe<typeof A>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String> }>
      >()
      expect(schema.ast).type.toBe<AST.TypeLiteral>()
      expect(schema.makeUnsafe).type.toBe<
        (input: { readonly a: number }, options?: Schema.MakeOptions | undefined) => A
      >()
      expect(schema.fields).type.toBe<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String> }>()

      expect(A).type.not.toHaveProperty("a")
    })

    it("Nested Struct", () => {
      class A extends Schema.Opaque<A>()(Schema.Struct({ a: Schema.String })) {}
      const schema = Schema.Struct({ a: A })

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: A }, { readonly a: { readonly a: string } }, never>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: typeof A }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: typeof A }>>()
    })

    it("branded (unique symbol)", () => {
      class A extends Schema.Opaque<A>()(Schema.Struct({
        a: Schema.String
      })) {}
      class B extends Schema.Opaque<B>()(Schema.Struct({
        a: Schema.String
      })) {}

      const f = (a: A) => a

      f(A.makeUnsafe({ a: "a" }))
      f(B.makeUnsafe({ a: "a" }))

      class ABranded extends Schema.Opaque<ABranded, { readonly brand: unique symbol }>()(Schema.Struct({
        a: Schema.String
      })) {}
      class BBranded extends Schema.Opaque<BBranded, { readonly brand: unique symbol }>()(Schema.Struct({
        a: Schema.String
      })) {}

      const fABranded = (a: ABranded) => a

      fABranded(ABranded.makeUnsafe({ a: "a" }))
      when(fABranded).isCalledWith(expect(BBranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))

      const fBBranded = (a: BBranded) => a

      fBBranded(BBranded.makeUnsafe({ a: "a" }))
      when(fBBranded).isCalledWith(expect(ABranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))
    })

    it("branded (Brand module)", () => {
      class ABranded extends Schema.Opaque<ABranded, Brand.Brand<"A">>()(Schema.Struct({
        a: Schema.String
      })) {}
      class BBranded extends Schema.Opaque<BBranded, Brand.Brand<"B">>()(Schema.Struct({
        a: Schema.String
      })) {}

      const fABranded = (a: ABranded) => a

      fABranded(ABranded.makeUnsafe({ a: "a" }))
      when(fABranded).isCalledWith(expect(BBranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))

      const fBBranded = (a: BBranded) => a

      fBBranded(BBranded.makeUnsafe({ a: "a" }))
      when(fBBranded).isCalledWith(expect(ABranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))
    })
  })

  it("instanceOf", () => {
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
        defaultJsonSerializer: () =>
          new AST.Link(
            Schema.String.ast,
            Transformation.transform({
              decode: (e) => e.message,
              encode: (message) => new MyError(message)
            })
          )
      }
    )

    expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<MyError, MyError, never, never>>()
    expect(schema).type.toBe<Schema.instanceOf<MyError>>()
    expect(schema.annotate({})).type.toBe<Schema.instanceOf<MyError>>()
    expect(schema.ast).type.toBe<AST.Declaration>()
    expect(schema.makeUnsafe).type.toBe<
      (input: MyError, options?: Schema.MakeOptions | undefined) => MyError
    >()
  })

  describe("decodeTo", () => {
    it("should allow partial application", () => {
      const f = Schema.decodeTo(Schema.String)
      expect(f).type.toBe<<From extends Schema.Top>(from: From) => Schema.compose<Schema.String, From>>()

      expect(f(Schema.Number)).type.toBe<Schema.compose<Schema.String, Schema.Number>>()
    })
  })

  describe("passthrough", () => {
    it("E = T", () => {
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.NonEmptyString,
          Transformation.passthrough()
        )
      )
    })

    it("E != T", () => {
      when(Schema.String.pipe).isCalledWith(
        expect(Schema.decodeTo).type.not.toBeCallableWith(
          Schema.Number,
          Transformation.passthrough()
        )
      )

      Schema.String.pipe(
        Schema.decodeTo(
          Schema.Number,
          Transformation.passthrough({ strict: false })
        )
      )
    })

    it("E extends T", () => {
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.UndefinedOr(Schema.String),
          Transformation.passthroughSubtype()
        )
      )
    })

    it("T extends E", () => {
      Schema.UndefinedOr(Schema.String).pipe(
        Schema.decodeTo(
          Schema.String,
          Transformation.passthroughSupertype()
        )
      )
    })
  })

  it("TemplateLiteral", () => {
    expect(Schema.TemplateLiteral).type.not.toBeCallableWith([Schema.Null])
    expect(Schema.TemplateLiteral).type.not.toBeCallableWith([Schema.Undefined])
    expect(Schema.TemplateLiteral).type.not.toBeCallableWith([Schema.Boolean])
    expect(Schema.TemplateLiteral).type.not.toBeCallableWith([Schema.Date])

    expect(Schema.TemplateLiteral(["a"])["Encoded"])
      .type.toBe<`a`>()
    expect(Schema.TemplateLiteral([Schema.Literal("a")])["Encoded"])
      .type.toBe<`a`>()
    expect(Schema.TemplateLiteral([1])["Encoded"])
      .type.toBe<`1`>()
    expect(Schema.TemplateLiteral([Schema.Literal(1)])["Encoded"])
      .type.toBe<`1`>()
    expect(Schema.TemplateLiteral([Schema.String])["Encoded"])
      .type.toBe<`${string}`>()
    expect(Schema.TemplateLiteral([Schema.Number])["Encoded"])
      .type.toBe<`${number}`>()
    expect(Schema.TemplateLiteral(["a", "b"])["Encoded"])
      .type.toBe<`ab`>()
    expect(Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b")])["Encoded"])
      .type.toBe<`ab`>()
    expect(Schema.TemplateLiteral(["a", Schema.String])["Encoded"])
      .type.toBe<`a${string}`>()
    expect(Schema.TemplateLiteral([Schema.Literal("a"), Schema.String])["Encoded"])
      .type.toBe<`a${string}`>()
    expect(Schema.TemplateLiteral(["a", Schema.Number])["Encoded"])
      .type.toBe<`a${number}`>()
    expect(Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number])["Encoded"])
      .type.toBe<`a${number}`>()
    expect(Schema.TemplateLiteral([Schema.String, "a"])["Encoded"])
      .type.toBe<`${string}a`>()
    expect(Schema.TemplateLiteral([Schema.String, Schema.Literal("a")])["Encoded"])
      .type.toBe<`${string}a`>()
    expect(Schema.TemplateLiteral([Schema.Number, "a"])["Encoded"])
      .type.toBe<`${number}a`>()
    expect(Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")])["Encoded"])
      .type.toBe<`${number}a`>()
    expect(Schema.TemplateLiteral([Schema.String, 0])["Encoded"])
      .type.toBe<`${string}0`>()
    expect(Schema.TemplateLiteral([Schema.String, 1n])["Encoded"])
      .type.toBe<`${string}1`>()
    expect(Schema.TemplateLiteral([Schema.String, Schema.Literals(["a", 0])])["Encoded"])
      .type.toBe<`${string}a` | `${string}0`>()
    expect(Schema.TemplateLiteral([Schema.String, Schema.Literal("/"), Schema.Number])["Encoded"])
      .type.toBe<`${string}/${number}`>()
    const EmailLocaleIDs = Schema.Literals(["welcome_email", "email_heading"])
    const FooterLocaleIDs = Schema.Literals(["footer_title", "footer_sendoff"])
    expect(
      Schema.revealCodec(Schema.TemplateLiteral([
        Schema.Union([EmailLocaleIDs, FooterLocaleIDs]),
        Schema.Literal("_id")
      ]))
    )
      .type.toBe<
      Schema.Codec<
        "welcome_email_id" | "email_heading_id" | "footer_title_id" | "footer_sendoff_id",
        "welcome_email_id" | "email_heading_id" | "footer_title_id" | "footer_sendoff_id",
        never
      >
    >()
    expect(Schema.TemplateLiteral([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), Schema.Literal("_id")])["Encoded"])
      .type.toBe<
      "welcome_email_id" | "email_heading_id" | "footer_title_id" | "footer_sendoff_id"
    >()
    expect(Schema.TemplateLiteral(["a", Schema.Union([Schema.Number, Schema.String])])["Encoded"])
      .type.toBe<`a${string}` | `a${number}`>()
    expect(Schema.TemplateLiteral(["a", Schema.FiniteFromString])["Encoded"])
      .type.toBe<`a${string}`>()
  })

  it("optional", () => {
    const schema = Schema.String.pipe(Schema.optionalKey)
    expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never>>()
    expect(schema).type.toBe<Schema.optionalKey<Schema.String>>()
    expect(schema.annotate({})).type.toBe<Schema.optionalKey<Schema.String>>()
  })

  it("mutable", () => {
    const schema = Schema.String.pipe(Schema.mutableKey)
    expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never>>()
    expect(schema).type.toBe<Schema.mutableKey<Schema.String>>()
    expect(schema.annotate({})).type.toBe<Schema.mutableKey<Schema.String>>()
  })

  describe("Class", () => {
    it("Fields argument", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}

      expect(new A({ a: "a" })).type.toBe<A>()
      expect(A.makeUnsafe({ a: "a" })).type.toBe<A>()
      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { readonly a: string }>>()
      expect(revealClass(A)).type.toBe<
        Schema.Class<A, Schema.Struct<{ readonly a: Schema.String }>, A>
      >()
      expect(A.fields).type.toBe<{ readonly a: Schema.String }>()
      expect(A.annotate({})).type.toBe<Schema.decodeTo<Schema.declareConstructor<A, { readonly a: string; }, readonly [Schema.Struct<{ readonly a: Schema.String; }>], { readonly a: string; }>, Schema.Struct<{ readonly a: Schema.String; }>>>()
    })

    it("Struct argument", () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      expect(new A({ a: "a" })).type.toBe<A>()
      expect(A.makeUnsafe({ a: "a" })).type.toBe<A>()
      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { readonly a: string }>>()
      expect(revealClass(A)).type.toBe<
        Schema.Class<A, Schema.Struct<{ readonly a: Schema.String }>, A>
      >()
      expect(A.fields).type.toBe<{ readonly a: Schema.String }>()
    })

    it("should reject non existing props", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}

      expect(A).type.not.toBeConstructableWith({ a: "a", b: "b" })
      expect(A.makeUnsafe).type.not.toBeCallableWith({ a: "a", b: "b" })
    })

    it("should be compatible with `immer`", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.Struct({ b: Schema.FiniteFromString }).pipe(Schema.optional)
      }) {
        [immerable] = true
      }

      const a = new A({ a: { b: 1 } })

      const modified = produce(a, (draft) => {
        if (draft.a) {
          draft.a.b = 2
        }
      })

      expect(modified).type.toBe<A>()
    })

    it("mutable field", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String.pipe(Schema.mutableKey)
      }) {}

      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { a: string }>>()
    })

    it("branded (unique symbol)", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      class B extends Schema.Class<B>("B")({
        a: Schema.String
      }) {}

      const f = (a: A) => a

      f(A.makeUnsafe({ a: "a" }))
      f(B.makeUnsafe({ a: "a" }))

      class ABranded extends Schema.Class<ABranded, { readonly brand: unique symbol }>("ABranded")({
        a: Schema.String
      }) {}
      class BBranded extends Schema.Class<BBranded, { readonly brand: unique symbol }>("BBranded")({
        a: Schema.String
      }) {}

      const fABranded = (a: ABranded) => a

      fABranded(ABranded.makeUnsafe({ a: "a" }))
      when(fABranded).isCalledWith(expect(BBranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))

      const fBBranded = (a: BBranded) => a

      fBBranded(BBranded.makeUnsafe({ a: "a" }))
      when(fBBranded).isCalledWith(expect(ABranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))
    })

    it("branded (Brand module)", () => {
      class ABranded extends Schema.Class<ABranded, Brand.Brand<"A">>("ABranded")({
        a: Schema.String
      }) {}
      class BBranded extends Schema.Class<BBranded, Brand.Brand<"B">>("BBranded")({
        a: Schema.String
      }) {}

      const fABranded = (a: ABranded) => a

      fABranded(ABranded.makeUnsafe({ a: "a" }))
      when(fABranded).isCalledWith(expect(BBranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))

      const fBBranded = (a: BBranded) => a

      fBBranded(BBranded.makeUnsafe({ a: "a" }))
      when(fBBranded).isCalledWith(expect(ABranded.makeUnsafe).type.not.toBeCallableWith({ a: "a" }))
    })
  })

  describe("Error", () => {
    it("extend Fields", () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: Schema.String
      }) {}

      expect(new E({ a: "a" })).type.toBe<E>()
      expect(E.makeUnsafe({ a: "a" })).type.toBe<E>()
      expect(Schema.revealCodec(E)).type.toBe<Schema.Codec<E, { readonly a: string }>>()

      expect(Effect.gen(function*() {
        return yield* new E({ a: "a" })
      })).type.toBe<Effect.Effect<never, E>>()
    })

    it("extend Struct", () => {
      class E extends Schema.ErrorClass<E>("E")(Schema.Struct({
        a: Schema.String
      })) {}

      expect(new E({ a: "a" })).type.toBe<E>()
      expect(E.makeUnsafe({ a: "a" })).type.toBe<E>()
      expect(Schema.revealCodec(E)).type.toBe<Schema.Codec<E, { readonly a: string }>>()

      expect(Effect.gen(function*() {
        return yield* new E({ a: "a" })
      })).type.toBe<Effect.Effect<never, E>>()
    })

    it("should reject non existing props", () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: Schema.String
      }) {}

      expect(E).type.not.toBeConstructableWith({ a: "a", b: "b" })
      expect(E.makeUnsafe).type.not.toBeCallableWith({ a: "a", b: "b" })
    })

    it("mutable field", () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: Schema.String.pipe(Schema.mutableKey)
      }) {}

      expect(Schema.revealCodec(E)).type.toBe<Schema.Codec<E, { a: string }>>()
    })
  })

  describe("brand", () => {
    it("brand", () => {
      const schema = Schema.Number.pipe(Schema.brand("MyBrand"))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<number & Brand.Brand<"MyBrand">, number, never, never>
      >()
      expect(schema).type.toBe<Schema.refine<number & Brand.Brand<"MyBrand">, Schema.Number>>()
      expect(schema.annotate({})).type.toBe<Schema.refine<number & Brand.Brand<"MyBrand">, Schema.Number>>()
    })

    it("double brand", () => {
      const schema = Schema.Number.pipe(Schema.brand("MyBrand"), Schema.brand("MyBrand2"))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<number & Brand.Brand<"MyBrand"> & Brand.Brand<"MyBrand2">, number, never, never>
      >()
      expect(schema).type.toBe<
        Schema.refine<
          number & Brand.Brand<"MyBrand"> & Brand.Brand<"MyBrand2">,
          Schema.refine<number & Brand.Brand<"MyBrand">, Schema.Number>
        >
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.refine<
          number & Brand.Brand<"MyBrand"> & Brand.Brand<"MyBrand2">,
          Schema.refine<number & Brand.Brand<"MyBrand">, Schema.Number>
        >
      >()
    })
  })

  it("decodeTo as composition", () => {
    const From = Schema.Struct({
      a: Schema.String,
      b: Schema.FiniteFromString
    })

    const To = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.UndefinedOr(Schema.Number)
    })

    const schema = From.pipe(Schema.decodeTo(To))

    expect(Schema.revealCodec(schema)).type.toBe<
      Schema.Codec<
        { readonly a: number; readonly b: number | undefined },
        { readonly a: string; readonly b: string },
        never,
        never
      >
    >()
    expect(schema).type.toBe<
      Schema.compose<
        Schema.Struct<
          { readonly a: Schema.FiniteFromString; readonly b: Schema.Union<readonly [Schema.Number, Schema.Undefined]> }
        >,
        Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.FiniteFromString }>
      >
    >()
    expect(schema.annotate({})).type.toBe<
      Schema.compose<
        Schema.Struct<
          { readonly a: Schema.FiniteFromString; readonly b: Schema.Union<readonly [Schema.Number, Schema.Undefined]> }
        >,
        Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.FiniteFromString }>
      >
    >()
  })

  it("encodeTo as composition", () => {
    const From = Schema.Struct({
      a: Schema.String,
      b: Schema.FiniteFromString
    })

    const To = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.UndefinedOr(Schema.Number)
    })

    const schema = To.pipe(Schema.encodeTo(From))

    expect(Schema.revealCodec(schema)).type.toBe<
      Schema.Codec<
        { readonly a: number; readonly b: number | undefined },
        { readonly a: string; readonly b: string },
        never,
        never
      >
    >()
    expect(schema).type.toBe<
      Schema.compose<
        Schema.Struct<
          { readonly a: Schema.FiniteFromString; readonly b: Schema.Union<readonly [Schema.Number, Schema.Undefined]> }
        >,
        Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.FiniteFromString }>
      >
    >()
    expect(schema.annotate({})).type.toBe<
      Schema.compose<
        Schema.Struct<
          { readonly a: Schema.FiniteFromString; readonly b: Schema.Union<readonly [Schema.Number, Schema.Undefined]> }
        >,
        Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.FiniteFromString }>
      >
    >()
  })

  it("is", () => {
    const is = Schema.is(Schema.String)
    const u = hole<unknown>()
    if (is(u)) {
      expect(u).type.toBe<string>()
    }
    const sn = hole<string| number>()
    if (is(sn)) {
      expect(sn).type.toBe<string>()
    }
    const struct = Schema.Struct({ a: Schema.String })
    const isStruct = Schema.is(struct)
    const s = hole<{ b: string }>()
    if (isStruct(s)) {
      expect(s).type.toBe<{ b: string } & { readonly a: string }>()
    }
    const schema = Schema.Array(Schema.String).pipe(
      Schema.refineByGuard(
        (arr): arr is readonly [string, string, ...Array<string>] => arr.length >= 2
      )
    )
    expect(schema).type.toBe<Schema.refine<readonly [string, string, ...Array<string>], Schema.Array$<Schema.String>>>()
  })

  it("asserts", () => {
    const schema = Schema.String
    const asserts: Schema.Codec.ToAsserts<typeof schema> = Schema.asserts(schema)
    const u = hole<unknown>()
    {
      asserts(u)
      expect(u).type.toBe<string>()
    }
    const sn = hole<string| number>()
    {
      asserts(sn)
      expect(sn).type.toBe<string>()
    }
    const struct = Schema.Struct({ a: Schema.String })
    const assertsStruct: Schema.Codec.ToAsserts<typeof struct> = Schema.asserts(struct)
    const s = hole<{ b: string }>()
    {
      assertsStruct(s)
      expect(s).type.toBe<{ b: string } & { readonly a: string }>()
    }
  })

  it("TemplateLiteralParser", () => {
    expect(Schema.revealCodec(Schema.TemplateLiteralParser(["a"])))
      .type.toBe<Schema.Codec<readonly ["a"], "a">>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Literal("a")])))
      .type.toBe<Schema.Codec<readonly ["a"], "a">>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([1])))
      .type.toBe<Schema.Codec<readonly [1], "1">>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Literal(1)])))
      .type.toBe<Schema.Codec<readonly [1], "1">>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String])))
      .type.toBe<Schema.Codec<readonly [string], string>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Number])))
      .type.toBe<Schema.Codec<readonly [number], `${number}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser(["a", "b"])))
      .type.toBe<Schema.Codec<readonly ["a", "b"], "ab">>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Literal("a"), Schema.Literal("b")])))
      .type.toBe<Schema.Codec<readonly ["a", "b"], "ab">>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser(["a", Schema.String])))
      .type.toBe<Schema.Codec<readonly ["a", string], `a${string}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Literal("a"), Schema.String])))
      .type.toBe<Schema.Codec<readonly ["a", string], `a${string}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser(["a", Schema.Number])))
      .type.toBe<Schema.Codec<readonly ["a", number], `a${number}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Literal("a"), Schema.Number])))
      .type.toBe<Schema.Codec<readonly ["a", number], `a${number}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, "a"])))
      .type.toBe<Schema.Codec<readonly [string, "a"], `${string}a`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, Schema.Literal("a")])))
      .type.toBe<Schema.Codec<readonly [string, "a"], `${string}a`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Number, "a"])))
      .type.toBe<Schema.Codec<readonly [number, "a"], `${number}a`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Number, Schema.Literal("a")])))
      .type.toBe<Schema.Codec<readonly [number, "a"], `${number}a`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, 0])))
      .type.toBe<Schema.Codec<readonly [string, 0], `${string}0`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, "true"])))
      .type.toBe<Schema.Codec<readonly [string, "true"], `${string}true`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, "null"])))
      .type.toBe<Schema.Codec<readonly [string, "null"], `${string}null`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, 1n])))
      .type.toBe<Schema.Codec<readonly [string, 1n], `${string}1`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, Schema.Literals(["a", 0])])))
      .type.toBe<Schema.Codec<readonly [string, 0 | "a"], `${string}a` | `${string}0`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, Schema.Literal("/"), Schema.Number])))
      .type.toBe<Schema.Codec<readonly [string, "/", number], `${string}/${number}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String, "/", Schema.Number])))
      .type.toBe<Schema.Codec<readonly [string, "/", number], `${string}/${number}`>>()
    const EmailLocaleIDs = Schema.Literals(["welcome_email", "email_heading"])
    const FooterLocaleIDs = Schema.Literals(["footer_title", "footer_sendoff"])
    expect(
      Schema.revealCodec(
        Schema.TemplateLiteralParser([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), Schema.Literal("_id")])
      )
    )
      .type.toBe<
      Schema.Codec<
        readonly ["welcome_email" | "email_heading" | "footer_title" | "footer_sendoff", "_id"],
        "welcome_email_id" | "email_heading_id" | "footer_title_id" | "footer_sendoff_id",
        never
      >
    >()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), "_id"])))
      .type.toBe<
      Schema.Codec<
        readonly ["welcome_email" | "email_heading" | "footer_title" | "footer_sendoff", "_id"],
        "welcome_email_id" | "email_heading_id" | "footer_title_id" | "footer_sendoff_id",
        never
      >
    >()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.String.pipe(Schema.brand("MyBrand"))])))
      .type.toBe<Schema.Codec<readonly [string & Brand.Brand<"MyBrand">], string>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser([Schema.Number.pipe(Schema.brand("MyBrand"))])))
      .type.toBe<Schema.Codec<readonly [number & Brand.Brand<"MyBrand">], `${number}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser(["a", Schema.String.pipe(Schema.brand("MyBrand"))])))
      .type.toBe<Schema.Codec<readonly ["a", string & Brand.Brand<"MyBrand">], `a${string}`>>()
    expect(
      Schema.revealCodec(
        Schema.TemplateLiteralParser([Schema.Literal("a"), Schema.String.pipe(Schema.brand("MyBrand"))])
      )
    )
      .type.toBe<Schema.Codec<readonly ["a", string & Brand.Brand<"MyBrand">], `a${string}`>>()
    expect(
      Schema.revealCodec(
        Schema.TemplateLiteralParser([
          Schema.Literal("a").pipe(Schema.brand("L")),
          Schema.String.pipe(Schema.brand("MyBrand"))
        ])
      )
    ).type.toBe<
      Schema.Codec<readonly [("a" & Brand.Brand<"L">), string & Brand.Brand<"MyBrand">], `a${string}`>
    >()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser(["a", Schema.Number.pipe(Schema.brand("MyBrand"))])))
      .type.toBe<Schema.Codec<readonly ["a", number & Brand.Brand<"MyBrand">], `a${number}`>>()
    expect(
      Schema.revealCodec(
        Schema.TemplateLiteralParser([Schema.Literal("a"), Schema.Number.pipe(Schema.brand("MyBrand"))])
      )
    )
      .type.toBe<Schema.Codec<readonly ["a", number & Brand.Brand<"MyBrand">], `a${number}`>>()
    expect(Schema.revealCodec(Schema.TemplateLiteralParser(["a", Schema.Union([Schema.Number, Schema.String])])))
      .type.toBe<Schema.Codec<readonly ["a", string | number], `a${string}` | `a${number}`>>()
  })

  describe("StructWithRest", () => {
    it("Record(String, Number)", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.Record(Schema.String, Schema.Number)]
      )

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: number; readonly [x: string]: number },
          { readonly a: number; readonly [x: string]: number },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.StructWithRest<
          Schema.Struct<{ readonly a: Schema.Number }>,
          readonly [Schema.Record$<Schema.String, Schema.Number>]
        >
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.StructWithRest<
          Schema.Struct<{ readonly a: Schema.Number }>,
          readonly [Schema.Record$<Schema.String, Schema.Number>]
        >
      >()
    })
  })

  describe("TupleWithRest", () => {
    it("Tuple([FiniteFromString, String]) + [Boolean, String]", () => {
      const schema = Schema.TupleWithRest(
        Schema.Tuple([Schema.FiniteFromString, Schema.String]),
        [Schema.Boolean, Schema.String]
      )

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          readonly [number, string, ...Array<boolean>, string],
          readonly [string, string, ...Array<boolean>, string],
          never,
          never
        >
      >()
    })
  })

  describe("mutable", () => {
    it("Struct", () => {
      const schema = Schema.mutable(Schema.Struct({ a: Schema.Number }))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a: number }, { a: number }, never, never>
      >()
      expect(schema).type.toBe<Schema.mutable<Schema.Struct<{ readonly a: Schema.Number }>>>()
      expect(schema.annotate({})).type.toBe<Schema.mutable<Schema.Struct<{ readonly a: Schema.Number }>>>()
    })

    it("Record", () => {
      const schema = Schema.mutable(Schema.Record(Schema.String, Schema.Number))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ [x: string]: number }, { [x: string]: number }, never>
      >()
      expect(schema).type.toBe<Schema.mutable<Schema.Record$<Schema.String, Schema.Number>>>()
      expect(schema.annotate({})).type.toBe<Schema.mutable<Schema.Record$<Schema.String, Schema.Number>>>()
    })

    it("Tuple", () => {
      const schema = Schema.mutable(Schema.Tuple([Schema.String, Schema.FiniteFromString]))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<[string, number], [string, string], never, never>
      >()
      expect(schema).type.toBe<
        Schema.mutable<Schema.Tuple<readonly [Schema.String, Schema.FiniteFromString]>>
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.mutable<Schema.Tuple<readonly [Schema.String, Schema.FiniteFromString]>>
      >()
      expect(schema.makeUnsafe).type.toBe<
        (input: readonly [string, number], options?: Schema.MakeOptions | undefined) => [string, number]
      >()
    })

    it("Array", () => {
      const schema = Schema.mutable(Schema.Array(FiniteFromString))
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<Array<number>, Array<string>>>()
      expect(schema).type.toBe<Schema.mutable<Schema.Array$<typeof FiniteFromString>>>()
      expect(schema.annotate({})).type.toBe<Schema.mutable<Schema.Array$<typeof FiniteFromString>>>()

      expect(schema.schema.schema).type.toBe<typeof FiniteFromString>()
    })

    it("NonEmptyArray", () => {
      const schema = Schema.mutable(Schema.NonEmptyArray(FiniteFromString))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<[number, ...Array<number>], [string, ...Array<string>]>
      >()
      expect(schema).type.toBe<Schema.mutable<Schema.NonEmptyArray<typeof FiniteFromString>>>()
      expect(schema.annotate({})).type.toBe<Schema.mutable<Schema.NonEmptyArray<typeof FiniteFromString>>>()

      expect(schema.schema.schema).type.toBe<typeof FiniteFromString>()
    })

    it("StructWithRest", async () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.Number }),
        [Schema.mutable(Schema.Record(Schema.String, Schema.Number))]
      )

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: number; [x: string]: number },
          { readonly a: number; [x: string]: number },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.StructWithRest<
          Schema.Struct<{ readonly a: Schema.Number }>,
          readonly [Schema.mutable<Schema.Record$<Schema.String, Schema.Number>>]
        >
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.StructWithRest<
          Schema.Struct<{ readonly a: Schema.Number }>,
          readonly [Schema.mutable<Schema.Record$<Schema.String, Schema.Number>>]
        >
      >()
    })
  })

  describe("readonly", () => {
    it("Struct", () => {
      const schema = Schema.readonly(Schema.mutable(Schema.Struct({ a: Schema.Number })))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: number }, { readonly a: number }, never, never>
      >()
    })

    it("Record", () => {
      const schema = Schema.readonly(Schema.mutable(Schema.Record(Schema.String, Schema.Number)))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number }, { readonly [x: string]: number }, never>
      >()
    })

    it("Tuple", () => {
      const schema = Schema.readonly(Schema.mutable(Schema.Tuple([Schema.String, Schema.FiniteFromString])))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string, number], readonly [string, string], never, never>
      >()
    })

    it("Array", () => {
      const schema = Schema.readonly(Schema.mutable(Schema.Array(FiniteFromString)))
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<ReadonlyArray<number>, ReadonlyArray<string>>>()
    })

    it("NonEmptyArray", () => {
      const schema = Schema.readonly(Schema.mutable(Schema.NonEmptyArray(FiniteFromString)))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [number, ...Array<number>], readonly [string, ...Array<string>]>
      >()
    })

    it("StructWithRest", async () => {
      const schema = Schema.readonly(Schema.StructWithRest(
        Schema.mutable(Schema.Struct({ a: Schema.Number })),
        [Schema.mutable(Schema.Record(Schema.String, Schema.Number))]
      ))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: number; readonly [x: string]: number },
          { readonly a: number; readonly [x: string]: number },
          never,
          never
        >
      >()
    })
  })

  describe("withConstructorDefault", () => {
    it("should be possible to access the original schema", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("a")))
      })

      expect(schema.fields.a.schema).type.toBe<Schema.String>()
    })

    it("effectful", () => {
      const service = hole<ServiceMap.Service<"Tag", "-">>()

      const schema = Schema.String.pipe(Schema.withConstructorDefault(() =>
        Effect.gen(function*() {
          yield* Effect.serviceOption(service)
          return Option.some("some-result")
        })
      ))

      expect(schema.makeUnsafe).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()

      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never, never>>()
    })
  })

  describe("Struct.mapFields", () => {
    describe("merge", () => {
      it("non-overlapping fields", () => {
        const schema = Schema.Struct({ a: Schema.String }).mapFields(Struct.merge({ b: Schema.String }))
        expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.String }>>()
      })

      it("overlapping fields", () => {
        const schema = Schema.Struct({ a: Schema.String, b: Schema.String }).mapFields(
          Struct.merge({ b: Schema.Number, c: Schema.Number })
        )
        expect(schema).type.toBe<
          Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.Number; readonly c: Schema.Number }>
        >()
      })
    })

    it("evolve", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolve({ a: (v) => Schema.optionalKey(v) }))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number; readonly a?: string },
          { readonly b: number; readonly a?: string },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.optionalKey<Schema.String>; readonly b: Schema.Number }>
      >()
    })

    it("evolveKeys", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolveKeys({ a: (k) => Str.toUpperCase(k) }))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number; readonly A: string },
          { readonly b: number; readonly A: string },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly A: Schema.String; readonly b: Schema.Number }>
      >()
    })

    it("renameKeys", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number,
        c: Schema.Boolean
      }).mapFields(Struct.renameKeys({ a: "A", b: "B" }))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly B: number; readonly A: string; readonly c: boolean },
          { readonly B: number; readonly A: string; readonly c: boolean },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly A: Schema.String; readonly B: Schema.Number; readonly c: Schema.Boolean }>
      >()
    })

    it("evolveEntries", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.evolveEntries({ a: (k, v) => [Str.toUpperCase(k), Schema.optionalKey(v)] }))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number; readonly A?: string },
          { readonly b: number; readonly A?: string },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly A: Schema.optionalKey<Schema.String>; readonly b: Schema.Number }>
      >()
    })

    it("typeCodec", () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.typeCodec))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: number; readonly b: number },
          { readonly a: number; readonly b: number },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<
          { readonly a: Schema.typeCodec<Schema.FiniteFromString>; readonly b: Schema.typeCodec<Schema.Number> }
        >
      >()
    })

    it("encodedCodec", () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.encodedCodec))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: string; readonly b: number },
          { readonly a: string; readonly b: number },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<
          { readonly a: Schema.encodedCodec<Schema.FiniteFromString>; readonly b: Schema.encodedCodec<Schema.Number> }
        >
      >()
    })

    it("optionalKey", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.optionalKey))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b?: number; readonly a?: string },
          { readonly b?: number; readonly a?: string },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.optionalKey<Schema.String>; readonly b: Schema.optionalKey<Schema.Number> }>
      >()
    })

    it("mapPick", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.mapPick(["a"], Schema.optionalKey))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number; readonly a?: string },
          { readonly b: number; readonly a?: string },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.optionalKey<Schema.String>; readonly b: Schema.Number }>
      >()
    })

    it("mapOmit", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.mapOmit(["b"], Schema.optionalKey))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number; readonly a?: string },
          { readonly b: number; readonly a?: string },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.optionalKey<Schema.String>; readonly b: Schema.Number }>
      >()
    })

    it("optional", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.optional))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b?: number | undefined; readonly a?: string | undefined },
          { readonly b?: number | undefined; readonly a?: string | undefined },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.optional<Schema.String>; readonly b: Schema.optional<Schema.Number> }>
      >()
    })

    it("mutableKey", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.mutableKey))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a: string; b: number }, { a: string; b: number }, never, never>
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.mutableKey<Schema.String>; readonly b: Schema.mutableKey<Schema.Number> }>
      >()
    })

    it("mutable", () => {
      const schema = Schema.Struct({
        a: Schema.Array(Schema.String),
        b: Schema.Tuple([Schema.Number])
      }).mapFields(Struct.map(Schema.mutable))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: Array<string>; readonly b: [number] },
          { readonly a: Array<string>; readonly b: [number] },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.mutable<Schema.Array$<Schema.String>>
            readonly b: Schema.mutable<Schema.Tuple<readonly [Schema.Number]>>
          }
        >
      >()
    })

    it("readonly", () => {
      const schema = Schema.Struct({
        a: Schema.Array(Schema.String),
        b: Schema.Tuple([Schema.Number])
      }).mapFields(Struct.map(Schema.mutable))
        .mapFields(Struct.map(Schema.readonly))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: ReadonlyArray<string>; readonly b: readonly [number] },
          { readonly a: ReadonlyArray<string>; readonly b: readonly [number] },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.readonly$<Schema.mutable<Schema.Array$<Schema.String>>>
            readonly b: Schema.readonly$<Schema.mutable<Schema.Tuple<readonly [Schema.Number]>>>
          }
        >
      >()
    })

    it("NullOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.NullOr))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number | null; readonly a: string | null },
          { readonly b: number | null; readonly a: string | null },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.NullOr<Schema.String>; readonly b: Schema.NullOr<Schema.Number> }>
      >()
    })

    it("UndefinedOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.UndefinedOr))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number | undefined; readonly a: string | undefined },
          { readonly b: number | undefined; readonly a: string | undefined },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.UndefinedOr<Schema.String>; readonly b: Schema.UndefinedOr<Schema.Number> }>
      >()
    })

    it("NullishOr", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.NullishOr))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number | null | undefined; readonly a: string | null | undefined },
          { readonly b: number | null | undefined; readonly a: string | null | undefined },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.NullishOr<Schema.String>; readonly b: Schema.NullishOr<Schema.Number> }>
      >()
    })

    it("Array", () => {
      const schema = Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      }).mapFields(Struct.map(Schema.Array))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: ReadonlyArray<string>; readonly b: ReadonlyArray<number> },
          { readonly a: ReadonlyArray<string>; readonly b: ReadonlyArray<number> },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.Array$<Schema.String>; readonly b: Schema.Array$<Schema.Number> }>
      >()
    })

    it("should work with opaque structs", () => {
      class A extends Schema.Opaque<A>()(Schema.Struct({
        a: Schema.String,
        b: Schema.Number
      })) {}

      const schema = A.mapFields(Struct.map(Schema.Array))

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly a: ReadonlyArray<string>; readonly b: ReadonlyArray<number> },
          { readonly a: ReadonlyArray<string>; readonly b: ReadonlyArray<number> },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.Array$<Schema.String>; readonly b: Schema.Array$<Schema.Number> }>
      >()
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

      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          { readonly b: number | null; a: string | null; c: boolean | null },
          { readonly b: string | null; a: string | null; c: boolean | null },
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.mutableKey<Schema.NullOr<Schema.String>>
            readonly b: Schema.NullOr<Schema.FiniteFromString>
            readonly c: Schema.mutableKey<Schema.NullOr<Schema.Boolean>>
          }
        >
      >()
    })
  })

  describe("Tuple.mapElements", () => {
    it("appendElement", () => {
      const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.appendElement(Schema.Number))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string, number], readonly [string, number], never, never>
      >()
      expect(schema).type.toBe<Schema.Tuple<readonly [Schema.String, Schema.Number]>>()
    })

    it("appendElements", () => {
      const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.appendElements([Schema.Number, Schema.Boolean]))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string, number, boolean], readonly [string, number, boolean], never, never>
      >()
      expect(schema).type.toBe<Schema.Tuple<readonly [Schema.String, Schema.Number, Schema.Boolean]>>()
    })

    it("pick", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.pick([0, 2]))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string, boolean], readonly [string, boolean], never, never>
      >()
      expect(schema).type.toBe<Schema.Tuple<readonly [Schema.String, Schema.Boolean]>>()
    })

    it("omit", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(Tuple.omit([1]))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string, boolean], readonly [string, boolean], never, never>
      >()
      expect(schema).type.toBe<Schema.Tuple<readonly [Schema.String, Schema.Boolean]>>()
    })

    describe("evolve", () => {
      it("readonly [string] -> readonly [string?]", () => {
        const schema = Schema.Tuple([Schema.String]).mapElements(Tuple.evolve([(v) => Schema.optionalKey(v)]))
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<readonly [string?], readonly [string?], never, never>
        >()
        expect(schema).type.toBe<Schema.Tuple<readonly [Schema.optionalKey<Schema.String>]>>()
      })

      it("readonly [string, number] -> readonly [string, number?]", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(
          Tuple.evolve([undefined, (v) => Schema.optionalKey(v)])
        )
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<readonly [string, number?], readonly [string, number?], never, never>
        >()
        expect(schema).type.toBe<
          Schema.Tuple<readonly [Schema.String, Schema.optionalKey<Schema.Number>]>
        >()
      })
    })

    describe("renameIndices", () => {
      it("partial index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["1", "0"])
        )
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<readonly [number, string, boolean], readonly [number, string, boolean], never, never>
        >()
        expect(schema).type.toBe<Schema.Tuple<readonly [Schema.Number, Schema.String, Schema.Boolean]>>()
      })

      it("full index mapping", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
          Tuple.renameIndices(["2", "1", "0"])
        )
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<readonly [boolean, number, string], readonly [boolean, number, string], never, never>
        >()
        expect(schema).type.toBe<Schema.Tuple<readonly [Schema.Boolean, Schema.Number, Schema.String]>>()
      })
    })

    it("optionalKey", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(Tuple.map(Schema.optionalKey))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string?, number?], readonly [string?, number?], never, never>
      >()
      expect(schema).type.toBe<
        Schema.Tuple<readonly [Schema.optionalKey<Schema.String>, Schema.optionalKey<Schema.Number>]>
      >()
    })

    it("NullOr", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number]).mapElements(Tuple.map(Schema.NullOr))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string | null, number | null], readonly [string | null, number | null], never, never>
      >()
      expect(schema).type.toBe<
        Schema.Tuple<readonly [Schema.NullOr<Schema.String>, Schema.NullOr<Schema.Number>]>
      >()
    })

    it("mapPick", () => {
      const schema = Schema.Tuple([Schema.String, Schema.Number, Schema.Boolean]).mapElements(
        Tuple.mapPick([0, 2], Schema.NullOr)
      )
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          readonly [string | null, number, boolean | null],
          readonly [string | null, number, boolean | null],
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Tuple<readonly [Schema.NullOr<Schema.String>, Schema.Number, Schema.NullOr<Schema.Boolean>]>
      >()
    })
  })

  describe("Union.mapMembers", () => {
    it("appendElement", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.appendElement(Schema.Boolean))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<string | number | boolean, string | number | boolean, never, never>
      >()
      expect(schema).type.toBe<Schema.Union<readonly [Schema.String, Schema.Number, Schema.Boolean]>>()
    })

    it("evolve", () => {
      const schema = Schema.Union([Schema.String, Schema.Number, Schema.Boolean]).mapMembers(
        Tuple.evolve([
          (v) => Schema.Array(v),
          undefined,
          (v) => Schema.Array(v)
        ])
      )
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          ReadonlyArray<string> | number | ReadonlyArray<boolean>,
          ReadonlyArray<string> | number | ReadonlyArray<boolean>,
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Union<readonly [Schema.Array$<Schema.String>, Schema.Number, Schema.Array$<Schema.Boolean>]>
      >()
    })

    it("Array", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.map(Schema.Array))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          ReadonlyArray<string> | ReadonlyArray<number>,
          ReadonlyArray<string> | ReadonlyArray<number>,
          never,
          never
        >
      >()
      expect(schema).type.toBe<Schema.Union<readonly [Schema.Array$<Schema.String>, Schema.Array$<Schema.Number>]>>()
    })

    it("NonEmptyArray", () => {
      const schema = Schema.Union([Schema.String, Schema.Number]).mapMembers(Tuple.map(Schema.NonEmptyArray))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<
          Array.NonEmptyReadonlyArray<string> | Array.NonEmptyReadonlyArray<number>,
          Array.NonEmptyReadonlyArray<string> | Array.NonEmptyReadonlyArray<number>,
          never,
          never
        >
      >()
      expect(schema).type.toBe<
        Schema.Union<readonly [Schema.NonEmptyArray<Schema.String>, Schema.NonEmptyArray<Schema.Number>]>
      >()
    })
  })

  it("Literals", () => {
    const schema = Schema.Literals(["a", "b", "c"])

    expect(schema.literals).type.toBe<readonly ["a", "b", "c"]>()
    expect(schema.members).type.toBe<
      readonly [Schema.Literal<"a">, Schema.Literal<"b">, Schema.Literal<"c">]
    >()

    expect(Schema.revealCodec(schema)).type.toBe<
      Schema.Codec<"a" | "b" | "c", "a" | "b" | "c", never, never>
    >()
    expect(schema).type.toBe<Schema.Literals<readonly ["a", "b", "c"]>>()
    expect(schema.annotate({})).type.toBe<Schema.Literals<readonly ["a", "b", "c"]>>()

    expect(schema).type.toBeAssignableTo<
      Schema.Union<readonly [Schema.Literal<"a">, Schema.Literal<"b">, Schema.Literal<"c">]>
    >()
  })

  it("Literals.mapMembers", () => {
    const schema = Schema.Literals(["a", "b", "c"]).mapMembers(Tuple.evolve([
      (a) => Schema.Struct({ _tag: a, a: Schema.String }),
      (b) => Schema.Struct({ _tag: b, b: Schema.Number }),
      (c) => Schema.Struct({ _tag: c, c: Schema.Boolean })
    ]))

    expect(Schema.revealCodec(schema)).type.toBe<
      Schema.Codec<
        { readonly _tag: "a"; readonly a: string } | { readonly _tag: "b"; readonly b: number } | {
          readonly _tag: "c"
          readonly c: boolean
        },
        { readonly _tag: "a"; readonly a: string } | { readonly _tag: "b"; readonly b: number } | {
          readonly _tag: "c"
          readonly c: boolean
        },
        never,
        never
      >
    >()
  })

  it("encodeKeys", () => {
    const schema = Schema.Struct({
      a: Schema.FiniteFromString,
      b: Schema.String
    }).pipe(Schema.encodeKeys({ a: "c" }))

    expect(schema).type.toBe<
      Schema.decodeTo<
        Schema.Struct<{
          readonly a: Schema.FiniteFromString
          readonly b: Schema.String
        }>,
        Schema.Struct<{
          readonly c: Schema.encodedCodec<Schema.FiniteFromString>
          readonly b: Schema.encodedCodec<Schema.String>
        }>
      >
    >()
  })

  it("tag", () => {
    const schema = Schema.tag("A")
    expect(schema).type.toBe<Schema.tag<"A">>()
    expect(schema.schema).type.toBe<Schema.Literal<"A">>()
    expect(schema.schema.literal).type.toBe<"A">()
  })

  it("TaggedStruct", () => {
    const schema = Schema.TaggedStruct("A", {
      a: Schema.String
    })

    expect(schema).type.toBe<
      Schema.TaggedStruct<"A", { readonly a: Schema.String }>
    >()
    expect(schema).type.toBe<
      Schema.Struct<{ readonly _tag: Schema.tag<"A">; } & { readonly a: Schema.String }>
    >()
    expect(schema.fields._tag.schema.literal).type.toBe<"A">()
  })

  describe("Tagged unions", () => {
    describe("asTaggedUnion", () => {
      it("should not be callable if the tag field is invalid", () => {
        const original = Schema.Union([
          Schema.TaggedStruct("A", { a: Schema.String }),
          Schema.TaggedStruct("C", { c: Schema.Boolean }),
          Schema.TaggedStruct("B", { b: Schema.FiniteFromString })
        ])

        expect(original.pipe).type.toBeCallableWith(Schema.asTaggedUnion("_tag"))
        expect(original.pipe).type.not.toBeCallableWith(Schema.asTaggedUnion("a"))

        const schema = original.pipe(Schema.asTaggedUnion("_tag"))

        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<
            | { readonly _tag: "A"; readonly a: string }
            | { readonly _tag: "B"; readonly b: number }
            | { readonly _tag: "C"; readonly c: boolean },
            | { readonly _tag: "A"; readonly a: string }
            | { readonly _tag: "B"; readonly b: string }
            | { readonly _tag: "C"; readonly c: boolean },
            never,
            never
          >
        >()

        // cases
        const { A, B, C } = schema.cases
        expect(B.fields._tag.schema.literal).type.toBe<"B">()
        expect(A.fields._tag.schema.literal).type.toBe<"A">()
        expect(C.fields._tag.schema.literal).type.toBe<"C">()
        expect(A).type.toBe<Schema.TaggedStruct<"A", { readonly a: Schema.String }>>()
        expect(B).type.toBe<Schema.TaggedStruct<"B", { readonly b: Schema.FiniteFromString }>>()
        expect(C).type.toBe<Schema.TaggedStruct<"C", { readonly c: Schema.Boolean }>>()
      })
    })

    describe("TaggedUnion", () => {
      it("should depends on the order of the cases", () => {
        const schema = Schema.TaggedUnion({
          A: { a: Schema.String },
          C: { c: Schema.Boolean },
          B: { b: Schema.FiniteFromString }
        }).annotate({})

        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<
            | { readonly _tag: "A"; readonly a: string }
            | { readonly _tag: "B"; readonly b: number }
            | { readonly _tag: "C"; readonly c: boolean },
            | { readonly _tag: "A"; readonly a: string }
            | { readonly _tag: "B"; readonly b: string }
            | { readonly _tag: "C"; readonly c: boolean },
            never,
            never
          >
        >()

        // cases
        const { A, B, C } = schema.cases
        expect(B.fields._tag.schema.literal).type.toBe<"B">()
        expect(A.fields._tag.schema.literal).type.toBe<"A">()
        expect(C.fields._tag.schema.literal).type.toBe<"C">()
        expect(A).type.toBe<Schema.TaggedStruct<"A", { readonly a: Schema.String }>>()
        expect(B).type.toBe<Schema.TaggedStruct<"B", { readonly b: Schema.FiniteFromString }>>()
        expect(C).type.toBe<Schema.TaggedStruct<"C", { readonly c: Schema.Boolean }>>()
      })
    })
  })

  it("withDecodingDefaultKey", () => {
    const schema = Schema.Struct({
      a: Schema.FiniteFromString.pipe(Schema.withDecodingDefaultKey(() => "1"))
    })

    expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.withDecodingDefaultKey<Schema.FiniteFromString> }>>()
    expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: number }, { readonly a?: string }, never, never>
      >()
  })

  it("withDecodingDefault", () => {
    const schema = Schema.Struct({
      a: Schema.FiniteFromString.pipe(Schema.withDecodingDefault(() => "1"))
    })

    expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.withDecodingDefault<Schema.FiniteFromString> }>>()
    expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: number }, { readonly a?: string | undefined }, never, never>
      >()
  })

  it("annotateKey", () => {
    expect(Schema.String.annotateKey).type.toBeCallableWith(
      { examples: ['a'] }
    )
    expect(Schema.String.annotateKey).type.not.toBeCallableWith(
      { examples: [1] }
    )
    expect(Schema.String.annotateKey).type.toBeCallableWith(
      { default: "a" }
    )
    expect(Schema.String.annotateKey).type.not.toBeCallableWith(
      { default: 1 }
    )
  })
})
