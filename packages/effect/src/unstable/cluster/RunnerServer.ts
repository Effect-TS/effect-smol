/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import { constant } from "../../Function.ts"
import * as Layer from "../../Layer.ts"
import * as Queue from "../../Queue.ts"
import * as RpcServer from "../rpc/RpcServer.ts"
import * as Message from "./Message.ts"
import * as MessageStorage from "./MessageStorage.ts"
import * as Reply from "./Reply.ts"
import * as Runners from "./Runners.ts"
import * as RunnerStorage from "./RunnerStorage.ts"
import * as Sharding from "./Sharding.ts"
import { ShardingConfig } from "./ShardingConfig.ts"
import * as SynchronizedClock from "./SynchronizedClock.ts"

const constVoid = constant(Effect.void)

/**
 * @since 4.0.0
 * @category Layers
 */
export const layerHandlers = Runners.Rpcs.toLayer(Effect.gen(function*() {
  const sharding = yield* Sharding.Sharding
  const storage = yield* MessageStorage.MessageStorage

  return {
    Ping: () => Effect.void,
    Notify: ({ envelope }) =>
      sharding.notify(
        envelope._tag === "Request"
          ? new Message.IncomingRequest({
            envelope,
            respond: constVoid,
            lastSentReply: undefined
          })
          : new Message.IncomingEnvelope({ envelope })
      ),
    Effect: ({ persisted, request }) => {
      let resume: (reply: Effect.Effect<Reply.Encoded>) => void
      let replyEncoded: Reply.Encoded | undefined
      const message = new Message.IncomingRequest({
        envelope: request,
        lastSentReply: undefined,
        respond(reply) {
          return Effect.flatMap(Reply.serialize(reply), (reply) => {
            if (resume) {
              resume(Effect.succeed(reply))
            } else {
              replyEncoded = reply
            }
            return Effect.void
          })
        }
      })
      return Effect.flatMap(
        persisted ?
          Effect.flatMap(
            storage.registerReplyHandler(message),
            () => sharding.notify(message)
          ) :
          sharding.send(message),
        () =>
          Effect.callback<Reply.Encoded>((resume_) => {
            if (replyEncoded) {
              resume_(Effect.succeed(replyEncoded))
            } else {
              resume = resume_
            }
          })
      )
    },
    Stream: ({ persisted, request }) =>
      Effect.flatMap(
        Queue.make<Reply.Encoded>(),
        (queue) => {
          const message = new Message.IncomingRequest({
            envelope: request,
            lastSentReply: undefined,
            respond(reply) {
              return Effect.flatMap(Reply.serialize(reply), (reply) => Queue.offer(queue, reply))
            }
          })
          return Effect.as(
            persisted ?
              Effect.flatMap(
                storage.registerReplyHandler(message),
                () => sharding.notify(message)
              ) :
              sharding.send(message),
            queue
          )
        }
      ),
    Envelope: ({ envelope }) => sharding.send(new Message.IncomingEnvelope({ envelope }))
  }
}))

/**
 * The `RunnerServer` recieves messages from other Runners and forwards them to the
 * `Sharding` layer.
 *
 * It also responds to `Ping` requests.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<
  never,
  never,
  RpcServer.Protocol | Sharding.Sharding | MessageStorage.MessageStorage
> = RpcServer.layer(Runners.Rpcs, {
  spanPrefix: "RunnerServer",
  disableTracing: true
}).pipe(Layer.provide(layerHandlers))

/**
 * A `RunnerServer` layer that includes the `Runners` & `Sharding` clients.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerWithClients: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | RpcServer.Protocol
  | ShardingConfig
  | Runners.RpcClientProtocol
  | MessageStorage.MessageStorage
  | RunnerStorage.RunnerStorage
> = layer.pipe(
  Layer.provideMerge(Sharding.layer),
  Layer.provideMerge(Runners.layerRpc),
  Layer.provideMerge(SynchronizedClock.layer)
)

/**
 * A `Runners` layer that is client only.
 *
 * It will not register with the ShardManager and recieve shard assignments,
 * so this layer can be used to embed a cluster client inside another effect
 * application.
 *
 * @since 4.0.0
 * @category Layers
 */
export const layerClientOnly: Layer.Layer<
  Sharding.Sharding | Runners.Runners,
  never,
  | ShardingConfig
  | Runners.RpcClientProtocol
  | MessageStorage.MessageStorage
> = Sharding.layer.pipe(
  Layer.provideMerge(Runners.layerRpc),
  Layer.provide(RunnerStorage.layerNoop),
  Layer.updateService(ShardingConfig, (config) => ({
    ...config,
    runnerAddress: undefined
  }))
)
