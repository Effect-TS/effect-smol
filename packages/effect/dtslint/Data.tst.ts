import { Data } from "effect"
import { describe, expect, it } from "tstyche"

describe("Data", () => {
  describe("Class", () => {
    it("no fields: args is void", () => {
      class Empty extends Data.Class {}
      expect<ConstructorParameters<typeof Empty>>().type.toBe<[args?: void]>()
    })

    it("with fields: args is the fields object", () => {
      class Person extends Data.Class<{ readonly name: string; readonly age: number }> {}
      expect<ConstructorParameters<typeof Person>>().type.toBe<
        [args: { readonly name: string; readonly age: number }]
      >()
    })
  })

  describe("TaggedClass", () => {
    it("no fields: args is void", () => {
      class Empty extends Data.TaggedClass("Empty") {}
      expect<ConstructorParameters<typeof Empty>>().type.toBe<[args?: void]>()
    })

    it("with fields: args excludes _tag", () => {
      class Person extends Data.TaggedClass("Person")<{ readonly name: string }> {}
      expect<ConstructorParameters<typeof Person>>().type.toBe<
        [args: { readonly name: string }]
      >()
    })
  })

  describe("Error", () => {
    it("no fields: args is void", () => {
      class MyError extends Data.Error {}
      expect<ConstructorParameters<typeof MyError>>().type.toBe<[args?: void]>()
    })

    it("with fields: args is the fields object", () => {
      class MyError extends Data.Error<{ readonly message: string }> {}
      expect<ConstructorParameters<typeof MyError>>().type.toBe<
        [args: { readonly message: string }]
      >()
    })
  })

  describe("TaggedError", () => {
    it("no fields: args is void", () => {
      class MyError extends Data.TaggedError("MyError") {}
      expect<ConstructorParameters<typeof MyError>>().type.toBe<[args?: void]>()
    })

    it("with fields: args excludes _tag", () => {
      class MyError extends Data.TaggedError("MyError")<{ readonly reason: string }> {}
      expect<ConstructorParameters<typeof MyError>>().type.toBe<
        [args: { readonly reason: string }]
      >()
    })
  })
})
