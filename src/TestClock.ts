import * as Array from "./Array.js"
import * as Clock from "./Clock.js"
import * as Data from "./Data.js"
import * as Deferred from "./Deferred.js"
import * as Duration from "./Duration.js"
import type { Effect } from "./Effect.js"
import type { Fiber } from "./Fiber.js"
import { pipe } from "./Function.js"
import * as core from "./internal/core.js"
import * as Order from "./Order.js"

// TODO:
//   - Remove console.log when Effect.log exists
//   - Determine a way to track if all fibers in a test are suspended

/**
 * A `TestClock` simplifies deterministically and efficiently testing effects
 * which involve the passage of time.
 *
 * Instead of waiting for actual time to pass, `sleep` and methods implemented
 * in terms of it schedule effects to take place at a given clock time. Users
 * can adjust the clock time using the `adjust` and `setTime` methods, and all
 * effects scheduled to take place on or before that time will automatically be
 * run in order.
 *
 * For example, here is how we can test `Effect.timeout` using `TestClock`:
 *
 * ```ts
 * import { Duration, Effect, Fiber, TestClock, Option } from "effect"
 *
 * Effect.gen(function*() {
 *   const fiber = yield* pipe(
 *     Effect.sleep("5 minutes"),
 *     Effect.timeout("1 minute"),
 *     Effect.fork
 *   )
 *   yield* TestClock.adjust("1 minute")
 *   const result = yield* Fiber.join(fiber)
 *   assert.deepStrictEqual(result, Option.none())
 * })
 * ```
 *
 * Note how we forked the fiber that `sleep` was invoked on. Calls to `sleep`
 * and methods derived from it will semantically block until the time is set to
 * on or after the time they are scheduled to run. If we didn't fork the fiber
 * on which we called sleep we would never get to set the time on the line
 * below. Thus, a useful pattern when using `TestClock` is to fork the effect
 * being tested, then adjust the clock time, and finally verify that the
 * expected effects have been performed.
 *
 * @since 2.0.0
 */
export interface TestClock extends Clock.Clock {
  /**
   * Increments the current clock time by the specified duration. Any effects
   * that were scheduled to occur on or before the new time will be run in
   * order.
   */
  adjust(duration: Duration.DurationInput): Effect<void>
  /**
   * Sets the current clock time to the specified `timestamp`. Any effects that
   * were scheduled to occur on or before the new time will be run in order.
   */
  setTime(timestamp: number): Effect<void>
}

/**
 * @since 4.0.0
 */
export declare namespace TestClock {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Options {
    /**
     * The amount of time to wait before displaying a warning message when a
     * test is using time but is not advancing the `TestClock`.
     */
    readonly warningDelay?: Duration.DurationInput
  }

  /**
   * @since 4.0.0
   * @category models
   */
  export interface State {
    readonly timestamp: number
    readonly sleeps: ReadonlyArray<[number, Deferred.Deferred<void>]>
  }
}

/**
 * The warning message that will be displayed if a test is using time but is
 * not advancing the `TestClock`.
 */
const warningMessage = "Warning: A test is using time, but is not advancing " +
  "the test clock, which may result in the test hanging. Use TestClock.adjust to " +
  "manually advance the time."

const defaultOptions: Required<TestClock.Options> = {
  warningDelay: "1 second"
}

