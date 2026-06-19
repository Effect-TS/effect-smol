/**
 * Svelte hooks for using Effect Atoms from components. Hooks read and write
 * atoms through the current `RegistryContext`, expose reactive read handles
 * whose `current` getter participates in Svelte reactivity, keep atoms mounted
 * for cleanup, and read `AtomRef` values.
 *
 * Reactive read handles are backed by `createSubscriber` from
 * `svelte/reactivity`: the value is pulled synchronously in the `current`
 * getter (so server render and the first client render are correct), and a
 * subscription is established only while `current` is read from a reactive
 * context (template, `$derived`, or `$effect`).
 *
 * Each hook calls `injectRegistry()` (and the mounting hooks call `onDestroy`),
 * so each must be called during component initialisation — the same rule as
 * Svelte's own `getContext`.
 *
 * @since 4.0.0
 */
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import type * as Atom from "effect/unstable/reactivity/Atom"
import type * as AtomRef from "effect/unstable/reactivity/AtomRef"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { onDestroy } from "svelte"
import { createSubscriber } from "svelte/reactivity"
import { injectRegistry } from "./RegistryContext.ts"

/**
 * A reactive read handle. Reading `current` inside a Svelte effect, `$derived`,
 * or template subscribes the reader to the underlying source.
 *
 * @category models
 * @since 4.0.0
 */
export interface AtomValue<A> {
  readonly current: A
}

/**
 * A two-way reactive handle whose `current` property is both readable and
 * assignable, so it can be driven by Svelte's `bind:` directive — e.g.
 * `<input bind:value={state.current} />`.
 *
 * @category models
 * @since 4.0.0
 */
export interface AtomState<A> {
  current: A
}

/**
 * A reactive read handle over an external source that exposes a value and a
 * `subscribe`/unsubscribe pair, keyed by the identity of the selected source.
 *
 * The value is read synchronously in the getter, so it is correct under SSR and
 * before mount. `createSubscriber` establishes the subscription lazily (only
 * while `current` is read reactively) and tears it down automatically. When the
 * selected source changes between reads, the subscription is moved across.
 *
 * The value is read before `track()` registers the subscription: reading a
 * source can lazily initialise it and synchronously notify listeners, so doing
 * it first keeps that notification out of `createSubscriber`'s setup. That makes
 * `current` safe to read from a `$derived` / `{#await}` / `{#if}` expression, not
 * just from a template or `$effect`.
 */
const reactiveValue = <S, A>(
  select: () => S,
  read: (source: S) => A,
  subscribe: (source: S, notify: () => void) => () => void
): AtomValue<A> => {
  let active: S | undefined
  let unsubscribe: (() => void) | undefined
  let notify: (() => void) | undefined
  const track = createSubscriber((update) => {
    notify = update
    active = select()
    unsubscribe = subscribe(active, update)
    return () => {
      unsubscribe?.()
      unsubscribe = undefined
      notify = undefined
      active = undefined
    }
  })
  return {
    get current() {
      const source = select()
      const value = read(source)
      track()
      if (notify !== undefined && source !== active) {
        unsubscribe?.()
        active = source
        unsubscribe = subscribe(source, notify)
      }
      return value
    }
  }
}

const subscribeAtom = (registry: AtomRegistry.AtomRegistry) => <A>(atom: Atom.Atom<A>, notify: () => void): () => void =>
  registry.subscribe(atom, notify)

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
  const subscribe = subscribeAtom(registry)
  return f
    ? reactiveValue(atom, (a) => f(registry.get(a)), subscribe)
    : reactiveValue(atom, (a) => registry.get(a), subscribe)
}

const flattenExit = <A, E>(exit: Exit.Exit<A, E>): A => {
  if (Exit.isSuccess(exit)) return exit.value
  throw Cause.squash(exit.cause)
}

/**
 * The setter returned by {@link useAtom} and {@link useAtomSet}. For plain
 * atoms it accepts a value or an updater function; for `AsyncResult` atoms the
 * `promise` and `promiseExit` modes return a promise for the success value or
 * the full `Exit`.
 *
 * @category models
 * @since 4.0.0
 */
export type AtomSetter<R, W, Mode> = "promise" extends Mode ? (
    (value: W, options?: { readonly signal?: AbortSignal | undefined } | undefined) =>
      Promise<AsyncResult.AsyncResult.Success<R>>
  ) :
  "promiseExit" extends Mode ? (
      (value: W, options?: { readonly signal?: AbortSignal | undefined } | undefined) =>
        Promise<Exit.Exit<AsyncResult.AsyncResult.Success<R>, AsyncResult.AsyncResult.Failure<R>>>
    ) :
  ((value: W | ((value: R) => W)) => void)

