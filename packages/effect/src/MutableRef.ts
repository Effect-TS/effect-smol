/**
 * @since 2.0.0
 */
import * as Equal from "./Equal.js"
import * as Dual from "./Function.js"
import { type Inspectable, toJSON } from "./Inspectable.js"
import { PipeInspectableProto } from "./internal/core.js"
import type { Pipeable } from "./Pipeable.js"

const TypeId: unique symbol = Symbol.for("effect/MutableRef") as TypeId

/**
 * @since 2.0.0
 * @category symbol
 */
export type TypeId = typeof TypeId

/**
 * @since 2.0.0
 * @category models
 */
export interface MutableRef<out T> extends Pipeable, Inspectable {
  readonly [TypeId]: TypeId

  /** @internal */
  current: T
}

const MutableRefProto: Omit<MutableRef<unknown>, "current"> = {
  [TypeId]: TypeId,
  ...PipeInspectableProto,
  toJSON<A>(this: MutableRef<A>) {
    return {
      _id: "MutableRef",
      current: toJSON(this.current)
    }
  }
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const make = <T>(value: T): MutableRef<T> => {
  const ref = Object.create(MutableRefProto)
  ref.current = value
  return ref
}

/**
 * @since 2.0.0
 * @category general
 */
export const compareAndSet: {
  <T>(oldValue: T, newValue: T): (self: MutableRef<T>) => boolean
  <T>(self: MutableRef<T>, oldValue: T, newValue: T): boolean
} = /* #__SIDE_EFFECTS__ */ Dual.dual<
  <T>(oldValue: T, newValue: T) => (self: MutableRef<T>) => boolean,
  <T>(self: MutableRef<T>, oldValue: T, newValue: T) => boolean
>(3, (self, oldValue, newValue) => {
  if (Equal.equals(oldValue, self.current)) {
    self.current = newValue
    return true
  }
  return false
})

/**
 * @since 2.0.0
 * @category numeric
 */
export const decrement = /* #__SIDE_EFFECTS__ */ (self: MutableRef<number>): MutableRef<number> =>
  update(self, (n) => n - 1)

/**
 * @since 2.0.0
 * @category numeric
 */
export const decrementAndGet = /* #__SIDE_EFFECTS__ */ (self: MutableRef<number>): number =>
  updateAndGet(self, (n) => n - 1)

/**
 * @since 2.0.0
 * @category general
 */
export const get = <T>(self: MutableRef<T>): T => self.current

/**
 * @since 2.0.0
 * @category numeric
 */
export const getAndDecrement = /* #__SIDE_EFFECTS__ */ (self: MutableRef<number>): number =>
  getAndUpdate(self, (n) => n - 1)

/**
 * @since 2.0.0
 * @category numeric
 */
export const getAndIncrement = /* #__SIDE_EFFECTS__ */ (self: MutableRef<number>): number =>
  getAndUpdate(self, (n) => n + 1)

/**
 * @since 2.0.0
 * @category general
 */
export const getAndSet: {
  <T>(value: T): (self: MutableRef<T>) => T
  <T>(self: MutableRef<T>, value: T): T
} = /* #__SIDE_EFFECTS__ */ Dual.dual<
  <T>(value: T) => (self: MutableRef<T>) => T,
  <T>(self: MutableRef<T>, value: T) => T
>(2, (self, value) => {
  const ret = self.current
  self.current = value
  return ret
})

/**
 * @since 2.0.0
 * @category general
 */
export const getAndUpdate: {
  <T>(f: (value: T) => T): (self: MutableRef<T>) => T
  <T>(self: MutableRef<T>, f: (value: T) => T): T
} = /* #__SIDE_EFFECTS__ */ Dual.dual<
  <T>(f: (value: T) => T) => (self: MutableRef<T>) => T,
  <T>(self: MutableRef<T>, f: (value: T) => T) => T
>(2, (self, f) => getAndSet(self, f(get(self))))

/**
 * @since 2.0.0
 * @category numeric
 */
export const increment = /* #__SIDE_EFFECTS__ */ (self: MutableRef<number>): MutableRef<number> =>
  update(self, (n) => n + 1)

/**
 * @since 2.0.0
 * @category numeric
 */
export const incrementAndGet = /* #__SIDE_EFFECTS__ */ (self: MutableRef<number>): number =>
  updateAndGet(self, (n) => n + 1)

/**
 * @since 2.0.0
 * @category general
 */
export const set: {
  <T>(value: T): (self: MutableRef<T>) => MutableRef<T>
  <T>(self: MutableRef<T>, value: T): MutableRef<T>
} = /* #__SIDE_EFFECTS__ */ Dual.dual<
  <T>(value: T) => (self: MutableRef<T>) => MutableRef<T>,
  <T>(self: MutableRef<T>, value: T) => MutableRef<T>
>(2, (self, value) => {
  self.current = value
  return self
})

/**
 * @since 2.0.0
 * @category general
 */
export const setAndGet: {
  <T>(value: T): (self: MutableRef<T>) => T
  <T>(self: MutableRef<T>, value: T): T
} = /* #__SIDE_EFFECTS__ */ Dual.dual<
  <T>(value: T) => (self: MutableRef<T>) => T,
  <T>(self: MutableRef<T>, value: T) => T
>(2, (self, value) => {
  self.current = value
  return self.current
})

/**
 * @since 2.0.0
 * @category general
 */
export const update: {
  <T>(f: (value: T) => T): (self: MutableRef<T>) => MutableRef<T>
  <T>(self: MutableRef<T>, f: (value: T) => T): MutableRef<T>
} = /* #__SIDE_EFFECTS__ */ Dual.dual<
  <T>(f: (value: T) => T) => (self: MutableRef<T>) => MutableRef<T>,
  <T>(self: MutableRef<T>, f: (value: T) => T) => MutableRef<T>
>(2, (self, f) => set(self, f(get(self))))

/**
 * @since 2.0.0
 * @category general
 */
export const updateAndGet: {
  <T>(f: (value: T) => T): (self: MutableRef<T>) => T
  <T>(self: MutableRef<T>, f: (value: T) => T): T
} = /* #__SIDE_EFFECTS__ */ Dual.dual<
  <T>(f: (value: T) => T) => (self: MutableRef<T>) => T,
  <T>(self: MutableRef<T>, f: (value: T) => T) => T
>(2, (self, f) => setAndGet(self, f(get(self))))

/**
 * @since 2.0.0
 * @category boolean
 */
export const toggle = /* #__SIDE_EFFECTS__ */ (self: MutableRef<boolean>): MutableRef<boolean> =>
  update(self, (_) => !_)
