import { Check, Schema } from "effect/schema"
import { TestSchema } from "effect/testing"
import { describe, it } from "vitest"
import { assertGetter, strictEqual } from "../utils/assert.ts"

const verifyGeneration = true

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

    it("should remove any existing identifier annotation", () => {
      const filter = Check.nonEmpty().annotate({
        identifier: "a"
      })
      strictEqual(filter.annotations?.identifier, "a")
      strictEqual(filter.annotate({}).annotations?.identifier, undefined)
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

      it("should remove any existing identifier annotation", () => {
        const filter = Check.int32().annotate({
          identifier: "a"
        })
        strictEqual(filter.annotations?.identifier, "a")
        strictEqual(filter.annotate({}).annotations?.identifier, undefined)
      })
    })
  })

  it("ulid", async () => {
    const schema = Schema.String.check(Check.ulid())
    const asserts = new TestSchema.Asserts(schema)

    if (verifyGeneration) {
      const arbitrary = asserts.arbitrary()
      arbitrary.verifyGeneration()
    }

    const decoding = asserts.decoding()
    await decoding.succeed("01H4PGGGJVN2DKP2K1H7EH996V")
    await decoding.fail(
      "",
      `Expected a string matching the regex ^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$, got ""`
    )
  })
})