function setAtom<R, W, Mode extends "value" | "promise" | "promiseExit" = never>(
  registry: AtomRegistry.AtomRegistry,
  atom: () => Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): AtomSetter<R, W, Mode> {
  if (options?.mode === "promise" || options?.mode === "promiseExit") {
    const write = (value: W, opts?: { readonly signal?: AbortSignal | undefined } | undefined) => {
      const result = atom() as Atom.Writable<AsyncResult.AsyncResult<unknown, unknown>, W>
      registry.set(result, value)
      const promise = Effect.runPromiseExit(
        AtomRegistry.getResult(registry, result, { suspendOnWaiting: true }),
        opts
      )
      return options.mode === "promise" ? promise.then(flattenExit) : promise
    }
    return write as AtomSetter<R, W, Mode>
  }
  const write = (value: W | ((value: R) => W)) => {
    const writable = atom()
    registry.set(writable, typeof value === "function" ? (value as (value: R) => W)(registry.get(writable)) : value)
  }
  return write as AtomSetter<R, W, Mode>
}

/**
 * Reads a writable atom's value as a reactive handle and returns a setter.
 *
 * @see {@link AtomSetter} for the setter's behaviour and modes.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtom = <R, W, Mode extends "value" | "promise" | "promiseExit" = never>(
  atom: () => Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): readonly [value: AtomValue<R>, write: AtomSetter<R, W, Mode>] => {
  const registry = injectRegistry()
  const value = reactiveValue(atom, (a) => registry.get(a), subscribeAtom(registry))
  return [value, setAtom(registry, atom, options)] as const
}

/**
 * Reads and writes a writable atom whose read and write types match, returning
 * a two-way {@link AtomState} handle. Assigning to `current` writes the atom, so
 * the handle can be bound directly with `bind:`, e.g.
 * `<input bind:value={state.current} />`.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomState = <A>(atom: () => Atom.Writable<A, A>): AtomState<A> => {
  const registry = injectRegistry()
  const value = reactiveValue(atom, (a) => registry.get(a), subscribeAtom(registry))
  return {
    get current() {
      return value.current
    },
    set current(next: A) {
      registry.set(atom(), next)
    }
  }
}

/**
 * Returns a setter for a writable atom, keeping it mounted for the lifetime of
 * the calling component.
 *
 * @see {@link AtomSetter} for the setter's behaviour and modes.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomSet = <R, W, Mode extends "value" | "promise" | "promiseExit" = never>(
  atom: () => Atom.Writable<R, W>,
  options?: {
    readonly mode?: ([R] extends [AsyncResult.AsyncResult<any, any>] ? Mode : "value") | undefined
  }
): AtomSetter<R, W, Mode> => {
  const registry = injectRegistry()
  onDestroy(registry.mount(atom()))
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
  onDestroy(registry.mount(atom()))
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

const constPending: Promise<never> = new Promise<never>(() => {})

const resultToPromise = <A, E>(
  result: AsyncResult.AsyncResult<A, E>,
  suspendOnWaiting: boolean
): Promise<A> => {
  if (AsyncResult.isInitial(result) || (suspendOnWaiting && result.waiting)) {
    return constPending
  } else if (AsyncResult.isSuccess(result)) {
    return Promise.resolve(result.value)
  }
  return Promise.reject(Cause.squash(result.cause))
}

/**
 * Reads an `AsyncResult` atom as a reactive handle whose `current` is a promise
 * for the success value.
 *
 * **Details**
 *
 * The promise stays pending while the result is `Initial` (and, when
 * `suspendOnWaiting` is set, while it is re-running), resolves with the success
 * value, or rejects with the squashed failure cause. As the Suspense analogue
 * for Svelte, read `current` from an `{#await}` block — or, with the
 * experimental async feature enabled, `await` it inside a `<svelte:boundary>`
 * whose `pending` snippet renders the loading state. The promise identity
 * changes when the result changes, so the awaiting block re-runs on every
 * transition.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomSuspense = <A, E>(
  atom: () => Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  options?: { readonly suspendOnWaiting?: boolean | undefined }
): AtomValue<Promise<A>> => {
  const result = useAtomValue(atom)
  const suspendOnWaiting = options?.suspendOnWaiting ?? false
  return {
    get current() {
      return resultToPromise(result.current, suspendOnWaiting)
    }
  }
}

/**
 * Reads an `AtomRef` value as a reactive handle.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomRef = <A>(atomRef: () => AtomRef.ReadonlyRef<A>): AtomValue<A> =>
  reactiveValue(atomRef, (ref) => ref.value, (ref, notify) => ref.subscribe(notify))

/**
 * Derives an `AtomRef` for one property of an object-valued `AtomRef`, returning
 * a thunk suitable for passing to {@link useAtomRef}. The child ref is recreated
 * only when the source ref changes, so the result is referentially stable.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomRefProp = <A, K extends keyof A>(
  ref: () => AtomRef.AtomRef<A>,
  prop: K
): () => AtomRef.AtomRef<A[K]> => {
  let parent = ref()
  let child = parent.prop(prop)
  return () => {
    const current = ref()
    if (current !== parent) {
      parent = current
      child = current.prop(prop)
    }
    return child
  }
}

/**
 * Reads the value of one property of an object-valued `AtomRef` as a reactive
 * handle, composing {@link useAtomRefProp} with {@link useAtomRef}.
 *
 * @category hooks
 * @since 4.0.0
 */
export const useAtomRefPropValue = <A, K extends keyof A>(
  ref: () => AtomRef.AtomRef<A>,
  prop: K
): AtomValue<A[K]> => useAtomRef(useAtomRefProp(ref, prop))
