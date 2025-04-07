import type { Brand, SchemaAST } from "effect"
import { hole, Option, Schema } from "effect"
import { describe, expect, it } from "tstyche"

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
    it("String", () => {
      const schema = Schema.String
      expect(schema.makeUnsafe).type.toBe<(input: string) => string>()
    })

    it("Number", () => {
      const schema = Schema.Number
      expect(schema.makeUnsafe).type.toBe<(input: number) => number>()
    })

    it("filter", () => {
      const schema = Schema.String.pipe(Schema.minLength(1))
      expect(schema.makeUnsafe).type.toBe<(input: string) => string>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.makeUnsafe).type.toBe<(input: string) => string & Brand.Brand<"a">>()
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(schema.makeUnsafe).type.toBe<
        (input: { readonly a: string }) => { readonly a: string & Brand.Brand<"a"> }
      >()
    })
  })

  describe("typeSchema", () => {
    it.todo("ast type", () => {
      const schema = Schema.String.pipe(Schema.brand("a"), Schema.typeCodec)
      expect(schema.ast).type.toBe<SchemaAST.StringKeyword>()
    })

    it("typeSchema", () => {
      const schema = Schema.String.pipe(Schema.brand("a"), Schema.typeCodec)
      expect(schema.makeUnsafe).type.toBe<(input: string) => string & Brand.Brand<"a">>()
    })
  })

  describe("Never", () => {
    const schema = Schema.Never

    it("ast type", () => {
      expect(schema.ast).type.toBe<SchemaAST.NeverKeyword>()
    })

    it("reveal + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<never>>()
      expect(schema).type.toBe<Schema.Never>()
      expect(schema.annotate({})).type.toBe<Schema.Never>()
    })
  })

  describe("String", () => {
    const schema = Schema.String

    it("ast type", () => {
      expect(schema.ast).type.toBe<SchemaAST.StringKeyword>()
    })

    it("reveal + annotate", () => {
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

    it("reveal + annotate", () => {
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<number>>()
      expect(schema).type.toBe<Schema.Number>()
      expect(schema.annotate({})).type.toBe<Schema.Number>()
    })
  })

  describe("Literal", () => {
    const schema = Schema.Literal("a")

    it("ast type", () => {
      expect(schema.ast).type.toBe<SchemaAST.Literal>()
    })

    it("reveal + annotate", () => {
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
        a: Schema.NumberToString
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a: number }, { readonly a: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.parseNumber<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.parseNumber<Schema.String> }>>()
    })

    it("readonly & optional field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optional)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ readonly a?: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.optional<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.optional<Schema.String> }>>()
    })

    it("mutable & required field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.mutable)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.mutable<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.mutable<Schema.String> }>>()
    })

    it("mutable & optional field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.mutable, Schema.optional)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a?: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.optional<Schema.mutable<Schema.String>> }>>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.optional<Schema.mutable<Schema.String>> }>
      >()
    })

    it("optional & mutable field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optional, Schema.mutable)
      })
      expect(Schema.revealCodec(schema)).type.toBe<
        Schema.Codec<{ a?: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.mutable<Schema.optional<Schema.String>> }>>()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<{ readonly a: Schema.mutable<Schema.optional<Schema.String>> }>
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
          input: { readonly a: string; readonly c: string; readonly b: string }
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
    it("base", () => {
      class A extends Schema.Class<A>("A")(Schema.Struct({
        a: Schema.String
      })) {}

      expect(new A({ a: "a" })).type.toBe<A>()
      expect(A.makeUnsafe({ a: "a" })).type.toBe<A>()
      expect(Schema.revealCodec(A)).type.toBe<Schema.Codec<A, { readonly a: string }>>()
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

  describe("PropertySignature", () => {
    it("optional", () => {
      const schema = Schema.String.pipe(Schema.optional)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never>>()
      expect(schema).type.toBe<Schema.optional<Schema.String>>()
      expect(schema.annotate({})).type.toBe<Schema.optional<Schema.String>>()
    })

    it("mutable", () => {
      const schema = Schema.String.pipe(Schema.mutable)
      expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<string, string, never>>()
      expect(schema).type.toBe<Schema.mutable<Schema.String>>()
      expect(schema.annotate({})).type.toBe<Schema.mutable<Schema.String>>()
    })
  })

  describe("encodeOptionalToRequired", () => {
    it("From must be optional", () => {
      // @ts-expect-error
      Schema.String.pipe(
        Schema.encodeOptionalToRequired(Schema.String, {
          // @ts-expect-error
          encode: (o) => Option.getOrElse(o, () => "default"),
          decode: (s) => Option.some(s)
        })
      )
    })
  })

  describe("encodeRequiredToOptional", () => {
    it("To must be required", () => {
      Schema.String.pipe(Schema.encodeRequiredToOptional(
        // @ts-expect-error
        Schema.optional(Schema.String),
        {
          encode: (s) => Option.some(s),
          decode: (o) => Option.getOrElse(o, () => "default")
        }
      ))
    })
  })

  it("encodeToKey", () => {
    const schema = Schema.Struct({
      a: Schema.String.pipe(Schema.encodeToKey("b"))
    })
    expect(Schema.revealCodec(schema)).type.toBe<Schema.Codec<{ readonly a: string }, { readonly b: string }>>()
    expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.encodeToKey<Schema.String, "b"> }>>()
    expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.encodeToKey<Schema.String, "b"> }>>()
  })

  describe("flip", () => {
    it("Struct & encodeToKey & addDefault", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.encodeToKey("b"), Schema.withConstructorDefault(Option.some("c")))
      })
      expect(schema.makeUnsafe).type.toBe<(input: { readonly a?: string }) => { readonly a: string }>()

      const flipped = schema.pipe(Schema.flip)
      expect(flipped.makeUnsafe).type.toBe<(input: { readonly b: string }) => { readonly b: string }>()

      const flipped2 = flipped.pipe(Schema.flip)
      expect(flipped2.makeUnsafe).type.toBe<(input: { readonly a?: string }) => { readonly a: string }>()
    })
  })
})
