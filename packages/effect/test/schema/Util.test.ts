import { pipe } from "effect"
import { Schema, Util } from "effect/schema"
import { describe, it } from "vitest"
import { assertFalse, assertTrue, deepStrictEqual } from "../utils/assert.js"

describe("Util", () => {
  describe("augmentUnion", () => {
    it("should augment a union", () => {
      const b = Symbol.for("B")
      const schema = pipe(
        Schema.Union([
          Schema.Struct({ _tag: Schema.Literal("A"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.UniqueSymbol(b), b: Schema.FiniteFromString }),
          Schema.Union([
            Schema.Struct({ _tag: Schema.Literal(1), c: Schema.Boolean }),
            Schema.Struct({ _tag: Schema.Literal("D"), d: Schema.Date })
          ])
        ]),
        (union) => ({ ...union, ...Util.augmentUnion("_tag", union) })
      )

      // membersByTag
      deepStrictEqual(schema.membersByTag.A, schema.members[0])
      deepStrictEqual(schema.membersByTag[b], schema.members[1])
      deepStrictEqual(schema.membersByTag[1], schema.members[2].members[0])
      deepStrictEqual(schema.membersByTag["1"], schema.members[2].members[0])
      deepStrictEqual(schema.membersByTag.D, schema.members[2].members[1])

      // is
      assertTrue(schema.is({ _tag: "A", a: "a" }))
      assertFalse(schema.is({ _tag: "A", a: 1 }))

      assertTrue(schema.is({ _tag: b, b: 1 }))
      assertFalse(schema.is({ _tag: b, b: "b" }))

      assertTrue(schema.is({ _tag: 1, c: true }))
      assertFalse(schema.is({ _tag: 1, c: 1 }))

      assertTrue(schema.is({ _tag: "D", d: new Date() }))
      assertFalse(schema.is({ _tag: "D", d: "d" }))

      assertFalse(schema.is(null))
      assertFalse(schema.is({}))

      // isAnyOf
      const isAOr1 = schema.isAnyOf(["A", 1])
      assertTrue(isAOr1({ _tag: "A", a: "a" }))
      assertTrue(isAOr1({ _tag: 1, c: true }))
      assertFalse(isAOr1({ _tag: "D", d: new Date() }))
      assertFalse(isAOr1({ _tag: b, b: 1 }))

      // guards
      assertTrue(schema.guards.A({ _tag: "A", a: "a" }))
      assertFalse(schema.guards.A({ _tag: "A", a: 1 }))

      assertTrue(schema.guards[b]({ _tag: b, b: 1 }))
      assertFalse(schema.guards[b]({ _tag: b, b: "b" }))

      assertTrue(schema.guards[1]({ _tag: 1, c: true }))
      assertFalse(schema.guards[1]({ _tag: 1, c: 1 }))

      assertTrue(schema.guards.D({ _tag: "D", d: new Date() }))
      assertFalse(schema.guards.D({ _tag: "D", d: "d" }))

      // match
      deepStrictEqual(
        schema.match({ _tag: "A", a: "a" }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
        "A"
      )
      deepStrictEqual(
        pipe({ _tag: "A", a: "a" }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
        "A"
      )
      deepStrictEqual(
        schema.match({ _tag: b, b: 1 }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
        "B"
      )
      deepStrictEqual(
        pipe({ _tag: b, b: 1 }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
        "B"
      )
      deepStrictEqual(
        schema.match({ _tag: 1, c: true }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
        "C"
      )
      deepStrictEqual(
        pipe({ _tag: 1, c: true }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
        "C"
      )
      deepStrictEqual(
        schema.match({ _tag: "D", d: new Date() }, { A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" }),
        "D"
      )
      deepStrictEqual(
        pipe({ _tag: "D", d: new Date() }, schema.match({ A: () => "A", [b]: () => "B", 1: () => "C", D: () => "D" })),
        "D"
      )
    })

    it("should support multiple tags", () => {
      const schema = pipe(
        Schema.Union([
          Schema.Struct({ _tag: Schema.tag("A"), type: Schema.tag("TypeA"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.tag("B"), type: Schema.tag("TypeB"), b: Schema.FiniteFromString })
        ]),
        (union) => ({ ...union, ...Util.augmentUnion("type", union) })
      )

      // membersByTag
      deepStrictEqual(schema.membersByTag.TypeA, schema.members[0])
      deepStrictEqual(schema.membersByTag.TypeB, schema.members[1])
    })
  })
})
