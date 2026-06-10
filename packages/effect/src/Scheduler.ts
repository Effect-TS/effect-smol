/**
 * Controls how runnable Effect fiber tasks are dispatched.
 *
 * A scheduler decides how tasks are queued, when queued tasks run, and when a
 * fiber should pause so other work can continue. This module includes the
 * scheduler service reference, the default `MixedScheduler`, dispatcher types
 * for queued tasks, and references for tuning or disabling automatic scheduler
 * yields.
 *
 * @since 2.0.0
 */
import * as Context from "./Context.ts"
import type * as Fiber from "./Fiber.ts"

const setImmediateUnsafe: (f: () => void) => () => void = "setImmediate" in globalThis
  ? (f) => {
    // @ts-ignore
    const timer = globalThis.setImmediate(f)
    // @ts-ignore
    return (): void => globalThis.clearImmediate(timer)
  }
  : (f) => {
    const timer = setTimeout(f, 0)
    return (): void => clearTimeout(timer)
  }

// Tracks consecutive microtask flushes across all dispatchers, so the
// periodic macrotask fallback applies globally. Keeping it per-dispatcher
// would let workloads spanning many dispatchers starve the event loop
// indefinitely.
let microtaskDepth = 0

const maxMicrotaskDepth = 2048

/**
 * A scheduler manages the execution of Effect fibers by controlling when queued
 * tasks run.
 *
 * **When to use**
 *
 * Use to define or provide custom runtime scheduling behavior for Effect fibers.
 *
 * **Details**
 *
 * A scheduler determines the execution mode, schedules tasks with different
 * priorities, and decides when fibers should yield control after consuming
 * their operation budget.
 *
 * @category models
 * @since 2.0.0
 */
export interface Scheduler {
  readonly executionMode: "sync" | "async"
  shouldYield(fiber: Fiber.Fiber<unknown, unknown>): boolean
  makeDispatcher(fiber?: Fiber.Fiber<unknown, unknown>): SchedulerDispatcher
}

/**
 * A dispatcher created by a `Scheduler` for enqueuing tasks and forcing queued
 * tasks to run.
 *
 * **When to use**
 *
 * Use when implementing or testing scheduler-created dispatchers that enqueue
 * prioritized runtime tasks and flush queued work deterministically.
 *
 * **Details**
 *
 * `scheduleTask` queues a task with a priority. `flush` drains pending work
 * synchronously, which is useful when callers need deterministic completion of
 * already scheduled tasks. Lower priority numbers run first, and equal
 * priorities run in FIFO order.
 *
 * @category models
 * @since 4.0.0
 */
export interface SchedulerDispatcher {
  scheduleTask(task: () => void, priority: number): void
  flush(): void
}

/**
 * Context reference for the scheduler used by the Effect runtime.
 *
 * **When to use**
 *
 * Use when you need to replace scheduling behavior globally in tests or runtime
 * setup, such as forcing deterministic task dispatch.
 *
 * **Details**
 *
 * The default value creates a `MixedScheduler`. Provide this service to
 * customize execution mode, task dispatching, or yield behavior.
 *
 * @category references
 * @since 2.0.0
 */
export const Scheduler: Context.Reference<Scheduler> = Context.Reference<Scheduler>("effect/Scheduler", {
  defaultValue: () => new MixedScheduler()
})

class PriorityBuckets {
  buckets: Array<[priority: number, tasks: Array<() => void>]> = []

  scheduleTask(task: () => void, priority: number): void {
    const buckets = this.buckets
    const len = buckets.length
    let bucket: [number, Array<() => void>] | undefined
    let index = 0
    for (; index < len; index++) {
      if (buckets[index][0] > priority) break
      bucket = buckets[index]
    }
    if (bucket && bucket[0] === priority) {
      bucket[1].push(task)
    } else if (index === len) {
      buckets.push([priority, [task]])
    } else {
      buckets.splice(index, 0, [priority, [task]])
    }
  }

  drain() {
    const buckets = this.buckets
    this.buckets = []
    return buckets
  }
}

