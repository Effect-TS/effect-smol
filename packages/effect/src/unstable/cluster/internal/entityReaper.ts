import * as Effect from "../../../Effect.ts"
import * as Layer from "../../../Layer.ts"
import * as ServiceMap from "../../../ServiceMap.ts"
import { Clock } from "../../../time/Clock.ts"
import type { EntityNotAssignedToRunner } from "../ClusterError.ts"
import type { EntityAddress } from "../EntityAddress.ts"
import type { EntityId } from "../EntityId.ts"
import type { EntityState } from "./entityManager.ts"
import type { ResourceMap } from "./resourceMap.ts"

/** @internal */
export class EntityReaper extends ServiceMap.Key<EntityReaper>()("effect/cluster/EntityReaper", {
  make: Effect.gen(function*() {
    let currentResolution = 30_000
    const registered: Array<{
      readonly maxIdleTime: number
      readonly servers: Map<EntityId, EntityState>
      readonly entities: ResourceMap<EntityAddress, EntityState, EntityNotAssignedToRunner>
    }> = []
    const latch = yield* Effect.makeLatch()

    const register = (options: {
      readonly maxIdleTime: number
      readonly servers: Map<EntityId, EntityState>
      readonly entities: ResourceMap<EntityAddress, EntityState, EntityNotAssignedToRunner>
    }) =>
      Effect.suspend(() => {
        currentResolution = Math.max(Math.min(currentResolution, options.maxIdleTime), 5000)
        registered.push(options)
        return latch.open
      })

    const clock = yield* Clock
    yield* Effect.gen(function*() {
      while (true) {
        yield* Effect.sleep(currentResolution)
        const now = clock.currentTimeMillisUnsafe()
        for (const { entities, maxIdleTime, servers } of registered) {
          for (const state of servers.values()) {
            const duration = now - state.lastActiveCheck
            if (state.keepAliveEnabled || state.activeRequests.size > 0 || duration < maxIdleTime) {
              continue
            }
            yield* Effect.fork(entities.removeIgnore(state.address))
          }
        }
      }
    }).pipe(
      latch.whenOpen,
      Effect.forkScoped
    )

    return { register } as const
  })
}) {
  static readonly layer: Layer.Layer<EntityReaper> = Layer.effect(this)(this.make)
}
