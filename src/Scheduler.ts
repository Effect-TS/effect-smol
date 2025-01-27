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
  readonly scheduleTask: (task: () => void, priority: number) => void
  readonly shouldYield: (fiber: Fiber.Fiber<unknown, unknown>) => boolean
}

const setImmediate = "setImmediate" in globalThis
  ? globalThis.setImmediate
  : (f: () => void) => setTimeout(f, 0)

/**
 * @since 2.0.0
 * @category schedulers
 */
export class MixedScheduler implements Scheduler {
  private tasks: Array<() => void> = []
  private running = false

  /**
   * @since 2.0.0
   */
  scheduleTask(task: () => void, _priority: number) {
    this.tasks.push(task)
    if (!this.running) {
      this.running = true
      setImmediate(this.afterScheduled)
    }
  }

  /**
   * @since 2.0.0
   */
  afterScheduled = () => {
    this.running = false
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
