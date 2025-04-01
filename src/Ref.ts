/**
 * @since 2.0.0
 */
import * as Effect from "./Effect.ts"
import { dual, identity } from "./Function.ts"
import { PipeInspectableProto } from "./internal/core.ts"
import * as MutableRef from "./MutableRef.ts"
import type * as Option from "./Option.ts"
import type { Invariant } from "./Types.ts"
import type * as Unify from "./Unify.ts"

/**
 * @since 2.0.0
 * @category symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/Ref")

/**
 * @since 2.0.0
 * @category symbols
 */
export type TypeId = typeof TypeId

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
