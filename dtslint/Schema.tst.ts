import type { Brand, SchemaAST } from "effect"
import { hole, Schema } from "effect"
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
    it("ast type", () => {
      const schema = Schema.Never
      expect(schema.ast).type.toBe<SchemaAST.NeverKeyword>()
    })

    it("asSchema + annotate", () => {
      const schema = Schema.Never
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<never>>()
      expect(schema).type.toBe<Schema.Never>()
      expect(schema.annotate({})).type.toBe<Schema.Never>()
    })
  })

  describe("String", () => {
    it("ast type", () => {
      const schema = Schema.String
      expect(schema.ast).type.toBe<SchemaAST.StringKeyword>()
    })

    it("asSchema + annotate", () => {
      const schema = Schema.String
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<string>>()
      expect(schema).type.toBe<Schema.String>()
      expect(schema.annotate({})).type.toBe<Schema.String>()
    })
  })

  describe("Number", () => {
    it("ast type", () => {
      const schema = Schema.Number
      expect(schema.ast).type.toBe<SchemaAST.NumberKeyword>()
    })

    it("asSchema + annotate", () => {
      const schema = Schema.Number
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<number>>()
      expect(schema).type.toBe<Schema.Number>()
      expect(schema.annotate({})).type.toBe<Schema.Number>()
    })
  })

  describe("Literal", () => {
    it("ast type", () => {
      const schema = Schema.Literal("a")
      expect(schema.ast).type.toBe<SchemaAST.Literal>()
    })

    it("asSchema + annotate", () => {
      const schema = Schema.Literal("a")
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
      expect(schema).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.PropertySignature<
              "readonly",
              ":?",
              string,
              "readonly",
              never,
              ":?",
              string,
              "no-constructor-default",
              never,
              string
            >
          }
        >
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.PropertySignature<
              "readonly",
              ":?",
              string,
              "readonly",
              never,
              ":?",
              string,
              "no-constructor-default",
              never,
              string
            >
          }
        >
      >()
    })

    it("mutable field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.mutable)
      })
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ a: string }>
      >()
      expect(schema).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.PropertySignature<
              "",
              ":",
              string,
              "",
              never,
              ":",
              string,
              "no-constructor-default",
              never,
              string
            >
          }
        >
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.PropertySignature<
              "",
              ":",
              string,
              "",
              never,
              ":",
              string,
              "no-constructor-default",
              never,
              string
            >
          }
        >
      >()
    })

    it("optional & mutable field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.optional, Schema.mutable)
      })
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ a?: string }>
      >()
      expect(schema).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.PropertySignature<
              "",
              ":?",
              string,
              "",
              never,
              ":?",
              string,
              "no-constructor-default",
              never,
              string
            >
          }
        >
      >()
      expect(schema.annotate({})).type.toBe<
        Schema.Struct<
          {
            readonly a: Schema.PropertySignature<
              "",
              ":?",
              string,
              "",
              never,
              ":?",
              string,
              "no-constructor-default",
              never,
              string
            >
          }
        >
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
    describe("asPropertySignature", () => {
      it("String", () => {
        const schema = Schema.String

        const actual = Schema.asPropertySignature(schema)

        expect(actual).type.toBe<
          Schema.PropertySignature<
            "readonly",
            ":",
            string,
            "readonly",
            never,
            ":",
            string,
            "no-constructor-default",
            never,
            string
          >
        >()
      })

      it("Struct", () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.String.pipe(Schema.mutable),
          c: Schema.String.pipe(Schema.optional),
          d: Schema.String.pipe(Schema.optional, Schema.mutable)
        })

        const actual = Schema.asPropertySignature(schema)

        expect(actual).type.toBe<
          Schema.PropertySignature<
            "readonly",
            ":",
            { readonly a: string; readonly c?: string; b: string; d?: string },
            "readonly",
            never,
            ":",
            { readonly a: string; readonly c?: string; b: string; d?: string },
            "no-constructor-default",
            never,
            {
              readonly a: string
              readonly b: string
              readonly c?: string
              readonly d?: string
            }
          >
        >()
      })
    })
  })
})
