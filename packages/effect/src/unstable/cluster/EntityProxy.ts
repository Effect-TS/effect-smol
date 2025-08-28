/**
 * @since 4.0.0
 */
import * as Schema from "../../schema/Schema.ts"
import * as HttpApiEndpoint from "../httpapi/HttpApiEndpoint.ts"
import * as HttpApiGroup from "../httpapi/HttpApiGroup.ts"
import * as Rpc from "../rpc/Rpc.ts"
import * as RpcGroup from "../rpc/RpcGroup.ts"
import { AlreadyProcessingMessage, EntityNotManagedByRunner, MailboxFull, PersistenceError } from "./ClusterError.ts"
import type * as Entity from "./Entity.ts"
import type { EntityId } from "./EntityId.ts"

const clientErrors = [
  MailboxFull,
  AlreadyProcessingMessage,
  PersistenceError,
  EntityNotManagedByRunner
] as const

/**
 * Derives an `RpcGroup` from an `Entity`.
 *
 * ```ts
 * import { ClusterSchema, Entity, EntityProxy, EntityProxyServer } from "effect/unstable/cluster"
 * import { Rpc, RpcServer } from "effect/unstable/rpc"
 * import { Schema } from "effect/schema"
 * import { Layer } from "effect"
 *
 * export const Counter = Entity.make("Counter", [
 *   Rpc.make("Increment", {
 *     payload: { id: Schema.String, amount: Schema.Number },
 *     primaryKey: ({ id }) => id,
 *     success: Schema.Number
 *   })
 * ]).annotateRpcs(ClusterSchema.Persisted, true)
 *
 * // Use EntityProxy.toRpcGroup to create a `RpcGroup` from the Counter entity
 * export class MyRpcs extends EntityProxy.toRpcGroup(Counter) {}
 *
 * // Use EntityProxyServer.layerRpcHandlers to create a layer that implements
 * // the rpc handlers
 * const RpcServerLayer = RpcServer.layer(MyRpcs).pipe(
 *   Layer.provide(EntityProxyServer.layerRpcHandlers(Counter))
 * )
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const toRpcGroup = <Type extends string, Rpcs extends Rpc.Any>(
  entity: Entity.Entity<Type, Rpcs>
): RpcGroup.RpcGroup<ConvertRpcs<Rpcs, Type>> => {
  const rpcs: Array<Rpc.Any> = []
  for (const parentRpc_ of entity.protocol.requests.values()) {
    const parentRpc = parentRpc_ as any as Rpc.AnyWithProps
    const payloadSchema = Schema.Struct({
      entityId: Schema.String,
      payload: parentRpc.payloadSchema
    })
    const oldMake = payloadSchema.makeSync
    payloadSchema.makeSync = (input: any, options?: Schema.MakeOptions) => {
      return oldMake({
        entityId: input.entityId,
        payload: parentRpc.payloadSchema.makeSync(input.payload, options)
      }, options)
    }
    const rpc = Rpc.make(`${entity.type}.${parentRpc._tag}`, {
      payload: payloadSchema,
      error: Schema.Union([parentRpc.errorSchema, ...clientErrors]),
      success: parentRpc.successSchema
    }).annotateMerge(parentRpc.annotations)
    const rpcDiscard = Rpc.make(`${entity.type}.${parentRpc._tag}Discard`, {
      payload: payloadSchema,
      error: Schema.Union(clientErrors)
    }).annotateMerge(parentRpc.annotations)
    rpcs.push(rpc, rpcDiscard)
  }
  return RpcGroup.make(...rpcs) as any as RpcGroup.RpcGroup<ConvertRpcs<Rpcs, Type>>
}

/**
 * @since 4.0.0
 */
export type ConvertRpcs<Rpcs extends Rpc.Any, Prefix extends string> = Rpcs extends Rpc.Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ?
    | Rpc.Rpc<
      `${Prefix}.${_Tag}`,
      Schema.Struct<{
        entityId: typeof Schema.String
        payload: _Payload
      }>,
      _Success,
      Schema.Codec<
        _Error["Type"] | MailboxFull | AlreadyProcessingMessage | PersistenceError | EntityNotManagedByRunner,
        | _Error["Encoded"]
        | typeof MailboxFull["Encoded"]
        | typeof AlreadyProcessingMessage["Encoded"]
        | typeof PersistenceError["Encoded"]
        | typeof EntityNotManagedByRunner["Encoded"],
        _Error["DecodingServices"],
        _Error["EncodingServices"]
      >
    >
    | Rpc.Rpc<
      `${Prefix}.${_Tag}Discard`,
      Schema.Struct<{
        entityId: typeof Schema.String
        payload: _Payload
      }>,
      typeof Schema.Void,
      Schema.Union<[
        typeof MailboxFull,
        typeof AlreadyProcessingMessage,
        typeof PersistenceError,
        typeof EntityNotManagedByRunner
      ]>
    >
  : never

