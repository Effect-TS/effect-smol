import type { Brand } from "effect/data"
import { Check, Schema } from "effect/schema"
import { describe, expect, it } from "tstyche"

describe("Check", () => {
  it("asCheck", () => {
    const check = Schema.asCheck(Check.maxLength(5))
    expect(check).type.toBe<
      <S extends Schema.Schema<{ readonly length: number }>>(self: S) => S["~rebuild.out"]
    >()
  })

  describe("and / annotate", () => {
    it("Filter + Filter", () => {
      const f1 = Check.int()
      const f2 = Check.int()

      expect(f1.and(f2)).type.toBe<Check.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<Check.FilterGroup<number>>()
    })

    it("Filter + FilterGroup", () => {
      const f1 = Check.int()
      const f2 = Check.int32()

      expect(f1.and(f2)).type.toBe<Check.FilterGroup<number>>()
      expect(f2.and(f1)).type.toBe<Check.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<Check.FilterGroup<number>>()
      expect(f2.and(f1).annotate({})).type.toBe<Check.FilterGroup<number>>()
    })

    it("FilterGroup + FilterGroup", () => {
      const f1 = Check.int32()
      const f2 = Check.int32()

      expect(f1.and(f2)).type.toBe<Check.FilterGroup<number>>()
      expect(f2.and(f1)).type.toBe<Check.FilterGroup<number>>()
      expect(f1.and(f2).annotate({})).type.toBe<Check.FilterGroup<number>>()
      expect(f2.and(f1).annotate({})).type.toBe<Check.FilterGroup<number>>()
    })

    it("RefinementGroup + Filter", () => {
      const f1 = Check.int().pipe(Check.brand("a"))
      const f2 = Check.int()

      expect(f1.and(f2)).type.toBe<Check.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f2.and(f1)).type.toBe<Check.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f1.and(f2).annotate({})).type.toBe<Check.RefinementGroup<number & Brand.Brand<"a">, number>>()
      expect(f2.and(f1).annotate({})).type.toBe<Check.RefinementGroup<number & Brand.Brand<"a">, number>>()
    })

    it("RefinementGroup + RefinementGroup", () => {
      const f1 = Check.int().pipe(Check.brand("a"))
      const f2 = Check.int().pipe(Check.brand("b"))

      expect(f1.and(f2)).type.toBe<Check.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
      expect(f2.and(f1)).type.toBe<Check.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>>()
      expect(f1.and(f2).annotate({})).type.toBe<
        Check.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
      >()
      expect(f2.and(f1).annotate({})).type.toBe<
        Check.RefinementGroup<number & Brand.Brand<"a"> & Brand.Brand<"b">, number>
      >()
    })
  })
})
