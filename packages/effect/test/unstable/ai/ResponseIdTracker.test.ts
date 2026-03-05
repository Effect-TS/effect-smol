import { assert, describe, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import { Prompt, ResponseIdTracker } from "effect/unstable/ai"

const userMessage = (text: string) => Prompt.userMessage({ content: [Prompt.textPart({ text })] })

const assistantMessage = (text: string) => Prompt.assistantMessage({ content: [Prompt.textPart({ text })] })

describe("ResponseIdTracker", () => {
  it.effect("returns None for a fresh tracker", () =>
    Effect.gen(function*() {
      const tracker = yield* ResponseIdTracker.make
      const msg1 = userMessage("msg1")

      const prepared = yield* tracker.prepare(Prompt.fromMessages([msg1]))

      assert.isTrue(Option.isNone(prepared))
    }))

  it.effect("returns Some after marking parts", () =>
    Effect.gen(function*() {
      const tracker = yield* ResponseIdTracker.make
      const msg1 = userMessage("msg1")
      const asst = assistantMessage("done")
      const msg2 = userMessage("msg2")

      tracker.markParts([msg1], "resp_123")
      const prepared = yield* tracker.prepare(Prompt.fromMessages([msg1, asst, msg2]))

      assert.isTrue(Option.isSome(prepared))
      if (Option.isSome(prepared)) {
        assert.strictEqual(prepared.value.previousResponseId, "resp_123")
        assert.deepStrictEqual(prepared.value.prompt, Prompt.fromMessages([msg2]))
      }
    }))

  it.effect("supports clear followed by new marks", () =>
    Effect.gen(function*() {
      const tracker = yield* ResponseIdTracker.make
      const msg1 = userMessage("msg1")
      const msg1New = userMessage("msg1-new")
      const asst = assistantMessage("done")
      const msg2 = userMessage("msg2")

      tracker.markParts([msg1], "resp_123")
      yield* tracker.clear
      tracker.markParts([msg1New], "resp_456")
      const prepared = yield* tracker.prepare(Prompt.fromMessages([msg1New, asst, msg2]))

      assert.isTrue(Option.isSome(prepared))
      if (Option.isSome(prepared)) {
        assert.strictEqual(prepared.value.previousResponseId, "resp_456")
        assert.deepStrictEqual(prepared.value.prompt, Prompt.fromMessages([msg2]))
      }
    }))

  it.effect("keeps latest response id when markParts is called twice", () =>
    Effect.gen(function*() {
      const tracker = yield* ResponseIdTracker.make
      const msg1 = userMessage("msg1")
      const asst = assistantMessage("done")
      const msg2 = userMessage("msg2")

      tracker.markParts([msg1], "resp_1")
      tracker.markParts([msg1], "resp_2")
      const prepared = yield* tracker.prepare(Prompt.fromMessages([msg1, asst, msg2]))

      assert.isTrue(Option.isSome(prepared))
      if (Option.isSome(prepared)) {
        assert.strictEqual(prepared.value.previousResponseId, "resp_2")
        assert.deepStrictEqual(prepared.value.prompt, Prompt.fromMessages([msg2]))
      }
    }))

  it.effect("returns None after onSessionDrop", () =>
    Effect.gen(function*() {
      const tracker = yield* ResponseIdTracker.make
      const msg1 = userMessage("msg1")
      const asst = assistantMessage("done")
      const msg2 = userMessage("msg2")

      tracker.markParts([msg1], "resp_123")
      yield* tracker.onSessionDrop
      const prepared = yield* tracker.prepare(Prompt.fromMessages([msg1, asst, msg2]))

      assert.isTrue(Option.isNone(prepared))
    }))

  it.effect("recovers after onSessionDrop with new marks", () =>
    Effect.gen(function*() {
      const tracker = yield* ResponseIdTracker.make
      const msg1 = userMessage("msg1")
      const msg1New = userMessage("msg1-new")
      const asst = assistantMessage("done")
      const msg2 = userMessage("msg2")

      tracker.markParts([msg1], "resp_123")
      yield* tracker.onSessionDrop
      tracker.markParts([msg1New], "resp_456")
      const prepared = yield* tracker.prepare(Prompt.fromMessages([msg1New, asst, msg2]))

      assert.isTrue(Option.isSome(prepared))
      if (Option.isSome(prepared)) {
        assert.strictEqual(prepared.value.previousResponseId, "resp_456")
        assert.deepStrictEqual(prepared.value.prompt, Prompt.fromMessages([msg2]))
      }
    }))

  it.effect("remains usable after concurrent markParts and clear", () =>
    Effect.gen(function*() {
      const tracker = yield* ResponseIdTracker.make
      const raceMessage = userMessage("race")

      const markPartsRace = Effect.gen(function*() {
        for (let i = 0; i < 200; i++) {
          tracker.markParts([raceMessage], "resp_race")
          yield* Effect.yieldNow
        }
      })

      const clearRace = Effect.gen(function*() {
        for (let i = 0; i < 200; i++) {
          yield* tracker.clear
          yield* Effect.yieldNow
        }
      })

      yield* Effect.all([
        markPartsRace,
        clearRace
      ], {
        concurrency: "unbounded",
        discard: true
      })

      const msg1 = userMessage("msg1")
      const asst = assistantMessage("done")
      const msg2 = userMessage("msg2")
      tracker.markParts([msg1], "resp_final")
      const prepared = yield* tracker.prepare(Prompt.fromMessages([msg1, asst, msg2]))

      assert.isTrue(Option.isSome(prepared))
      if (Option.isSome(prepared)) {
        assert.strictEqual(prepared.value.previousResponseId, "resp_final")
        assert.deepStrictEqual(prepared.value.prompt, Prompt.fromMessages([msg2]))
      }
    }))
})