export const make = core.fnUntraced(function*(
  options?: TestClock.Options
) {
  const config = Object.assign({}, defaultOptions, options)

  let currentTimestamp: number = new Date(0).getTime()
  let sleeps: Array<[number, Deferred.Deferred<void>]> = []
  let warningState: WarningState = WarningState.Start()

  const liveClock = yield* Clock.clockWith(core.succeed)

  const warningSemaphore = yield* core.makeSemaphore(1)

  const sleepOrder = pipe(
    Order.tuple(Order.number, Order.empty<Deferred.Deferred<void>>()),
    Order.reverse
  )
  const sortSleeps = Array.sort(sleepOrder)

  function unsafeCurrentTimeMillis(): number {
    return currentTimestamp
  }

  function unsafeCurrentTimeNanos(): bigint {
    return BigInt(currentTimestamp * 1000000)
  }

  const currentTimeMillis = core.sync(unsafeCurrentTimeMillis)
  const currentTimeNanos = core.sync(unsafeCurrentTimeNanos)

  /**
   * Forks a fiber that will display a warning message if a test is using time
   * but is not advancing the `TestClock`.
   */
  const warningStart = warningSemaphore.withPermits(1)(
    core.suspend(() => {
      if (warningState._tag === "Start") {
        return core.sync(() => console.log(warningMessage)).pipe(
          core.delay(config.warningDelay),
          core.provideService(Clock.CurrentClock, liveClock),
          core.fork,
          core.interruptible,
          core.flatMap((fiber) =>
            core.sync(() => {
              warningState = WarningState.Pending({ fiber })
            })
          )
        )
      }
      return core.void
    })
  )
  /**
   * Cancels the warning message that is displayed if a test is using time but
   * is not advancing the `TestClock`.
   */
  const warningDone = warningSemaphore.withPermits(1)(
    core.suspend(() => {
      switch (warningState._tag) {
        case "Pending": {
          return core.fiberInterrupt(warningState.fiber).pipe(
            core.andThen(core.sync(() => {
              warningState = WarningState.Done()
            }))
          )
        }
        case "Start":
        case "Done": {
          warningState = WarningState.Done()
          return core.void
        }
      }
    })
  )

  const sleep = core.fnUntraced(
    function*(duration: Duration.DurationInput) {
      const millis = Duration.toMillis(duration)
      const deferred = yield* Deferred.make<void>()
      const end = currentTimestamp + millis
      if (end > currentTimestamp) {
        sleeps = Array.append(sleeps, [end, deferred])
        yield* warningStart
        yield* Deferred.await(deferred)
      } else {
        yield* Deferred.succeed(deferred, void 0)
      }
    }
  )

  const run = core.fnUntraced(function*(step: (currentTimestamp: number) => number) {
    yield* core.yieldNow
    let endTimestamp = step(currentTimestamp)
    const sorted = sortSleeps(sleeps)
    const remaining: Array<[number, Deferred.Deferred<void>]> = []
    for (const sleep of sorted) {
      const [timestamp, deferred] = sleep
      if (timestamp <= endTimestamp) {
        endTimestamp = timestamp
        yield* Deferred.succeed(deferred, void 0)
        yield* core.yieldNow
      } else {
        remaining.push(sleep)
      }
    }
    currentTimestamp = endTimestamp
    sleeps = remaining
  })

  function adjust(duration: Duration.DurationInput): Effect<void> {
    const millis = Duration.toMillis(duration)
    return warningDone.pipe(core.andThen(run((timestamp) => timestamp + millis)))
  }

  function setTime(timestamp: number): Effect<void> {
    return warningDone.pipe(core.andThen(run(() => timestamp)))
  }

  const testClock: TestClock = {
    unsafeCurrentTimeMillis,
    unsafeCurrentTimeNanos,
    currentTimeMillis,
    currentTimeNanos,
    adjust,
    setTime,
    sleep
  }

  yield* core.provideReferenceScoped(Clock.CurrentClock, testClock)
  yield* core.addFinalizer(() => warningDone)
})

/**
 * Retrieves the `TestClock` service for this test and uses it to run the
 * specified workflow.
 *
 * @since 2.0.0
 */
export const testClockWith = <A, E, R>(f: (testClock: TestClock) => Effect<A, E, R>): Effect<A, E, R> =>
  core.withFiber((fiber) => f(fiber.getRef(Clock.CurrentClock) as TestClock))

/**
 * Accesses a `TestClock` instance in the context and increments the time
 * by the specified duration, running any actions scheduled for on or before
 * the new time in order.
 *
 * @since 2.0.0
 */
export const adjust = (duration: Duration.DurationInput): Effect<void> =>
  testClockWith((testClock) => testClock.adjust(duration))

/**
 * `WarningState` describes the state of the warning message that is displayed
 * if a test is using time but is not advancing the `TestClock`.
 *
 * The possible states are:
 *   - `Start` if a test has not used time yet
 *   - `Pending` if a test has used time but has not adjusted the `TestClock`
 *   - `Done` if a test has adjusted the `TestClock` or the warning message
 *     has already been displayed.
 */
type WarningState = Data.TaggedEnum<{
  /**
   * The `WarningState` which indicates that a test has not yet used time.
   */
  readonly Start: {}
  /**
   * The `WarningState` which indicates that a test has used time but has not
   * adjusted the `TestClock`.
   *
   * The `Pending` state also includes a reference to the fiber that will
   * display the warning message.
   */
  readonly Pending: {
    readonly fiber: Fiber<void, unknown>
  }
  /**
   * The `WarningState` which indicates that a test has used time, or that the
   * warning message has already been displayed.
   */
  readonly Done: {}
}>
const WarningState = Data.taggedEnum<WarningState>()
