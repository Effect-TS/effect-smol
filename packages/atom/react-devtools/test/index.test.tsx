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

  it("can set value on writable atom", async () => {
    const atom = Atom.make(0).pipe(Atom.withLabel("writable"))
    registry.mount(atom)

    render(<AtomDevtools initialIsOpen />, { wrapper: Wrapper })

    await waitFor(() => {
      expect(screen.getByText("writable")).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText("writable"))

    const input = screen.getByTestId("devtools-set-input")
    fireEvent.change(input, { target: { value: "123" } })
    fireEvent.click(screen.getByTestId("devtools-set-btn"))

    expect(registry.get(atom)).toBe(123)
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