const entityIdPath = Schema.Struct({
  entityId: Schema.String
})

/**
 * Derives an `HttpApiGroup` from an `Entity`.
 *
 * ```ts
 * import { ClusterSchema, Entity, EntityProxy, EntityProxyServer } from "effect/unstable/cluster"
 * import { HttpApi, HttpApiBuilder } from "effect/unstable/httpapi"
 * import { Rpc } from "effect/unstable/rpc"
 * import { Schema } from "effect/schema"
 * import { Layer } from "effect"
 *
 * export const Counter = Entity.make("Counter", [
 *   Rpc.make("Increment", {
 *     payload: { id: Schema.String, amount: Schema.Number },
 *     primaryKey: ({ id }) => id,
 *     success: Schema.Number
 *   })
 * ]).annotateRpcs(ClusterSchema.Persisted, true)
 *
 * // Use EntityProxy.toHttpApiGroup to create a `HttpApiGroup` from the
 * // Counter entity
 * export class MyApi extends HttpApi.make("api")
 *   .add(
 *     EntityProxy.toHttpApiGroup("counter", Counter)
 *       .prefix("/counter")
 *   )
 * {}
 *
 * // Use EntityProxyServer.layerHttpApi to create a layer that implements
 * // the handlers for the HttpApiGroup
 * const ApiLayer = HttpApiBuilder.layer(MyApi).pipe(
 *   Layer.provide(EntityProxyServer.layerHttpApi(MyApi, "counter", Counter))
 * )
 * ```
 *
 * @since 4.0.0
 * @category Constructors
 */
export const toHttpApiGroup = <const Name extends string, Type extends string, Rpcs extends Rpc.Any>(
  name: Name,
  entity: Entity.Entity<Type, Rpcs>
): HttpApiGroup.HttpApiGroup<Name, ConvertHttpApi<Rpcs>> => {
  let group = HttpApiGroup.make(name)
  for (const parentRpc_ of entity.protocol.requests.values()) {
    const parentRpc = parentRpc_ as any as Rpc.AnyWithProps
    const endpoint = HttpApiEndpoint.post(parentRpc._tag, `/${tagToPath(parentRpc._tag)}/:entityId`)
      .setPath(entityIdPath)
      .setPayload(parentRpc.payloadSchema)
      .addSuccess(parentRpc.successSchema)
      .addError(Schema.Union([parentRpc.errorSchema, ...clientErrors]))
      .annotateMerge(parentRpc.annotations)
    const endpointDiscard = HttpApiEndpoint.post(
      `${parentRpc._tag}Discard`,
      `/${tagToPath(parentRpc._tag)}/:entityId/discard`
    )
      .setPath(entityIdPath)
      .setPayload(parentRpc.payloadSchema)
      .addError(Schema.Union(clientErrors))
      .annotateMerge(parentRpc.annotations)

    group = group.add(endpoint).add(endpointDiscard) as any
  }
  return group as any as HttpApiGroup.HttpApiGroup<Name, ConvertHttpApi<Rpcs>>
}

// TODO: type level equivalent
const tagToPath = (tag: string): string =>
  tag
    // .replace(/[^a-zA-Z0-9]+/g, "-") // Replace non-alphanumeric characters with hyphen
    // .replace(/([a-z])([A-Z])/g, "$1-$2") // Insert hyphen before uppercase letters
    .toLowerCase()

/**
 * @since 4.0.0
 */
export type ConvertHttpApi<Rpcs extends Rpc.Any> = Rpcs extends Rpc.Rpc<
  infer _Tag,
  infer _Payload,
  infer _Success,
  infer _Error,
  infer _Middleware,
  infer _Requires
> ?
    | HttpApiEndpoint.HttpApiEndpoint<
      _Tag,
      "POST",
      `/${Lowercase<_Tag>}/:entityId`,
      Schema.Struct<{ entityId: typeof EntityId }>,
      never,
      _Payload,
      never,
      _Success,
      | _Error
      | typeof MailboxFull
      | typeof AlreadyProcessingMessage
      | typeof PersistenceError
      | typeof EntityNotManagedByRunner
    >
    | HttpApiEndpoint.HttpApiEndpoint<
      `${_Tag}Discard`,
      "POST",
      `/${Lowercase<_Tag>}/:entityId/discard`,
      Schema.Struct<{ entityId: typeof EntityId }>,
      never,
      _Payload,
      never,
      Schema.Void,
      typeof MailboxFull | typeof AlreadyProcessingMessage | typeof PersistenceError | typeof EntityNotManagedByRunner
    >
  : never
