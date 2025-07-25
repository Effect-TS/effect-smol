/**
 * This module provides a data structure called `ServiceMap` that can be used for dependency injection in effectful
 * programs. It is essentially a table mapping `Keys`s to their implementations (called `Service`s), and can be used to
 * manage dependencies in a type-safe way. The `ServiceMap` data structure is essentially a way of providing access to a set
 * of related services that can be passed around as a single unit. This module provides functions to create, modify, and
 * query the contents of a `ServiceMap`, as well as a number of utility types for working with keys and services.
 *
 * @since 4.0.0
 */
import * as Option from "./data/Option.ts"
import { hasProperty } from "./data/Predicate.ts"
import type { Effect, EffectIterator, Yieldable } from "./Effect.ts"
import { constant, dual, type LazyArg } from "./Function.ts"
import * as Equal from "./interfaces/Equal.ts"
import * as Hash from "./interfaces/Hash.ts"
import type { Inspectable } from "./interfaces/Inspectable.ts"
import type { Pipeable } from "./interfaces/Pipeable.ts"
import { exitSucceed, PipeInspectableProto, withFiber, YieldableProto } from "./internal/core.ts"
import type { ErrorWithStackTraceLimit } from "./internal/tracer.ts"
import type * as Types from "./types/Types.ts"

/**
 * @since 4.0.0
 * @category Symbols
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * console.log(ServiceMap.KeyTypeId)
 * // Output: "~effect/ServiceMap/Key"
 * ```
 */
export const KeyTypeId: KeyTypeId = "~effect/ServiceMap/Key"

/**
 * @since 4.0.0
 * @category Symbols
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // KeyTypeId is a type representing the unique identifier for ServiceMap keys
 * type MyKeyTypeId = ServiceMap.KeyTypeId
 * ```
 */
export type KeyTypeId = "~effect/ServiceMap/Key"

/**
 * @since 4.0.0
 * @category Models
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Define a key for a database service
 * const DatabaseKey = ServiceMap.Key<{ query: (sql: string) => string }>("Database")
 *
 * // The key can be used to store and retrieve services
 * const serviceMap = ServiceMap.make(DatabaseKey, { query: (sql) => `Result: ${sql}` })
 * ```
 */
