/**
 * This module provides utilities for working with mutable references in a functional context.
 *
 * A Ref is a mutable reference that can be read, written, and atomically modified. Unlike plain
 * mutable variables, Refs are thread-safe and work seamlessly with Effect's concurrency model.
 * They provide atomic operations for safe state management in concurrent programs.
 *
 * @example
 * ```ts
 * import { Effect, Ref } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   // Create a ref with initial value
 *   const counter = yield* Ref.make(0)
 *
 *   // Atomic operations
 *   yield* Ref.update(counter, n => n + 1)
 *   yield* Ref.update(counter, n => n * 2)
 *
 *   const value = yield* Ref.get(counter)
 *   console.log(value) // 2
 *
 *   // Atomic modify with return value
 *   const previous = yield* Ref.getAndSet(counter, 100)
 *   console.log(previous) // 2
 * })
 * ```
 *
 * @since 2.0.0
 */
import * as Effect from "./Effect.js"
import { dual, identity } from "./Function.js"
import { PipeInspectableProto } from "./internal/core.js"
import * as MutableRef from "./MutableRef.js"
import type * as Option from "./Option.js"
import type { Invariant } from "./Types.js"
import type * as Unify from "./Unify.js"

/**
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: TypeId = "~effect/Ref"

/**
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = "~effect/Ref"

/**
 * @since 2.0.0
 * @category models
 */
export interface Ref<in out A> extends Ref.Variance<A> {
  readonly ref: MutableRef.MutableRef<A>
  readonly [Unify.typeSymbol]?: unknown
  readonly [Unify.unifySymbol]?: RefUnify<this>
  readonly [Unify.ignoreSymbol]?: RefUnifyIgnore
}

/**
 * @category models
 * @since 3.8.0
 */
export interface RefUnify<A extends { [Unify.typeSymbol]?: any }> extends Effect.EffectUnify<A> {
  Ref?: () => Extract<A[Unify.typeSymbol], Ref<any>>
}

/**
 * @category models
 * @since 3.8.0
 */
export interface RefUnifyIgnore extends Effect.EffectUnifyIgnore {
  Effect?: true
}

/**
 * @since 2.0.0
 * @category models
 */
export declare namespace Ref {
  /**
   * @since 2.0.0
   */
  export interface Variance<in out A> {
    readonly [TypeId]: {
      readonly _A: Invariant<A>
    }
  }
}

