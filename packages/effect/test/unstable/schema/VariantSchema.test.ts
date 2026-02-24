import { assert, describe, it } from "@effect/vitest"
import * as Schema from "effect/Schema"
import { Model, VariantSchema } from "effect/unstable/schema"

describe("VariantSchema", () => {
  it("FieldOnly and FieldExcept accept key arrays", () => {
    const Test = VariantSchema.make({
      variants: ["a", "b", "c"],
      defaultVariant: "a"
    })
    const struct = Test.Struct({
      common: Schema.String,
      onlyB: Test.FieldOnly(["b"])(Schema.Number),
      exceptC: Test.FieldExcept(["c"])(Schema.Boolean)
    })

    assert.deepStrictEqual(Object.keys(Test.extract(struct, "a").fields), ["common", "exceptC"])
    assert.deepStrictEqual(Object.keys(Test.extract(struct, "b").fields), ["common", "onlyB", "exceptC"])
    assert.deepStrictEqual(Object.keys(Test.extract(struct, "c").fields), ["common"])
  })
})

describe("Model", () => {
  it("FieldOnly accepts array arguments", () => {
    const InsertOnly = Model.Struct({
      value: Model.FieldOnly(["insert"])(Schema.String)
    })

    assert.deepStrictEqual(Object.keys(Model.extract(InsertOnly, "insert").fields), ["value"])
    assert.deepStrictEqual(Object.keys(Model.extract(InsertOnly, "select").fields), [])
  })
})
