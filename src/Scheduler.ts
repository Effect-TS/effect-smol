/**
 * @since 2.0.0
 */
import * as Context from "./Context.js"
import type * as Fiber from "./Fiber.js"

/**
 * @since 2.0.0
 * @category models
 */
export interface Scheduler {
  readonly executionMode: "sync" | "async"
  readonly scheduleTask: (task: () => void, priority: number) => void
  readonly shouldYield: (fiber: Fiber.Fiber<unknown, unknown>) => boolean
}

const setImmediate = "setImmediate" in globalThis
  ? (f: () => void) => {
    const timer = globalThis.setImmediate(f)
    return () => clearImmediate(timer)
  }
  : (f: () => void) => {
    const timer = setTimeout(f, 0)
    return () => clearTimeout(timer)
  }

/**
 * @since 2.0.0
 * @category schedulers
 */
export class MixedScheduler implements Scheduler {
  private tasks: Array<() => void> = []
  private running: ReturnType<typeof setImmediate> | undefined = undefined

  constructor(
    readonly executionMode: "sync" | "async" = "async"
  ) {}

  /**
   * @since 2.0.0
   */
  scheduleTask(task: () => void, _priority: number) {
    this.tasks.push(task)
    if (this.running === undefined) {
      this.running = setImmediate(this.afterScheduled)
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
 * @since 4.0.0
 * @category references
 */
export class MaxOpsBeforeYield extends Context.Reference<
  "effect/Scheduler/MaxOpsBeforeYield",
  number
>("effect/Scheduler/MaxOpsBeforeYield", { defaultValue: () => 2048 }) {}