const RefProto = {
  [TypeId]: {
    _A: identity
  },
  ...PipeInspectableProto,
  toJSON(this: Ref<any>) {
    return {
      _id: "Ref",
      ref: this.ref
    }
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const unsafeMake = <A>(value: A): Ref<A> => {
  const self = Object.create(RefProto)
  self.ref = MutableRef.make(value)
  return self
}

/**
 * Creates a new Ref with the specified initial value.
 *
 * @param value - The initial value for the Ref
 * @returns An Effect that creates a new Ref
 *
 * @example
 * ```ts
 * import { Effect, Ref } from "effect"
 *
 * const program = Effect.gen(function*() {
 *   const ref = yield* Ref.make(42)
 *   const value = yield* Ref.get(ref)
 *   console.log(value) // 42
 * })
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const make = <A>(value: A): Effect.Effect<Ref<A>> => Effect.sync(() => unsafeMake(value))

/**
 * @since 2.0.0
 * @category getters
 */
export const get = <A>(self: Ref<A>) => Effect.sync(() => self.ref.current)

/**
 * @since 2.0.0
 * @category setters
 */
export const set = dual<
  <A>(value: A) => (self: Ref<A>) => Effect.Effect<void>,
  <A>(self: Ref<A>, value: A) => Effect.Effect<void>
>(2, <A>(self: Ref<A>, value: A) => Effect.sync(() => MutableRef.set(self.ref, value)))

/**
 * @since 2.0.0
 * @category utils
 */
export const getAndSet = dual<
  <A>(value: A) => (self: Ref<A>) => Effect.Effect<A>,
  <A>(self: Ref<A>, value: A) => Effect.Effect<A>
>(2, <A>(self: Ref<A>, value: A) =>
  Effect.sync(() => {
    const current = self.ref.current
    self.ref.current = value
    return current
  }))

/**
 * @since 2.0.0
 * @category utils
 */
export const getAndUpdate = dual<
  <A>(f: (a: A) => A) => (self: Ref<A>) => Effect.Effect<A>,
  <A>(self: Ref<A>, f: (a: A) => A) => Effect.Effect<A>
>(2, <A>(self: Ref<A>, f: (a: A) => A) =>
  Effect.sync(() => {
    const current = self.ref.current
    self.ref.current = f(current)
    return current
  }))

/**
 * @since 2.0.0
 * @category utils
 */
export const getAndUpdateSome = dual<
  <A>(pf: (a: A) => Option.Option<A>) => (self: Ref<A>) => Effect.Effect<A>,
  <A>(self: Ref<A>, pf: (a: A) => Option.Option<A>) => Effect.Effect<A>
>(2, <A>(self: Ref<A>, pf: (a: A) => Option.Option<A>) =>
  Effect.sync(() => {
    const current = self.ref.current
    const option = pf(current)
    if (option._tag === "Some") {
      self.ref.current = option.value
    }
    return current
  }))

/**
 * @since 2.0.0
 * @category utils
 */
export const setAndGet = dual<
  <A>(value: A) => (self: Ref<A>) => Effect.Effect<A>,
  <A>(self: Ref<A>, value: A) => Effect.Effect<A>
>(2, <A>(self: Ref<A>, value: A) => Effect.sync(() => self.ref.current = value))

/**
 * @since 2.0.0
 * @category setters
 */
export const modify = dual<
  <A, B>(f: (a: A) => readonly [B, A]) => (self: Ref<A>) => Effect.Effect<B>,
  <A, B>(self: Ref<A>, f: (a: A) => readonly [B, A]) => Effect.Effect<B>
>(2, (self, f) =>
  Effect.sync(() => {
    const [b, a] = f(self.ref.current)
    self.ref.current = a
    return b
  }))

/**
 * @since 2.0.0
 * @category setters
 */
export const modifySome = dual<
  <B, A>(
    fallback: B,
    pf: (a: A) => Option.Option<readonly [B, A]>
  ) => (self: Ref<A>) => Effect.Effect<B>,
  <A, B>(
    self: Ref<A>,
    fallback: B,
    pf: (a: A) => Option.Option<readonly [B, A]>
  ) => Effect.Effect<B>
>(3, (self, fallback, pf) =>
  modify(self, (value) => {
    const option = pf(value)
    return option._tag === "None" ? [fallback, value] : option.value
  }))

/**
 * @since 2.0.0
 * @category setters
 */
export const update = dual<
  <A>(f: (a: A) => A) => (self: Ref<A>) => Effect.Effect<void>,
  <A>(self: Ref<A>, f: (a: A) => A) => Effect.Effect<void>
>(2, <A>(self: Ref<A>, f: (a: A) => A) =>
  Effect.sync(() => {
    self.ref.current = f(self.ref.current)
  }))

/**
 * @since 2.0.0
 * @category utils
 */
export const updateAndGet = dual<
  <A>(f: (a: A) => A) => (self: Ref<A>) => Effect.Effect<A>,
  <A>(self: Ref<A>, f: (a: A) => A) => Effect.Effect<A>
>(2, <A>(self: Ref<A>, f: (a: A) => A) => Effect.sync(() => self.ref.current = f(self.ref.current)))

/**
 * @since 2.0.0
 * @category setters
 */
export const updateSome = dual<
  <A>(f: (a: A) => Option.Option<A>) => (self: Ref<A>) => Effect.Effect<void>,
  <A>(self: Ref<A>, f: (a: A) => Option.Option<A>) => Effect.Effect<void>
>(2, <A>(self: Ref<A>, f: (a: A) => Option.Option<A>) =>
  Effect.sync(() => {
    const option = f(self.ref.current)
    if (option._tag === "Some") {
      self.ref.current = option.value
    }
  }))

/**
 * @since 2.0.0
 * @category utils
 */
export const updateSomeAndGet = dual<
  <A>(pf: (a: A) => Option.Option<A>) => (self: Ref<A>) => Effect.Effect<A>,
  <A>(self: Ref<A>, pf: (a: A) => Option.Option<A>) => Effect.Effect<A>
>(2, <A>(self: Ref<A>, pf: (a: A) => Option.Option<A>) =>
  Effect.sync(() => {
    const option = pf(self.ref.current)
    if (option._tag === "Some") {
      self.ref.current = option.value
    }
    return self.ref.current
  }))

/**
 * @since 2.0.0
 * @category getters
 */
export const unsafeGet = <A>(self: Ref<A>): A => self.ref.current
