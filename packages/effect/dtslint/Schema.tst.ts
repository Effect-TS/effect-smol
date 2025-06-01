import type { Brand, Context } from "effect"
import {
  Effect,
  hole,
  Option,
  Predicate,
  Schema,
  SchemaAST,
  SchemaCheck,
  SchemaGetter,
  SchemaTransformation
} from "effect"
import { describe, expect, it, when } from "tstyche"

const revealClass = <Self, S extends Schema.Struct<Schema.Struct.Fields>, Inherited>(
  klass: Schema.Class<Self, S, Inherited>
): Schema.Class<Self, S, Inherited> => klass

const FiniteFromString = Schema.String.pipe(Schema.decodeTo(
  Schema.Finite,
  new SchemaTransformation.SchemaTransformation(
    SchemaGetter.Number(),
    SchemaGetter.String()
  )
))

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    new SchemaTransformation.SchemaTransformation(
      SchemaGetter.Number(),
      SchemaGetter.String()
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

  describe("makeSync", () => {
    type MakeSync<In, Out> = (input: In, options?: Schema.MakeOptions | undefined) => Out

    it("Never", () => {
      const schema = Schema.Never
      expect(schema.makeSync).type.toBe<MakeSync<never, never>>()
    })

    it("Unknown", () => {
      const schema = Schema.Unknown
      expect(schema.makeSync).type.toBe<MakeSync<unknown, unknown>>()
    })

    it("Any", () => {
      const schema = Schema.Any
      expect(schema.makeSync).type.toBe<MakeSync<any, any>>()
    })

    it("Null", () => {
      const schema = Schema.Null
      expect(schema.makeSync).type.toBe<MakeSync<null, null>>()
    })

    it("Undefined", () => {
      const schema = Schema.Undefined
      expect(schema.makeSync).type.toBe<MakeSync<undefined, undefined>>()
    })

    it("String", () => {
      const schema = Schema.String
      expect(schema.makeSync).type.toBe<MakeSync<string, string>>()
    })

    it("Number", () => {
      const schema = Schema.Number
      expect(schema.makeSync).type.toBe<MakeSync<number, number>>()
    })

    it("check", () => {
      const schema = Schema.String.check(SchemaCheck.minLength(1))
      expect(schema.makeSync).type.toBe<MakeSync<string, string>>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.makeSync).type.toBe<MakeSync<string, string & Brand.Brand<"a">>>()
    })

    it("guard", () => {
      const schema = Schema.Option(Schema.String).pipe(Schema.guard(Option.isSome))
      expect(schema.makeSync).type.toBe<MakeSync<Option.Option<string>, Option.Some<string>>>()
    })

    describe("Struct", () => {
      it("simple field", () => {
        const schema = Schema.Struct({
          a: Schema.String
        })
        expect(schema.makeSync).type.toBe<MakeSync<{ readonly a: string }, { readonly a: string }>>()
      })

      it("branded field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.brand("a"))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a: string & Brand.Brand<"a"> }, { readonly a: string & Brand.Brand<"a"> }>
        >()
      })

      it("guarded field", () => {
        const schema = Schema.Struct({
          a: Schema.Option(Schema.String).pipe(Schema.guard(Option.isSome))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a: Option.Some<string> }, { readonly a: Option.Some<string> }>
        >()
      })

      it("defaulted field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("default")))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a?: string }, { readonly a: string }>
        >()
      })

      it("branded defaulted field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.brand("a"), Schema.withConstructorDefault(() => Option.some("default")))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a?: string & Brand.Brand<"a"> }, { readonly a: string & Brand.Brand<"a"> }>
        >()
      })

      it("defaulted branded field", () => {
        const schema = Schema.Struct({
          a: Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("default")), Schema.brand("a"))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a?: string & Brand.Brand<"a"> }, { readonly a: string & Brand.Brand<"a"> }>
        >()
      })

      it("nested defaulted fields", () => {
        const schema = Schema.Struct({
          a: Schema.Struct({
            b: Schema.Finite.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
          }).pipe(Schema.withConstructorDefault(() => Option.some({})))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a?: { readonly b?: number } }, { readonly a: { readonly b: number } }>
        >()
      })

      it("nested defaulted & branded field", () => {
        const A = Schema.Struct({
          b: Schema.Finite.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
        }).pipe(Schema.brand("a"))
        const schema = Schema.Struct({
          a: A.pipe(Schema.withConstructorDefault(() => Option.some(A.makeSync({}))))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<
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
        expect(schema.makeSync).type.toBe<MakeSync<{ readonly a: A }, { readonly a: A }>>()
      })

      it("optional Class field", () => {
        class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
          a: Schema.String
        })) {}
        const schema = Schema.Struct({
          a: A.pipe(Schema.withConstructorDefault(() => Option.some(new A({ a: "default" }))))
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a?: A }, { readonly a: A }>
        >()
      })
    })

    describe("Tuple", () => {
      it("simple element", () => {
        const schema = Schema.Tuple([Schema.String])
        expect(schema.makeSync).type.toBe<MakeSync<readonly [string], readonly [string]>>()
      })

      it("branded field", () => {
        const schema = Schema.Tuple([Schema.String.pipe(Schema.brand("a"))])
        expect(schema.makeSync).type.toBe<
          MakeSync<readonly [string & Brand.Brand<"a">], readonly [string & Brand.Brand<"a">]>
        >()
      })

      it("defaulted field", () => {
        const schema = Schema.Tuple([Schema.String.pipe(Schema.withConstructorDefault(() => Option.some("default")))])
        expect(schema.makeSync).type.toBe<MakeSync<readonly [string?], readonly [string]>>()
      })

      it("nested defaults (Struct)", () => {
        const schema = Schema.Tuple(
          [
            Schema.Struct({
              b: Schema.FiniteFromString.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
            }).pipe(Schema.withConstructorDefault(() => Option.some({})))
          ]
        )
        expect(schema.makeSync).type.toBe<
          MakeSync<readonly [{ readonly b?: number }?], readonly [{ readonly b: number }]>
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
        expect(schema.makeSync).type.toBe<MakeSync<readonly [(readonly [number?])?], readonly [readonly [number]]>>()
      })
    })

    describe("Class", () => {
      it("nested defaulted fields", () => {
        class A extends Schema.Class<A, { readonly brand: unique symbol }>("A")(Schema.Struct({
          a: Schema.Struct({
            b: Schema.Finite.pipe(Schema.withConstructorDefault(() => Option.some(-1)))
          }).pipe(Schema.withConstructorDefault(() => Option.some({})))
        })) {}
        expect(A.makeSync).type.toBe<
          MakeSync<{ readonly a?: { readonly b?: number } }, A>
        >()
        const schema = Schema.Struct({
          a: A
        })
        expect(schema.makeSync).type.toBe<
          MakeSync<{ readonly a: A }, { readonly a: A }>
        >()
      })
    })

    it("typeCodec", () => {
      const schema = Schema.typeCodec(Schema.FiniteFromString)
      expect(schema.makeSync).type.toBe<(input: number, options?: Schema.MakeOptions | undefined) => number>()
    })

    it("encodedCodec", () => {
      const schema = Schema.encodedCodec(Schema.FiniteFromString)
      expect(schema.makeSync).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()
    })

    it("flip", () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString
      })
      const flipped = Schema.flip(schema)
      expect(flipped.makeSync).type.toBe<
        (input: { readonly a: string }, options?: Schema.MakeOptions | undefined) => { readonly a: string }
      >()
    })

    it("Array", () => {
      const schema = Schema.Array(Schema.FiniteFromString.pipe(Schema.brand("a")))
      expect(schema.makeSync).type.toBe<
        (
          input: ReadonlyArray<number & Brand.Brand<"a">>,
          options?: Schema.MakeOptions | undefined
        ) => ReadonlyArray<number & Brand.Brand<"a">>
      >()
    })

    it("Record", () => {
      const schema = Schema.Record(
        Schema.String.pipe(Schema.brand("k")),
        Schema.FiniteFromString.pipe(Schema.brand("a"))
      )
      expect(schema.makeSync).type.toBe<
        (
          input: { readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a"> },
          options?: Schema.MakeOptions | undefined
        ) => { readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a"> }
      >()
    })

    it("StructWithRest", () => {
      const schema = Schema.StructWithRest(
        Schema.Struct({ a: Schema.FiniteFromString.pipe(Schema.brand("a")) }),
        [Schema.Record(Schema.String.pipe(Schema.brand("k")), Schema.FiniteFromString.pipe(Schema.brand("a")))]
      )
      expect(schema.makeSync).type.toBe<
        (
          input: {
            readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a">
            readonly a: number & Brand.Brand<"a">
          },
          options?: Schema.MakeOptions | undefined
        ) => {
          readonly [x: string & Brand.Brand<"k">]: number & Brand.Brand<"a">
          readonly a: number & Brand.Brand<"a">
        }
      >()
    })

    it("TupleWithRest", () => {
      const schema = Schema.TupleWithRest(
        Schema.Tuple([Schema.FiniteFromString.pipe(Schema.brand("a"))]),
        [Schema.FiniteFromString.pipe(Schema.brand("b")), Schema.FiniteFromString.pipe(Schema.brand("c"))]
      )
      expect(schema.makeSync).type.toBe<
        (
          input: readonly [number & Brand.Brand<"a">, ...Array<number & Brand.Brand<"b">>, number & Brand.Brand<"c">],
          options?: Schema.MakeOptions | undefined
        ) => readonly [number & Brand.Brand<"a">, ...Array<number & Brand.Brand<"b">>, number & Brand.Brand<"c">]
      >()
    })

    it("Union", () => {
      const schema = Schema.Union([
        Schema.Array(Schema.FiniteFromString.pipe(Schema.brand("a"))),
        Schema.FiniteFromString.pipe(Schema.brand("b"))
      ])
      expect(schema.makeSync).type.toBe<
        (
          input: ReadonlyArray<number & Brand.Brand<"a">> | number & Brand.Brand<"b">,
          options?: Schema.MakeOptions | undefined
        ) => ReadonlyArray<number & Brand.Brand<"a">> | number & Brand.Brand<"b">
      >()
    })
  })

  describe("typeCodec", () => {
    it("ast type", () => {
      const schema = Schema.typeCodec(Schema.FiniteFromString)
      expect(schema.ast).type.toBe<SchemaAST.NumberKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.NumberKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.NeverKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.UnknownKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.NullKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.UndefinedKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.StringKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.NumberKeyword>()
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
      expect(schema.ast).type.toBe<SchemaAST.LiteralType>()
    })

    it("revealCodec + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<"a">>()
      expect(schema).type.toBe<Schema.Literal<"a">>()
    })
  })

  describe("Struct", () => {
    it("ast type", () => {
      const schema = Schema.Struct({ a: Schema.String })
      expect(schema.ast).type.toBe<SchemaAST.TypeLiteral>()
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
        Schema.Struct<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String, never, never> }>
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String, never, never> }>
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
      expect(schema.makeSync).type.toBe<
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
      expect(flipped).type.toBe<Schema.flip<Schema.decodeTo<Schema.Number, Schema.String, never, never>>>()
      expect(flipped.annotate({})).type.toBe<Schema.flip<Schema.decodeTo<Schema.Number, Schema.String, never, never>>>()
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
      expect(schema.makeSync).type.toBe<
        (input: { readonly a?: string }, options?: Schema.MakeOptions | undefined) => { readonly a: string }
      >()

      const flipped = schema.pipe(Schema.flip)
      expect(flipped.makeSync).type.toBe<
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

  describe("refinements", () => {
    describe("guard", () => {
      it("String & isString", () => {
        const schema = Schema.String.pipe(Schema.guard(Predicate.isString))
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<string, string, never, never>
        >()
      })

      it("String | Number & isString", () => {
        const schema = Schema.Union([Schema.String, Schema.Number]).pipe(
          Schema.guard(Predicate.isString)
        )
        expect(Schema.revealCodec(schema)).type.toBe<
          Schema.Codec<string, string | number, never, never>
        >()
      })

      it("Option(String) & isSome", () => {
        const schema = Schema.Option(Schema.String).pipe(Schema.guard(Option.isSome))
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
      const min2 = SchemaCheck.greaterThanOrEqualTo(2).pipe(SchemaCheck.brand("min2"))
      const int = SchemaCheck.int.pipe(SchemaCheck.brand("int"))

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

      expect(A.makeSync({ a: 1 })).type.toBe<A>()

      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<A, { readonly a: string }>>()
      expect(schema).type.toBe<typeof A>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String, never, never> }>
      >()
      expect(schema.ast).type.toBe<SchemaAST.TypeLiteral>()
      expect(schema.makeSync).type.toBe<
        (input: { readonly a: number }, options?: Schema.MakeOptions | undefined) => A
      >()
      expect(schema.fields).type.toBe<{ readonly a: Schema.decodeTo<Schema.Number, Schema.String, never, never> }>()

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
  })

  it("instanceOf", () => {
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
          new SchemaAST.Link(
            Schema.String.ast,
            SchemaTransformation.transform({
              decode: (e) => e.message,
              encode: (message) => new MyError(message)
            })
          )
      }
    })

    expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<MyError, MyError, never, never>>()
    expect(schema).type.toBe<Schema.instanceOf<MyError>>()
    expect(schema.annotate({})).type.toBe<Schema.instanceOf<MyError>>()
    expect(schema.ast).type.toBe<SchemaAST.Declaration>()
    expect(schema.makeSync).type.toBe<
      (input: MyError, options?: Schema.MakeOptions | undefined) => MyError
    >()
  })

  describe("extend", () => {
    it("Struct", () => {
      const schema = Schema.Struct({ a: Schema.String }).pipe(Schema.extend({ b: Schema.String }))
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.String }>>()
    })

    it("overlapping fields", () => {
      const schema = Schema.Struct({ a: Schema.String, b: Schema.String }).pipe(
        Schema.extend({ b: Schema.Number, c: Schema.Number })
      )
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.String; readonly b: Schema.Number; readonly c: Schema.Number }>
      >()
    })
  })

  describe("passthrough", () => {
    it("E = T", () => {
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.String.check(SchemaCheck.nonEmpty),
          SchemaTransformation.passthrough()
        )
      )
    })

    it("E != T", () => {
      when(Schema.String.pipe).isCalledWith(
        expect(Schema.decodeTo).type.not.toBeCallableWith(
          Schema.Number,
          SchemaTransformation.passthrough()
        )
      )

      Schema.String.pipe(
        Schema.decodeTo(
          Schema.Number,
          SchemaTransformation.passthrough({ strict: false })
        )
      )
    })

    it("E extends T", () => {
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.UndefinedOr(Schema.String),
          SchemaTransformation.passthroughSubtype()
        )
      )
    })

    it("T extends E", () => {
      Schema.UndefinedOr(Schema.String).pipe(
        Schema.decodeTo(
          Schema.String,
          SchemaTransformation.passthroughSupertype()
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
    it("extend Fields", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}

      expect(new A({ a: "a" })).type.toBe<A>()
      expect(A.makeSync({ a: "a" })).type.toBe<A>()
      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { readonly a: string }>>()
      expect(revealClass(A)).type.toBe<
        Schema.Class<A, Schema.Struct<{ readonly a: Schema.String }>, A>
      >()
      expect(A.fields).type.toBe<{ readonly a: Schema.String }>()
    })

    it("extend Struct", () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      expect(new A({ a: "a" })).type.toBe<A>()
      expect(A.makeSync({ a: "a" })).type.toBe<A>()
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
      expect(A.makeSync).type.not.toBeCallableWith({ a: "a", b: "b" })
    })

    it("mutable field", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String.pipe(Schema.mutableKey)
      }) {}

      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { a: string }>>()
    })

    it("branded", () => {
      class A extends Schema.Class<A>("A")({
        a: Schema.String
      }) {}
      class B extends Schema.Class<B>("B")({
        a: Schema.String
      }) {}

      const f = (a: A) => a

      f(A.makeSync({ a: "a" }))
      f(B.makeSync({ a: "a" }))

      class ABranded extends Schema.Class<ABranded, { readonly brand: unique symbol }>("ABranded")({
        a: Schema.String
      }) {}
      class BBranded extends Schema.Class<BBranded, { readonly brand: unique symbol }>("BBranded")({
        a: Schema.String
      }) {}

      const fABranded = (a: ABranded) => a

      fABranded(ABranded.makeSync({ a: "a" }))
      when(fABranded).isCalledWith(expect(BBranded.makeSync).type.not.toBeCallableWith({ a: "a" }))

      const fBBranded = (a: BBranded) => a

      fBBranded(BBranded.makeSync({ a: "a" }))
      when(fBBranded).isCalledWith(expect(ABranded.makeSync).type.not.toBeCallableWith({ a: "a" }))
    })
  })

  describe("Error", () => {
    it("extend Fields", () => {
      class E extends Schema.ErrorClass<E>("E")({
        a: Schema.String
      }) {}

      expect(new E({ a: "a" })).type.toBe<E>()
      expect(E.makeSync({ a: "a" })).type.toBe<E>()
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
      expect(E.makeSync({ a: "a" })).type.toBe<E>()
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
      expect(E.makeSync).type.not.toBeCallableWith({ a: "a", b: "b" })
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
      const schema = Schema.Number.pipe(Schema.brand("MyBrand")).pipe(Schema.brand("MyBrand2"))
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
    const schema = Schema.String
    const is = Schema.is(schema)
    const u = hole<unknown>()
    if (is(u)) {
      expect(u).type.toBe<string>()
    }
  })

  it("asserts", () => {
    const schema = Schema.String
    const asserts: Schema.Codec.ToAsserts<typeof schema> = Schema.asserts(schema)
    const u = hole<unknown>()
    {
      asserts(u)
      expect(u).type.toBe<string>()
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
    it("Type-level", () => {
      expect<Schema.Mutable<any>>().type.toBe<{ [x: string]: any }>()
      expect<Schema.Mutable<unknown>>().type.toBe<{}>()
      expect<Schema.Mutable<never>>().type.toBe<never>()
      expect<Schema.Mutable<void>>().type.toBe<void>()
      expect<Schema.Mutable<null>>().type.toBe<null>()
      expect<Schema.Mutable<undefined>>().type.toBe<undefined>()
      expect<Schema.Mutable<string>>().type.toBe<string>()
      expect<Schema.Mutable<number>>().type.toBe<number>()
      expect<Schema.Mutable<boolean>>().type.toBe<boolean>()
      expect<Schema.Mutable<symbol>>().type.toBe<symbol>()
      expect<Schema.Mutable<bigint>>().type.toBe<bigint>()
      expect<Schema.Mutable<object>>().type.toBe<object>()
      expect<Schema.Mutable<"a">>().type.toBe<"a">()
      expect<Schema.Mutable<1>>().type.toBe<1>()
      expect<Schema.Mutable<1n>>().type.toBe<1n>()
      expect<Schema.Mutable<true>>().type.toBe<true>()
      expect<Schema.Mutable<false>>().type.toBe<false>()
      expect<Schema.Mutable<Date>>().type.toBe<Date>()
      expect<Schema.Mutable<Error>>().type.toBe<Error>()
      expect<Schema.Mutable<Array<unknown>>>().type.toBe<Array<unknown>>()
      expect<Schema.Mutable<ReadonlyArray<unknown>>>().type.toBe<Array<unknown>>()
      expect<Schema.Mutable<readonly [string, number]>>().type.toBe<[string, number]>()
      expect<Schema.Mutable<{ readonly a: string; readonly b: number }>>().type.toBe<{ a: string; b: number }>()
      expect<Schema.Mutable<{ readonly a: string } | { readonly b: number }>>().type.toBe<
        { a: string } | { b: number }
      >()
      interface Category {
        readonly name: string
        readonly subcategories: ReadonlyArray<Category>
      }
      expect<Schema.Mutable<Category>>().type.toBe<{ name: string; subcategories: ReadonlyArray<Category> }>()
    })

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
      expect(schema.makeSync).type.toBe<
        (input: readonly [string, number], options?: Schema.MakeOptions | undefined) => [string, number]
      >()
    })

    it("Array", () => {
      const schema = Schema.mutable(Schema.Array(FiniteFromString))
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<Array<number>, Array<string>>>()
      expect(schema).type.toBe<Schema.mutable<Schema.Array$<typeof FiniteFromString>>>()
      expect(schema.annotate({})).type.toBe<Schema.mutable<Schema.Array$<typeof FiniteFromString>>>()

      expect(schema.schema.schema).type.toBe<typeof FiniteFromString>()

      expect(schema.makeSync).type.toBe<
        (input: ReadonlyArray<number>, options?: Schema.MakeOptions | undefined) => Array<number>
      >()
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
    it("effectful", () => {
      const service = hole<Context.Tag<"Tag", "-">>()

      const schema = Schema.String.pipe(Schema.withConstructorDefault(() =>
        Effect.gen(function*() {
          yield* Effect.serviceOption(service)
          return Option.some("some-result")
        })
      ))

      expect(schema.makeSync).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()

      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never, never>>()
    })
  })
})
