import { Check } from "effect/schema"
import { describe, it } from "vitest"
import { assertGetter, strictEqual } from "../utils/assert.ts"

describe("Check", () => {
  describe("Filter", () => {
    describe("annotate", () => {
      it("should keep getters", () => {
        const filter = Check.nonEmpty().annotate({
          get title() {
            return "value"
          }
        })
        const annotations = filter.annotations
        assertGetter(annotations, "title", "value")
      })

      it("should preserve existing getters when merging", () => {
        const filter = Check.nonEmpty()
          .annotate({
            a: "a",
            get b() {
              return "b"
            },
            get c() {
              return "c"
            }
          })
          .annotate({
            get c() {
              return "c2"
            },
            get d() {
              return "d"
            }
          })

        const annotations = filter.annotations
        strictEqual(annotations?.a, "a")
        assertGetter(annotations, "b", "b")
        assertGetter(annotations, "c", "c2")
        assertGetter(annotations, "d", "d")
      })
    })
  })

  describe("FilterGroup", () => {
    describe("annotate", () => {
      it("should keep getters", () => {
        const filter = Check.int32().annotate({
          get title() {
            return "value"
          }
        })
        const annotations = filter.annotations
        assertGetter(annotations, "title", "value")
      })

      it("should preserve existing getters when merging", () => {
        const filter = Check.int32()
          .annotate({
            a: "a",
            get b() {
              return "b"
            },
            get c() {
              return "c"
            }
          })
          .annotate({
            get c() {
              return "c2"
            },
            get d() {
              return "d"
            }
          })

        const annotations = filter.annotations
        strictEqual(annotations?.a, "a")
        assertGetter(annotations, "b", "b")
        assertGetter(annotations, "c", "c2")
        assertGetter(annotations, "d", "d")
      })
    })
  })
})
