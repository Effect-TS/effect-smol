/** @jsxImportSource solid-js */
import { assert, describe, it } from "@effect/vitest"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRef from "effect/unstable/reactivity/AtomRef"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import type { Accessor } from "solid-js"
import { createComponent, createEffect, createRoot } from "solid-js"
import {
  createAtom,
  createAtomInitialValues,
  createAtomRef,
  createAtomRefProp,
  createAtomRefPropValue,
  createAtomValue,
  RegistryContext
} from "../src/index.ts"

const renderAtomRef = function<A>(ref: AtomRef.ReadonlyRef<A>, onValue: (_: A) => void) {
  return createRoot((dispose) => {
    const accessor = createAtomRef(ref)
    createEffect(() => {
      onValue(accessor())
    })
    return dispose
  })
}

const renderAccessor = function<A>(makeAccessor: () => Accessor<A>, onValue: (_: A) => void) {
  return createRoot((dispose) => {
    const accessor = makeAccessor()
    createEffect(() => {
      onValue(accessor())
    })
    return dispose
  })
}

const renderAtomValue = function<A, B = A>(
  atom: Atom.Atom<A>,
  onValue: (_: B) => void,
  options?: { readonly registry?: AtomRegistry.AtomRegistry; readonly map?: (_: A) => B }
) {
  return createRoot((dispose) => {
    const run = () => {
      const accessor = options?.map ? createAtomValue(atom, options.map) : createAtomValue(atom)
      createEffect(() => {
        onValue(accessor() as B)
      })
      return null
    }

    if (options?.registry) {
      createComponent(RegistryContext.Provider, {
        value: options.registry,
        get children() {
          return run()
        }
      })
    } else {
      run()
    }

    return dispose
  })
}

describe("atom-solid", () => {
  describe("createAtomValue", () => {
    it("reads value from simple Atom", () => {
      const atom = Atom.make(42)
      let observed: number | undefined
      const dispose = renderAtomValue(atom, (value) => {
        observed = value
      })
      assert.strictEqual(observed, 42)
      dispose()
    })

    it("reads value with transform function", () => {
      const atom = Atom.make(42)
      let observed: number | undefined
      const dispose = renderAtomValue(atom, (value) => {
        observed = value
      }, { map: (value) => value * 2 })
      assert.strictEqual(observed, 84)
      dispose()
    })

    it("updates when Atom value changes", () => {
      const registry = AtomRegistry.make()
      const atom = Atom.make("initial")
      let observed: string | undefined
      const dispose = renderAtomValue(atom, (value) => {
        observed = value
      }, { registry })
      assert.strictEqual(observed, "initial")
      registry.set(atom, "updated")
      assert.strictEqual(observed, "updated")
      dispose()
    })

    it("works with computed Atom", () => {
      const baseAtom = Atom.make(10)
      const computedAtom = Atom.make((get) => get(baseAtom) * 2)
      let observed: number | undefined
      const dispose = renderAtomValue(computedAtom, (value) => {
        observed = value
      })
      assert.strictEqual(observed, 20)
      dispose()
    })
  })

  describe("createAtom", () => {
    it("updates value with setter", () => {
      const atom = Atom.make(0)
      let observed: number | undefined
      const dispose = createRoot((dispose) => {
        const [value, setValue] = createAtom(atom)
        createEffect(() => {
          observed = value()
        })
        createEffect(() => {
          if (value() !== 0) {
            return
          }
          setValue(1)
          setValue((current) => current + 1)
        })
        return dispose
      })
      assert.strictEqual(observed, 2)
      dispose()
    })
  })

  describe("createAtomInitialValues", () => {
    it("applies initial values once per registry", () => {
      const registry = AtomRegistry.make()
      const atom = Atom.make(0)
      createRoot((dispose) => {
        createComponent(RegistryContext.Provider, {
          value: registry,
          get children() {
            createAtomInitialValues([[atom, 1]])
            createAtomInitialValues([[atom, 2]])
            assert.strictEqual(registry.get(atom), 1)
            return null
          }
        })
        return dispose
      })
    })
  })

  describe("AtomRef", () => {
    it("updates when AtomRef changes", () => {
      const ref = AtomRef.make(0)
      let observed: number | undefined
      const dispose = renderAtomRef(ref, (value) => {
        observed = value
      })
      assert.strictEqual(observed, 0)
      ref.set(1)
      assert.strictEqual(observed, 1)
      dispose()
    })

    it("updates when AtomRef prop changes", () => {
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
    })

    it("updates when AtomRef prop value changes", () => {
      const ref = AtomRef.make({ count: 0, label: "a" })
      let observed: number | undefined
      const dispose = renderAccessor(() => createAtomRefPropValue(ref, "count"), (value) => {
        observed = value
      })
      assert.strictEqual(observed, 0)
      ref.set({ count: 2, label: "a" })
      assert.strictEqual(observed, 2)
      dispose()
    })
  })
})
