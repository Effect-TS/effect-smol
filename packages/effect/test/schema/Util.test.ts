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
          Schema.Struct({ _tag: Schema.Literal("B"), b: Schema.Number }),
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
          Schema.Struct({ _tag: Schema.Literal("A"), type: Schema.Literal("TypeA"), a: Schema.String }),
          Schema.Struct({ _tag: Schema.Literal("B"), type: Schema.Literal("TypeB"), b: Schema.Number })
        ]),
        (union) => ({ ...union, ...Util.augmentUnion("type", union) })
      )

      // membersByTag
      deepStrictEqual(schema.membersByTag.TypeA, schema.members[0])
      deepStrictEqual(schema.membersByTag.TypeB, schema.members[1])

      // guards
      deepStrictEqual(schema.guards.TypeA({ _tag: "A", type: "TypeA", a: "a" }), true)
      deepStrictEqual(schema.guards.TypeA({ _tag: "B", type: "TypeB", b: 1 }), false)

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
