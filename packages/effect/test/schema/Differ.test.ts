import { Option } from "effect/data"
import { Differ, Schema, ToArbitrary } from "effect/schema"
import * as FastCheck from "effect/testing/FastCheck"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual } from "../utils/assert.ts"

function roundtrip<S extends Schema.Top>(schema: S) {
  const differ = Differ.jsonPatch(schema)
  const arbitrary = ToArbitrary.make(schema)
  const arb = arbitrary
  FastCheck.assert(
    FastCheck.property(arb, arb, (v1, v2) => {
      const patch = differ.diff(v1, v2)
      const patched = differ.patch(v1, patch)
      if (patched instanceof Date && v2 instanceof Date && Object.is(patched.getTime(), v2.getTime())) {
        return
      }
      deepStrictEqual(patched, v2)
    }),
    { seed: 1847023290, path: "2:0", endOnFailure: true }
  )
}

describe("Differ", () => {
  describe("jsonPatch", () => {
    it("String", () => {
      const schema = Schema.String
      const differ = Differ.jsonPatch(schema)

      deepStrictEqual(differ.diff("a", "a"), [])
      deepStrictEqual(differ.diff("a", "b"), [{ op: "replace", path: "", value: "b" }])

      deepStrictEqual(differ.patch("a", [{ op: "replace", path: "", value: "b" }]), "b")

      roundtrip(schema)
    })

    it("Number", () => {
      const schema = Schema.Number
      const differ = Differ.jsonPatch(schema)

      deepStrictEqual(differ.diff(0, -0), [{ op: "replace", path: "", value: -0 }])
      deepStrictEqual(differ.diff(0, 0), [])
      deepStrictEqual(differ.diff(NaN, NaN), [])
      deepStrictEqual(differ.diff(Infinity, Infinity), [])
      deepStrictEqual(differ.diff(-Infinity, -Infinity), [])

      deepStrictEqual(differ.patch(0, [{ op: "replace", path: "", value: -0 }]), -0)

      roundtrip(schema)
    })

    it("Date", () => {
      const schema = Schema.Date
      const differ = Differ.jsonPatch(schema)

      deepStrictEqual(differ.diff(new Date(0), new Date(0)), [])
      deepStrictEqual(differ.diff(new Date(0), new Date(1)), [
        { op: "replace", path: "", value: "1970-01-01T00:00:00.001Z" }
      ])
      deepStrictEqual(differ.diff(new Date("1970-01-01T00:00:00.000Z"), new Date(NaN)), [
        { op: "replace", path: "", value: "Invalid Date" }
      ])

      deepStrictEqual(
        differ.patch(new Date(0), [{ op: "replace", path: "", value: "1970-01-01T00:00:00.001Z" }]),
        new Date(1)
      )

      roundtrip(schema)
    })

    describe("Struct", () => {
      it("required fields", () => {
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

        deepStrictEqual(
          differ.patch({ a: "a", b: "b", "": "c" }, [
            { op: "replace", path: "/a", value: "a2" },
            { op: "replace", path: "/b", value: null },
            { op: "replace", path: "/", value: "c2" }
          ]),
          { a: "a2", b: null, "": "c2" }
        )

        roundtrip(schema)
      })
    })

    describe("Record", () => {
      it("Record(String, Number)", () => {
        const schema = Schema.Record(Schema.String, Schema.Number)
        const differ = Differ.jsonPatch(schema)

        deepStrictEqual(differ.diff({ a: 1, b: 2 }, { a: 1, b: 2 }), [])
        deepStrictEqual(differ.diff({ a: 1, b: 2 }, { a: 1 }), [
          { op: "remove", path: "/b" }
        ])
        deepStrictEqual(differ.diff({ a: 1 }, { a: 1, b: 2 }), [
          { op: "add", path: "/b", value: 2 }
        ])
        deepStrictEqual(differ.diff({ a: 1, b: 2 }, { a: 1, b: 3 }), [
          { op: "replace", path: "/b", value: 3 }
        ])

        deepStrictEqual(
          differ.patch({ a: 1, b: 2 }, [
            { op: "replace", path: "/b", value: 3 }
          ]),
          { a: 1, b: 3 }
        )

        roundtrip(schema)
      })
    })

    describe("Tuple", () => {
      it("required elements", () => {
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

        deepStrictEqual(
          differ.patch(["a", 1], [
            { op: "replace", path: "/0", value: "b" },
            { op: "replace", path: "/1", value: 2 }
          ]),
          ["b", 2]
        )

        roundtrip(schema)
      })
    })

    describe("Array", () => {
      it("Array(Number)", () => {
        const schema = Schema.Array(Schema.Number)
        const differ = Differ.jsonPatch(schema)

        deepStrictEqual(differ.diff([], []), [])
        deepStrictEqual(differ.diff([1, 2], [1, 2]), [])
        deepStrictEqual(differ.diff([1, 2], [3, 2]), [
          { op: "replace", path: "/0", value: 3 }
        ])

        deepStrictEqual(
          differ.patch([1, 2], [
            { op: "replace", path: "/0", value: 3 }
          ]),
          [3, 2]
        )

        roundtrip(schema)
      })
    })

    describe("Union", () => {
      it("Union(String, Number)", () => {
        const schema = Schema.Union([Schema.String, Schema.Number])
        const differ = Differ.jsonPatch(schema)

        deepStrictEqual(differ.diff("a", "b"), [{ op: "replace", path: "", value: "b" }])
        deepStrictEqual(differ.diff(1, 2), [{ op: "replace", path: "", value: 2 }])
        deepStrictEqual(differ.diff("a", 1), [{ op: "replace", path: "", value: 1 }])
        deepStrictEqual(differ.diff(1, "a"), [{ op: "replace", path: "", value: "a" }])

        deepStrictEqual(
          differ.patch("a", [{ op: "replace", path: "", value: 2 }]),
          2
        )

        roundtrip(schema)
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

        roundtrip(schema)
      })
    })

    it("patch should return the same reference if nothing changed", () => {
      const schema = Schema.Struct({ a: Schema.String })
      const differ = Differ.jsonPatch(schema)
      const value = { a: "a" }
      strictEqual(differ.patch(value, []), value)
    })

    it("Option(String)", () => {
      const schema = Schema.Option(Schema.String)
      const differ = Differ.jsonPatch(schema)

      deepStrictEqual(differ.diff(Option.some("a"), Option.some("b")), [
        { op: "replace", path: "/value", value: "b" }
      ])

      deepStrictEqual(
        differ.patch(Option.some("a"), [
          { op: "replace", path: "/value", value: "b" }
        ]),
        Option.some("b")
      )

      roundtrip(schema)
    })
  })
})
