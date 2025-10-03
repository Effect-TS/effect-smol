import { Differ, Schema, ToArbitrary } from "effect/schema"
import * as FastCheck from "effect/testing/FastCheck"
import { describe, it } from "vitest"
import { deepStrictEqual, strictEqual, throws } from "../utils/assert.ts"

function roundtrip<S extends Schema.Top>(schema: S) {
  const differ = Differ.makeJsonPatch(schema)
  const arbitrary = ToArbitrary.make(schema)
  const arb = arbitrary
  FastCheck.assert(
    FastCheck.property(arb, arb, (v1, v2) => {
      const patch = differ.diff(v1, v2)
      const patched = differ.patch(v1, patch)
      // two invalid dates are not considered equal by deepStrictEqual
      if (patched instanceof Date && v2 instanceof Date && Object.is(patched.getTime(), v2.getTime())) {
        return
      }
      deepStrictEqual(patched, v2)
    })
  )
}

describe("Differ", () => {
  describe("makeJsonPatch", () => {
    it("patch should return the same reference if nothing changed", () => {
      const schema = Schema.Struct({ a: Schema.String })
      const differ = Differ.makeJsonPatch(schema)
      const value = { a: "a" }
      strictEqual(differ.patch(value, []), value)
    })

    it("array removes are ordered highest → lowest (no index shifting)", () => {
      const differ = Differ.makeJsonPatch(Schema.Any)

      const oldValue = [0, 1, 2, 3, 4, 5]
      const newValue = [0, 1, 3]

      const patch = differ.diff(oldValue, newValue)

      const removeIdx = patch
        .filter((op) => op.op === "remove")
        .map((op) => Number(op.path.slice(1)))

      const sorted = [...removeIdx].sort((a, b) => b - a)
      deepStrictEqual(removeIdx, sorted)

      const patched = differ.patch(oldValue, patch)
      deepStrictEqual(patched, newValue)
    })

    it("object patches use stable key order (sorted keys)", () => {
      const differ = Differ.makeJsonPatch(Schema.Any)

      const oldValue = { b: 1, a: 1 }
      const newValue = { a: 2, b: 2 }

      const patch = differ.diff(oldValue, newValue)
      const replacePaths = patch.filter((op) => op.op === "replace").map((op) => op.path)

      deepStrictEqual(replacePaths, ["/a", "/b"])
      deepStrictEqual(differ.patch(oldValue, patch), newValue)
    })

    it(`"-" is only valid for objects and add into arrays`, () => {
      const differ = Differ.makeJsonPatch(Schema.Any)

      {
        const doc = { "-": 123, a: 1 }
        const out = differ.patch(doc, [
          { op: "remove", path: "/-" },
          { op: "replace", path: "/a", value: 0 }
        ])
        deepStrictEqual(out, { a: 0 })
      }

      // replace "/-" value
      {
        const doc = { "-": 1 }
        const out = differ.patch(doc, [{ op: "replace", path: "/-", value: 2 }])
        deepStrictEqual(out, { "-": 2 })
      }

      // replace "/-" should throw if key does not exist (replace requires existence)
      {
        const doc = {}
        throws(() => differ.patch(doc, [{ op: "replace", path: "/-", value: 2 }]))
      }

      // add with "-" appends
      {
        const doc = { xs: [1, 2] }
        const out = differ.patch(doc, [{ op: "add", path: "/xs/-", value: 3 }])
        deepStrictEqual(out, { xs: [1, 2, 3] })
      }

      // remove with "-" -> throws
      {
        const doc = { xs: [1, 2, 3] }
        throws(() => differ.patch(doc, [{ op: "remove", path: "/xs/-" }]))
      }

      // replace with "-" -> throws
      {
        const doc = { xs: [1, 2, 3] }
        throws(() => differ.patch(doc, [{ op: "replace", path: "/xs/-", value: 9 }]))
      }
    })

    it("replace requires the target to exist; add can create", () => {
      const differ = Differ.makeJsonPatch(Schema.Any)

      // add can create missing key
      {
        const doc = {}
        const out = differ.patch(doc, [{ op: "add", path: "/x", value: 1 }])
        deepStrictEqual(out, { x: 1 })
      }

      // replace on missing key throws
      {
        const doc = {}
        throws(() => differ.patch(doc, [{ op: "replace", path: "/x", value: 1 }]))
      }
    })

    it("root replace returns the provided reference (no clone)", () => {
      const differ = Differ.makeJsonPatch(Schema.Any)

      const newRef = { hello: "world" }
      const out = differ.patch({ old: true }, [{ op: "replace", path: "", value: newRef }])

      strictEqual(out, newRef) // same reference
      deepStrictEqual(out, newRef)
    })

    it("immutability: original input is not mutated by patch", () => {
      const differ = Differ.makeJsonPatch(Schema.Any)

      const oldValue = { a: { b: [1, 2, 3] } }

      const snapshot = JSON.parse(JSON.stringify(oldValue))
      const out = differ.patch(oldValue, [
        { op: "replace", path: "/a/b/1", value: 9 },
        { op: "remove", path: "/a/b/2" }
      ])

      deepStrictEqual(oldValue, snapshot) // unchanged
      deepStrictEqual(out, { a: { b: [1, 9] } })
    })

    it("Number", () => {
      const schema = Schema.Number
      const differ = Differ.makeJsonPatch(schema)

      deepStrictEqual(differ.diff(0, -0), [{ op: "replace", path: "", value: -0 }])
      deepStrictEqual(differ.diff(-0, 0), [{ op: "replace", path: "", value: 0 }])
      deepStrictEqual(differ.diff(NaN, NaN), [])
      deepStrictEqual(differ.diff(Infinity, Infinity), [])
      deepStrictEqual(differ.diff(-Infinity, -Infinity), [])

      deepStrictEqual(differ.patch(0, [{ op: "replace", path: "", value: -0 }]), -0)
      deepStrictEqual(differ.patch(-0, [{ op: "replace", path: "", value: 0 }]), 0)
    })

    it("Date", () => {
      const schema = Schema.Date
      const differ = Differ.makeJsonPatch(schema)

      deepStrictEqual(differ.diff(new Date("1970-01-01T00:00:00.000Z"), new Date(NaN)), [
        { op: "replace", path: "", value: "Invalid Date" }
      ])
    })
  })

  it("roundtrip", () => {
    roundtrip(Schema.Any.annotate({ arbitrary: { _tag: "Override", override: (fc) => fc.json() } }))
    roundtrip(Schema.String)
    roundtrip(Schema.Number)
    roundtrip(Schema.Date)
    roundtrip(Schema.Struct({
      a: Schema.String,
      "-": Schema.NullOr(Schema.String),
      "": Schema.String
    }))
    roundtrip(Schema.Record(Schema.String, Schema.Number))
    roundtrip(Schema.StructWithRest(
      Schema.Struct({
        a: Schema.Number,
        "-": Schema.Number,
        "": Schema.Number
      }),
      [Schema.Record(Schema.String, Schema.Number)]
    ))
    roundtrip(Schema.Tuple([Schema.String, Schema.Number]))
    roundtrip(Schema.Array(Schema.Number))
    roundtrip(Schema.TupleWithRest(
      Schema.Tuple([Schema.Number]),
      [Schema.String]
    ))
    roundtrip(Schema.TupleWithRest(
      Schema.Tuple([Schema.Number]),
      [Schema.String, Schema.Boolean]
    ))
    roundtrip(Schema.Union([Schema.String, Schema.Finite]))
    roundtrip(Schema.Option(Schema.String))
  })
})
