/**
 * Svelte hooks for using Effect Atoms from components. Hooks read and write
 * atoms through the current `RegistryContext`, expose reactive read handles
 * whose `current` getter participates in Svelte reactivity, keep atoms mounted
 * for cleanup, and read `AtomRef` values.
 *
 * Each hook calls `injectRegistry()` and uses `$effect`, so each must be called
 * during component initialisation (the same rule as Svelte's `getContext`).
 * Reading the returned `current` getter later — in templates, `$effect`, or
 * `$derived` — is unrestricted.
 *
 * @since 4.0.0
 */
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRef from "effect/unstable/reactivity/AtomRef"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { untrack } from "svelte"
import { injectRegistry } from "./RegistryContext.ts"

/**
 * A reactive read handle. Reading `current` inside a Svelte effect, `$derived`,
 * or template subscribes the reader to the atom.
 *
 * @category models
 * @since 4.0.0
 */
export interface AtomValue<A> {
  readonly current: A
}

const makeReactive = <A>(
  registry: AtomRegistry.AtomRegistry,
  atom: () => Atom.Atom<A>
): AtomValue<A> => {
  const selected = $derived(atom())
  // Synchronous seed so server render and the first client render are correct;
  // Svelte `$effect` does not run on the server or before mount. The seed is a
  // one-off read, so `untrack` keeps it out of any caller's reactive graph.
  let value = $state<A>(untrack(() => registry.get(selected)))
  $effect(() => {
    value = registry.get(selected)
    return registry.subscribe(selected, (next) => {
      value = next
    })
  })
  return {
    get current() {
      return value
    }
  }
}

/**
 * Reads an atom's value as a reactive handle.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomValue: {
  <A>(atom: () => Atom.Atom<A>): AtomValue<A>
  <A, B>(atom: () => Atom.Atom<A>, f: (_: A) => B): AtomValue<B>
} = <A, B>(atom: () => Atom.Atom<A>, f?: (_: A) => B): AtomValue<A> | AtomValue<B> => {
  const registry = injectRegistry()
  return f ? makeReactive(registry, () => Atom.map(atom(), f)) : makeReactive(registry, atom)
}

const flattenExit = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}

function setAtom<R, W, Mode extends "value" | "promise" | "promiseExit" = never>(
  registry: AtomRegistry.AtomRegistry,
  atom: () => Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): "promise" extends Mode ? (
    (
      value: W,
      options?: {
        readonly signal?: AbortSignal | undefined
      } | undefined
    ) => Promise<AsyncResult.AsyncResult.Success<R>>
  ) :
  "promiseExit" extends Mode ? (
      (
        value: W,
        options?: {
          readonly signal?: AbortSignal | undefined
        } | undefined
      ) => Promise<Exit.Exit<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>>>
    ) :
  ((value: W | ((value: R) => W)) => void)
{
  if (options?.mode === "promise" || options?.mode === "promiseExit") {
    return ((value: W, opts?: any) => {
      const a = atom()
      registry.set(a, value)
      const promise = Effect.runPromiseExit(
        AtomRegistry.getResult(
          registry,
          a as Atom.Atom<AsyncResult.AsyncResult<any, any>>,
          { suspendOnWaiting: true }
        ),
        opts
      )
      return options!.mode === "promise" ? promise.then(flattenExit) : promise
    }) as any
  }
  return ((value: W | ((value: R) => W)) => {
    const a = atom()
    registry.set(a, typeof value === "function" ? (value as any)(registry.get(a)) : value)
  }) as any
}

/**
 * Reads a writable atom's value as a reactive handle and returns a setter.
 *
 * The setter accepts either a write value or an updater function. For
 * `AsyncResult` atoms, the `promise` and `promiseExit` modes return promises for
 * the success value or the full `Exit`.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtom = <R, W, Mode extends "value" | "promise" | "promiseExit" = never>(
  atom: () => Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): readonly [
  AtomValue<R>,
  write: "promise" extends Mode ? (
      (value: W) => Promise<AsyncResult.AsyncResult.Success<R>>
    ) :
    "promiseExit" extends Mode ? (
        (value: W) => Promise<Exit.Exit<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>>>
      ) :
    ((value: W | ((value: R) => W)) => void)
] => {
  const registry = injectRegistry()
  return [makeReactive(registry, atom), setAtom(registry, atom, options)] as const
}

/**
 * Returns a setter for a writable atom, keeping it mounted for the lifetime of
 * the calling component. Re-mounts if the selected atom changes.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomSet = <R, W, Mode extends "value" | "promise" | "promiseExit" = never>(
  atom: () => Atom.Writable<R, W>,
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
  const registry = injectRegistry()
  const selected = $derived(atom())
  $effect(() => registry.mount(selected))
  return setAtom(registry, atom, options)
}

/**
 * Keeps an atom mounted for the lifetime of the calling component, without
 * reading its value.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomMount = <A>(atom: () => Atom.Atom<A>): void => {
  const registry = injectRegistry()
  const selected = $derived(atom())
  $effect(() => registry.mount(selected))
}

/**
 * Returns a function that refreshes (re-runs) the given atom.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomRefresh = <A>(atom: () => Atom.Atom<A>): () => void => {
  const registry = injectRegistry()
  return () => registry.refresh(atom())
}

/**
 * Reads an `AtomRef` value as a reactive handle.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomRef = <A>(atomRef: () => AtomRef.ReadonlyRef<A>): AtomValue<A> => {
  const ref = $derived(atomRef())
  let value = $state<A>(untrack(() => ref.value))
  $effect(() => {
    value = ref.value
    return ref.subscribe((next) => {
      value = next
    })
  })
  return {
    get current() {
      return value
    }
  }
}
