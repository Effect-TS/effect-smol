/**
 * @since 2.0.0
 */
import type * as Fiber from "./Fiber.ts"
import * as ServiceMap from "./ServiceMap.ts"

/**
 * A scheduler manages the execution of Effects by controlling when and how tasks
 * are scheduled and executed. It determines the execution mode (synchronous or
 * asynchronous) and handles task prioritization and yielding behavior.
 *
 * The scheduler is responsible for:
 * - Scheduling tasks with different priorities
 * - Determining when fibers should yield control
 * - Managing the execution flow of Effects
 *
 * @example
 * ```ts
 * import type { Fiber } from "effect"
 * import type { Scheduler } from "effect/Scheduler"
 *
 * // Create a custom scheduler implementation
 * class CustomScheduler implements Scheduler {
 *   readonly executionMode = "async" as const
 *   private taskQueue: Array<() => void> = []
 *
 *   scheduleTask(task: () => void, priority: number): void {
 *     // Higher priority tasks are added to the front
 *     if (priority > 0) {
 *       this.taskQueue.unshift(task)
 *     } else {
 *       this.taskQueue.push(task)
 *     }
 *     // Schedule execution
 *     setTimeout(() => this.flush(), 0)
 *   }
 *
 *   shouldYield(fiber: Fiber.Fiber<unknown, unknown>): boolean {
 *     // Yield after every 1000 operations
 *     return fiber.currentOpCount >= 1000
 *   }
 *
 *   private flush(): void {
 *     const task = this.taskQueue.shift()
 *     if (task) {
 *       task()
 *     }
 *   }
 * }
 *
 * // Example implementation demonstrating the interface
 * const scheduler = new CustomScheduler()
 *
 * // Check execution mode
 * console.log(scheduler.executionMode) // "async"
 *
 * // Schedule a task
 * scheduler.scheduleTask(() => console.log("Task executed"), 1)
 * ```
 *
 * @since 2.0.0
 * @category models
 */
export interface Scheduler {
  readonly executionMode: "sync" | "async"
  readonly scheduleTask: (task: () => void, priority: number) => void
  readonly shouldYield: (fiber: Fiber.Fiber<unknown, unknown>) => boolean
}

/**
 * @since 4.0.0
 * @category references
 */
export const Scheduler: ServiceMap.Reference<Scheduler> = ServiceMap.Reference<Scheduler>("effect/Scheduler", {
  defaultValue: () => new MixedScheduler()
})

const setImmediate = "setImmediate" in globalThis
  ? (f: () => void) => {
    // @ts-ignore
    const timer = globalThis.setImmediate(f)
    // @ts-ignore
    return (): void => globalThis.clearImmediate(timer)
  }
  : (f: () => void) => {
    const timer = setTimeout(f, 0)
    return (): void => clearTimeout(timer)
  }

/**
 * The default scheduler implementation that provides efficient task scheduling
 * with support for both synchronous and asynchronous execution modes.
 *
 * Features:
 * - Batches tasks for efficient execution
 * - Supports priority-based task scheduling
 * - Configurable execution mode (sync/async)
 * - Automatic yielding based on operation count
 * - Optimized for high-throughput scenarios
 *
 * @example
 * ```ts
 * import { MixedScheduler } from "effect/Scheduler"
 *
 * // Create a mixed scheduler with async execution (default)
 * const asyncScheduler = new MixedScheduler("async")
 *
 * // Create a mixed scheduler with sync execution
 * const syncScheduler = new MixedScheduler("sync")
 *
 * // Schedule tasks with different priorities
 * asyncScheduler.scheduleTask(() => console.log("High priority task"), 10)
 * asyncScheduler.scheduleTask(() => console.log("Normal priority task"), 0)
 * asyncScheduler.scheduleTask(() => console.log("Low priority task"), -1)
 *
 * // For sync scheduler, you can flush tasks immediately
 * syncScheduler.scheduleTask(() => console.log("Task 1"), 0)
 * syncScheduler.scheduleTask(() => console.log("Task 2"), 0)
 *
 * // Force flush all pending tasks in sync mode
 * syncScheduler.flush()
 * // Output: "Task 1", "Task 2"
 *
 * // Check execution mode
 * console.log(asyncScheduler.executionMode) // "async"
 * console.log(syncScheduler.executionMode) // "sync"
 * ```
 *
 * @since 2.0.0
 * @category schedulers
 */
export class MixedScheduler implements Scheduler {
  private tasks: Array<() => void> = []
  private running: ReturnType<typeof setImmediate> | undefined = undefined
  readonly executionMode: "sync" | "async"
  readonly setImmediate: (f: () => void) => () => void

  constructor(
    executionMode: "sync" | "async" = "async",
    setImmediateFn: (f: () => void) => () => void = setImmediate
  ) {
    this.executionMode = executionMode
    this.setImmediate = setImmediateFn
  }

