import type { Brand, Context, SchemaAST, SchemaResult } from "effect"
import { Effect, hole, Option, Result, Schema, SchemaParser, SchemaTransformation, SchemaValidator } from "effect"
import { describe, expect, it } from "tstyche"

const revealClass = <Self, const Fields extends Schema.Struct.Fields, S extends Schema.Top, Inherited>(
  klass: Schema.Class<Self, Fields, S, Inherited>
): Schema.Class<Self, Fields, S, Inherited> => klass

const FiniteFromString = Schema.String.pipe(Schema.decodeTo(
  Schema.Finite,
  new SchemaTransformation.Transformation(
    SchemaParser.Number,
    SchemaParser.String
  )
))

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Number,
    new SchemaTransformation.Transformation(
      SchemaParser.Number,
      SchemaParser.String
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

    it("Context", () => {
      const f1 = hole<
        <A extends "a", S extends Schema.Codec<unknown, unknown, A>>(schema: S) => S
      >()
      const f2 = hole<
        <S extends Schema.Codec<unknown, unknown, "a">>(schema: S) => S
      >()

      const schema = hole<Schema.Codec<string, number, "a">>()

      f1(schema)
      f2(schema)
    })
  })

  describe("makeUnsafe", () => {
    it("Never", () => {
      const schema = Schema.Never
      expect(schema.makeUnsafe).type.toBe<(input: never, options?: Schema.MakeOptions | undefined) => never>()
    })

    it("Unknown", () => {
      const schema = Schema.Unknown
      expect(schema.makeUnsafe).type.toBe<(input: unknown, options?: Schema.MakeOptions | undefined) => unknown>()
    })

    it("Null", () => {
      const schema = Schema.Null
      expect(schema.makeUnsafe).type.toBe<(input: null, options?: Schema.MakeOptions | undefined) => null>()
    })

    it("Undefined", () => {
      const schema = Schema.Undefined
      expect(schema.makeUnsafe).type.toBe<(input: undefined, options?: Schema.MakeOptions | undefined) => undefined>()
    })

    it("String", () => {
      const schema = Schema.String
      expect(schema.makeUnsafe).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()
    })

    it("Number", () => {
      const schema = Schema.Number
      expect(schema.makeUnsafe).type.toBe<(input: number, options?: Schema.MakeOptions | undefined) => number>()
    })

    it("check", () => {
      const schema = Schema.String.pipe(Schema.check(Schema.minLength(1)))
      expect(schema.makeUnsafe).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.makeUnsafe).type.toBe<
        (input: string, options?: Schema.MakeOptions | undefined) => string & Brand.Brand<"a">
      >()
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(schema.makeUnsafe).type.toBe<
        (
          input: { readonly a: string },
          options?: Schema.MakeOptions | undefined
        ) => { readonly a: string & Brand.Brand<"a"> }
      >()
    })
  })

  describe("typeSchema", () => {
    it("ast type", () => {
      const schema = Schema.String.pipe(Schema.brand("a"), Schema.typeCodec)
      expect(schema.ast).type.toBe<SchemaAST.StringKeyword>()
    })

    it("typeSchema", () => {
      const schema = Schema.String.pipe(Schema.brand("a"), Schema.typeCodec)
      expect(schema.makeUnsafe).type.toBe<
        (input: string, options?: Schema.MakeOptions | undefined) => string & Brand.Brand<"a">
      >()
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
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.brand<Schema.String, "a"> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.brand<Schema.String, "a"> }>>()
    })

    it("readonly & required field", () => {
      const schema = Schema.Struct({
        a: FiniteFromString
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: number }, { readonly a: string }>
      >()
      expect(schema).type.toBe<
        Schema.Struct<{ readonly a: Schema.encodeTo<Schema.Number, Schema.String, never, never> }>
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.encodeTo<Schema.Number, Schema.String, never, never> }>
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
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.optionalKey<Schema.String> }>>()
    })

    it("mutable & required field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.mutableKey)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.mutableKey<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.mutableKey<Schema.String> }>>()
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

  describe("Class", () => {
    it("extend Struct", () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      expect(new A({ a: "a" })).type.toBe<A>()
      expect(A.makeUnsafe({ a: "a" })).type.toBe<A>()
      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { readonly a: string }>>()
      expect(revealClass(A)).type.toBe<
        Schema.Class<A, { readonly a: Schema.String }, Schema.Struct<{ readonly a: Schema.String }>, A>
      >()
      expect(A.fields).type.toBe<{ readonly a: Schema.String }>()
    })

    it("mutable field", () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String.pipe(Schema.mutableKey)
      })) {}

      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { a: string }>>()
    })

    it("extends (abstract A)", () => {
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

      // @ts-expect-error: Cannot create an instance of an abstract class.ts(2511)
      new A({ a: "a" })

      expect(new B({ a: "a" })).type.toBe<B>()
      expect(B.makeUnsafe({ a: "a" })).type.toBe<B>()
      expect(Schema.revealCodec(B)).type.toBe<Schema.Codec<B, { readonly a: string }>>()
    })
  })

  describe("TaggedError", () => {
    it("extend Struct", () => {
      class E extends Schema.TaggedError<E>()("E", {
        id: Schema.Number
      }) {}

      expect(new E({ id: 1 })).type.toBe<E>()
      expect(E.makeUnsafe({ id: 1 })).type.toBe<E>()
      expect(Schema.revealCodec(E)).type.toBe<Schema.Codec<E, { readonly _tag: "E"; readonly id: number }>>()

      expect(Effect.gen(function*() {
        return yield* new E({ id: 1 })
      })).type.toBe<Effect.Effect<never, E>>()
    })
  })

  describe("PropertySignature", () => {
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
  })

  describe("flip", () => {
    it("Struct & setConstructorDefault", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.setConstructorDefault(() => Result.succeedSome("c")))
      })
      expect(schema.makeUnsafe).type.toBe<
        (input: { readonly a?: string }, options?: Schema.MakeOptions | undefined) => { readonly a: string }
      >()

      const flipped = schema.pipe(Schema.flip)
      expect(flipped.makeUnsafe).type.toBe<
        (input: { readonly a: string }, options?: Schema.MakeOptions | undefined) => { readonly a: string }
      >()

      const flipped2 = flipped.pipe(Schema.flip)
      expect(flipped2).type.toBe<typeof schema>()
    })
  })

  describe("declareParserResult", () => {
    it("R !== never", () => {
      const service = hole<Context.Tag<"Tag", "-">>()
      const schema = Schema.declareParserResult([])<string>()(() => () => {
        return Effect.gen(function*() {
          yield* service
          return "some-result" as const
        })
      })
      expect(schema).type.toBe<Schema.declareParserResult<"some-result", string, never, never, "Tag">>()
    })

    it("item & R = never", () => {
      const item = hole<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI">>()
      const schema = Schema.declareParserResult([item])()(([item]) => (input) => {
        return SchemaValidator.decodeUnknownSchemaResult(item)(input)
      })
      expect(schema).type.toBe<Schema.declareParserResult<"Type", unknown, "RD", "RE", "RI">>()
    })

    it("item & R !== never", () => {
      const service = hole<Context.Tag<"Tag", "-">>()
      const item = hole<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI">>()
      const schema = Schema.declareParserResult([item])()(([item]) => (input) => {
        return Effect.gen(function*() {
          yield* service
          return yield* SchemaValidator.decodeUnknownSchemaResult(item)(input)
        })
      })
      expect(schema).type.toBe<Schema.declareParserResult<"Type", unknown, "RD", "RE", "Tag" | "RI">>()
    })
  })

  describe("Array", () => {
    it("Encoded type", () => {
      const schema = Schema.ReadonlyArray(FiniteFromString)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<ReadonlyArray<number>, ReadonlyArray<string>>>()
      expect(schema).type.toBe<Schema.ReadonlyArray$<typeof FiniteFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.ReadonlyArray$<typeof FiniteFromString>>()
    })
  })

  it("filterEffect", () => {
    const from = hole<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI">>()
    const schema = from.pipe(Schema.checkEffect(() => hole<Effect.Effect<boolean, never, "service">>()))
    expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI" | "service">>()
  })

  it("withConstructorDefault", () => {
    const service = hole<Context.Tag<"Tag", "-">>()

    const schema = Schema.String.pipe(Schema.setConstructorDefault(() =>
      Effect.gen(function*() {
        yield* Effect.serviceOption(service)
        return Option.some("some-result")
      })
    ))
    expect(schema.make).type.toBe<
      (input: string, options?: Schema.MakeOptions | undefined) => SchemaResult.SchemaResult<string>
    >()
  })

  describe("ReadonlyRecord", () => {
    it("ReadonlyRecord(String, Number)", () => {
      const schema = Schema.ReadonlyRecord(Schema.String, Schema.Number)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number }, { readonly [x: string]: number }, never>
      >()
      expect(schema).type.toBe<Schema.ReadonlyRecord$<typeof Schema.String, typeof Schema.Number>>()
      expect(schema.annotate({})).type.toBe<Schema.ReadonlyRecord$<typeof Schema.String, typeof Schema.Number>>()
    })

    it("ReadonlyRecord(String, NumberFromString)", () => {
      const schema = Schema.ReadonlyRecord(Schema.String, NumberFromString)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number }, { readonly [x: string]: string }, never>
      >()
      expect(schema).type.toBe<Schema.ReadonlyRecord$<typeof Schema.String, typeof NumberFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.ReadonlyRecord$<typeof Schema.String, typeof NumberFromString>>()
    })
  })

  describe("ReadonlyTuple", () => {
    it("empty", () => {
      const schema = Schema.ReadonlyTuple([])
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<readonly [], readonly []>>()
      expect(schema).type.toBe<Schema.ReadonlyTuple<readonly []>>()
      expect(schema.annotate({})).type.toBe<Schema.ReadonlyTuple<readonly []>>()

      expect(schema.elements).type.toBe<readonly []>()
    })

    it("readonly [String, Number?]", () => {
      const schema = Schema.ReadonlyTuple([Schema.String, Schema.optionalKey(Schema.Number)])
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<readonly [string, number?], readonly [string, number?]>
      >()
      expect(schema).type.toBe<Schema.ReadonlyTuple<readonly [Schema.String, Schema.optionalKey<Schema.Number>]>>()
      expect(schema.annotate({})).type.toBe<
        Schema.ReadonlyTuple<readonly [Schema.String, Schema.optionalKey<Schema.Number>]>
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
})
