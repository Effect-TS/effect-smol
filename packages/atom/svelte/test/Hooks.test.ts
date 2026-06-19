import { fireEvent, render } from "@testing-library/svelte"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRef from "effect/unstable/reactivity/AtomRef"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { describe, expect, it } from "vitest"
import Counter from "./Counter.svelte"
import Reader from "./Reader.svelte"
import RefReader from "./RefReader.svelte"

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
