import type { Brand } from "effect"
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
    it("Schema", () => {
      const schema = Schema.String
      expect(schema.make).type.toBe<(a: string) => string>()
    })

    it("brand", () => {
      const schema = Schema.String.pipe(Schema.brand("a"))
      expect(schema.make).type.toBe<(a: string) => string & Brand.Brand<"a">>()
    })

    it("Struct", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(schema.make).type.toBe<(type: { readonly a: string }) => { readonly a: string & Brand.Brand<"a"> }>()
    })
  })

  describe("Never", () => {
    it("asSchema", () => {
      const schema = Schema.Never
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<never, never, never>>()
      expect(schema).type.toBe<Schema.Never>()
      expect(schema.annotate({})).type.toBe<Schema.Never>()
    })
  })

  describe("Never", () => {
    it("asSchema", () => {
      const schema = Schema.String
      expect(Schema.asSchema(schema)).type.toBe<Schema.Schema<string, string, never>>()
      expect(schema).type.toBe<Schema.String>()
      expect(schema.annotate({})).type.toBe<Schema.String>()
    })
  })

  describe("Struct", () => {
    it("Never should be usable as a field", () => {
      Schema.Struct({
        a: Schema.Never
      })
    })

    it("branded field", () => {
      const schema = Schema.Struct({
        a: Schema.String.pipe(Schema.brand("a"))
      })
      expect(Schema.asSchema(schema)).type.toBe<
        Schema.Schema<{ readonly a: string & Brand.Brand<"a"> }, { readonly a: string }, never>
      >()
      expect(schema).type.toBe<Schema.Struct<{ a: Schema.brand<Schema.String, "a"> }>>()
      expect(schema.annotate({})).type.toBe<Schema.Struct<{ a: Schema.brand<Schema.String, "a"> }>>()
    })
  })
})
