/**
 * @since 4.0.0
 */
import * as Option from "../../data/Option.ts"
import * as Effect from "../../Effect.ts"
import * as PrimaryKey from "../../interfaces/PrimaryKey.ts"
import * as Layer from "../../Layer.ts"
import * as Schedule from "../../Schedule.ts"
import * as Schema from "../../schema/Schema.ts"
import type { Scope } from "../../Scope.ts"
import * as Cron from "../../time/Cron.ts"
import * as DateTime from "../../time/DateTime.ts"
import * as Duration from "../../time/Duration.ts"
import * as Rpc from "../rpc/Rpc.ts"
import * as ClusterSchema from "./ClusterSchema.ts"
import { Persisted, Uninterruptible } from "./ClusterSchema.ts"
import * as DeliverAt from "./DeliverAt.ts"
import * as Entity from "./Entity.ts"
import type { Sharding } from "./Sharding.ts"
import * as Singleton from "./Singleton.ts"

/**
 * @since 4.0.0
 * @category Constructors
 */
export const make = <E, R>(options: {
  readonly name: string
  readonly cron: Cron.Cron
  readonly execute: Effect.Effect<void, E, R>

  /**
   * Choose a shard group to run this cron job on.
   */
  readonly shardGroup?: string | undefined

  /**
   * Whether to run the next cron job based from the time of the previous run.
   *
   * Defaults to `false`, meaning the next run will be calculated from the
   * current time.
   */
  readonly calculateNextRunFromPrevious?: boolean | undefined

  /**
   * If set, the cron job will skip execution if the scheduled time is older
   * than this duration.
   *
   * This is useful to prevent running jobs that were scheduled too far in the
   * past.
   *
   * Defaults to "1 day".
   */
  readonly skipIfOlderThan?: Duration.DurationInput | undefined
}): Layer.Layer<never, never, Sharding | Exclude<R, Scope>> => {
  const CronEntity = Entity.make(`ClusterCron/${options.name}`, [
    Rpc.make("run", {
      payload: CronPayload
    })
      .annotate(Persisted, true)
      .annotate(Uninterruptible, true)
  ])
    .annotate(ClusterSchema.ShardGroup, () => options.shardGroup ?? "default")
    .annotate(ClusterSchema.ClientTracingEnabled, false)

  const InitialRun = Singleton.make(
    `ClusterCron/${options.name}`,
    Effect.gen(function*() {
      const client = (yield* CronEntity.client)("initial")
      const now = yield* DateTime.now
      const next = Cron.next(options.cron, now)
      yield* client.run({
        dateTime: DateTime.unsafeFromDate(next)
      }, { discard: true })
    }),
    { shardGroup: options.shardGroup }
  )

  const skipIfOlderThan = Option.fromNullishOr(options.skipIfOlderThan).pipe(
    Option.map(Duration.decode),
    Option.getOrElse(() => Duration.days(1))
  )

  const effect = Effect.fnUntraced(function*(dateTime: DateTime.Utc) {
    const now = yield* DateTime.now
    if (DateTime.lessThan(dateTime, DateTime.subtractDuration(now, skipIfOlderThan))) {
      return
    }
    return yield* options.execute
  }, Effect.orDie)

  const EntityLayer = CronEntity.toLayer(Effect.gen(function*() {
    const makeClient = yield* CronEntity.client
    return {
      run(request) {
        return Effect.ensuring(
          effect(request.payload.dateTime),
          Effect.gen(function*() {
            const now = yield* DateTime.now
            const next = DateTime.unsafeFromDate(Cron.next(
              options.cron,
              options.calculateNextRunFromPrevious ? request.payload.dateTime : now
            ))
            const client = makeClient(DateTime.formatIso(next))
            return yield* client.run({ dateTime: next }, { discard: true }).pipe(
              Effect.sandbox,
              Effect.retry(retryPolicy)
            )
          }).pipe(
            Effect.catchCause(Effect.logWarning),
            Effect.annotateLogs({
              module: "ClusterCron",
              name: options.name,
              dateTime: request.payload.dateTime
            })
          )
        )
      }
    }
  }))

  return Layer.merge(InitialRun, EntityLayer)
}

const retryPolicy = Schedule.exponential(200, 1.5).pipe(
  Schedule.either(Schedule.spaced("1 minute"))
)

class CronPayload extends Schema.Class<CronPayload>("@effect/cluster/ClusterCron/CronPayload")({
  dateTime: Schema.DateTimeUtc
}) {
  [PrimaryKey.symbol]() {
    return ""
  }
  [DeliverAt.symbol]() {
    return this.dateTime
  }
}
