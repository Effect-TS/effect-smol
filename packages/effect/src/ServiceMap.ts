/**
 * This module provides a data structure called `ServiceMap` that can be used for dependency injection in effectful
 * programs. It is essentially a table mapping `Keys`s to their implementations (called `Service`s), and can be used to
 * manage dependencies in a type-safe way. The `ServiceMap` data structure is essentially a way of providing access to a set
 * of related services that can be passed around as a single unit. This module provides functions to create, modify, and
 * query the contents of a `ServiceMap`, as well as a number of utility types for working with keys and services.
 *
 * @since 4.0.0
 */
import type { EffectIterator, Yieldable } from "./Effect.js"
import * as Equal from "./Equal.js"
import { dual, type LazyArg } from "./Function.js"
import * as Hash from "./Hash.js"
import type { Inspectable } from "./Inspectable.js"
import { PipeInspectableProto } from "./internal/core.js"
import type { Option } from "./Option.js"
import type { Pipeable } from "./Pipeable.js"
import { hasProperty } from "./Predicate.js"
import type * as Types from "./Types.js"

/**
 * @since 4.0.0
 * @category Symbols
 */
export const KeyTypeId: unique symbol = Symbol.for("effect/ServiceMap/Key")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type KeyTypeId = typeof KeyTypeId

/**
 * @since 4.0.0
 * @category Models
 */
export interface Key<in out Id, in out Service> extends Pipeable, Inspectable, Yieldable<Service, never, Id> {
  readonly [KeyTypeId]: {
    readonly _Service: Types.Invariant<Service>
    readonly _Identifier: Types.Invariant<Id>
  }
  readonly Service: Service
  readonly Identifier: Id
  [Symbol.iterator](): EffectIterator<Key<Id, Service>>
  of(self: Service): Service
  context(self: Service): ServiceMap<Id>

  readonly stack?: string | undefined
  readonly key: string
}

/**
 * @since 4.0.0
 * @category Models
 */
export interface KeyClass<in out Self, in out Id extends string, in out Service> extends Key<Self, Service> {
  new(_: never): {
    readonly [KeyTypeId]: KeyTypeId
    readonly key: Id
    readonly Service: Service
  }
  readonly key: Id
}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const Key: {
  <Id, Service = Id>(key: string): Key<Id, Service>
  <Self, Service>(): <const Id extends string>(id: Id) => KeyClass<Self, Id, Service>
} = function() {
  const prevLimit = Error.stackTraceLimit
  Error.stackTraceLimit = 2
  const err = new Error()
  Error.stackTraceLimit = prevLimit

  if (arguments.length === 1) {
    const key = arguments[0] as string
  }
  return function(key: string) {}
} as any

/**
 * @since 4.0.0
 * @category Symbols
 */
export const ReferenceTypeId: unique symbol = Symbol.for("effect/ServiceMap/Reference")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type ReferenceTypeId = typeof ReferenceTypeId

/**
 * @since 4.0.0
 * @category Models
 */
export interface Reference<in out Service> extends Key<never, Service> {
  readonly [ReferenceTypeId]: ReferenceTypeId
  readonly defaultValue: () => Service
  [Symbol.iterator](): EffectIterator<Reference<Service>>
}

/**
 * @since 2.0.0
 */
export declare namespace Key {
  /**
   * @since 4.0.0
   */
  export interface Variance<in out Id, in out Service> {
    readonly [KeyTypeId]: {
      readonly _Service: Types.Invariant<Service>
      readonly _Identifier: Types.Invariant<Id>
    }
  }
  /**
   * @since 2.0.0
   */
  export type Any = Key<never, any> | Key<any, any>
  /**
   * @since 2.0.0
   */
  export type Service<T> = T extends Variance<infer _I, infer S> ? S : never
  /**
   * @since 2.0.0
   */
  export type Identifier<T> = T extends Variance<infer I, infer _S> ? I : never
}

/**
 * @since 4.0.0
 * @category Symbols
 */