export interface Key<in out Id, in out Service>
  extends Pipeable, Inspectable, Yieldable<Key<Id, Service>, Service, never, Id>
{
  readonly [KeyTypeId]: {
    readonly _Service: Types.Invariant<Service>
    readonly _Identifier: Types.Invariant<Id>
  }
  readonly Service: Service
  readonly Identifier: Id
  of(self: Service): Service
  serviceMap(self: Service): ServiceMap<Id>

  readonly stack?: string | undefined
  readonly key: string
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface KeyClass<in out Self, in out Id extends string, in out Service> extends Key<Self, Service> {
  new(_: never): KeyClass.Shape<Id, Service>
  readonly key: Id
}

/**
 * @since 4.0.0
 * @category Models
 */
export declare namespace KeyClass {
  /**
   * @since 4.0.0
   * @category Models
   */
  export interface Shape<Id extends string, Service> {
    readonly [KeyTypeId]: KeyTypeId
    readonly key: Id
    readonly Service: Service
  }
}

/**
 * @since 4.0.0
 * @category Constructors
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Create a simple key
 * const DatabaseKey = ServiceMap.Key<{ query: (sql: string) => string }>("Database")
 *
 * // Create a key class
 * class ConfigKey extends ServiceMap.Key<ConfigKey, { port: number }>()("Config") {}
 *
 * // Use the keys to create service maps
 * const db = ServiceMap.make(DatabaseKey, { query: (sql) => `Result: ${sql}` })
 * const config = ServiceMap.make(ConfigKey, { port: 8080 })
 * ```
 */
export const Key: {
  <Id, Service = Id>(key: string): Key<Id, Service>
  <Self, Service>(): <
    const Id extends string,
    E,
    R = Types.unassigned,
    Args extends ReadonlyArray<any> = never
  >(
    id: Id,
    options?: {
      readonly make: ((...args: Args) => Effect<Service, E, R>) | Effect<Service, E, R> | undefined
    } | undefined
  ) =>
    & KeyClass<Self, Id, Service>
    & ([Types.unassigned] extends [R] ? unknown
      : { readonly make: [Args] extends [never] ? Effect<Service, E, R> : (...args: Args) => Effect<Service, E, R> })
  <Self>(): <
    const Id extends string,
    Make extends Effect<any, any, any> | ((...args: any) => Effect<any, any, any>)
  >(
    id: Id,
    options: {
      readonly make: Make
    }
  ) =>
    & KeyClass<
      Self,
      Id,
      Make extends
        Effect<infer _A, infer _E, infer _R> | ((...args: infer _Args) => Effect<infer _A, infer _E, infer _R>) ? _A
        : never
    >
    & { readonly make: Make }
} = function() {
  const prevLimit = (Error as ErrorWithStackTraceLimit).stackTraceLimit
  ;(Error as ErrorWithStackTraceLimit)
    .stackTraceLimit = 2
  const err = new Error()
  ;(Error as ErrorWithStackTraceLimit).stackTraceLimit = prevLimit
  function KeyClass() {}
  const self = KeyClass as any as Types.Mutable<Reference<any>>
  Object.setPrototypeOf(self, KeyProto)
  Object.defineProperty(self, "stack", {
    get() {
      return err.stack
    }
  })
  if (arguments.length > 0) {
    self.key = arguments[0]
    if (arguments[1]?.defaultValue) {
      self[ReferenceTypeId] = ReferenceTypeId
      self.defaultValue = arguments[1].defaultValue
    }
    return self
  }
  return function(key: string, make?: any) {
    self.key = key
    if (make) {
      ;(self as any).make = make
    }
    return self
  }
} as any

const KeyProto: any = {
  [KeyTypeId]: {
    _Service: (_: unknown) => _,
    _Identifier: (_: unknown) => _
  },
  ...PipeInspectableProto,
  ...YieldableProto,
  toJSON<I, A>(this: Key<I, A>) {
    return {
      _id: "Key",
      key: this.key,
      stack: this.stack
    }
  },
  asEffect(this: any) {
    const fn = this.asEffect = constant(withFiber((fiber) => exitSucceed(unsafeGet(fiber.services, this))))
    return fn()
  },
  of<Service>(self: Service): Service {
    return self
  },
  serviceMap<Identifier, Service>(
    this: Key<Identifier, Service>,
    self: Service
  ): ServiceMap<Identifier> {
    return make(this, self)
  }
}

/**
 * @since 4.0.0
 * @category Symbols
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * console.log(ServiceMap.ReferenceTypeId)
 * // Output: "~effect/ServiceMap/Reference"
 * ```
 */
export const ReferenceTypeId: ReferenceTypeId = "~effect/ServiceMap/Reference"

/**
 * @since 4.0.0
 * @category Symbols
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // ReferenceTypeId is a type representing the unique identifier for ServiceMap references
 * type MyReferenceTypeId = ServiceMap.ReferenceTypeId
 * ```
 */
export type ReferenceTypeId = "~effect/ServiceMap/Reference"

/**
 * @since 4.0.0
 * @category Models
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Define a reference with a default value
 * const LoggerRef: ServiceMap.Reference<{ log: (msg: string) => void }> =
 *   ServiceMap.Reference("Logger", { defaultValue: () => ({ log: (msg: string) => console.log(msg) }) })
 *
 * // The reference can be used without explicit provision
 * const serviceMap = ServiceMap.empty()
 * const logger = ServiceMap.get(serviceMap, LoggerRef) // Uses default value
 * ```
 */
export interface Reference<in out Service> extends Key<never, Service> {
  readonly [ReferenceTypeId]: ReferenceTypeId
  readonly defaultValue: () => Service
  [Symbol.iterator](): EffectIterator<Reference<Service>>
}

/**
 * @since 4.0.0
 * @category Models
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Extract service type from a key
 * type DatabaseService = ServiceMap.Key.Service<typeof DatabaseKey>
 *
 * // Extract identifier type from a key
 * type DatabaseId = ServiceMap.Key.Identifier<typeof DatabaseKey>
 *
 * const DatabaseKey = ServiceMap.Key<{ query: (sql: string) => string }>("Database")
 * ```
 */
export declare namespace Key {
  /**
   * @since 4.0.0
   * @category Models
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * // Variance interface is used internally for type inference
   * type MyVariance = ServiceMap.Key.Variance<"MyId", { value: number }>
   * ```
   */
  export interface Variance<in out Id, in out Service> {
    readonly [KeyTypeId]: {
      readonly _Service: Types.Invariant<Service>
      readonly _Identifier: Types.Invariant<Id>
    }
  }
  /**
   * @since 4.0.0
   * @category Models
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * // Any represents any possible key type
   * const keys: ServiceMap.Key.Any[] = [
   *   ServiceMap.Key<{ log: (msg: string) => void }>("Logger"),
   *   ServiceMap.Key<{ query: (sql: string) => string }>("Database")
   * ]
   * ```
   */
  export type Any = Key<never, any> | Key<any, any>
  /**
   * @since 4.0.0
   * @category Models
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * const DatabaseKey = ServiceMap.Key<{ query: (sql: string) => string }>("Database")
   *
   * // Extract the service type from a key
   * type DatabaseService = ServiceMap.Key.Service<typeof DatabaseKey>
   * // DatabaseService is { query: (sql: string) => string }
   * ```
   */
  export type Service<T> = T extends Variance<infer _I, infer S> ? S : never
  /**
   * @since 4.0.0
   * @category Models
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * const DatabaseKey = ServiceMap.Key<{ query: (sql: string) => string }>("Database")
   *
   * // Extract the identifier type from a key
   * type DatabaseId = ServiceMap.Key.Identifier<typeof DatabaseKey>
   * // DatabaseId is the identifier type
   * ```
   */
  export type Identifier<T> = T extends Variance<infer I, infer _S> ? I : never
}

/**
 * @since 4.0.0
 * @category Symbols
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * console.log(ServiceMap.TypeId)
 * // Output: "~effect/ServiceMap"
 * ```
 */
export const TypeId: TypeId = "~effect/ServiceMap"

/**
 * @since 4.0.0
 * @category Symbols
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // TypeId is a type representing the unique identifier for ServiceMap
 * type MyTypeId = ServiceMap.TypeId
 * ```
 */
export type TypeId = "~effect/ServiceMap"

/**
 * @since 4.0.0
 * @category Models
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Create a service map with multiple services
 * const Logger = ServiceMap.Key<{ log: (msg: string) => void }>("Logger")
 * const Database = ServiceMap.Key<{ query: (sql: string) => string }>("Database")
 *
 * const services = ServiceMap.make(Logger, { log: (msg: string) => console.log(msg) })
 *   .pipe(ServiceMap.add(Database, { query: (sql) => `Result: ${sql}` }))
 * ```
 */
export interface ServiceMap<in Services> extends Equal.Equal, Pipeable, Inspectable {
  readonly [TypeId]: {
    readonly _Services: Types.Contravariant<Services>
  }
  readonly unsafeMap: ReadonlyMap<string, any>
}

/**
 * @since 4.0.0
 * @category Constructors
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Create a service map from a Map (unsafe)
 * const map = new Map([[
 *   "Logger",
 *   { log: (msg: string) => console.log(msg) }
 * ]])
 *
 * const services = ServiceMap.unsafeMake(map)
 * ```
 */
export const unsafeMake = <Services = never>(unsafeMap: ReadonlyMap<string, any>): ServiceMap<Services> => {
  const self = Object.create(Proto)
  self.unsafeMap = unsafeMap
  return self
}

const Proto: Omit<ServiceMap<never>, "unsafeMap"> = {
  ...PipeInspectableProto,
  [TypeId]: {
    _Services: (_: never) => _
  },
  toJSON(this: ServiceMap<never>) {
    return {
      _id: "ServiceMap",
      services: Array.from(this.unsafeMap).map(([key, value]) => ({ key, value }))
    }
  },
  [Equal.symbol]<A>(this: ServiceMap<A>, that: unknown): boolean {
    if (
      !isServiceMap(that)
      || this.unsafeMap.size !== that.unsafeMap.size
    ) return false
    for (const k of this.unsafeMap.keys()) {
      if (
        !that.unsafeMap.has(k) ||
        !Equal.equals(this.unsafeMap.get(k), that.unsafeMap.get(k))
      ) {
        return false
      }
    }
    return true
  },
  [Hash.symbol]<A>(this: ServiceMap<A>): number {
    return Hash.cached(this, () => Hash.number(this.unsafeMap.size))
  }
}

/**
 * Checks if the provided argument is a `ServiceMap`.
 *
 * @param u - The value to be checked if it is a `ServiceMap`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * assert.strictEqual(ServiceMap.isServiceMap(ServiceMap.empty()), true)
 * ```
 *
 * @since 4.0.0
 * @category Guards
 */
export const isServiceMap = (u: unknown): u is ServiceMap<never> => hasProperty(u, TypeId)

/**
 * Checks if the provided argument is a `Key`.
 *
 * @param u - The value to be checked if it is a `Key`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * assert.strictEqual(ServiceMap.isKey(ServiceMap.Key("Key")), true)
 * ```
 *
 * @since 4.0.0
 * @category Guards
 */
export const isKey = (u: unknown): u is Key<any, any> => hasProperty(u, KeyTypeId)

/**
 * Checks if the provided argument is a `Reference`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const LoggerRef = ServiceMap.Reference("Logger", { defaultValue: () => ({ log: (msg: string) => console.log(msg) }) })
 *
 * assert.strictEqual(ServiceMap.isReference(LoggerRef), true)
 * assert.strictEqual(ServiceMap.isReference(ServiceMap.Key("Key")), false)
 * ```
 *
 * @since 4.0.0
 * @category Guards
 */
export const isReference = (u: unknown): u is Reference<any> => hasProperty(u, ReferenceTypeId)

/**
 * Returns an empty `ServiceMap`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * assert.strictEqual(ServiceMap.isServiceMap(ServiceMap.empty()), true)
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const empty = (): ServiceMap<never> => emptyServiceMap
const emptyServiceMap = unsafeMake(new Map())

/**
 * Creates a new `ServiceMap` with a single service associated to the key.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 *
 * const Services = ServiceMap.make(Port, { PORT: 8080 })
 *
 * assert.deepStrictEqual(ServiceMap.get(Services, Port), { PORT: 8080 })
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const make = <I, S>(
  key: Key<I, S>,
  service: Types.NoInfer<S>
): ServiceMap<I> => unsafeMake(new Map([[key.key, service]]))

/**
 * Adds a service to a given `ServiceMap`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Key<{ TIMEOUT: number }>("Timeout")
 *
 * const someServiceMap = ServiceMap.make(Port, { PORT: 8080 })
 *
 * const Services = pipe(
 *   someServiceMap,
 *   ServiceMap.add(Timeout, { TIMEOUT: 5000 })
 * )
 *
 * assert.deepStrictEqual(ServiceMap.get(Services, Port), { PORT: 8080 })
 * assert.deepStrictEqual(ServiceMap.get(Services, Timeout), { TIMEOUT: 5000 })
 * ```
 *
 * @since 4.0.0
 * @category Adders
 */
export const add: {
  <I, S>(
    key: Key<I, S>,
    service: Types.NoInfer<S>
  ): <Services>(self: ServiceMap<Services>) => ServiceMap<Services | I>
  <Services, I, S>(
    self: ServiceMap<Services>,
    key: Key<I, S>,
    service: Types.NoInfer<S>
  ): ServiceMap<Services | I>
} = dual(3, <Services, I, S>(
  self: ServiceMap<Services>,
  key: Key<I, S>,
  service: Types.NoInfer<S>
): ServiceMap<Services | I> => {
  const map = new Map(self.unsafeMap)
  map.set(key.key, service)
  return unsafeMake(map)
})

/**
 * Get a service from the context that corresponds to the given key, or
 * use the fallback value.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const Logger = ServiceMap.Key<{ log: (msg: string) => void }>("Logger")
 * const Database = ServiceMap.Key<{ query: (sql: string) => string }>("Database")
 *
 * const services = ServiceMap.make(Logger, { log: (msg: string) => console.log(msg) })
 *
 * const logger = ServiceMap.getOrElse(services, Logger, () => ({ log: () => {} }))
 * const database = ServiceMap.getOrElse(services, Database, () => ({ query: () => "fallback" }))
 *
 * assert.deepStrictEqual(logger, { log: (msg: string) => console.log(msg) })
 * assert.deepStrictEqual(database, { query: () => "fallback" })
 * ```
 *
 * @since 4.0.0
 * @category Getters
 */
export const getOrElse: {
  <S, I, B>(key: Key<I, S>, orElse: LazyArg<B>): <Services>(self: ServiceMap<Services>) => S | B
  <Services, S, I, B>(self: ServiceMap<Services>, key: Key<I, S>, orElse: LazyArg<B>): S | B
} = dual(3, <Services, S, I, B>(self: ServiceMap<Services>, key: Key<I, S>, orElse: LazyArg<B>): S | B => {
  if (self.unsafeMap.has(key.key)) {
    return self.unsafeMap.get(key.key)! as any
  }
  return isReference(key) ? getDefaultValue(key) : orElse()
})

/**
 * Get a service from the context that corresponds to the given key.
 * This function is unsafe because if the key is not present in the context, a runtime error will be thrown.
 *
 * For a safer version see {@link getOption}.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param key - The `Key` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Key<{ TIMEOUT: number }>("Timeout")
 *
 * const Services = ServiceMap.make(Port, { PORT: 8080 })
 *
 * assert.deepStrictEqual(ServiceMap.unsafeGet(Services, Port), { PORT: 8080 })
 * assert.throws(() => ServiceMap.unsafeGet(Services, Timeout))
 * ```
 *
 * @since 4.0.0
 * @category unsafe
 */
export const unsafeGet: {
  <S, I>(key: Key<I, S>): <Services>(self: ServiceMap<Services>) => S
  <Services, S, I>(self: ServiceMap<Services>, key: Key<I, S>): S
} = dual(
  2,
  <Services, I extends Services, S>(self: ServiceMap<Services>, key: Key<I, S>): S => {
    if (!self.unsafeMap.has(key.key)) {
      if (ReferenceTypeId in key) return getDefaultValue(key as any)
      throw serviceNotFoundError(key)
    }
    return self.unsafeMap.get(key.key)! as any
  }
)

/**
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const LoggerRef = ServiceMap.Reference("Logger", {
 *   defaultValue: () => ({ log: (msg: string) => console.log(msg) })
 * })
 *
 * const services = ServiceMap.empty()
 * const logger = ServiceMap.unsafeGetReference(services, LoggerRef)
 *
 * assert.deepStrictEqual(logger, { log: (msg: string) => console.log(msg) })
 * ```
 *
 * @since 4.0.0
 * @category unsafe
 */
export const unsafeGetReference = <Services, S>(self: ServiceMap<Services>, key: Reference<S>): S => {
  if (!self.unsafeMap.has(key.key)) {
    return getDefaultValue(key as any)
  }
  return self.unsafeMap.get(key.key)! as any
}

const defaultValueCacheKey = "~effect/ServiceMap/defaultValue"
const getDefaultValue = (ref: Reference<any>) => {
  if (defaultValueCacheKey in ref) {
    return ref[defaultValueCacheKey] as any
  }
  return (ref as any)[defaultValueCacheKey] = ref.defaultValue()
}

const serviceNotFoundError = (key: Key<any, any>) => {
  const error = new Error(
    `Service not found${key.key ? `: ${String(key.key)}` : ""}`
  )
  if (key.stack) {
    const lines = key.stack.split("\n")
    if (lines.length > 2) {
      const afterAt = lines[2].match(/at (.*)/)
      if (afterAt) {
        error.message = error.message + ` (defined at ${afterAt[1]})`
      }
    }
  }
  if (error.stack) {
    const lines = error.stack.split("\n")
    lines.splice(1, 3)
    error.stack = lines.join("\n")
  }
  return error
}

/**
 * Get a service from the context that corresponds to the given key.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param key - The `Key` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Key<{ TIMEOUT: number }>("Timeout")
 *
 * const Services = pipe(
 *   ServiceMap.make(Port, { PORT: 8080 }),
 *   ServiceMap.add(Timeout, { TIMEOUT: 5000 })
 * )
 *
 * assert.deepStrictEqual(ServiceMap.get(Services, Timeout), { TIMEOUT: 5000 })
 * ```
 *
 * @since 4.0.0
 * @category Getters
 */
export const get: {
  <Services, I extends Services, S>(key: Key<I, S>): (self: ServiceMap<Services>) => S
  <Services, I extends Services, S>(self: ServiceMap<Services>, key: Key<I, S>): S
} = unsafeGet

/**
 * Get the value associated with the specified key from the context wrapped in an `Option` object. If the key is not
 * found, the `Option` object will be `None`.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param key - The `Key` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 * import { Option } from "effect/data"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Key<{ TIMEOUT: number }>("Timeout")
 *
 * const Services = ServiceMap.make(Port, { PORT: 8080 })
 *
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Port), Option.some({ PORT: 8080 }))
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Timeout), Option.none())
 * ```
 *
 * @since 4.0.0
 * @category Getters
 */
export const getOption: {
  <S, I>(key: Key<I, S>): <Services>(self: ServiceMap<Services>) => Option.Option<S>
  <Services, S, I>(self: ServiceMap<Services>, key: Key<I, S>): Option.Option<S>
} = dual(2, <Services, I extends Services, S>(self: ServiceMap<Services>, key: Key<I, S>): Option.Option<S> => {
  if (self.unsafeMap.has(key.key)) {
    return Option.some(self.unsafeMap.get(key.key)! as any)
  }
  return isReference(key) ? Option.some(getDefaultValue(key as any)) : Option.none()
})

/**
 * Merges two `ServiceMap`s, returning a new `ServiceMap` containing the services of both.
 *
 * @param self - The first `ServiceMap` to merge.
 * @param that - The second `ServiceMap` to merge.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Key<{ TIMEOUT: number }>("Timeout")
 *
 * const firstServiceMap = ServiceMap.make(Port, { PORT: 8080 })
 * const secondServiceMap = ServiceMap.make(Timeout, { TIMEOUT: 5000 })
 *
 * const Services = ServiceMap.merge(firstServiceMap, secondServiceMap)
 *
 * assert.deepStrictEqual(ServiceMap.get(Services, Port), { PORT: 8080 })
 * assert.deepStrictEqual(ServiceMap.get(Services, Timeout), { TIMEOUT: 5000 })
 * ```
 *
 * @since 4.0.0
 * @category Utils
 */
export const merge: {
  <R1>(that: ServiceMap<R1>): <Services>(self: ServiceMap<Services>) => ServiceMap<R1 | Services>
  <Services, R1>(self: ServiceMap<Services>, that: ServiceMap<R1>): ServiceMap<Services | R1>
} = dual(2, <Services, R1>(self: ServiceMap<Services>, that: ServiceMap<R1>): ServiceMap<Services | R1> => {
  if (self.unsafeMap.size === 0) return that as any
  if (that.unsafeMap.size === 0) return self as any
  const map = new Map(self.unsafeMap)
  for (const [key, value] of that.unsafeMap) {
    map.set(key, value)
  }
  return unsafeMake(map)
})

/**
 * Returns a new `ServiceMap` that contains only the specified services.
 *
 * @param self - The `ServiceMap` to prune services from.
 * @param keys - The list of `Key`s to be included in the new `ServiceMap`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 * import { Option } from "effect/data"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Key<{ TIMEOUT: number }>("Timeout")
 *
 * const someServiceMap = pipe(
 *   ServiceMap.make(Port, { PORT: 8080 }),
 *   ServiceMap.add(Timeout, { TIMEOUT: 5000 })
 * )
 *
 * const Services = pipe(someServiceMap, ServiceMap.pick(Port))
 *
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Port), Option.some({ PORT: 8080 }))
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Timeout), Option.none())
 * ```
 *
 * @since 4.0.0
 * @category Utils
 */
export const pick = <Keys extends ReadonlyArray<Key<any, any>>>(
  ...keys: Keys
) =>
<Services>(self: ServiceMap<Services>): ServiceMap<Services & Key.Identifier<Keys[number]>> => {
  const map = new Map<string, any>()
  const keySet = new Set(keys.map((key) => key.key))
  for (const [key, value] of self.unsafeMap) {
    if (keySet.has(key)) {
      map.set(key, value)
    }
  }
  return unsafeMake(map)
}

/**
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 * import { Option } from "effect/data"
 *
 * const Port = ServiceMap.Key<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Key<{ TIMEOUT: number }>("Timeout")
 *
 * const someServiceMap = pipe(
 *   ServiceMap.make(Port, { PORT: 8080 }),
 *   ServiceMap.add(Timeout, { TIMEOUT: 5000 })
 * )
 *
 * const Services = pipe(someServiceMap, ServiceMap.omit(Timeout))
 *
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Port), Option.some({ PORT: 8080 }))
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Timeout), Option.none())
 * ```
 *
 * @since 4.0.0
 * @category Utils
 */
export const omit = <Keys extends ReadonlyArray<Key<any, any>>>(
  ...keys: Keys
) =>
<Services>(self: ServiceMap<Services>): ServiceMap<Exclude<Services, Key.Identifier<Keys[number]>>> => {
  const map = new Map(self.unsafeMap)
  for (const key of keys) {
    map.delete(key.key)
  }
  return unsafeMake(map)
}

/**
 * Creates a service map key with a default value.
 *
 * **Details**
 *
 * `ServiceMap.Reference` allows you to create a key that can hold a value. You can
 * provide a default value for the service, which will automatically be used
 * when the context is accessed, or override it with a custom implementation
 * when needed.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * // Create a reference with a default value
 * const LoggerRef = ServiceMap.Reference("Logger", {
 *   defaultValue: () => ({ log: (msg: string) => console.log(msg) })
 * })
 *
 * // The reference provides the default value when accessed from an empty context
 * const services = ServiceMap.empty()
 * const logger = ServiceMap.get(services, LoggerRef)
 *
 * // You can also override the default value
 * const customServices = ServiceMap.make(LoggerRef, { log: (msg) => `Custom: ${msg}` })
 * const customLogger = ServiceMap.get(customServices, LoggerRef)
 * ```
 *
 * @since 4.0.0
 * @category References
 */
export const Reference: <Service>(
  key: string,
  options: { readonly defaultValue: () => Service }
) => Reference<Service> = Key as any
