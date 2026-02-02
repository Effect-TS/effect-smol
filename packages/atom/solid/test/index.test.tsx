import { assert, describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as AtomRef from "effect/unstable/reactivity/AtomRef"
import { createEffect, createRoot } from "solid-js"
import { createAtomRef, createAtomRefProp } from "../src/index.ts"

const renderAtomRef = function<A>(ref: AtomRef.ReadonlyRef<A>, onValue: (_: A) => void) {
  return createRoot((dispose) => {
    const accessor = createAtomRef(ref)
    createEffect(() => {
      onValue(accessor())
    })
    return dispose
  })
}

describe("atom-solid", () => {
  describe("AtomRef", () => {
    it.effect("updates when AtomRef changes", () =>
      Effect.sync(() => {
        const ref = AtomRef.make(0)
        let observed: number | undefined
        const dispose = renderAtomRef(ref, (value) => {
          observed = value
        })
        assert.strictEqual(observed, 0)
        ref.set(1)
        assert.strictEqual(observed, 1)
        dispose()
      }))

    it.effect("updates when AtomRef prop changes", () =>
      Effect.sync(() => {
        const ref = AtomRef.make({ count: 0, label: "a" })
        const propRef = createAtomRefProp(ref, "count")
        let observed: number | undefined
        const dispose = renderAtomRef(propRef, (value) => {
          observed = value
        })
        assert.strictEqual(observed, 0)
        ref.set({ count: 1, label: "a" })
        assert.strictEqual(observed, 1)
        dispose()
      }))

    it.effect("updates when AtomRef prop value changes", () =>
      Effect.sync(() => {
        const ref = AtomRef.make({ count: 0, label: "a" })
        let observed: number | undefined
        const dispose = renderAtomRef(createAtomRefProp(ref, "count"), (value) => {
          observed = value
        })
        assert.strictEqual(observed, 0)
        ref.set({ count: 2, label: "a" })
        assert.strictEqual(observed, 2)
        dispose()
      }))
  })
})
