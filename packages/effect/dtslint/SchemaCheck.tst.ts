import type { Brand } from "effect"
import { Schema, SchemaCheck } from "effect"
import { describe, expect, it } from "tstyche"

describe("SchemaCheck", () => {
  it("asCheck", () => {
    const check = Schema.asCheck(SchemaCheck.maxLength(5))
    expect(check).type.toBe<
      <S extends Schema.Schema<{ readonly length: number }>>(self: S) => S["~rebuild.out"]
    >()
  })

  describe("and / annotate", () => {
    it("Filter + Filter", () => {
      const f1 = SchemaCheck.int()
      const f2 = SchemaCheck.int()

      expect(f1.and(f2)).type.toBe<SchemaCheck.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<SchemaCheck.FilterGroup<number>>()
    })

    it("Filter + FilterGroup", () => {
      const f1 = SchemaCheck.int()
      const f2 = SchemaCheck.int32()

      expect(f1.and(f2)).type.toBe<SchemaCheck.FilterGroup<number>>()
      expect(f2.and(f1)).type.toBe<SchemaCheck.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<SchemaCheck.FilterGroup<number>>()
      expect(f2.and(f1).annotate({})).type.toBe<SchemaCheck.FilterGroup<number>>()
    })

    it("FilterGroup + FilterGroup", () => {
      const f1 = SchemaCheck.int32()
      const f2 = SchemaCheck.int32()

      expect(f1.and(f2)).type.toBe<SchemaCheck.FilterGroup<number>>()
      expect(f2.and(f1)).type.toBe<SchemaCheck.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<SchemaCheck.FilterGroup<number>>()
      expect(f2.and(f1).annotate({})).type.toBe<SchemaCheck.FilterGroup<number>>()
    })

    it("Refinement + Filter", () => {
      const f1 = SchemaCheck.int().pipe(SchemaCheck.brand("a"))
      const f2 = SchemaCheck.int()

      expect(f1.and(f2)).type.toBe<SchemaCheck.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f2.and(f1)).type.toBe<SchemaCheck.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f1.and(f2).annotate({})).type.toBe<SchemaCheck.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f2.and(f1).annotate({})).type.toBe<SchemaCheck.RefinementGroup<number & Brand.Brand<"a">, number>>()
    })

    it("RefinementGroup + RefinementGroup", () => {
      const f1 = SchemaCheck.int().pipe(SchemaCheck.brand("a"))
      const f2 = SchemaCheck.int().pipe(SchemaCheck.brand("b"))

      expect(f1.and(f2)).type.toBe<SchemaCheck.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
      expect(f2.and(f1)).type.toBe<SchemaCheck.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
      expect(f1.and(f2).annotate({})).type.toBe<
        SchemaCheck.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
      >()
      expect(f2.and(f1).annotate({})).type.toBe<
        SchemaCheck.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
      >()
    })
  })
})
