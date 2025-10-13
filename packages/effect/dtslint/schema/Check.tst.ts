import type { Brand } from "effect/data"
import type { AST } from "effect/schema"
import { Schema } from "effect/schema"
import { describe, expect, it } from "tstyche"

describe("Check", () => {
  describe("and / annotate", () => {
    it("Filter + Filter", () => {
      const f1 = Schema.isInt()
      const f2 = Schema.isInt()

      expect(f1.and(f2)).type.toBe<AST.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<AST.FilterGroup<number>>()
    })

    it("Filter + FilterGroup", () => {
      const f1 = Schema.isInt()
      const f2 = Schema.isInt32()

      expect(f1.and(f2)).type.toBe<AST.FilterGroup<number>>()
      expect(f2.and(f1)).type.toBe<AST.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<AST.FilterGroup<number>>()
      expect(f2.and(f1).annotate({})).type.toBe<AST.FilterGroup<number>>()
    })

    it("FilterGroup + FilterGroup", () => {
      const f1 = Schema.isInt32()
      const f2 = Schema.isInt32()

      expect(f1.and(f2)).type.toBe<AST.FilterGroup<number>>()
      expect(f2.and(f1)).type.toBe<AST.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<AST.FilterGroup<number>>()
      expect(f2.and(f1).annotate({})).type.toBe<AST.FilterGroup<number>>()
    })

    it("RefinementGroup + Filter", () => {
      const f1 = Schema.isInt().pipe(Schema.isBranded("a"))
      const f2 = Schema.isInt()

      expect(f1.and(f2)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f2.and(f1)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f1.and(f2).annotate({})).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f2.and(f1).annotate({})).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a">, number>>()
    })

    it("RefinementGroup + RefinementGroup", () => {
      const f1 = Schema.isInt().pipe(Schema.isBranded("a"))
      const f2 = Schema.isInt().pipe(Schema.isBranded("b"))

      expect(f1.and(f2)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
      expect(f2.and(f1)).type.toBe<AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
      expect(f1.and(f2).annotate({})).type.toBe<
        AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
      >()
      expect(f2.and(f1).annotate({})).type.toBe<
        AST.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
      >()
    })
  })
})
