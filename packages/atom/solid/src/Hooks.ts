/**
 * @since 1.0.0
 */
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRef from "effect/unstable/reactivity/AtomRef"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import type { Accessor } from "solid-js"
import { createEffect, createMemo, createSignal, onCleanup, useContext } from "solid-js"
import { RegistryContext } from "./RegistryContext.ts"

const initialValuesSet = new WeakMap<AtomRegistry.AtomRegistry, WeakSet<Atom.Atom<any>>>()

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomInitialValues = (initialValues: Iterable<readonly [Atom.Atom<any>, any]>): void => {
  const registry = useContext(RegistryContext)
  let set = initialValuesSet.get(registry)
  if (set === undefined) {
    set = new WeakSet()
    initialValuesSet.set(registry, set)
  }
  for (const [atom, value] of initialValues) {
    if (!set.has(atom)) {
      set.add(atom)
      ;(registry as any).ensureNode(atom).setValue(value)
    }
  }
}

const storeRegistry = new WeakMap<AtomRegistry.AtomRegistry, WeakMap<Atom.Atom<any>, Accessor<any>>>()

function createStore<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): Accessor<A> {
  let stores = storeRegistry.get(registry)
  if (stores === undefined) {
    stores = new WeakMap()
    storeRegistry.set(registry, stores)
  }
  const store = stores.get(atom)
  if (store !== undefined) {
    return store
  }
  const [value, setValue] = createSignal<A>(registry.get(atom))
  createEffect(() => {
    const dispose = registry.subscribe(atom, (next) => setValue(() => next))
    onCleanup(dispose)
  })
  stores.set(atom, value)
  return value
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomValue: {
  <A>(atom: Atom.Atom<A>): Accessor<A>
  <A, B>(atom: Atom.Atom<A>, f: (_: A) => B): Accessor<B>
} = <A>(atom: Atom.Atom<A>, f?: (_: A) => A): Accessor<A> => {
  const registry = useContext(RegistryContext)
  if (f) {
    const atomB = createMemo(() => Atom.map(atom, f))
    return createMemo(() => createStore(registry, atomB())())
  }
  return createStore(registry, atom)
}

function mountAtom<A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>): void {
  const dispose = registry.mount(atom)
  onCleanup(dispose)
}

function setAtom<R, W, Mode extends "value" | "promise" | "promiseExit" = never>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): "promise" extends Mode ? (
    (value: W) => Promise<AsyncResult.AsyncResult.Success<R>>
  ) :
  "promiseExit" extends Mode ? (
      (value: W) => Promise<Exit.Exit<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>>>
    ) :
  ((value: W | ((value: R) => W)) => void)
{
  if (options?.mode === "promise" || options?.mode === "promiseExit") {
    return ((value: W) => {
      registry.set(atom, value)
      const promise = Effect.runPromiseExit(
        AtomRegistry.getResult(registry, atom as Atom.Atom<AsyncResult.AsyncResult<any, any>>, {
          suspendOnWaiting: true
        })
      )
      return options!.mode === "promise" ? promise.then(flattenExit) : promise
    }) as any
  }
  return ((value: W | ((value: R) => W)) => {
    registry.set(atom, typeof value === "function" ? (value as any)(registry.get(atom)) : value)
  }) as any
}

const flattenExit = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomMount = <A>(atom: Atom.Atom<A>): void => {
  const registry = useContext(RegistryContext)
  mountAtom(registry, atom)
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomSet = <
  R,
  W,
  Mode extends "value" | "promise" | "promiseExit" = never
>(
  atom: Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): "promise" extends Mode ? (
    (value: W) => Promise<AsyncResult.AsyncResult.Success<R>>
  ) :
  "promiseExit" extends Mode ? (
      (value: W) => Promise<Exit.Exit<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>>>
    ) :
  ((value: W | ((value: R) => W)) => void) =>
{
  const registry = useContext(RegistryContext)
  mountAtom(registry, atom)
  return setAtom(registry, atom, options)
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomRefresh = <A>(atom: Atom.Atom<A>): () => void => {
  const registry = useContext(RegistryContext)
  mountAtom(registry, atom)
  return () => {
    registry.refresh(atom)
  }
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtom = <R, W, const Mode extends "value" | "promise" | "promiseExit" = never>(
  atom: Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): readonly [
  value: Accessor<R>,
  write: "promise" extends Mode ? (
      (value: W) => Promise<AsyncResult.AsyncResult.Success<R>>
    ) :
    "promiseExit" extends Mode ? (
        (value: W) => Promise<Exit.Exit<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>>>
      ) :
    ((value: W | ((value: R) => W)) => void)
] => {
  const registry = useContext(RegistryContext)
  return [
    createStore(registry, atom),
    setAtom(registry, atom, options)
  ] as const
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomSubscribe = <A>(
  atom: Atom.Atom<A>,
  f: (_: A) => void,
  options?: { readonly immediate?: boolean }
): void => {
  const registry = useContext(RegistryContext)
  createEffect(() => {
    const dispose = registry.subscribe(atom, f, options)
    onCleanup(dispose)
  })
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomRef = <A>(ref: AtomRef.ReadonlyRef<A>): Accessor<A> => {
  const [value, setValue] = createSignal(ref.value)
  let tracked = false
  const accessor = () => {
    tracked = true
    return value()
  }
  createEffect(() => {
    if (!tracked) {
      return
    }
    const dispose = ref.subscribe((next) => setValue(() => next))
    onCleanup(dispose)
  })
  return accessor
}

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomRefProp = <A, K extends keyof A>(ref: AtomRef.AtomRef<A>, prop: K): AtomRef.AtomRef<A[K]> =>
  ref.prop(prop)

/**
 * @since 1.0.0
 * @category hooks
 */
export const createAtomRefPropValue = <A, K extends keyof A>(ref: AtomRef.AtomRef<A>, prop: K): Accessor<A[K]> =>
  createAtomRef(createAtomRefProp(ref, prop))
