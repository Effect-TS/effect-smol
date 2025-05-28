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
    it("Never", () => {
      const schema = Schema.Never
      expect(schema.makeSync).type.toBe<(input: never, options?: Schema.MakeOptions | undefined) => never>()
    })

    it("Unknown", () => {
      const schema = Schema.Unknown
      expect(schema.makeSync).type.toBe<(input: unknown, options?: Schema.MakeOptions | undefined) => unknown>()
    })

    it("Null", () => {
      const schema = Schema.Null
      expect(schema.makeSync).type.toBe<(input: null, options?: Schema.MakeOptions | undefined) => null>()
    })

    it("Undefined", () => {
      const schema = Schema.Undefined
      expect(schema.makeSync).type.toBe<(input: undefined, options?: Schema.MakeOptions | undefined) => undefined>()
    })

    it("String", () => {
      const schema = Schema.String
      expect(schema.makeSync).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()
    })

    it("Number", () => {
      const schema = Schema.Number
      expect(schema.makeSync).type.toBe<(input: number, options?: Schema.MakeOptions | undefined) => number>()
    })

    it("check", () => {
      const schema = Schema.String.pipe(Schema.check(SchemaCheck.minLength(1)))
      expect(schema.makeSync).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.makeSync).type.toBe<
        (input: string, options?: Schema.MakeOptions | undefined) => string & Brand.Brand<"a">
      >()
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(schema.makeSync).type.toBe<
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
      expect(schema.makeSync).type.toBe<
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

    it(`flipped "~type.make.in" should be "Encoded"`, () => {
      const schema = Schema.Struct({
        a: Schema.FiniteFromString
      })
      const flipped = Schema.flip(schema)
      expect(flipped.makeSync).type.toBe<
        (input: { readonly a: string }, options?: Schema.MakeOptions | undefined) => { readonly a: string }
      >()
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

  describe("ReadonlyArray", () => {
    it("ReadonlyArray<transformation>", () => {
      const schema = Schema.ReadonlyArray(FiniteFromString)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<ReadonlyArray<number>, ReadonlyArray<string>>>()
      expect(schema).type.toBe<Schema.ReadonlyArray$<typeof FiniteFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.ReadonlyArray$<typeof FiniteFromString>>()

      expect(schema.schema).type.toBe<typeof FiniteFromString>()

      expect(schema.makeSync).type.toBe<
        (input: ReadonlyArray<number>, options?: Schema.MakeOptions | undefined) => ReadonlyArray<number>
      >()
    })
  })

  describe("Array", () => {
    it("Array<transformation>", () => {
      const schema = Schema.Array(FiniteFromString)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<Array<number>, Array<string>>>()
      expect(schema).type.toBe<Schema.Array$<typeof FiniteFromString>>()
      expect(schema.annotate({})).type.toBe<Schema.Array$<typeof FiniteFromString>>()

      expect(schema.schema).type.toBe<typeof FiniteFromString>()

      expect(schema.makeSync).type.toBe<
        (input: ReadonlyArray<number>, options?: Schema.MakeOptions | undefined) => Array<number>
      >()
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

  it("withConstructorDefault", () => {
    const service = hole<Context.Tag<"Tag", "-">>()

    const schema = Schema.String.pipe(Schema.withConstructorDefault(() =>
      Effect.gen(function*() {
        yield* Effect.serviceOption(service)
        return Option.some("some-result")
      })
    ))
    expect(schema.makeSync).type.toBe<
      (input: string, options?: Schema.MakeOptions | undefined) => string
    >()
  })

  describe("ReadonlyRecord", () => {
    it("ReadonlyRecord(String, Number)", () => {
      const schema = Schema.ReadonlyRecord(Schema.String, Schema.Number)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number }, { readonly [x: string]: number }, never>
      >()
      expect(schema).type.toBe<Schema.ReadonlyRecord$<typeof Schema.String, typeof Schema.Number>>()
      expect(schema.annotate({})).type.toBe<
        Schema.ReadonlyRecord$<typeof Schema.String, typeof Schema.Number>
      >()
    })

    it("ReadonlyRecord(String, NumberFromString)", () => {
      const schema = Schema.ReadonlyRecord(Schema.String, NumberFromString)
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly [x: string]: number }, { readonly [x: string]: string }, never>
      >()
      expect(schema).type.toBe<Schema.ReadonlyRecord$<typeof Schema.String, typeof NumberFromString>>()
      expect(schema.annotate({})).type.toBe<
        Schema.ReadonlyRecord$<typeof Schema.String, typeof NumberFromString>
      >()
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
          Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty)),
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
    expect(Schema.TemplateLiteral(["a"]))
      .type.toBe<Schema.TemplateLiteral<"a">>()
    expect(Schema.TemplateLiteral([Schema.Literal("a")]))
      .type.toBe<Schema.TemplateLiteral<"a">>()
    expect(Schema.TemplateLiteral([1]))
      .type.toBe<Schema.TemplateLiteral<"1">>()
    expect(Schema.TemplateLiteral([Schema.Literal(1)]))
      .type.toBe<Schema.TemplateLiteral<"1">>()
    expect(Schema.TemplateLiteral([Schema.String]))
      .type.toBe<Schema.TemplateLiteral<string>>()
    expect(Schema.TemplateLiteral([Schema.Number]))
      .type.toBe<Schema.TemplateLiteral<`${number}`>>()
    expect(Schema.TemplateLiteral(["a", "b"]))
      .type.toBe<Schema.TemplateLiteral<"ab">>()
    expect(Schema.TemplateLiteral([Schema.Literal("a"), Schema.Literal("b")]))
      .type.toBe<Schema.TemplateLiteral<"ab">>()
    expect(Schema.TemplateLiteral(["a", Schema.String]))
      .type.toBe<Schema.TemplateLiteral<`a${string}`>>()
    expect(Schema.TemplateLiteral([Schema.Literal("a"), Schema.String]))
      .type.toBe<Schema.TemplateLiteral<`a${string}`>>()
    expect(Schema.TemplateLiteral(["a", Schema.Number]))
      .type.toBe<Schema.TemplateLiteral<`a${number}`>>()
    expect(Schema.TemplateLiteral([Schema.Literal("a"), Schema.Number]))
      .type.toBe<Schema.TemplateLiteral<`a${number}`>>()
    expect(Schema.TemplateLiteral([Schema.String, "a"]))
      .type.toBe<Schema.TemplateLiteral<`${string}a`>>()
    expect(Schema.TemplateLiteral([Schema.String, Schema.Literal("a")]))
      .type.toBe<Schema.TemplateLiteral<`${string}a`>>()
    expect(Schema.TemplateLiteral([Schema.Number, "a"]))
      .type.toBe<Schema.TemplateLiteral<`${number}a`>>()
    expect(Schema.TemplateLiteral([Schema.Number, Schema.Literal("a")]))
      .type.toBe<Schema.TemplateLiteral<`${number}a`>>()
    expect(Schema.TemplateLiteral([Schema.String, 0]))
      .type.toBe<Schema.TemplateLiteral<`${string}0`>>()
    expect(Schema.TemplateLiteral([Schema.String, true]))
      .type.toBe<Schema.TemplateLiteral<`${string}true`>>()
    expect(Schema.TemplateLiteral([Schema.String, 1n]))
      .type.toBe<Schema.TemplateLiteral<`${string}1`>>()
    expect(Schema.TemplateLiteral([Schema.String, Schema.Literals(["a", 0])]))
      .type.toBe<Schema.TemplateLiteral<`${string}a` | `${string}0`>>()
    expect(Schema.TemplateLiteral([Schema.String, Schema.Literal("/"), Schema.Number]))
      .type.toBe<Schema.TemplateLiteral<`${string}/${number}`>>()
    expect(Schema.TemplateLiteral([Schema.String, "/", Schema.Number]))
      .type.toBe<Schema.TemplateLiteral<`${string}/${number}`>>()
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
    expect(Schema.TemplateLiteral([Schema.Union([EmailLocaleIDs, FooterLocaleIDs]), Schema.Literal("_id")]))
      .type.toBe<
      Schema.TemplateLiteral<
        "welcome_email_id" | "email_heading_id" | "footer_title_id" | "footer_sendoff_id"
      >
    >()
    expect(Schema.TemplateLiteral(["a", Schema.Union([Schema.Number, Schema.String])]))
      .type.toBe<Schema.TemplateLiteral<`a${string}` | `a${number}`>>()
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

  it("encodedCodec", () => {
    const schema = Schema.encodedCodec(Schema.FiniteFromString)
    expect(Schema.revealCodec(schema)).type.toBe<
      Schema.Codec<string, string, never, never>
    >()
    expect(schema.makeSync).type.toBe<(input: string, options?: Schema.MakeOptions | undefined) => string>()
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

    it("Tuple", () => {
      const schema = Schema.mutable(Schema.ReadonlyTuple([Schema.String, Schema.FiniteFromString]))
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<[string, number], [string, string], never, never>
      >()
      expect(schema).type.toBe<
        Schema.mutable<Schema.ReadonlyTuple<readonly [Schema.String, Schema.FiniteFromString]>>
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.mutable<Schema.ReadonlyTuple<readonly [Schema.String, Schema.FiniteFromString]>>
      >()
      expect(schema.makeSync).type.toBe<
        (input: readonly [string, number], options?: Schema.MakeOptions | undefined) => [string, number]
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
})
