/**
 * @since 1.0.0
 */
import type * as Record from "../../data/Record.ts"
import * as Effect from "../../Effect.ts"
import { identity } from "../../Function.ts"
import { type Pipeable } from "../../interfaces/Pipeable.ts"
import * as Layer from "../../Layer.ts"
import type * as Queue from "../../Queue.ts"
import type { Scope } from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as Stream from "../../stream/Stream.ts"
import type { Headers } from "../http/Headers.ts"
import * as Rpc from "./Rpc.ts"
import type * as RpcMiddleware from "./RpcMiddleware.ts"

/**
 * @since 1.0.0
 * @category type ids
 */
export const TypeId: TypeId = "~effect/rpc/RpcGroup"

/**
 * @since 1.0.0
 * @category type ids
 */
export type TypeId = "~effect/rpc/RpcGroup"

/**
 * @since 1.0.0
 * @category groups
 */
export interface RpcGroup<in out R extends Rpc.Any> extends Pipeable {
  new(_: never): {}

  readonly [TypeId]: TypeId
  readonly requests: ReadonlyMap<string, R>
  readonly annotations: ServiceMap.ServiceMap<never>

  /**
   * Add one or more procedures to the group.
   */
  add<const Rpcs2 extends ReadonlyArray<Rpc.Any>>(
    ...rpcs: Rpcs2
  ): RpcGroup<R | Rpcs2[number]>

  /**
   * Merge this group with one or more other groups.
   */
  merge<const Groups extends ReadonlyArray<Any>>(
    ...groups: Groups
  ): RpcGroup<R | Rpcs<Groups[number]>>

  /**
   * Add middleware to all the procedures added to the group until this point.
   */
  middleware<M extends RpcMiddleware.AnyKey>(middleware: M): RpcGroup<Rpc.AddMiddleware<R, M>>

  /**
   * Add a prefix to the procedures in this group, returning a new group
   */
  prefix<const Prefix extends string>(prefix: Prefix): RpcGroup<Rpc.Prefixed<R, Prefix>>

  /**
   * Implement the handlers for the procedures in this group, returning a
   * context object.
   */
  toHandlers<
    Handlers extends HandlersFrom<R>,
    EX = never,
    RX = never
  >(
    build:
      | Handlers
      | Effect.Effect<Handlers, EX, RX>
  ): Effect.Effect<
    ServiceMap.ServiceMap<Rpc.ToHandler<R>>,
    EX,
    | RX
    | HandlersServices<R, Handlers>
  >

  /**
   * Implement the handlers for the procedures in this group.
   */
  toLayer<
    Handlers extends HandlersFrom<R>,
    EX = never,
    RX = never
  >(
    build:
      | Handlers
      | Effect.Effect<Handlers, EX, RX>
  ): Layer.Layer<
    Rpc.ToHandler<R>,
    EX,
    | Exclude<RX, Scope>
    | HandlersServices<R, Handlers>
  >

  of<const Handlers extends HandlersFrom<R>>(handlers: Handlers): Handlers

  /**
   * Implement a single handler from the group.
   */
  toLayerHandler<
    const Tag extends R["_tag"],
    Handler extends HandlerFrom<R, Tag>,
    EX = never,
    RX = never
  >(
    tag: Tag,
    build:
      | Handler
      | Effect.Effect<Handler, EX, RX>
  ): Layer.Layer<
    Rpc.Handler<Tag>,
    EX,
    | Exclude<RX, Scope>
    | HandlerServices<R, Tag, Handler>
  >

  /**
   * Retrieve a handler for a specific procedure in the group.
   */
  accessHandler<const Tag extends R["_tag"]>(tag: Tag): Effect.Effect<
    (
      payload: Rpc.Payload<Extract<R, { readonly _tag: Tag }>>,
      headers: Headers
    ) => Rpc.ResultFrom<Extract<R, { readonly _tag: Tag }>, never>,
    never,
    Rpc.Handler<Tag>
  >

  /**
   * Annotate the group with a value.
   */
  annotate<I, S>(tag: ServiceMap.Key<I, S>, value: S): RpcGroup<R>