/**
 * Provides a scheduler implementation that batches queued tasks and dispatches them by
 * priority.
 *
 * **When to use**
 *
 * Use when you need the default runtime scheduler directly, including a
 * scheduler that batches queued work by priority and preserves FIFO order within
 * each priority.
 *
 * **Details**
 *
 * `MixedScheduler` supports synchronous and asynchronous execution modes, uses
 * operation counts to decide when fibers should yield, and is the default
 * scheduler implementation. Task flushes are chained on the microtask queue
 * for low latency, unless the dispatching fiber's context sets
 * {@link MacrotaskDispatch}, in which case every flush is scheduled with
 * `setImmediate` so the host event loop turns between flushes.
 *
 * @category schedulers
 * @since 2.0.0
 */
export class MixedScheduler implements Scheduler {
  readonly executionMode: "sync" | "async"
  readonly setImmediate: (f: () => void) => () => void

  constructor(
    executionMode: "sync" | "async" = "async",
    setImmediateFn: (f: () => void) => () => void = setImmediateUnsafe
  ) {
    this.executionMode = executionMode
    this.setImmediate = setImmediateFn
  }

  /**
   * Returns whether the fiber has reached its operation budget and should yield.
   *
   * **When to use**
   *
   * Use to decide whether a fiber should yield after consuming its current
   * operation budget.
   *
   * @since 2.0.0
   */
  shouldYield(fiber: Fiber.Fiber<unknown, unknown>) {
    return fiber.currentOpCount >= fiber.maxOpsBeforeYield
  }

  /**
   * Creates a dispatcher that schedules work through this scheduler.
   *
   * **When to use**
   *
   * Use when you need a standalone dispatcher from a scheduler instance, for
   * example in tests that enqueue tasks and then flush them deterministically.
   *
   * **Details**
   *
   * When a fiber is provided, the dispatcher reads the fiber's
   * {@link MacrotaskDispatch} state to decide the dispatch medium for each
   * flush.
   *
   * @since 4.0.0
   */
  makeDispatcher(fiber?: Fiber.Fiber<unknown, unknown>) {
    return new MixedSchedulerDispatcher(this.setImmediate, fiber)
  }
}

const microtask = (f: () => void): () => void => {
  let cancelled = false
  Promise.resolve().then(() => {
    if (!cancelled) f()
  })
  return (): void => {
    cancelled = true
  }
}

class MixedSchedulerDispatcher implements SchedulerDispatcher {
  private tasks = new PriorityBuckets()
  private running: (() => void) | undefined = undefined
  readonly setImmediate: (f: () => void) => () => void
  readonly fiber: Fiber.Fiber<unknown, unknown> | undefined

  constructor(
    setImmediateFn: (f: () => void) => () => void = setImmediateUnsafe,
    fiber?: Fiber.Fiber<unknown, unknown>
  ) {
    this.setImmediate = setImmediateFn
    this.fiber = fiber
  }

  /**
   * @since 2.0.0
   */
  scheduleTask(task: () => void, priority: number) {
    this.tasks.scheduleTask(task, priority)
    if (this.running === undefined) {
      // Flush on the microtask queue for low latency, but periodically fall
      // back to a macrotask so timers and I/O are not starved by
      // continuously yielding fibers. The depth counter is global so that
      // workloads spanning many dispatchers still rotate the event loop:
      // once the budget is exhausted, every dispatcher arms a macrotask
      // until one of them actually runs, which guarantees the microtask
      // queue drains and the event loop turns.
      //
      // Fibers whose `MacrotaskDispatch` state is active (e.g. while a
      // `TestClock` is flushing) flush via macrotask, so the host event loop
      // turns between their task flushes.
      if (this.fiber?.currentMacrotaskDispatch.current || microtaskDepth >= maxMicrotaskDepth) {
        this.running = this.setImmediate(this.afterScheduledMacro)
      } else {
        microtaskDepth++
        this.running = microtask(this.afterScheduled)
      }
    }
  }

  /**
   * @since 2.0.0
   */
  afterScheduled = () => {
    this.running = undefined
    this.runTasks()
  }

  private afterScheduledMacro = () => {
    microtaskDepth = 0
    this.running = undefined
    this.runTasks()
  }

  /**
   * @since 2.0.0
   */
  runTasks() {
    const buckets = this.tasks.drain()
    for (let i = 0; i < buckets.length; i++) {
      const toRun = buckets[i][1]
      for (let j = 0; j < toRun.length; j++) {
        toRun[j]()
      }
    }
  }

  /**
   * @since 2.0.0
   */
  flush() {
    while (this.tasks.buckets.length > 0) {
      if (this.running !== undefined) {
        this.running()
        this.running = undefined
      }
      this.runTasks()
    }
  }
}

