/**
 * @since 4.0.0
 */
import * as Clock from "../../Clock.ts"
import * as Duration from "../../Duration.ts"
import * as Effect from "../../Effect.ts"
import * as Layer from "../../Layer.ts"
import * as Schedule from "../../Schedule.ts"
import type { Scope } from "../../Scope.ts"
import { ShardManagerClient } from "./ShardManager.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make: (getRemoteTime: Effect.Effect<number, never, never>) => Effect.Effect<
  Clock.Clock,
  never,
  Scope
> = Effect.fnUntraced(function*(getRemoteTime) {
  const clock = yield* Effect.clock

  let driftMillis = 0
  let driftNanos = BigInt(0)

  yield* getRemoteTime.pipe(
    Effect.timed,
    Effect.map(([duration, shardManagerTime]) => {
      const halfTrip = Duration.unsafeDivide(duration, 2)
      shardManagerTime = shardManagerTime + Duration.toMillis(halfTrip) + 1
      const selfTime = clock.unsafeCurrentTimeMillis()
      return shardManagerTime - selfTime
    }),
    Effect.replicateEffect(5),
    Effect.flatMap((drifts) => {
      drifts.sort()
      const drift = (driftMillis + drifts[2]) / 2
      driftMillis = Math.round(drift)
      driftNanos = BigInt(Math.round(drift * 1_000_000))
      return Effect.logDebug("Current drift", driftMillis)
    }),
    Effect.andThen(Effect.sleep(Duration.minutes(5))),
    Effect.forever,
    Effect.sandbox,
    Effect.retry(Schedule.spaced(Duration.minutes(1))),
    Effect.annotateLogs({
      package: "@effect/cluster",
      service: "SynchronizedClock"
    }),
    Effect.forkScoped
  )

  function unsafeCurrentTimeMillis() {
    return clock.unsafeCurrentTimeMillis() + driftMillis
  }
  function unsafeCurrentTimeNanos() {
    return clock.unsafeCurrentTimeNanos() + driftNanos
  }

  return Clock.Clock.of({
    [Clock.ClockTypeId]: Clock.ClockTypeId,
    sleep: clock.sleep,
    unsafeCurrentTimeMillis,
    unsafeCurrentTimeNanos,
    currentTimeMillis: Effect.sync(unsafeCurrentTimeMillis),
    currentTimeNanos: Effect.sync(unsafeCurrentTimeNanos)
  })
})

/**
 * @since 4.0.0
 * @category Layers
 */
export const layer: Layer.Layer<
  never,
  never,
  ShardManagerClient
> = Layer.unwrapScoped(Effect.gen(function*() {
  const shardManager = yield* ShardManagerClient
  const clock = yield* make(shardManager.getTime)
  return Layer.setClock(clock)
}))