  /**
   * Annotate the Rpc's above this point with a value.
   */
  annotateRpcs<I, S>(tag: ServiceMap.Key<I, S>, value: S): RpcGroup<R>

  /**
   * Annotate the group with the provided annotations.
   */
  annotateMerge<S>(annotations: ServiceMap.ServiceMap<S>): RpcGroup<R>

  /**
   * Annotate the Rpc's above this point with the provided annotations.
   */
  annotateRpcsMerge<S>(annotations: ServiceMap.ServiceMap<S>): RpcGroup<R>
}

/**
 * @since 1.0.0
 * @category groups
 */
export interface Any {
  readonly [TypeId]: TypeId
}

/**
 * @since 1.0.0
 * @category groups
 */
export type HandlersFrom<Rpc extends Rpc.Any> = {
  readonly [Current in Rpc as Current["_tag"]]: Rpc.ToHandlerFn<Current>
}

/**
 * @since 1.0.0
 * @category groups
 */
export type HandlerFrom<Rpc extends Rpc.Any, Tag extends Rpc["_tag"]> = Extract<Rpc, { readonly _tag: Tag }> extends
  infer Current ? Current extends Rpc.Any ? Rpc.ToHandlerFn<Current> : never : never

/**
 * @since 1.0.0
 * @category groups
 */
export type HandlersServices<Rpcs extends Rpc.Any, Handlers> = keyof Handlers extends infer K ?
  K extends keyof Handlers & string ? HandlerServices<Rpcs, K, Handlers[K]> : never :
  never

/**
 * @since 1.0.0
 * @category groups
 */
export type HandlerServices<Rpcs extends Rpc.Any, K extends Rpcs["_tag"], Handler> = [Rpc.IsStream<Rpcs, K>] extends
  [true] ? Handler extends (...args: any) =>
    | Stream.Stream<infer _A, infer _E, infer _R>
    | Rpc.Fork<Stream.Stream<infer _A, infer _E, infer _R>>
    | Effect.Effect<
      Queue.Dequeue<infer _A, infer _E | Queue.Done>,
      infer _EX,
      infer _R
    >
    | Rpc.Fork<
      Effect.Effect<
        Queue.Dequeue<infer _A, infer _E | Queue.Done>,
        infer _EX,
        infer _R
      >
    > ? Exclude<Rpc.ExcludeProvides<_R, Rpcs, K>, Scope> :
  never :
  Handler extends (
    ...args: any
  ) => Effect.Effect<infer _A, infer _E, infer _R> | Rpc.Fork<Effect.Effect<infer _A, infer _E, infer _R>> ?
    Rpc.ExcludeProvides<_R, Rpcs, K>
  : never

/**
 * @since 1.0.0
 * @category groups
 */
export type Rpcs<Group> = Group extends RpcGroup<infer R> ? string extends R["_tag"] ? never : R : never

