/**
 * This module provides a data structure called `ServiceMap` that can be used
 * for dependency injection in effectful programs. It is essentially a table
 * mapping `Service`s identifiers to their implementations, and can be used to
 * manage dependencies in a type-safe way. The `ServiceMap` data structure is
 * essentially a way of providing access to a set of related services that can
 * be passed around as a single unit. This module provides functions to create,
 * modify, and query the contents of a `ServiceMap`, as well as a number of
 * utility types for working with a `ServiceMap`.
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

const ServiceTypeId = "~effect/ServiceMap/Service" as const

/**
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Define an identifier for a database service
 * const Database = ServiceMap.Service<{ query: (sql: string) => string }>("Database")
 *
 * // The key can be used to store and retrieve services
 * const services = ServiceMap.make(Database, { query: (sql) => `Result: ${sql}` })
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface Service<in out Identifier, in out Shape>
  extends Pipeable, Inspectable, Yieldable<Service<Identifier, Shape>, Shape, never, Identifier>
{
  readonly [ServiceTypeId]: {
    readonly _Service: Types.Invariant<Shape>
    readonly _Identifier: Types.Invariant<Identifier>
  }
  readonly Service: Shape
  readonly Identifier: Identifier
  of(self: Shape): Shape
  serviceMap(self: Shape): ServiceMap<Identifier>

  readonly stack?: string | undefined
  readonly key: string
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface ServiceClass<in out Self, in out Identifier extends string, in out Shape>
  extends Service<Self, Shape>
{
  new(_: never): ServiceClass.Shape<Identifier, Shape>
  readonly key: Identifier
}

/**
 * @since 4.0.0
 * @category Models
 */
export declare namespace ServiceClass {
  /**
   * @since 4.0.0
   * @category Models
   */
  export interface Shape<Identifier extends string, Service> {
    readonly [ServiceTypeId]: typeof ServiceTypeId
    readonly key: Identifier
    readonly Service: Service
  }
}

/**
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Create a simple service
 * const Database = ServiceMap.Service<{ query: (sql: string) => string }>("Database")
 *
 * // Create a service class
 * class Config extends ServiceMap.Service<ConfigKey, { port: number }>()("Config") {}
 *
 * // Use the services to create service maps
 * const db = ServiceMap.make(DatabaseKey, { query: (sql) => `Result: ${sql}` })
 * const config = ServiceMap.make(ConfigKey, { port: 8080 })
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const Service: {
  <Identifier, Shape = Identifier>(key: string): Service<Identifier, Shape>
  <Self, Shape>(): <
    const Identifier extends string,
    E,
    R = Types.unassigned,
    Args extends ReadonlyArray<any> = never
  >(
    id: Identifier,
    options?: {
      readonly make: ((...args: Args) => Effect<Shape, E, R>) | Effect<Shape, E, R> | undefined
    } | undefined
  ) =>
    & ServiceClass<Self, Identifier, Shape>
    & ([Types.unassigned] extends [R] ? unknown
      : { readonly make: [Args] extends [never] ? Effect<Shape, E, R> : (...args: Args) => Effect<Shape, E, R> })
  <Self>(): <
    const Identifier extends string,
    Make extends Effect<any, any, any> | ((...args: any) => Effect<any, any, any>)
  >(
    id: Identifier,
    options: {
      readonly make: Make
    }
  ) =>
    & ServiceClass<
      Self,
      Identifier,
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
  Object.setPrototypeOf(self, ServiceProto)
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
  return function(key: string, options?: {
    readonly make?: any
  }) {
    self.key = key
    if (options?.make) {
      ;(self as any).make = options.make
    }
    return self
  }
} as any

const ServiceProto: any = {
  [ServiceTypeId]: {
    _Service: (_: unknown) => _,
    _Identifier: (_: unknown) => _
  },
  ...PipeInspectableProto,
  ...YieldableProto,
  toJSON<I, A>(this: Service<I, A>) {
    return {
      _id: "Service",
      key: this.key,
      stack: this.stack
    }
  },
  asEffect(this: any) {
    const fn = this.asEffect = constant(withFiber((fiber) => exitSucceed(get(fiber.services, this))))
    return fn()
  },
  of<Service>(self: Service): Service {
    return self
  },
  serviceMap<Identifier, Shape>(
    this: Service<Identifier, Shape>,
    self: Shape
  ): ServiceMap<Identifier> {
    return make(this, self)
  }
}

const ReferenceTypeId = "~effect/ServiceMap/Reference" as const

/**
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
 *
 * @since 4.0.0
 * @category Models
 */