  /**
   * @since 2.0.0
   */
  scheduleTask(task: () => void, _priority: number) {
    this.tasks.push(task)
    if (this.running === undefined) {
      this.running = this.setImmediate(this.afterScheduled)
    }
  }

  /**
   * @since 2.0.0
   */
  afterScheduled = () => {
    this.running = undefined
    this.runTasks()
  }

  /**
   * @since 2.0.0
   */
  runTasks() {
    const tasks = this.tasks
    this.tasks = []
    for (let i = 0, len = tasks.length; i < len; i++) {
      tasks[i]()
    }
  }

  /**
   * @since 2.0.0
   */
  shouldYield(fiber: Fiber.Fiber<unknown, unknown>) {
    return fiber.currentOpCount >= fiber.maxOpsBeforeYield
  }

  /**
   * @since 2.0.0
   */
  flush() {
    while (this.tasks.length > 0) {
      if (this.running !== undefined) {
        this.running()
        this.running = undefined
      }
      this.runTasks()
    }
  }
}

/**
 * A priority bucket queue that maintains tasks sorted by priority.
 * Lower numbers mean higher priority.
 *
 * @since 2.0.0
 * @category utils
 */
export class PriorityBuckets<in out T = () => void> {
  /**
   * The buckets array containing [priority, tasks] tuples, sorted by priority in ascending order.
   * Lower priority numbers are executed first.
   * @since 2.0.0
   */
  public buckets: Array<[number, Array<T>]> = []

  /**
   * Schedule a task with a given priority. Tasks with the same priority are grouped
   * together and executed in FIFO order within their priority group.
   *
   * @since 2.0.0
   */
  scheduleTask(task: T, priority: number): void {
    const length = this.buckets.length
    let bucket: [number, Array<T>] | undefined = undefined
    let index = 0
    for (; index < length; index++) {
      if (this.buckets[index][0] <= priority) {
        bucket = this.buckets[index]
      } else {
        break
      }
    }
    if (bucket && bucket[0] === priority) {
      bucket[1].push(task)
    } else if (index === length) {
      this.buckets.push([priority, [task]])
    } else {
      this.buckets.splice(index, 0, [priority, [task]])
    }
  }
}

/**
 * A priority-based scheduler implementation that provides efficient task scheduling
 * with support for priority-based execution. Lower numbers mean higher priority.
 *
 * This scheduler uses a microtask-based approach with a setTimeout fallback to prevent
 * starvation. After a configurable number of microtask iterations, it falls back to
 * setTimeout to allow the browser/event loop to process other events.
 *
 * Features:
 * - Priority-based task scheduling (lower numbers = higher priority)
 * - Microtask-based execution for low latency
 * - Automatic fallback to setTimeout to prevent event loop starvation
 * - Configurable max microtask iterations before fallback
 *
 * @example
 * ```ts
 * import { PriorityScheduler } from "effect/Scheduler"
 *
 * // Create a priority scheduler (default: 2048 max microtasks before setTimeout)
 * const scheduler = new PriorityScheduler()
 *
 * // Schedule tasks with different priorities
 * scheduler.scheduleTask(() => console.log("Low priority"), 10)
 * scheduler.scheduleTask(() => console.log("Normal priority"), 0)
 * scheduler.scheduleTask(() => console.log("High priority"), -1)
 *
 * // Output order: "High priority", "Normal priority", "Low priority"
 *
 * // Create with custom max microtask count
 * const customScheduler = new PriorityScheduler(100)
 * ```
 *
 * @since 2.0.0
 * @category schedulers
 */
export class PriorityScheduler implements Scheduler {
  /**
   * Flag indicating whether the scheduler is currently running tasks.
   * @since 2.0.0
   */
  running = false

  /**
   * The priority bucket queue storing tasks by priority.
   * @since 2.0.0
   */
  tasks = new PriorityBuckets()

  /**
   * The maximum number of microtask iterations before falling back to setTimeout.
   * This prevents the scheduler from monopolizing the event loop.
   *
   * @since 2.0.0
   */
  readonly maxNextTickBeforeTimer: number

  readonly executionMode: "sync" | "async" = "async"

  /**
   * Creates a new PriorityScheduler.
   *
   * @param maxNextTickBeforeTimer - The maximum number of microtask iterations
   *   before falling back to setTimeout (default: 2048)
   *
   * @since 2.0.0
   */
  constructor(maxNextTickBeforeTimer: number = 2048) {
    this.maxNextTickBeforeTimer = maxNextTickBeforeTimer
  }

  /**
   * Internal method to process all pending tasks in the queue.
   * This runs all tasks from the current buckets and either stops
   * or continues scheduling based on whether new tasks were added.
   *
   * @since 2.0.0
   */
  private starveInternal(depth: number): void {
    const tasks = this.tasks.buckets
    this.tasks.buckets = []
    for (const [_, toRun] of tasks) {
      for (let i = 0; i < toRun.length; i++) {
        toRun[i]()
      }
    }
    if (this.tasks.buckets.length === 0) {
      this.running = false
    } else {
      this.starve(depth)
    }
  }

