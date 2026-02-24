import { Schema } from "effect"
import { Model, VariantSchema } from "effect/unstable/schema"
import { describe, expect, it } from "tstyche"

describe("VariantSchema", () => {
  it("FieldOnly and FieldExcept take key arrays", () => {
    const Test = VariantSchema.make({
      variants: ["a", "b"],
      defaultVariant: "a"
    })

    expect(Test.FieldOnly).type.toBeCallableWith(["a"] as const)
    expect(Test.FieldExcept).type.toBeCallableWith(["b"] as const)
    expect(Test.FieldOnly).type.not.toBeCallableWith("a")
    expect(Test.FieldExcept).type.not.toBeCallableWith("b")
  })

  it("Union takes members as an array", () => {
    const Test = VariantSchema.make({
      variants: ["a", "b"],
      defaultVariant: "a"
    })
    const first = Test.Struct({
      value: Test.FieldOnly(["a", "b"])(Schema.String)
    })
    const second = Test.Struct({
      value: Test.FieldOnly(["a", "b"])(Schema.Number)
    })

    expect(Test.Union).type.toBeCallableWith([first, second])
    expect(Test.Union).type.not.toBeCallableWith(first, second)
  })
})

describe("Model", () => {
  it("re-exports array based variant APIs", () => {
    const first = Model.Struct({
      value: Schema.String
    })
    const second = Model.Struct({
      value: Schema.Number
    })

    expect(Model.FieldOnly).type.toBeCallableWith(["insert"] as const)
    expect(Model.FieldExcept).type.toBeCallableWith(["insert"] as const)
    expect(Model.Union).type.toBeCallableWith([first, second])
    expect(Model.Union).type.not.toBeCallableWith(first, second)
  })
})