export const TypeId: unique symbol = Symbol.for("effect/ServiceMap")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type TypeId = typeof TypeId

/**
 * @since 4.0.0
 * @category Models
 */
export interface ServiceMap<in Services> extends Equal.Equal, Pipeable, Inspectable {
  readonly [TypeId]: {
    readonly _Services: Types.Contravariant<Services>
  }
  readonly unsafeMap: Map<string, any>
}

/**
 * @since 2.0.0
 * @category constructors
 */
export const unsafeMake = <Services = never>(unsafeMap: Map<string, any>): ServiceMap<Services> => {
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
 * Checks if the provided argument is a `Tag`.
 *
 * @param u - The value to be checked if it is a `Tag`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * assert.strictEqual(ServiceMap.isTag(ServiceMap.GenericTag("Tag")), true)
 * ```
 *
 * @since 2.0.0
 * @category guards
 */
export const isKey = (u: unknown): u is Key<any, any> => hasProperty(u, KeyTypeId)

/**
 * Checks if the provided argument is a `Reference`.
 *
 * @param input - The value to be checked if it is a `Reference`.
 * @since 4.0.0
 * @category guards
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
 * @since 2.0.0
 * @category constructors
 */
export const empty = (): ServiceMap<never> => unsafeMake(new Map())

/**
 * Creates a new `ServiceMap` with a single service associated to the tag.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.GenericTag<{ PORT: number }>("Port")
 *
 * const Services = ServiceMap.make(Port, { PORT: 8080 })
 *
 * assert.deepStrictEqual(ServiceMap.get(Services, Port), { PORT: 8080 })
 * ```
 *
 * @since 2.0.0
 * @category constructors
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
 * import { ServiceMap, pipe } from "effect"
 *
 * const Port = ServiceMap.GenericTag<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.GenericTag<{ TIMEOUT: number }>("Timeout")
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
 * Get a service from the context that corresponds to the given tag.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param tag - The `Tag` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe, ServiceMap } from "effect"
 *
 * const Port = ServiceMap.GenericTag<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.GenericTag<{ TIMEOUT: number }>("Timeout")
 *
 * const Services = pipe(
 *   ServiceMap.make(Port, { PORT: 8080 }),
 *   ServiceMap.add(Timeout, { TIMEOUT: 5000 })
 * )
 *
 * assert.deepStrictEqual(ServiceMap.get(Services, Timeout), { TIMEOUT: 5000 })
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const get: {
  <Services, I extends Services, S>(tag: Key<I, S>): (self: ServiceMap<Services>) => S
  <Services, I extends Services, S>(self: ServiceMap<Services>, tag: Key<I, S>): S
} = internal.get

/**
 * Get a service from the context that corresponds to the given tag, or
 * use the fallback value.
 *
 * @since 3.7.0
 * @category getters
 */
export const getOrElse: {
  <S, I, B>(tag: Key<I, S>, orElse: LazyArg<B>): <Services>(self: ServiceMap<Services>) => S | B
  <Services, S, I, B>(self: ServiceMap<Services>, tag: Key<I, S>, orElse: LazyArg<B>): S | B
} = internal.getOrElse

/**
 * Get a service from the context that corresponds to the given tag.
 * This function is unsafe because if the tag is not present in the context, a runtime error will be thrown.
 *
 * For a safer version see {@link getOption}.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param tag - The `Tag` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap } from "effect"
 *
 * const Port = ServiceMap.GenericTag<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.GenericTag<{ TIMEOUT: number }>("Timeout")
 *
 * const Services = ServiceMap.make(Port, { PORT: 8080 })
 *
 * assert.deepStrictEqual(ServiceMap.unsafeGet(Services, Port), { PORT: 8080 })
 * assert.throws(() => ServiceMap.unsafeGet(Services, Timeout))
 * ```
 *
 * @since 2.0.0
 * @category unsafe
 */
