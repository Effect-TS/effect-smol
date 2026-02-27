import { assert, describe, it } from "@effect/vitest"
import { Effect, Exit, Schema } from "effect"
import { Workflow, WorkflowEngine } from "effect/unstable/workflow"

describe("WorkflowEngine", () => {
  const IncrementWorkflow = Workflow.make({
    name: "WorkflowEngine/IncrementWorkflow",
    payload: { value: Schema.Number },
    success: Schema.Number,
    idempotencyKey: ({ value }) => String(value)
  })

  const IncrementWorkflowLayer = IncrementWorkflow.toLayer(({ value }) => Effect.succeed(value + 1))

  it.effect("layer executes and polls workflows", () =>
    Effect.gen(function*() {
      const executionId = yield* IncrementWorkflow.execute({ value: 1 }, { discard: true })
      const result = yield* IncrementWorkflow.execute({ value: 1 })
      const polled = yield* IncrementWorkflow.poll(executionId)

      assert.strictEqual(result, 2)
      assert(polled !== undefined && polled._tag === "Complete" && Exit.isSuccess(polled.exit))
      assert.strictEqual(polled.exit.value, 2)
    }).pipe(
      Effect.provide(IncrementWorkflowLayer),
      Effect.provide(WorkflowEngine.layer)
    ))

  it.effect("layer returns cached result for completed execution", () => {
    let runs = 0
    const workflow = Workflow.make({
      name: "WorkflowEngine/CachedResultWorkflow",
      payload: { value: Schema.Number },
      success: Schema.Number,
      idempotencyKey: ({ value }) => String(value)
    })
    const workflowLayer = workflow.toLayer(({ value }) => {
      runs += 1
      return Effect.succeed(value + 1)
    })

    return Effect.gen(function*() {
      yield* workflow.execute({ value: 1 }, { discard: true })
      const result = yield* workflow.execute({ value: 1 })

      assert.strictEqual(result, 2)
      assert.strictEqual(runs, 1)
    }).pipe(
      Effect.provide(workflowLayer),
      Effect.provide(WorkflowEngine.layer)
    )
  })
})