  /**
   * Schedule the internal task processing using either microtasks or setTimeout.
   * Uses microtasks (Promise.resolve) up to maxNextTickBeforeTimer iterations,
   * then falls back to setTimeout to prevent event loop starvation.
   *
   * @since 2.0.0
   */
  private starve(depth = 0): void {
    if (depth >= this.maxNextTickBeforeTimer) {
      setTimeout(() => this.starveInternal(0), 0)
    } else {
      Promise.resolve(void 0).then(() => this.starveInternal(depth + 1))
    }
  }

  /**
   * Determine if a fiber should yield control based on its operation count.
   *
   * @param fiber - The fiber to check
   * @returns `true` if the fiber should yield, `false` otherwise
   *
   * @since 2.0.0
   */
  shouldYield(fiber: Fiber.Fiber<unknown, unknown>): boolean {
    return fiber.currentOpCount >= fiber.maxOpsBeforeYield
  }

  /**
   * Schedule a task with a given priority. Lower numbers mean higher priority.
   *
   * @param task - The task function to execute
   * @param priority - The priority of the task (lower numbers = higher priority)
   *
   * @since 2.0.0
   */
  scheduleTask(task: () => void, priority: number): void {
    this.tasks.scheduleTask(task, priority)
    if (!this.running) {
      this.running = true
      this.starve()
    }
  }
}

/**
 * A service reference that controls the maximum number of operations a fiber
 * can perform before yielding control back to the scheduler. This helps
 * prevent long-running fibers from monopolizing the execution thread.
 *
 * The default value is 2048 operations, which provides a good balance between
 * performance and fairness in concurrent execution.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { MaxOpsBeforeYield } from "effect/Scheduler"
 *
 * // Configure a fiber to yield more frequently
 * const program = Effect.gen(function*() {
 *   // Get current max ops setting (default is 2048)
 *   const currentMax = yield* MaxOpsBeforeYield
 *   yield* Effect.log(`Default max ops before yield: ${currentMax}`)
 *
 *   // Run with reduced max ops for more frequent yielding
 *   return yield* Effect.provideService(
 *     Effect.gen(function*() {
 *       const maxOps = yield* MaxOpsBeforeYield
 *       yield* Effect.log(`Max ops before yield: ${maxOps}`)
 *
 *       // Run a compute-intensive task that will yield frequently
 *       let result = 0
 *       for (let i = 0; i < 10000; i++) {
 *         result += i
 *         // This will cause yielding every 100 operations
 *         yield* Effect.sync(() => result)
 *       }
 *       return result
 *     }),
 *     MaxOpsBeforeYield,
 *     100
 *   )
 * })
 *
 * // Configure for high-performance scenarios
 * const highPerformanceProgram = Effect.gen(function*() {
 *   // Run with increased max ops for better performance (less yielding)
 *   return yield* Effect.provideService(
 *     Effect.gen(function*() {
 *       const maxOps = yield* MaxOpsBeforeYield
 *       yield* Effect.log(`High-performance max ops: ${maxOps}`)
 *
 *       // Run multiple concurrent tasks
 *       const tasks = Array.from(
 *         { length: 100 },
 *         (_, i) =>
 *           Effect.gen(function*() {
 *             yield* Effect.sleep(`${i * 10} millis`)
 *             return `Task ${i} completed`
 *           })
 *       )
 *
 *       return yield* Effect.all(tasks, { concurrency: "unbounded" })
 *     }),
 *     MaxOpsBeforeYield,
 *     10000
 *   )
 * })
 *
 * // Configure for fair scheduling
 * const fairSchedulingProgram = Effect.gen(function*() {
 *   // Run with lower max ops for more frequent yielding
 *   return yield* Effect.provideService(
 *     Effect.gen(function*() {
 *       const maxOps = yield* MaxOpsBeforeYield
 *       yield* Effect.log(`Fair scheduling max ops: ${maxOps}`)
 *
 *       const longRunningTask = Effect.gen(function*() {
 *         for (let i = 0; i < 1000; i++) {
 *           yield* Effect.sync(() => Math.random())
 *         }
 *         return "Long task completed"
 *       })
 *
 *       const quickTask = Effect.gen(function*() {
 *         yield* Effect.sleep("10 millis")
 *         return "Quick task completed"
 *       })
 *
 *       // Both tasks will execute fairly due to frequent yielding
 *       return yield* Effect.all([longRunningTask, quickTask], {
 *         concurrency: "unbounded"
 *       })
 *     }),
 *     MaxOpsBeforeYield,
 *     50
 *   )
 * })
 * ```
 *
 * @since 4.0.0
 * @category references
 */
export const MaxOpsBeforeYield = ServiceMap.Reference<number>("effect/Scheduler/MaxOpsBeforeYield", {
  defaultValue: () => 2048
})
