import { assert, describe, it, vitest } from "@effect/vitest"

describe("Effect keepAlive", () => {
  it("runPromise when setInterval is blocked at module load", async () => {
    const originalSetInterval = globalThis.setInterval
    const originalClearInterval = globalThis.clearInterval
    let attempts = 0
    ;(globalThis as any).setInterval = () => {
      attempts++
      throw new Error("blocked")
    }
    ;(globalThis as any).clearInterval = () => {
      throw new Error("blocked")
    }

    try {
      vitest.resetModules()
      const { Effect } = await import("effect")
      const one = await Effect.runPromise(Effect.promise(() => Promise.resolve(1)))
      const two = await Effect.runPromise(Effect.promise(() => Promise.resolve(2)))
      assert.strictEqual(one, 1)
      assert.strictEqual(two, 2)
      assert.strictEqual(attempts, 1)
    } finally {
      ;(globalThis as any).setInterval = originalSetInterval
      ;(globalThis as any).clearInterval = originalClearInterval
      vitest.resetModules()
    }
  })
})