export interface Reference<in out Shape> extends Service<never, Shape> {
  readonly [ReferenceTypeId]: typeof ReferenceTypeId
  readonly defaultValue: () => Shape
  [Symbol.iterator](): EffectIterator<Reference<Shape>>
}

/**
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
 *
 * @since 4.0.0
 * @category Models
 */
export declare namespace Service {
  /**
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * // Variance interface is used internally for type inference
   * type MyVariance = ServiceMap.Service.Variance<"MyId", { value: number }>
   * ```
   *
   * @since 4.0.0
   * @category Models
   */
  export interface Variance<in out Identifier, in out Shape> {
    readonly [ServiceTypeId]: {
      readonly _Service: Types.Invariant<Shape>
      readonly _Identifier: Types.Invariant<Identifier>
    }
  }

  /**
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * // Any represents any possible service type
   * const services: Array<ServiceMap.Service.Any> = [
   *   ServiceMap.Service<{ log: (msg: string) => void }>("Logger"),
   *   ServiceMap.Service<{ query: (sql: string) => string }>("Database")
   * ]
   * ```
   *
   * @since 4.0.0
   * @category Models
   */
  export type Any = Service<never, any> | Service<any, any>

  /**
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * const Database = ServiceMap.Service<{ query: (sql: string) => string }>("Database")
   *
   * // Extract the service shape from the service
   * type DatabaseService = ServiceMap.Service.Shape<typeof Database>
   * // DatabaseService is { query: (sql: string) => string }
   * ```
   *
   * @since 4.0.0
   * @category Models
   */
  export type Shape<T> = T extends Variance<infer _I, infer S> ? S : never

  /**
   * @example
   * ```ts
   * import { ServiceMap } from "effect"
   *
   * const DatabaseKey = ServiceMap.Service<{ query: (sql: string) => string }>("Database")
   *
   * // Extract the identifier type from a key
   * type DatabaseId = ServiceMap.Service.Identifier<typeof DatabaseKey>
   * // DatabaseId is the identifier type
   * ```
   *
   * @since 4.0.0
   * @category Models
   */
  export type Identifier<T> = T extends Variance<infer I, infer _S> ? I : never
}

const TypeId = "~effect/ServiceMap" as const

/**
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Create a service map with multiple services
 * const Logger = ServiceMap.Service<{ log: (msg: string) => void }>("Logger")
 * const Database = ServiceMap.Service<{ query: (sql: string) => string }>("Database")
 *
 * const services = ServiceMap.make(Logger, { log: (msg: string) => console.log(msg) })
 *   .pipe(ServiceMap.add(Database, { query: (sql) => `Result: ${sql}` }))
 * ```
 *
 * @since 4.0.0
 * @category Models
 */
export interface ServiceMap<in Services> extends Equal.Equal, Pipeable, Inspectable {
  readonly [TypeId]: {
    readonly _Services: Types.Contravariant<Services>
  }
  readonly mapUnsafe: ReadonlyMap<string, any>
}

/**
 * @example
 * ```ts
 * import { ServiceMap } from "effect"
 *
 * // Create a service map from a Map (unsafe)
 * const map = new Map([
 *   ["Logger", { log: (msg: string) => console.log(msg) }]
 * ])
 *
 * const services = ServiceMap.makeUnsafe(map)
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const makeUnsafe = <Services = never>(mapUnsafe: ReadonlyMap<string, any>): ServiceMap<Services> => {
  const self = Object.create(Proto)
  self.mapUnsafe = mapUnsafe
  return self
}

const Proto: Omit<ServiceMap<never>, "mapUnsafe"> = {
  ...PipeInspectableProto,
  [TypeId]: {
    _Services: (_: never) => _
  },
  toJSON(this: ServiceMap<never>) {
    return {
      _id: "ServiceMap",
      services: Array.from(this.mapUnsafe).map(([key, value]) => ({ key, value }))
    }
  },
  [Equal.symbol]<A>(this: ServiceMap<A>, that: unknown): boolean {
    if (
      !isServiceMap(that)
      || this.mapUnsafe.size !== that.mapUnsafe.size
    ) return false
    for (const k of this.mapUnsafe.keys()) {
      if (
        !that.mapUnsafe.has(k) ||
        !Equal.equals(this.mapUnsafe.get(k), that.mapUnsafe.get(k))
      ) {
        return false
      }
    }
    return true
  },
  [Hash.symbol]<A>(this: ServiceMap<A>): number {
    return Hash.number(this.mapUnsafe.size)
  }
}

/**
 * Checks if the provided argument is a `ServiceMap`.
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
 * Checks if the provided argument is a `Service`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * assert.strictEqual(ServiceMap.isService(ServiceMap.Service("Service")), true)
 * ```
 *
 * @since 4.0.0
 * @category Guards
 */
