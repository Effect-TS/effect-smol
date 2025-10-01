import { Option } from "effect/data"
import { Differ, Schema } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

describe("Differ", () => {
  describe("jsonPatch", () => {
    describe("diff", () => {
      it("String", () => {
        const schema = Schema.String
        const differ = Differ.jsonPatch(schema)
        deepStrictEqual(differ.diff("a", "a2"), [{ op: "replace", path: "", value: "a2" }])
        deepStrictEqual(differ.diff("a", "a"), [])
      })

      it("Date", () => {
        const schema = Schema.Date
        const differ = Differ.jsonPatch(schema)
        deepStrictEqual(differ.diff(new Date("2021-01-01"), new Date("2021-01-02")), [{
          op: "replace",
          path: "",
          value: "2021-01-02T00:00:00.000Z"
        }])
        deepStrictEqual(differ.diff(new Date("2021-01-01"), new Date("2021-01-01")), [])
      })

      it("Struct", () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.NullOr(Schema.String),
          "": Schema.String
        })
        const differ = Differ.jsonPatch(schema)
        deepStrictEqual(differ.diff({ a: "a", b: "b", "": "c" }, { a: "a2", b: null, "": "c2" }), [
          { op: "replace", path: "/a", value: "a2" },
          { op: "replace", path: "/b", value: null },
          { op: "replace", path: "/", value: "c2" }
        ])
      })

      it("Record(String, Number)", () => {
        const schema = Schema.Record(Schema.String, Schema.Number)
        const differ = Differ.jsonPatch(schema)
        deepStrictEqual(differ.diff({ a: 1, b: 2 }, { a: 1, b: 2 }), [])
        deepStrictEqual(differ.diff({ a: 1, b: 2 }, { a: 1, b: 3 }), [
          { op: "replace", path: "/b", value: 3 }
        ])
      })

      it("Tuple", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number])
        const differ = Differ.jsonPatch(schema)

        deepStrictEqual(differ.diff(["a", 1], ["a", 1]), [])
        deepStrictEqual(differ.diff(["a", 1], ["b", 1]), [
          { op: "replace", path: "/0", value: "b" }
        ])
        deepStrictEqual(differ.diff(["a", 1], ["a", 2]), [
          { op: "replace", path: "/1", value: 2 }
        ])
        deepStrictEqual(differ.diff(["a", 1], ["b", 2]), [
          { op: "replace", path: "/0", value: "b" },
          { op: "replace", path: "/1", value: 2 }
        ])
      })

      it("Array", () => {
        const schema = Schema.Array(Schema.Number)
        const differ = Differ.jsonPatch(schema)
        deepStrictEqual(differ.diff([], []), [])
        deepStrictEqual(differ.diff([1, 2], [1, 2]), [])
        deepStrictEqual(differ.diff([1, 2], [3, 2]), [
          { op: "replace", path: "/0", value: 3 }
        ])
      })

      it("Union", () => {
        const schema = Schema.Union([Schema.String, Schema.Number])
        const differ = Differ.jsonPatch(schema)

        // Same type, different values
        deepStrictEqual(differ.diff("a", "b"), [{ op: "replace", path: "", value: "b" }])
        deepStrictEqual(differ.diff(1, 2), [{ op: "replace", path: "", value: 2 }])

        // Different types
        deepStrictEqual(differ.diff("a", 1), [{ op: "replace", path: "", value: 1 }])
        deepStrictEqual(differ.diff(1, "a"), [{ op: "replace", path: "", value: "a" }])
      })

      it("Complex Union", () => {
        const schema = Schema.Union([
          Schema.Struct({ type: Schema.Literal("user"), name: Schema.String }),
          Schema.Struct({ type: Schema.Literal("admin"), name: Schema.String, level: Schema.Number })
        ])
        const differ = Differ.jsonPatch(schema)

        // Same union member, different values
        deepStrictEqual(
          differ.diff({ type: "user", name: "Alice" }, { type: "user", name: "Bob" }),
          [{ op: "replace", path: "/name", value: "Bob" }]
        )

        // Different union members - should replace entire value
        deepStrictEqual(
          differ.diff({ type: "user", name: "Alice" }, { type: "admin", name: "Bob", level: 5 }),
          [{ op: "replace", path: "", value: { type: "admin", name: "Bob", level: 5 } }]
        )
      })
    })

    describe("patch", () => {
      it("String", () => {
        const schema = Schema.String
        const differ = Differ.jsonPatch(schema)
        const patch: Differ.JsonPatchDocument = [{ op: "replace", path: "", value: "a2" }]
        deepStrictEqual(differ.patch("a", patch), "a2")
      })

      it("Date", () => {
        const schema = Schema.Struct({
          a: Schema.Date
        })
        const differ = Differ.jsonPatch(schema)
        const patch: Differ.JsonPatchDocument = [{ op: "replace", path: "/a", value: "2021-01-02" }]
        deepStrictEqual(differ.patch({ a: new Date("2021-01-01") }, patch), { a: new Date("2021-01-02") })
      })

      it("Struct", () => {
        const schema = Schema.Struct({
          a: Schema.String,
          b: Schema.NullOr(Schema.String),
          "": Schema.String
        })
        const differ = Differ.jsonPatch(schema)
        const patch: Differ.JsonPatchDocument = [
          { op: "replace", path: "/a", value: "a2" },
          { op: "replace", path: "/b", value: null },
          { op: "replace", path: "/", value: "c2" }
        ]
        deepStrictEqual(differ.patch({ a: "a", b: "b", "": "c" }, patch), { a: "a2", b: null, "": "c2" })
      })

      it("Tuple", () => {
        const schema = Schema.Tuple([Schema.String, Schema.Number])
        const differ = Differ.jsonPatch(schema)
        const patch: Differ.JsonPatchDocument = [
          { op: "replace", path: "/0", value: "b" },
          { op: "replace", path: "/1", value: 2 }
        ]

        deepStrictEqual(differ.patch(["a", 1], patch), ["b", 2])
      })

      it("Option(String)", () => {
        const schema = Schema.Option(Schema.String)
        const differ = Differ.jsonPatch(schema)
        const patch: Differ.JsonPatchDocument = [
          { op: "replace", path: "/value", value: "a2" }
        ]
        deepStrictEqual(differ.patch(Option.some("a"), patch), Option.some("a2"))
      })
    })
  })
})
