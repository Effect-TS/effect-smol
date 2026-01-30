import { assert, describe, it } from "@effect/vitest"
import { Effect, Scheduler } from "effect"

describe("PriorityScheduler", () => {
  describe("PriorityBuckets", () => {
    it("should schedule tasks by priority in descending order", () => {
      const buckets = new Scheduler.PriorityBuckets<string>()

      buckets.scheduleTask("low", -1)
      buckets.scheduleTask("high", 10)
      buckets.scheduleTask("normal", 0)
      buckets.scheduleTask("medium", 5)

      // Check that buckets are ordered by priority (highest first)
      assert.deepStrictEqual(buckets.buckets.map(([priority]) => priority), [10, 5, 0, -1])

      // Check tasks are in correct buckets
      assert.deepStrictEqual(buckets.buckets[0][1], ["high"])
      assert.deepStrictEqual(buckets.buckets[1][1], ["medium"])
      assert.deepStrictEqual(buckets.buckets[2][1], ["normal"])
      assert.deepStrictEqual(buckets.buckets[3][1], ["low"])
    })

    it("should group tasks with same priority together", () => {
      const buckets = new Scheduler.PriorityBuckets<number>()

      buckets.scheduleTask(1, 0)
      buckets.scheduleTask(2, 0)
      buckets.scheduleTask(3, 0)

      assert.strictEqual(buckets.buckets.length, 1)
      assert.deepStrictEqual(buckets.buckets[0][1], [1, 2, 3])
    })

    it("should maintain FIFO order within same priority", () => {
      const buckets = new Scheduler.PriorityBuckets<string>()

      buckets.scheduleTask("first", 5)
      buckets.scheduleTask("second", 5)
      buckets.scheduleTask("third", 5)

      assert.deepStrictEqual(buckets.buckets[0][1], ["first", "second", "third"])
    })
  })

  describe("PriorityScheduler", () => {
    it.effect("should execute tasks in priority order", () =>
      Effect.gen(function*() {
        const scheduler = new Scheduler.PriorityScheduler()
        const executed: Array<string> = []

        // Schedule tasks with different priorities
        scheduler.scheduleTask(() => executed.push("low"), -1)
        scheduler.scheduleTask(() => executed.push("normal"), 0)
        scheduler.scheduleTask(() => executed.push("high"), 10)
        scheduler.scheduleTask(() => executed.push("medium"), 5)

        // Wait for microtasks to complete (need to yield control to let microtasks run)
        yield* Effect.promise(() => Promise.resolve())
        yield* Effect.sleep(0)

        // Verify execution order (high priority first)
        assert.deepStrictEqual(executed, ["high", "medium", "normal", "low"])
      }))

    it.effect("should handle same-priority tasks in FIFO order", () =>
      Effect.gen(function*() {
        const scheduler = new Scheduler.PriorityScheduler()
        const executed: Array<number> = []

        // Schedule multiple tasks with same priority
        for (let i = 0; i < 5; i++) {
          scheduler.scheduleTask(() => executed.push(i), 0)
        }

        // Wait for microtasks to complete
        yield* Effect.promise(() => Promise.resolve())
        yield* Effect.sleep(0)

        // Verify FIFO order
        assert.deepStrictEqual(executed, [0, 1, 2, 3, 4])
      }))

    it.effect("should correctly implement shouldYield", () =>
      Effect.gen(function*() {
        const scheduler = new Scheduler.PriorityScheduler()

        // Create a mock fiber
        const mockFiber = {
          currentOpCount: 100,
          maxOpsBeforeYield: 2048
        } as any

        // Should not yield when under max ops
        assert.strictEqual(scheduler.shouldYield(mockFiber), false)

        // Should yield when at max ops
        mockFiber.currentOpCount = 2048
        assert.strictEqual(scheduler.shouldYield(mockFiber), true)

        // Should yield when over max ops
        mockFiber.currentOpCount = 3000
        assert.strictEqual(scheduler.shouldYield(mockFiber), true)
      }))

    it.effect("should have async execution mode", () =>
      Effect.gen(function*() {
        const scheduler = new Scheduler.PriorityScheduler()
        assert.strictEqual(scheduler.executionMode, "async")
      }))

    it.effect("should use configurable maxNextTickBeforeTimer", () =>
      Effect.gen(function*() {
        const defaultScheduler = new Scheduler.PriorityScheduler()
        const customScheduler = new Scheduler.PriorityScheduler(100)

        assert.strictEqual(defaultScheduler.maxNextTickBeforeTimer, 2048)
        assert.strictEqual(customScheduler.maxNextTickBeforeTimer, 100)
      }))

    it.effect("should handle nested task scheduling", () =>
      Effect.gen(function*() {
        const scheduler = new Scheduler.PriorityScheduler()
        const executed: Array<string> = []

        scheduler.scheduleTask(() => {
          executed.push("outer")
          // Schedule another task from within a task
          scheduler.scheduleTask(() => executed.push("inner"), 10)
        }, 0)

        // Wait for microtasks to complete (need multiple yields for nested tasks)
        yield* Effect.promise(() => Promise.resolve())
        yield* Effect.promise(() => Promise.resolve())
        yield* Effect.sleep(0)

        // Both tasks should have executed
        assert.deepStrictEqual(executed, ["outer", "inner"])
      }))
  })
})
