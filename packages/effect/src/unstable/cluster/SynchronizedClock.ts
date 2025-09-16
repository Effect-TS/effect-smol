/**
 * @since 4.0.0
 */
import * as Effect from "../../Effect.ts"
import * as Schedule from "../../Schedule.ts"
import type { Scope } from "../../Scope.ts"
import * as Clock from "../../time/Clock.ts"
import * as Duration from "../../time/Duration.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make: (getRemoteTime: Effect.Effect<number, never, never>) => Effect.Effect<
  Clock.Clock,
  never,
  Scope
> = Effect.fnUntraced(function*(getRemoteTime) {
  const clock = yield* Clock.Clock

  let driftMillis = 0
  let driftNanos = BigInt(0)

  yield* getRemoteTime.pipe(
    Effect.timed,
    Effect.map(([duration, shardManagerTime]) => {
      const halfTrip = Duration.divideUnsafe(duration, 2)
      shardManagerTime = shardManagerTime + Duration.toMillis(halfTrip) + 1
      const selfTime = clock.currentTimeMillisUnsafe()
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

  function currentTimeMillisUnsafe() {
    return clock.currentTimeMillisUnsafe() + driftMillis
  }
  function currentTimeNanosUnsafe() {
    return clock.currentTimeNanosUnsafe() + driftNanos
  }

  return Clock.Clock.of({
    sleep: clock.sleep,
    currentTimeMillisUnsafe,
    currentTimeNanosUnsafe,
    currentTimeMillis: Effect.sync(currentTimeMillisUnsafe),
    currentTimeNanos: Effect.sync(currentTimeNanosUnsafe)
  })
})
