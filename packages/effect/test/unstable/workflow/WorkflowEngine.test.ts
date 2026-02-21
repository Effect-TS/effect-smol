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
})