export const isService = (u: unknown): u is Service<any, any> => hasProperty(u, ServiceTypeId)

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
const emptyServiceMap = makeUnsafe(new Map())

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
  key: Service<I, S>,
  service: Types.NoInfer<S>
): ServiceMap<I> => makeUnsafe(new Map([[key.key, service]]))

/**
 * Adds a service to a given `ServiceMap`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Service<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Service<{ TIMEOUT: number }>("Timeout")
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
    key: Service<I, S>,
    service: Types.NoInfer<S>
  ): <Services>(self: ServiceMap<Services>) => ServiceMap<Services | I>
  <Services, I, S>(
    self: ServiceMap<Services>,
    key: Service<I, S>,
    service: Types.NoInfer<S>
  ): ServiceMap<Services | I>
} = dual(3, <Services, I, S>(
  self: ServiceMap<Services>,
  key: Service<I, S>,
  service: Types.NoInfer<S>
): ServiceMap<Services | I> => {
  const map = new Map(self.mapUnsafe)
  map.set(key.key, service)
  return makeUnsafe(map)
})

/**
 * @since 4.0.0
 * @category Adders
 */
export const addOrOmit: {
  <I, S>(
    key: Service<I, S>,
    service: Option.Option<Types.NoInfer<S>>
  ): <Services>(self: ServiceMap<Services>) => ServiceMap<Services | I>
  <Services, I, S>(
    self: ServiceMap<Services>,
    key: Service<I, S>,
    service: Option.Option<Types.NoInfer<S>>
  ): ServiceMap<Services | I>
} = dual(3, <Services, I, S>(
  self: ServiceMap<Services>,
  key: Service<I, S>,
  service: Option.Option<Types.NoInfer<S>>
): ServiceMap<Services | I> => {
  const map = new Map(self.mapUnsafe)
  if (service._tag === "None") {
    map.delete(key.key)
  } else {
    map.set(key.key, service.value)
  }
  return makeUnsafe(map)
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
 * const Logger = ServiceMap.Service<{ log: (msg: string) => void }>("Logger")
 * const Database = ServiceMap.Service<{ query: (sql: string) => string }>("Database")
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
  <S, I, B>(key: Service<I, S>, orElse: LazyArg<B>): <Services>(self: ServiceMap<Services>) => S | B
  <Services, S, I, B>(self: ServiceMap<Services>, key: Service<I, S>, orElse: LazyArg<B>): S | B
} = dual(3, <Services, S, I, B>(self: ServiceMap<Services>, key: Service<I, S>, orElse: LazyArg<B>): S | B => {
  if (self.mapUnsafe.has(key.key)) {
    return self.mapUnsafe.get(key.key)! as any
  }
  return isReference(key) ? getDefaultValue(key) : orElse()
})

/**
 * @since 4.0.0
 * @category Getters
 */
export const getOrUndefined: {
  <S, I>(key: Service<I, S>): <Services>(self: ServiceMap<Services>) => S | undefined
  <Services, S, I>(self: ServiceMap<Services>, key: Service<I, S>): S | undefined
} = dual(
  2,
  <Services, S, I>(self: ServiceMap<Services>, key: Service<I, S>): S | undefined => self.mapUnsafe.get(key.key)
)

/**
 * Get a service from the context that corresponds to the given key.
 *
 * This function is unsafe because if the key is not present in the context, a
 * runtime error will be thrown.
 *
 * For a safer version see {@link getOption}.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param service - The `Service` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Service<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Service<{ TIMEOUT: number }>("Timeout")
 *
 * const Services = ServiceMap.make(Port, { PORT: 8080 })
 *
 * assert.deepStrictEqual(ServiceMap.getUnsafe(Services, Port), { PORT: 8080 })
 * assert.throws(() => ServiceMap.getUnsafe(Services, Timeout))
 * ```
 *
 * @since 4.0.0
 * @category unsafe
 */
export const getUnsafe: {
  <S, I>(service: Service<I, S>): <Services>(self: ServiceMap<Services>) => S
  <Services, S, I>(self: ServiceMap<Services>, services: Service<I, S>): S
} = dual(
  2,
  <Services, I extends Services, S>(self: ServiceMap<Services>, service: Service<I, S>): S => {
    if (!self.mapUnsafe.has(service.key)) {
      if (ReferenceTypeId in service) return getDefaultValue(service as any)
      throw serviceNotFoundError(service)
    }
    return self.mapUnsafe.get(service.key)! as any
  }
)

/**
 * Get a service from the context that corresponds to the given key.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param service - The `Service` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.Service<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Service<{ TIMEOUT: number }>("Timeout")
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
  <Services, I extends Services, S>(service: Service<I, S>): (self: ServiceMap<Services>) => S
  <Services, I extends Services, S>(self: ServiceMap<Services>, service: Service<I, S>): S
} = getUnsafe

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
 * const logger = ServiceMap.getReferenceUnsafe(services, LoggerRef)
 *
 * assert.deepStrictEqual(logger, { log: (msg: string) => console.log(msg) })
 * ```
 *
 * @since 4.0.0
 * @category unsafe
 */
export const getReferenceUnsafe = <Services, S>(self: ServiceMap<Services>, service: Reference<S>): S => {
  if (!self.mapUnsafe.has(service.key)) {
    return getDefaultValue(service as any)
  }
  return self.mapUnsafe.get(service.key)! as any
}

const defaultValueCacheKey = "~effect/ServiceMap/defaultValue" as const

const getDefaultValue = (ref: Reference<any>) => {
  if (defaultValueCacheKey in ref) {
    return ref[defaultValueCacheKey] as any
  }
  return (ref as any)[defaultValueCacheKey] = ref.defaultValue()
}

const serviceNotFoundError = (service: Service<any, any>) => {
  const error = new Error(
    `Service not found${service.key ? `: ${String(service.key)}` : ""}`
  )
  if (service.stack) {
    const lines = service.stack.split("\n")
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
 * Get the value associated with the specified key from the context wrapped in
 * an `Option` object. If the key is not found, the `Option` object will be
 * `None`.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param service - The `Service` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 * import { Option } from "effect/data"
 *
 * const Port = ServiceMap.Service<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Service<{ TIMEOUT: number }>("Timeout")
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
  <S, I>(service: Service<I, S>): <Services>(self: ServiceMap<Services>) => Option.Option<S>
  <Services, S, I>(self: ServiceMap<Services>, service: Service<I, S>): Option.Option<S>
} = dual(2, <Services, I extends Services, S>(self: ServiceMap<Services>, service: Service<I, S>): Option.Option<S> => {
  if (self.mapUnsafe.has(service.key)) {
    return Option.some(self.mapUnsafe.get(service.key)! as any)
  }
  return isReference(service) ? Option.some(getDefaultValue(service as any)) : Option.none()
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
 * const Port = ServiceMap.Service<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Service<{ TIMEOUT: number }>("Timeout")
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
  if (self.mapUnsafe.size === 0) return that as any
  if (that.mapUnsafe.size === 0) return self as any
  const map = new Map(self.mapUnsafe)
  that.mapUnsafe.forEach((value, key) => map.set(key, value))
  return makeUnsafe(map)
})

/**
 * Returns a new `ServiceMap` that contains only the specified services.
 *
 * @param self - The `ServiceMap` to prune services from.
 * @param services - The list of `Service`s to be included in the new `ServiceMap`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 * import { Option } from "effect/data"
 *
 * const Port = ServiceMap.Service<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Service<{ TIMEOUT: number }>("Timeout")
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
export const pick = <S extends ReadonlyArray<Service<any, any>>>(
  ...services: S
) =>
<Services>(self: ServiceMap<Services>): ServiceMap<Services & Service.Identifier<S[number]>> => {
  const map = new Map<string, any>()
  const keySet = new Set(services.map((key) => key.key))
  self.mapUnsafe.forEach((value, key) => {
    if (keySet.has(key)) {
      map.set(key, value)
    }
  })
  return makeUnsafe(map)
}

/**
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe } from "effect"
 * import { ServiceMap } from "effect"
 * import { Option } from "effect/data"
 *
 * const Port = ServiceMap.Service<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.Service<{ TIMEOUT: number }>("Timeout")
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
export const omit = <S extends ReadonlyArray<Service<any, any>>>(
  ...keys: S
) =>
<Services>(self: ServiceMap<Services>): ServiceMap<Exclude<Services, Service.Identifier<S[number]>>> => {
  const map = new Map(self.mapUnsafe)
  for (let i = 0; i < keys.length; i++) {
    map.delete(keys[i].key)
  }
  return makeUnsafe(map)
}

/**
 * Creates a service map key with a default value.
 *
 * **Details**
 *
 * `ServiceMap.Reference` allows you to create a key that can hold a value. You
 * can provide a default value for the service, which will automatically be used
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
) => Reference<Service> = Service as any
