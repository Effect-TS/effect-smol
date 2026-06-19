import { fireEvent, render } from "@testing-library/svelte"
import * as Schema from "effect/Schema"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRef from "effect/unstable/reactivity/AtomRef"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as Hydration from "effect/unstable/reactivity/Hydration"
import { describe, expect, it } from "vitest"
import Counter from "./Counter.svelte"
import Hydrated from "./Hydrated.svelte"
import Reader from "./Reader.svelte"
import RefPropReader from "./RefPropReader.svelte"
import RefReader from "./RefReader.svelte"
import StateInput from "./StateInput.svelte"
import Suspense from "./Suspense.svelte"

describe("useAtom", () => {
  it("reads the initial value and updates on set", async () => {
    const registry = AtomRegistry.make()
    const countAtom = Atom.make(0)
    const { getByTestId } = render(Counter, { props: { registry, atom: () => countAtom } })

    const btn = getByTestId("btn")
    expect(btn.textContent).toBe("0")
    await fireEvent.click(btn)
    expect(btn.textContent).toBe("1")
    await fireEvent.click(btn)
    expect(btn.textContent).toBe("2")
  })

  it("reflects external registry writes", async () => {
    const registry = AtomRegistry.make()
    const countAtom = Atom.make(5)
    const { findByTestId } = render(Counter, { props: { registry, atom: () => countAtom } })

    const btn = await findByTestId("btn")
    expect(btn.textContent).toBe("5")
    registry.set(countAtom, 10)
    await Promise.resolve()
    expect(btn.textContent).toBe("10")
  })
})

describe("useAtomValue", () => {
  it("reads a transformed value and stays live", async () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make(3)
    const { getByTestId } = render(Reader, { props: { registry, atom: () => atom } })

    const span = getByTestId("value")
    expect(span.textContent).toBe("6")
    registry.set(atom, 4)
    await Promise.resolve()
    expect(span.textContent).toBe("8")
  })
})

describe("useAtomState", () => {
  it("reads via current, writes through bind:, and reflects external writes", async () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make("a")
    const { getByTestId } = render(StateInput, { props: { registry, atom: () => atom } })

    const input = getByTestId("input") as HTMLInputElement
    const value = getByTestId("value")
    expect(input.value).toBe("a")

    await fireEvent.input(input, { target: { value: "b" } })
    expect(registry.get(atom)).toBe("b")
    expect(value.textContent).toBe("b")

    registry.set(atom, "c")
    await Promise.resolve()
    expect(input.value).toBe("c")
  })
})

describe("useAtomRef", () => {
  it("reads the initial ref value and updates on change", async () => {
    const ref = AtomRef.make(0)
    const { getByTestId } = render(RefReader, { props: { atomRef: () => ref } })

    const span = getByTestId("ref")
    expect(span.textContent).toBe("0")
    ref.set(1)
    await Promise.resolve()
    expect(span.textContent).toBe("1")
  })
})

describe("useAtomRefPropValue", () => {
  it("reads a property value and updates when the prop changes", async () => {
    const ref = AtomRef.make({ count: 0, label: "a" })
    const { getByTestId } = render(RefPropReader, { props: { atomRef: () => ref } })

    const span = getByTestId("count")
    expect(span.textContent).toBe("0")
    ref.set({ count: 2, label: "a" })
    await Promise.resolve()
    expect(span.textContent).toBe("2")
  })
})

describe("hydrateAtoms", () => {
  it("restores dehydrated serializable atom state before children read it", () => {
    const countAtom = Atom.make(0).pipe(
      Atom.serializable({ key: "count", schema: Schema.Number })
    )

    // Server: produce dehydrated state from a registry that holds a value.
    const serverRegistry = AtomRegistry.make()
    serverRegistry.mount(countAtom)
    serverRegistry.set(countAtom, 42)
    const state = Hydration.dehydrate(serverRegistry)

    // Client: a fresh registry hydrated before the child reads the atom.
    const registry = AtomRegistry.make()
    const { getByTestId } = render(Hydrated, { props: { registry, state, atom: () => countAtom } })

    expect(getByTestId("hydrated").textContent).toBe("42")
  })
})

describe("useAtomSuspense", () => {
  it("resolves to the success value", async () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make(AsyncResult.success<number, Error>(5))
    const { findByText } = render(Suspense, { props: { registry, atom: () => atom } })

    expect(await findByText("5")).toBeTruthy()
  })

  it("stays pending on an initial result", async () => {
    const registry = AtomRegistry.make()
    const atom = Atom.make(AsyncResult.initial<number, Error>())
    const { getByTestId } = render(Suspense, { props: { registry, atom: () => atom } })

    await Promise.resolve()
    expect(getByTestId("state").textContent).toBe("pending")
  })
})
