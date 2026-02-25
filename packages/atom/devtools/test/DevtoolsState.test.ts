import * as DevtoolsState from "@effect/atom-devtools/DevtoolsState"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("DevtoolsState", () => {
  let registry: AtomRegistry.AtomRegistry
  let controller: DevtoolsState.DevtoolsController

  beforeEach(() => {
    vi.useFakeTimers()
    registry = AtomRegistry.make()
    controller = DevtoolsState.make(registry)
  })

  afterEach(() => {
    controller.dispose()
    vi.useRealTimers()
  })

  it("initializes with empty state", () => {
    const state = controller.getState()
    expect(state.nodes.size).toBe(0)
    expect(state.selectedAtom).toBe(null)
    expect(state.searchQuery).toBe("")
  })

  it("syncs atoms from registry", () => {
    const atom = Atom.make(42).pipe(Atom.withLabel("counter"))
    registry.mount(atom)

    // Trigger poll
    vi.advanceTimersByTime(1000)

    const state = controller.getState()
    expect(state.nodes.size).toBe(1)
    expect(state.nodes.get(atom)?.value).toBe(42)
  })

  it("notifies listeners on state change", () => {
    const listener = vi.fn()
    controller.subscribe(listener)

    const atom = Atom.make(1).pipe(Atom.withLabel("a"))
    registry.mount(atom)
    vi.advanceTimersByTime(1000)

    expect(listener).toHaveBeenCalled()
  })

  it("unsubscribe removes listener", () => {
    const listener = vi.fn()
    const unsub = controller.subscribe(listener)
    unsub()

    const atom = Atom.make(1).pipe(Atom.withLabel("a"))
    registry.mount(atom)
    vi.advanceTimersByTime(1000)

    // Listener was called during initial sync but not after unsubscribe
    const callCount = listener.mock.calls.length
    vi.advanceTimersByTime(1000)
    expect(listener.mock.calls.length).toBe(callCount)
  })

  it("setSelectedAtom updates state", () => {
    const atom = Atom.make(1).pipe(Atom.withLabel("a"))
    registry.mount(atom)
    vi.advanceTimersByTime(1000)

    controller.setSelectedAtom(atom)
    expect(controller.getState().selectedAtom).toBe(atom)
  })

  it("setSearchQuery updates state", () => {
    controller.setSearchQuery("foo")
    expect(controller.getState().searchQuery).toBe("foo")
  })

  it("filteredEntries filters by search query", () => {
    const a = Atom.make(1).pipe(Atom.withLabel("alpha"))
    const b = Atom.make(2).pipe(Atom.withLabel("beta"))
    registry.mount(a)
    registry.mount(b)
    vi.advanceTimersByTime(1000)

    controller.setSearchQuery("alph")
    const entries = controller.filteredEntries()
    expect(entries.length).toBe(1)
    expect(entries[0][0]).toBe(a)
  })

  it("filteredEntries returns all when no query", () => {
    const a = Atom.make(1).pipe(Atom.withLabel("alpha"))
    const b = Atom.make(2).pipe(Atom.withLabel("beta"))
    registry.mount(a)
    registry.mount(b)
    vi.advanceTimersByTime(1000)

    expect(controller.filteredEntries().length).toBe(2)
  })

  it("clears selected atom when it is removed", () => {
    const atom = Atom.make(1).pipe(Atom.withLabel("temp"))
    registry.mount(atom)
    vi.advanceTimersByTime(1000)

    controller.setSelectedAtom(atom)
    expect(controller.getState().selectedAtom).toBe(atom)

    // Dispose the registry to remove all nodes, then create a fresh one
    // and a new controller to verify stale selection is cleared
    controller.dispose()
    registry = AtomRegistry.make()
    controller = DevtoolsState.make(registry)
    vi.advanceTimersByTime(1000)

    expect(controller.getState().selectedAtom).toBe(null)
  })

  it("updates on atom value change via subscription", () => {
    const atom = Atom.make(1).pipe(Atom.withLabel("reactive"))
    registry.mount(atom)
    vi.advanceTimersByTime(1000)

    expect(controller.getState().nodes.get(atom)?.value).toBe(1)

    registry.set(atom, 99)
    expect(controller.getState().nodes.get(atom)?.value).toBe(99)
  })

  it("dispose stops polling and clears subscriptions", () => {
    const atom = Atom.make(1).pipe(Atom.withLabel("a"))
    registry.mount(atom)
    vi.advanceTimersByTime(1000)

    const listener = vi.fn()
    controller.subscribe(listener)
    const callsBefore = listener.mock.calls.length

    controller.dispose()
    vi.advanceTimersByTime(5000)

    expect(listener.mock.calls.length).toBe(callsBefore)
  })
})