export const unsafeGet: {
  <S, I>(tag: Key<I, S>): <Services>(self: ServiceMap<Services>) => S
  <Services, S, I>(self: ServiceMap<Services>, tag: Key<I, S>): S
} = internal.unsafeGet

/**
 * Get the value associated with the specified tag from the context wrapped in an `Option` object. If the tag is not
 * found, the `Option` object will be `None`.
 *
 * @param self - The `ServiceMap` to search for the service.
 * @param tag - The `Tag` of the service to retrieve.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { ServiceMap, Option } from "effect"
 *
 * const Port = ServiceMap.GenericTag<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.GenericTag<{ TIMEOUT: number }>("Timeout")
 *
 * const Services = ServiceMap.make(Port, { PORT: 8080 })
 *
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Port), Option.some({ PORT: 8080 }))
 * assert.deepStrictEqual(ServiceMap.getOption(Services, Timeout), Option.none())
 * ```
 *
 * @since 2.0.0
 * @category getters
 */
export const getOption: {
  <S, I>(tag: Key<I, S>): <Services>(self: ServiceMap<Services>) => Option<S>
  <Services, S, I>(self: ServiceMap<Services>, tag: Key<I, S>): Option<S>
} = internal.getOption

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
 * const Port = ServiceMap.GenericTag<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.GenericTag<{ TIMEOUT: number }>("Timeout")
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
 * @since 2.0.0
 */
export const merge: {
  <R1>(that: ServiceMap<R1>): <Services>(self: ServiceMap<Services>) => ServiceMap<R1 | Services>
  <Services, R1>(self: ServiceMap<Services>, that: ServiceMap<R1>): ServiceMap<Services | R1>
} = internal.merge

/**
 * Returns a new `ServiceMap` that contains only the specified services.
 *
 * @param self - The `ServiceMap` to prune services from.
 * @param tags - The list of `Tag`s to be included in the new `ServiceMap`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import { pipe, ServiceMap, Option } from "effect"
 *
 * const Port = ServiceMap.GenericTag<{ PORT: number }>("Port")
 * const Timeout = ServiceMap.GenericTag<{ TIMEOUT: number }>("Timeout")
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
 * @since 2.0.0
 */
export const pick: <Tags extends ReadonlyArray<Key<any, any>>>(
  ...tags: Tags
) => <Services>(self: ServiceMap<Services>) => ServiceMap<Services & Key.Identifier<Tags[number]>> = internal.pick

/**
 * @since 2.0.0
 */
export const omit: <Tags extends ReadonlyArray<Key<any, any>>>(
  ...tags: Tags
) => <Services>(self: ServiceMap<Services>) => ServiceMap<Exclude<Services, Key.Identifier<Tags[number]>>> =
  internal.omit

/**
 * @example
 * ```ts
 * import { ServiceMap, Layer } from "effect"
 *
 * class MyTag extends ServiceMap.Tag<MyTag, { readonly myNum: number }>()("MyTag") {
 *   static Live = Layer.succeed(this, { myNum: 108 })
 * }
 * ```
 *
 * @since 2.0.0
 * @category constructors
 */
export const Tag: <Self, Shape>() => <const Id extends string>(id: Id) => TagClass<Self, Id, Shape> = internal.Tag

/**
 * Creates a context tag with a default value.
 *
 * **Details**
 *
 * `ServiceMap.Reference` allows you to create a tag that can hold a value. You can
 * provide a default value for the service, which will automatically be used
 * when the context is accessed, or override it with a custom implementation
 * when needed.
 *
 * @since 3.11.0
 * @category constructors
 */
export const Reference: <const Id extends string, Service>(
  id: Id,
  options: { readonly defaultValue: () => Service }
) => ReferenceClass<Id, Service> = internal.Reference

/**
 * @since 4.0.0
 * @category constructors
 */
export const GenericReference: <Service>(
  key: string,
  options: { readonly defaultValue: () => Service }
) => Reference<Service> = internal.GenericReference
