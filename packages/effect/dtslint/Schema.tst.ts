import type { Brand, Context, SchemaAST, SchemaResult } from "effect"
import {
  Effect,
  hole,
  Option,
  Result,
  Schema,
  SchemaFilter,
  SchemaParser,
  SchemaTransformation,
  SchemaValidator
} from "effect"
import { describe, expect, it } from "tstyche"

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
      const schema = Schema.String.pipe(Schema.check(SchemaFilter.minLength(1)))
      expect(schema.makeUnsafe).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()
    })

    it("checkEncoded", () => {
      const schema = Schema.String.pipe(Schema.checkEncoded(SchemaFilter.minLength(1)))
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

  describe("declare", () => {
    it("R !== never", () => {
      const service = hole<Context.Tag<"Tag", "-">>()
      const schema = Schema.declare([])<string>()(() => () => {
        return Effect.gen(function*() {
          yield* service
          return "some-result" as const
        })
      })
      expect(schema).type.toBe<Schema.declare<"some-result", string, readonly [], "Tag">>()
    })

    it("item & R = never", () => {
      const item = hole<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI">>()
      const schema = Schema.declare([item])()(([item]) => (input) => {
        return SchemaValidator.decodeUnknownSchemaResult(item)(input)
      })
      expect(schema).type.toBe<Schema.declare<"Type", unknown, readonly [typeof item], "RI">>()
    })

    it("item & R !== never", () => {
      const service = hole<Context.Tag<"Tag", "-">>()
      const item = hole<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI">>()
      const schema = Schema.declare([item])()(([item]) => (input) => {
        return Effect.gen(function*() {
          yield* service
          return yield* SchemaValidator.decodeUnknownSchemaResult(item)(input)
        })
      })
      expect(schema).type.toBe<Schema.declare<"Type", unknown, readonly [typeof item], "Tag" | "RI">>()
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

  describe("checkEffect", () => {
    it("single filter", () => {
      const from = hole<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI">>()
      const schema = from.pipe(
        Schema.checkEffect(SchemaFilter.makeEffect(() => hole<Effect.Effect<boolean, never, "service">>()))
      )
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI" | "service">>()
    })

    it("multiple filters", () => {
      const from = hole<Schema.Codec<"Type", "Encoded", "RD", "RE", "RI">>()
      const f1 = SchemaFilter.makeEffect(() => hole<Effect.Effect<boolean, never, "service1">>())
      const f2 = SchemaFilter.makeEffect(() => hole<Effect.Effect<boolean, never, "service2">>())
      const schema = from.pipe(
        Schema.checkEffect(f1, f2)
      )
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<"Type", "Encoded", "RD", "RE", "RI" | "service1" | "service2">
      >()
    })
  })

  it("refine", () => {
    const schema = Schema.Option(Schema.String).pipe(Schema.refine(Option.isSome))
    expect(Schema.revealCodec(schema)).type.toBe<
      Schema.Codec<Option.Some<string>, Option.Option<string>, never, never, never>
    >()
    expect(schema).type.toBe<Schema.refine<Option.Some<string>, Schema.Option<Schema.String>>>()
    expect(schema.annotate({})).type.toBe<Schema.refine<Option.Some<string>, Schema.Option<Schema.String>>>()
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
        Schema.Struct<{ readonly a: Schema.encodeTo<Schema.Number, Schema.String, never, never> }>
      >()
      expect(schema.ast).type.toBe<SchemaAST.TypeLiteral>()
      expect(schema.makeUnsafe).type.toBe<
        (input: { readonly a: number }, options?: Schema.MakeOptions | undefined) => A
      >()
      expect(schema.fields).type.toBe<{ readonly a: Schema.encodeTo<Schema.Number, Schema.String, never, never> }>()

      // @ts-expect-error: Property 'a' does not exist on type 'typeof A'.
      const _test1 = A.a

      const instance = A.makeUnsafe({ a: 1 })
      // @ts-expect-error: Property 'annotate' does not exist on type 'A'.
      const _test2 = instance.annotate
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
      serialization: {
        json: {
          to: Schema.String,
          encode: (e) => e.message,
          decode: (message) => new MyError(message)
        }
      },
      annotations: { title: "MyError" }
    })

    expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<MyError, MyError, never, never, never>>()
    expect(schema).type.toBe<Schema.instanceOf<MyError>>()
    expect(schema.annotate({})).type.toBe<Schema.instanceOf<MyError>>()
    expect(schema.ast).type.toBe<SchemaAST.Declaration>()
    expect(schema.makeUnsafe).type.toBe<
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

  describe("compose", () => {
    it("E = T", () => {
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.String.pipe(Schema.check(SchemaFilter.nonEmpty)),
          SchemaTransformation.compose()
        )
      )
    })

    it("E != T", () => {
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.Number,
          // @ts-expect-error
          SchemaTransformation.compose()
        )
      )
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.Number,
          SchemaTransformation.compose({ strict: false })
        )
      )
    })

    it("E extends T", () => {
      Schema.String.pipe(
        Schema.decodeTo(
          Schema.UndefinedOr(Schema.String),
          SchemaTransformation.composeSupertype()
        )
      )
    })

    it("T extends E", () => {
      Schema.UndefinedOr(Schema.String).pipe(
        Schema.decodeTo(
          Schema.String,
          SchemaTransformation.composeSubtype()
        )
      )
    })
  })
})
