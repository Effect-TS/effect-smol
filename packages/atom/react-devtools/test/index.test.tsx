/// <reference types="@testing-library/jest-dom" />
import * as RegistryContext from "@effect/atom-react/RegistryContext"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import * as React from "react"
import { beforeEach, describe, expect, it } from "vitest"
import { AtomDevtools } from "../src/index.ts"

describe("atom-react-devtools", () => {
  let registry: AtomRegistry.AtomRegistry

  beforeEach(() => {
    localStorage.clear()
    registry = AtomRegistry.make()
  })

  const Wrapper: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => (
    <RegistryContext.RegistryContext.Provider value={registry}>
      {children}
    </RegistryContext.RegistryContext.Provider>
  )

  it("renders toggle button", () => {
    render(<AtomDevtools />, { wrapper: Wrapper })
    expect(screen.getByTestId("devtools-toggle")).toBeInTheDocument()
  })

  it("panel is closed by default", () => {
    render(<AtomDevtools />, { wrapper: Wrapper })
    expect(screen.queryByTestId("devtools-panel")).not.toBeInTheDocument()
  })

  it("opens panel when toggle is clicked", () => {
    render(<AtomDevtools />, { wrapper: Wrapper })
    fireEvent.click(screen.getByTestId("devtools-toggle"))
    expect(screen.getByTestId("devtools-panel")).toBeInTheDocument()
  })

  it("opens panel initially when initialIsOpen is true", () => {
    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })
    expect(screen.getByTestId("devtools-panel")).toBeInTheDocument()
  })

  it("persists open state in localStorage", () => {
    render(<AtomDevtools />, { wrapper: Wrapper })
    fireEvent.click(screen.getByTestId("devtools-toggle"))
    expect(localStorage.getItem("effect-atom-devtools-open")).toBe("true")
  })

  it("displays atoms from registry", async () => {
    const atom = Atom.make(42).pipe(Atom.withLabel("counter"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("counter")).toBeInTheDocument()
    })
  })

  it("filters atoms by search query", async () => {
    const a = Atom.make(1).pipe(Atom.withLabel("alpha"))
    const b = Atom.make(2).pipe(Atom.withLabel("beta"))
    registry.mount(a)
    registry.mount(b)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("alpha")).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId("devtools-search"), { target: { value: "alph" } })

    expect(screen.getByText("alpha")).toBeInTheDocument()
    expect(screen.queryByText("beta")).not.toBeInTheDocument()
  })

  it("shows detail panel when atom is selected", async () => {
    const atom = Atom.make(99).pipe(Atom.withLabel("myAtom"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("myAtom")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("myAtom"))

    expect(screen.getByTestId("devtools-detail")).toBeInTheDocument()
  })

  it("inline edit: double-click opens editor, Enter submits", async () => {
    const atom = Atom.make(42).pipe(Atom.withLabel("editable"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("editable")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("editable"))

    const leaf = screen.getByTestId("devtools-value-leaf")
    expect(leaf).toHaveTextContent("42")

    fireEvent.doubleClick(leaf)

    const input = screen.getByTestId("devtools-inline-edit")
    expect(input).toBeInTheDocument()
    fireEvent.change(input, { target: { value: "99" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(registry.get(atom)).toBe(99)
  })

  it("inline edit: Escape cancels edit", async () => {
    const atom = Atom.make(10).pipe(Atom.withLabel("cancelable"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("cancelable")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("cancelable"))

    const leaf = screen.getByTestId("devtools-value-leaf")
    fireEvent.doubleClick(leaf)

    const input = screen.getByTestId("devtools-inline-edit")
    fireEvent.change(input, { target: { value: "999" } })
    fireEvent.keyDown(input, { key: "Escape" })

    expect(registry.get(atom)).toBe(10)
  })

  it("inline edit: nested value update", async () => {
    const atom = Atom.make({ name: "Alice", age: 30 }).pipe(Atom.withLabel("nested"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("nested")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("nested"))

    const leaves = screen.getAllByTestId("devtools-value-leaf")
    const nameLeaf = leaves.find((el) => el.textContent === "\"Alice\"")!
    expect(nameLeaf).toBeDefined()

    fireEvent.doubleClick(nameLeaf)

    const input = screen.getByTestId("devtools-inline-edit")
    fireEvent.change(input, { target: { value: "Bob" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(registry.get(atom)).toEqual({ name: "Bob", age: 30 })
  })

  it("read-only atoms do not show edit affordance", async () => {
    const base = Atom.make(5).pipe(Atom.withLabel("base"))
    const derived = Atom.make((get: Atom.Context) => get(base) * 2).pipe(Atom.withLabel("derived"))
    registry.mount(derived)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("derived")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("derived"))

    const leaf = screen.getByTestId("devtools-value-leaf")
    fireEvent.doubleClick(leaf)

    expect(screen.queryByTestId("devtools-inline-edit")).not.toBeInTheDocument()
  })

  it("array: add item via + Add item button", async () => {
    const atom = Atom.make(["a", "b"]).pipe(Atom.withLabel("arr"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("arr")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("arr"))

    const addBtn = screen.getByTestId("devtools-array-add-btn")
    fireEvent.click(addBtn)

    const input = screen.getByTestId("devtools-add-input")
    fireEvent.change(input, { target: { value: "c" } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(registry.get(atom)).toEqual(["a", "b", "c"])
  })

  it("array: remove item via × button", async () => {
    const atom = Atom.make([10, 20, 30]).pipe(Atom.withLabel("removable"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("removable")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("removable"))

    // Hover over the first element row to reveal the × button
    const leaves = screen.getAllByTestId("devtools-value-leaf")
    const firstLeaf = leaves.find((el) => el.textContent === "10")!
    const row = firstLeaf.closest("[data-testid='devtools-value-leaf']")!.parentElement!.parentElement!
    fireEvent.mouseEnter(row)

    const removeBtn = screen.getAllByTestId("devtools-remove-btn")[0]
    fireEvent.click(removeBtn)

    expect(registry.get(atom)).toEqual([20, 30])
  })

  it("object: add key via + Add key button", async () => {
    const atom = Atom.make({ x: 1 }).pipe(Atom.withLabel("obj"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("obj")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("obj"))

    const addBtn = screen.getByTestId("devtools-object-add-btn")
    fireEvent.click(addBtn)

    const keyInput = screen.getByTestId("devtools-addkey-key")
    const valInput = screen.getByTestId("devtools-addkey-value")
    fireEvent.change(keyInput, { target: { value: "y" } })
    fireEvent.change(valInput, { target: { value: "2" } })
    fireEvent.keyDown(valInput, { key: "Enter" })

    expect(registry.get(atom)).toEqual({ x: 1, y: 2 })
  })

  it("object: remove key via × button", async () => {
    const atom = Atom.make({ a: 1, b: 2 }).pipe(Atom.withLabel("objRemove"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("objRemove")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("objRemove"))

    const leaves = screen.getAllByTestId("devtools-value-leaf")
    const aLeaf = leaves.find((el) => el.textContent === "1")!
    const row = aLeaf.closest("[data-testid='devtools-value-leaf']")!.parentElement!.parentElement!
    fireEvent.mouseEnter(row)

    const removeBtn = screen.getAllByTestId("devtools-remove-btn")[0]
    fireEvent.click(removeBtn)

    expect(registry.get(atom)).toEqual({ b: 2 })
  })

  it("can refresh an atom", async () => {
    let count = 0
    const atom = Atom.readable(() => count++).pipe(Atom.withLabel("refreshable"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("refreshable")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("refreshable"))

    const refreshBtn = screen.getByTestId("devtools-refresh-btn")
    act(() => {
      fireEvent.click(refreshBtn)
    })

    expect(count).toBeGreaterThan(1)
  })
})
