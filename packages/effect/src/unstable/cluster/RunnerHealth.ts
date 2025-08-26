/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as RcMap from "../../RcMap.ts"
import type * as Scope from "../../Scope.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as MessageStorage from "./MessageStorage.ts"
import type { RunnerAddress } from "./RunnerAddress.ts"
import * as Runners from "./Runners.ts"
import type { ShardingConfig } from "./ShardingConfig.ts"

/**
 * Represents the service used to check if a Runner is healthy.
 *
 * If a Runner is responsive, shards will not be re-assigned because the Runner may
 * still be processing messages. If a Runner is not responsive, then its
 * associated shards can and will be re-assigned to a different Runner.
 *
 * @since 4.0.0
 * @category models
 */
export class RunnerHealth extends ServiceMap.Key<
  RunnerHealth,
  {
    /**
     * Used to indicate that a Runner is connected to this host and is healthy,
     * while the Scope is active.
     */
    readonly onConnection: (address: RunnerAddress) => Effect.Effect<void, never, Scope.Scope>
    readonly isAlive: (address: RunnerAddress) => Effect.Effect<boolean>
  }
>()("effect/cluster/RunnerHealth") {}

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make: (
  options: { readonly isAlive: (address: RunnerAddress) => Effect.Effect<boolean> }
) => Effect.Effect<
  RunnerHealth["Service"],
  never,
  Scope.Scope
> = Effect.fnUntraced(function*(options: {
  readonly isAlive: (address: RunnerAddress) => Effect.Effect<boolean>
}) {
  const connections = yield* RcMap.make({
    lookup: (_address: RunnerAddress) => Effect.void
  })

  const onConnection = (address: RunnerAddress) => RcMap.get(connections, address)
  const isAlive = Effect.fnUntraced(function*(address: RunnerAddress) {
    if (yield* RcMap.has(connections, address)) {
      return true
    }
    return yield* options.isAlive(address)
  })

  return RunnerHealth.of({
    onConnection,
    isAlive
  })
})

/**
 * A layer which will **always** consider a Runner healthy.
 *
 * This is useful for testing.
 *
 * @since 4.0.0
 * @category layers
 */
export const layerNoop = Layer.effect(RunnerHealth)(make({
  isAlive: () => Effect.succeed(true)
}))

/**
 * @since 4.0.0
 * @category Constructors
 */
export const makePing: Effect.Effect<
  RunnerHealth["Service"],
  never,
  Runners.Runners | Scope.Scope
> = Effect.gen(function*() {
  const runners = yield* Runners.Runners

  function isAlive(address: RunnerAddress): Effect.Effect<boolean> {
    return runners.ping(address).pipe(
      Effect.timeout(3000),
      Effect.retry({ times: 3 }),
      Effect.isSuccess
    )
  }

  return yield* make({ isAlive })
})

/**
 * A layer which will ping a Runner directly to check if it is healthy.
 *
 * @since 4.0.0
 * @category layers
 */
export const layer: Layer.Layer<
  RunnerHealth,
  never,
  Runners.Runners
> = Layer.effect(RunnerHealth)(makePing)

/**
 * A layer which will ping a Runner directly to check if it is healthy.
 *
 * @since 4.0.0
 * @category layers
 */
export const layerRpc: Layer.Layer<
  RunnerHealth,
  never,
  Runners.RpcClientProtocol | ShardingConfig
> = layer.pipe(
  Layer.provide(Runners.layerRpc),
  Layer.provide(MessageStorage.layerNoop)
)