/**
 * Context reference that controls the maximum number of operations a fiber
 * can perform before yielding control back to the scheduler.
 *
 * **When to use**
 *
 * Use to tune scheduler fairness for CPU-bound fibers by changing the scheduler
 * operation budget that triggers a yield.
 *
 * **Details**
 *
 * The default value is `2048` operations, which balances performance and
 * fairness by helping prevent long-running fibers from monopolizing the
 * execution thread.
 *
 * @see {@link PreventSchedulerYield} for bypassing scheduler yield checks entirely rather than tuning the operation budget
 *
 * @category references
 * @since 4.0.0
 */
export const MaxOpsBeforeYield = Context.Reference<number>("effect/Scheduler/MaxOpsBeforeYield", {
  defaultValue: () => 2048
})

/**
 * Context reference that controls whether the runtime should bypass scheduler
 * yield checks. When set to `true`, the fiber run loop won't call
 * `Scheduler.shouldYield`.
 *
 * **When to use**
 *
 * Use to bypass scheduler yield checks for controlled runtime workloads where
 * cooperative yielding should be disabled.
 *
 * **Gotchas**
 *
 * Setting this reference to `true` can let long-running fibers monopolize the
 * JavaScript thread.
 *
 * @see {@link MaxOpsBeforeYield} for tuning yield frequency without disabling yield checks
 * @see {@link Scheduler} for providing custom scheduler yield behavior
 *
 * @category references
 * @since 4.0.0
 */
export const PreventSchedulerYield = Context.Reference<boolean>("effect/Scheduler/PreventSchedulerYield", {
  defaultValue: () => false
})

/**
 * Mutable state controlling whether fibers dispatch their task flushes on the
 * macrotask queue.
 *
 * @category models
 * @since 4.0.0
 */
export interface MacrotaskDispatchState {
  current: boolean
}

/**
 * Context reference holding the {@link MacrotaskDispatchState} that
 * `MixedScheduler` consults, through the dispatching fiber's context, to
 * decide the dispatch medium for each task flush.
 *
 * **When to use**
 *
 * Use when fibers must temporarily observe the host event loop turning
 * between task flushes, so host async work (promises resolved by the event
 * loop) interleaves with fiber execution at task flush granularity.
 *
 * **Details**
 *
 * While `current` is `false` (the default), task flushes are chained on the
 * microtask queue for low latency, periodically falling back to a macrotask
 * so timers and I/O are not starved. While `current` is `true`, every task
 * flush is scheduled with `setImmediate`.
 *
 * The state is mutable so it can be toggled around a region of execution:
 * `TestClock` provides its own state and sets `current` while it is flushing
 * virtual time forward, since sleepers woken by the clock rely on host async
 * work interleaving with their execution.
 *
 * @see {@link MaxOpsBeforeYield} and {@link PreventSchedulerYield} for the other scheduler tuning references
 *
 * @category references
 * @since 4.0.0
 */
export const MacrotaskDispatch = Context.Reference<MacrotaskDispatchState>("effect/Scheduler/MacrotaskDispatch", {
  defaultValue: () => ({ current: false })
})

/**
 * Mutable state tracking the async activity of fibers.
 *
 * @category models
 * @since 4.0.0
 */
export interface AsyncActivityState {
  resumptions: number
}

/**
 * Context reference holding the {@link AsyncActivityState} that fibers update
 * when they resume from asynchronous work.
 *
 * **When to use**
 *
 * Use when an observer needs to know whether fibers are resuming from
 * asynchronous work, such as host promises or callbacks.
 *
 * **Details**
 *
 * Whenever a fiber suspended on the runtime's async primitive (the basis of
 * `Effect.callback`, `Effect.promise`, and every other asynchronous
 * operation) is resumed, it increments `resumptions` on the state in its
 * context.
 *
 * `TestClock` uses this while advancing virtual time: it keeps yielding to
 * the host event loop while yields produce async resumptions, so work that
 * is in flight on the host (e.g. a pending promise) completes before time
 * advances further.
 *
 * @see {@link MacrotaskDispatch} for controlling the dispatch medium of task flushes
 *
 * @category references
 * @since 4.0.0
 */
export const AsyncActivity = Context.Reference<AsyncActivityState>("effect/Scheduler/AsyncActivity", {
  defaultValue: () => ({ resumptions: 0 })
})
