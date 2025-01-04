import * as Clock from "./Clock.js"
import * as Data from "./Data.js"
import * as Duration from "./Duration.js"
import * as Effect from "./Effect.js"
import * as Fiber from "./Fiber.js"
import * as Layer from "./Layer.js"
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
  adjust(duration: Duration.DurationInput): Effect.Effect<void>
  /**
   * Sets the current clock time to the specified `timestamp`. Any effects that
   * were scheduled to occur on or before the new time will be run in order.
   */
  setTime(timestamp: number): Effect.Effect<void>
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
    readonly sleeps: ReadonlyArray<[number, Effect.Latch]>
  }
}

/**
 * The warning message that will be displayed if a test is using time but is
 * not advancing the `TestClock`.
 */
const warningMessage = "A test is using time, but is not advancing the test " +
  "clock, which may result in the test hanging. Use TestClock.adjust to " +
  "manually advance the time."

const defaultOptions: Required<TestClock.Options> = {
  warningDelay: "1 second"
}

export const make = Effect.fnUntraced(function*(
  options?: TestClock.Options
) {
  const config = Object.assign({}, defaultOptions, options)
  let sleeps: Array<[number, Effect.Latch]> = []
  const liveClock = yield* Clock.clockWith(Effect.succeed)
  const warningSemaphore = yield* Effect.makeSemaphore(1)
  const SleepOrder = Order.tuple(Order.number, Order.empty<Effect.Latch>())

  let currentTimestamp: number = new Date(0).getTime()
  let warningState: WarningState = WarningState.Start()

  function unsafeCurrentTimeMillis(): number {
    return currentTimestamp
  }

  function unsafeCurrentTimeNanos(): bigint {
    return BigInt(currentTimestamp * 1000000)
  }

  const currentTimeMillis = Effect.sync(unsafeCurrentTimeMillis)
  const currentTimeNanos = Effect.sync(unsafeCurrentTimeNanos)

  /**
   * Forks a fiber that will display a warning message if a test is using time
   * but is not advancing the `TestClock`.
   */
  const warningStart = warningSemaphore.withPermits(1)(
    Effect.suspend(() => {
      if (warningState._tag === "Start") {
        return Effect.logWarning(warningMessage).pipe(
          Effect.delay(config.warningDelay),
          Effect.provideService(Clock.CurrentClock, liveClock),
          Effect.fork,
          Effect.interruptible,
          Effect.flatMap((fiber) =>
            Effect.sync(() => {
              warningState = WarningState.Pending({ fiber })
            })
          )
        )
      }
      return Effect.void
    })
  )
  /**
   * Cancels the warning message that is displayed if a test is using time but
   * is not advancing the `TestClock`.
   */
  const warningDone = warningSemaphore.withPermits(1)(
    Effect.suspend(() => {
      switch (warningState._tag) {
        case "Pending": {
          return Fiber.interrupt(warningState.fiber).pipe(
            Effect.andThen(Effect.sync(() => {
              warningState = WarningState.Done()
            }))
          )
        }
        case "Start":
        case "Done": {
          warningState = WarningState.Done()
          return Effect.void
        }
      }
    })
  )

  const sleep = Effect.fnUntraced(function*(duration: Duration.DurationInput) {
    const millis = Duration.toMillis(duration)
    const end = currentTimestamp + millis
    if (end <= currentTimestamp) return
    const latch = Effect.unsafeMakeLatch()
    sleeps.push([end, latch])
    yield* warningStart
    yield* latch.await
  })

  const run = Effect.fnUntraced(function*(step: (currentTimestamp: number) => number) {
    yield* Effect.yieldNow
    const endTimestamp = step(currentTimestamp)
    let index = 0
    while (true) {
      const toRun: Array<[number, Effect.Latch]> = []
      const remaining: Array<[number, Effect.Latch]> = []
      for (; index < sleeps.length; index++) {
        const entry = sleeps[index]
        if (entry[0] <= endTimestamp) {
          toRun.push(entry)
        } else {
          remaining.push(entry)
        }
      }
      if (toRun.length === 0) break
      sleeps = remaining
      index = remaining.length
      toRun.sort(SleepOrder)
      for (const sleep of toRun) {
        const [timestamp, latch] = sleep
        currentTimestamp = timestamp
        yield* latch.open
        yield* Effect.yieldNow
      }
      currentTimestamp = endTimestamp
    }
  })

  function adjust(duration: Duration.DurationInput) {
    const millis = Duration.toMillis(duration)
    return warningDone.pipe(Effect.andThen(run((timestamp) => timestamp + millis)))
  }

  function setTime(timestamp: number) {
    return warningDone.pipe(Effect.andThen(run(() => timestamp)))
  }

  yield* Effect.addFinalizer(() => warningDone)

  return {
    unsafeCurrentTimeMillis,
    unsafeCurrentTimeNanos,
    currentTimeMillis,
    currentTimeNanos,
    adjust,
    setTime,
    sleep
  }
})

/**
 * Creates a `Layer` which constructs a `TestClock`.
 *
 * @since 4.0.0
 * @category layers
 */
export const layer = (options?: TestClock.Options): Layer.Layer<TestClock> =>
  // @ts-expect-error
  Layer.effect(Clock.CurrentClock, make(options))

/**
 * Retrieves the `TestClock` service for this test and uses it to run the
 * specified workflow.
 *
 * @since 2.0.0
 */
export const testClockWith = <A, E, R>(
  f: (testClock: TestClock) => Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> => Effect.withFiber((fiber) => f(fiber.getRef(Clock.CurrentClock) as TestClock))

/**
 * Accesses a `TestClock` instance in the context and increments the time
 * by the specified duration, running any actions scheduled for on or before
 * the new time in order.
 *
 * @since 2.0.0
 */
export const adjust = (duration: Duration.DurationInput): Effect.Effect<void> =>
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
    readonly fiber: Fiber.Fiber<void, unknown>
  }
  /**
   * The `WarningState` which indicates that a test has used time, or that the
   * warning message has already been displayed.
   */
  readonly Done: {}
}>
const WarningState = Data.taggedEnum<WarningState>()
