import type { Brand, SchemaAST } from "effect"
import { hole, Option, Schema } from "effect"
import { describe, expect, it } from "tstyche"

describe("Schema", () => {
  describe("variance", () => {
    it("Type", () => {
      const f1 = hole<
        <A extends string, S extends Schema.Schema<A, unknown, unknown>>(schema: S) => S
      >()
      const f2 = hole<
        <S extends Schema.Schema<string, unknown, unknown>>(schema: S) => S
      >()

      const schema = hole<Schema.Schema<"a", number, "ctx">>()

      f1(schema)
      f2(schema)
    })

    it("Encoded", () => {
      const f1 = hole<
        <A extends number, S extends Schema.Schema<unknown, A, unknown>>(schema: S) => S
      >()
      const f2 = hole<
        <S extends Schema.Schema<unknown, number, unknown>>(schema: S) => S
      >()

      const schema = hole<Schema.Schema<string, 1, "ctx">>()

      f1(schema)
      f2(schema)
    })

    it("Context", () => {
      const f1 = hole<
        <A extends "a", S extends Schema.Schema<unknown, unknown, A>>(schema: S) => S
      >()
      const f2 = hole<
        <S extends Schema.Schema<unknown, unknown, "a">>(schema: S) => S
      >()

      const schema = hole<Schema.Schema<string, number, "a">>()

      f1(schema)
      f2(schema)
    })
  })

  describe("make", () => {
    it("String", () => {
      const schema = Schema.String
      expect(schema.make).type.toBe<(input: string) => string>()
    })

    it("Number", () => {
      const schema = Schema.Number
      expect(schema.make).type.toBe<(input: number) => number>()
    })

    it("filter", () => {
      const schema = Schema.String.pipe(Schema.minLength(1))
      expect(schema.make).type.toBe<(input: string) => string>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.make).type.toBe<(input: string) => string & Brand.Brand<"a">>()
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(schema.make).type.toBe<(input: { readonly a: string }) => { readonly a: string & Brand.Brand<"a"> }>()
    })
  })

  describe("typeSchema", () => {
    it.todo("ast type", () => {
      const schema = Schema.String.pipe(Schema.brand("a"), Schema.typeSchema)
      expect(schema.ast).type.toBe<SchemaAST.StringKeyword>()
    })

    it("typeSchema", () => {
      const schema = Schema.String.pipe(Schema.brand("a"), Schema.typeSchema)
      expect(schema.make).type.toBe<(input: string) => string & Brand.Brand<"a">>()
    })
  })

  describe("Never", () => {
    const schema = Schema.Never

    it("ast type", () => {
      expect(schema.ast).type.toBe<SchemaAST.NeverKeyword>()
    })

    it("asSchema + annotate", () => {
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<never>>()
      expect(schema).type.toBe<Schema.Never>()
      expect(schema.annotate({})).type.toBe<Schema.Never>()
    })
  })

  describe("String", () => {
    const schema = Schema.String

    it("ast type", () => {
      expect(schema.ast).type.toBe<SchemaAST.StringKeyword>()
    })

    it("asSchema + annotate", () => {
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<string>>()
      expect(schema).type.toBe<Schema.String>()
      expect(schema.annotate({})).type.toBe<Schema.String>()
    })
  })

  describe("Number", () => {
    const schema = Schema.Number

    it("ast type", () => {
      expect(schema.ast).type.toBe<SchemaAST.NumberKeyword>()
    })

    it("asSchema + annotate", () => {
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<number>>()
      expect(schema).type.toBe<Schema.Number>()
      expect(schema.annotate({})).type.toBe<Schema.Number>()
    })
  })

  describe("Literal", () => {
    const schema = Schema.Literal("a")

    it("ast type", () => {
      expect(schema.ast).type.toBe<SchemaAST.Literal>()
    })

    it("asSchema + annotate", () => {
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<"a">>()
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
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<{ readonly a: never }>>()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.Never }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.Never }>>()
    })

    it("branded field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ readonly a: string & Brand.Brand<"a"> }, { readonly a: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.brand<Schema.String, "a"> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.brand<Schema.String, "a"> }>>()
    })

    it("optional field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optional)
      })
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ readonly a?: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.optional<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.optional<Schema.String> }>>()
    })

    it("mutable field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.mutable)
      })
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ a: string }>
      >()
      expect(schema).type.toBe<Schema.Struct<{ readonly a: Schema.mutable<Schema.String> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ readonly a: Schema.mutable<Schema.String> }>>()
    })

    it("optional & mutable field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optional, Schema.mutable)
      })
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ a?: string }>
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
      expect(schema.make).type.toBe<
        (
          input: { readonly a: string; readonly c: string; readonly b: string }
        ) => { readonly a: string; readonly c: string; readonly b: string }
      >()
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ readonly a: string; readonly c: string; readonly b: string }>
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
      expect(A.make({ a: "a" })).type.toBe<A>()
      expect(Schema.asSchema(A)).type.toBe<Schema.Schema<A, { readonly a: string }>>()
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
      expect(B.make({ a: "a" })).type.toBe<B>()
      expect(Schema.asSchema(B)).type.toBe<Schema.Schema<B, { readonly a: string }>>()
    })
  })

  describe("PropertySignature", () => {
    it("optional", () => {
      const schema = Schema.String.pipe(Schema.optional)
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<string, string, never>>()
      expect(schema).type.toBe<Schema.optional<Schema.String>>()
      expect(schema.annotate({})).type.toBe<Schema.optional<Schema.String>>()
    })

    it("mutable", () => {
      const schema = Schema.String.pipe(Schema.mutable)
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<string, string, never>>()
      expect(schema).type.toBe<Schema.mutable<Schema.String>>()
      expect(schema.annotate({})).type.toBe<Schema.mutable<Schema.String>>()
    })

    describe("encodeOptionalToRequired", () => {
      it("should prevent applying to a already optional schema", () => {
        Schema.String.pipe(
          // @ts-expect-error
          Schema.optional,
          Schema.encodeOptionalToRequired(Schema.String, {
            encode: (o) => Option.getOrElse(o, () => "default"),
            decode: (s) => Option.some(s)
          })
        )
      })
    })

    describe("encodeRequiredToOptional", () => {
      it("should prevent applying to a already optional schema", () => {
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
  })
})
