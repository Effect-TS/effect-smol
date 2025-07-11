import { pipe } from "effect"
import { Schema, Util } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.js"

describe("Util", () => {
  describe("augmentUnion", () => {
    it("should augment a union", () => {
      const schema = pipe(
        Schema.Union([
          Schema.Struct({ _tag: Schema.Literal("A"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.Literal("B"), b: Schema.FiniteFromString }),
          Schema.Union([
            Schema.Struct({ _tag: Schema.Literal("C"), c: Schema.Boolean }),
            Schema.Struct({ _tag: Schema.Literal("D"), d: Schema.Date })
          ])
        ]),
        (union) => ({ ...union, ...Util.augmentUnion("_tag", union) })
      )

      // membersByTag
      deepStrictEqual(schema.membersByTag.A, schema.members[0])
      deepStrictEqual(schema.membersByTag.B, schema.members[1])
      deepStrictEqual(schema.membersByTag.C, schema.members[2].members[0])
      deepStrictEqual(schema.membersByTag.D, schema.members[2].members[1])

      // is
      deepStrictEqual(schema.is({ _tag: "A", a: "a" }), true)
      deepStrictEqual(schema.is({ _tag: "B", b: 1 }), true)
      deepStrictEqual(schema.is({ _tag: "C", c: true }), true)
      deepStrictEqual(schema.is({ _tag: "D", d: new Date() }), true)
      deepStrictEqual(schema.is(null), false)
      deepStrictEqual(schema.is({}), false)
      deepStrictEqual(schema.is({ _tag: "A", b: 1 }), false)
      deepStrictEqual(schema.is({ _tag: "B", a: "a" }), false)
      deepStrictEqual(schema.is({ _tag: "C", a: "a" }), false)
      deepStrictEqual(schema.is({ _tag: "D", a: "a" }), false)
      deepStrictEqual(schema.is({ _tag: "C", b: 1 }), false)
      deepStrictEqual(schema.is({ _tag: "D", b: 1 }), false)
      deepStrictEqual(schema.is({ _tag: "D", c: true }), false)
      deepStrictEqual(schema.is({ _tag: "A", c: true }), false)

      // guards
      deepStrictEqual(schema.guards.A({ _tag: "B", b: 1 }), false)
      deepStrictEqual(schema.guards.B({ _tag: "A", a: "a" }), false)
      deepStrictEqual(schema.guards.B({ _tag: "B", b: 1 }), true)
      deepStrictEqual(schema.guards.C({ _tag: "A", a: "a" }), false)
      deepStrictEqual(schema.guards.C({ _tag: "C", c: true }), true)
      deepStrictEqual(schema.guards.D({ _tag: "A", a: "a" }), false)
      deepStrictEqual(schema.guards.D({ _tag: "D", d: new Date() }), true)

      // match
      deepStrictEqual(
        schema.match({ _tag: "A", a: "a" }, { A: () => "A", B: () => "B", C: () => "C", D: () => "D" }),
        "A"
      )
      deepStrictEqual(
        pipe({ _tag: "A", a: "a" }, schema.match({ A: () => "A", B: () => "B", C: () => "C", D: () => "D" })),
        "A"
      )
      deepStrictEqual(
        schema.match({ _tag: "B", b: 1 }, { A: () => "A", B: () => "B", C: () => "C", D: () => "D" }),
        "B"
      )
      deepStrictEqual(
        pipe({ _tag: "B", b: 1 }, schema.match({ A: () => "A", B: () => "B", C: () => "C", D: () => "D" })),
        "B"
      )
      deepStrictEqual(
        schema.match({ _tag: "C", c: true }, { A: () => "A", B: () => "B", C: () => "C", D: () => "D" }),
        "C"
      )
      deepStrictEqual(
        pipe({ _tag: "C", c: true }, schema.match({ A: () => "A", B: () => "B", C: () => "C", D: () => "D" })),
        "C"
      )
      deepStrictEqual(
        schema.match({ _tag: "D", d: new Date() }, { A: () => "A", B: () => "B", C: () => "C", D: () => "D" }),
        "D"
      )
      deepStrictEqual(
        pipe({ _tag: "D", d: new Date() }, schema.match({ A: () => "A", B: () => "B", C: () => "C", D: () => "D" })),
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

      // is
      deepStrictEqual(schema.is({ _tag: "A", type: "TypeA", a: "a" }), true)
      deepStrictEqual(schema.is({ _tag: "B", type: "TypeB", b: 1 }), true)
      deepStrictEqual(schema.is(null), false)
      deepStrictEqual(schema.is({}), false)
      deepStrictEqual(schema.is({ _tag: "A", type: "TypeB", b: 1 }), false)
      deepStrictEqual(schema.is({ _tag: "B", type: "TypeA", a: "a" }), false)

      // guards
      deepStrictEqual(schema.guards.TypeA({ _tag: "A", type: "TypeA", a: "a" }), true)
      deepStrictEqual(schema.guards.TypeA({ _tag: "B", type: "TypeB", b: 1 }), false)
      deepStrictEqual(schema.guards.TypeB({ _tag: "A", type: "TypeA", a: "a" }), false)
      deepStrictEqual(schema.guards.TypeB({ _tag: "B", type: "TypeB", b: 1 }), true)

      // match
      deepStrictEqual(
        schema.match({ _tag: "A", type: "TypeA", a: "a" }, { TypeA: () => "TypeA", TypeB: () => "TypeB" }),
        "TypeA"
      )
      deepStrictEqual(
        pipe({ _tag: "A", type: "TypeA", a: "a" }, schema.match({ TypeA: () => "TypeA", TypeB: () => "TypeB" })),
        "TypeA"
      )
      deepStrictEqual(
        schema.match({ _tag: "B", type: "TypeB", b: 1 }, { TypeA: () => "TypeA", TypeB: () => "TypeB" }),
        "TypeB"
      )
      deepStrictEqual(
        pipe({ _tag: "B", type: "TypeB", b: 1 }, schema.match({ TypeA: () => "TypeA", TypeB: () => "TypeB" })),
        "TypeB"
      )
    })
  })
})