const RpcGroupProto = {
  add(this: RpcGroup<any>, ...rpcs: Array<Rpc.Any>) {
    const requests = new Map(this.requests)
    for (const rpc of rpcs) {
      requests.set(rpc._tag, rpc)
    }
    return makeProto({
      requests,
      annotations: this.annotations
    })
  },
  merge(this: RpcGroup<any>, ...groups: ReadonlyArray<RpcGroup<any>>) {
    const requests = new Map(this.requests)
    const annotations = new Map(this.annotations.unsafeMap)

    for (const group of groups) {
      for (const [tag, rpc] of group.requests) {
        requests.set(tag, rpc)
      }
      for (const [key, value] of group.annotations.unsafeMap) {
        annotations.set(key, value)
      }
    }

    return makeProto({
      requests,
      annotations: ServiceMap.unsafeMake(annotations)
    })
  },
  middleware(this: RpcGroup<any>, middleware: RpcMiddleware.AnyKey) {
    const requests = new Map<string, any>()
    for (const [tag, rpc] of this.requests) {
      requests.set(tag, rpc.middleware(middleware))
    }
    return makeProto({
      requests,
      annotations: this.annotations
    })
  },
  toHandlers(this: RpcGroup<any>, build: Effect.Effect<Record<string, (request: any) => any>>) {
    return Effect.gen(this, function*() {
      const services = yield* Effect.services<never>()
      const handlers = Effect.isEffect(build) ? yield* build : build
      const contextMap = new Map<string, unknown>()
      for (const [tag, handler] of Object.entries(handlers)) {
        const rpc = this.requests.get(tag)!
        contextMap.set(rpc.key, {
          handler,
          context: services
        })
      }
      return ServiceMap.unsafeMake(contextMap)
    })
  },
  prefix<const Prefix extends string>(this: RpcGroup<any>, prefix: Prefix) {
    const requests = new Map<string, any>()
    for (const rpc of this.requests.values()) {
      const newRpc = rpc.prefix(prefix)
      requests.set(newRpc._tag, newRpc)
    }
    return makeProto({
      requests,
      annotations: this.annotations
    })
  },
  toLayer(this: RpcGroup<any>, build: Effect.Effect<Record<string, (request: any) => any>>) {
    return Layer.effectServices(this.toHandlers(build))
  },
  of: identity,
  toLayerHandler(this: RpcGroup<any>, tag: string, build: Effect.Effect<Record<string, (request: any) => any>>) {
    return Layer.effectServices(Effect.gen(this, function*() {
      const services = yield* Effect.services<never>()
      const handler = Effect.isEffect(build) ? yield* build : build
      const contextMap = new Map<string, unknown>()
      const rpc = this.requests.get(tag)!
      contextMap.set(rpc.key, {
        handler,
        services
      })
      return ServiceMap.unsafeMake(contextMap)
    }))
  },
  accessHandler(this: RpcGroup<any>, tag: string) {
    return Effect.servicesWith((parentServices: ServiceMap.ServiceMap<any>) => {
      const rpc = this.requests.get(tag)!
      const { handler, services } = parentServices.unsafeMap.get(rpc.key) as Rpc.Handler<any>
      return Effect.succeed((payload: Rpc.Payload<any>, headers: Headers) => {
        const result = handler(payload, headers)
        const effectOrStream = Rpc.isFork(result) ? result.value : result
        return Effect.isEffect(effectOrStream)
          ? Effect.provide(effectOrStream, services)
          : Stream.provideServices(effectOrStream, services)
      })
    })
  },
  annotate(this: RpcGroup<any>, tag: ServiceMap.Key<any, any>, value: any) {
    return makeProto({
      requests: this.requests,
      annotations: ServiceMap.add(this.annotations, tag, value)
    })
  },
  annotateRpcs(this: RpcGroup<any>, tag: ServiceMap.Key<any, any>, value: any) {
    return this.annotateRpcsMerge(ServiceMap.make(tag, value))
  },
  annotateMerge(this: RpcGroup<any>, context: ServiceMap.ServiceMap<any>) {
    return makeProto({
      requests: this.requests,
      annotations: ServiceMap.merge(this.annotations, context)
    })
  },
  annotateRpcsMerge(this: RpcGroup<any>, context: ServiceMap.ServiceMap<any>) {
    const requests = new Map<string, any>()
    for (const [tag, rpc] of this.requests) {
      requests.set(tag, rpc.annotateMerge(ServiceMap.merge(context, rpc.annotations)))
    }
    return makeProto({
      requests,
      annotations: this.annotations
    })
  }
}

const makeProto = <Rpcs extends Rpc.Any>(options: {
  readonly requests: ReadonlyMap<string, Rpcs>
  readonly annotations: ServiceMap.ServiceMap<never>
}): RpcGroup<Rpcs> =>
  Object.assign(function() {}, RpcGroupProto, {
    requests: options.requests,
    annotations: options.annotations
  }) as any

/**
 * @since 1.0.0
 * @category groups
 */
export const make = <const Rpcs extends ReadonlyArray<Rpc.Any>>(
  ...rpcs: Rpcs
): RpcGroup<Rpcs[number]> =>
  makeProto({
    requests: new Map(rpcs.map((rpc) => [rpc._tag, rpc])),
    annotations: ServiceMap.empty()
  })
