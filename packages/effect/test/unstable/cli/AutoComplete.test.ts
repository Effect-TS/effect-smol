import { assert, describe, it } from "@effect/vitest"
import { Effect, FileSystem, Layer, Path } from "effect"
import { TestConsole } from "effect/testing"
import { Prompt } from "effect/unstable/cli"
import * as MockTerminal from "./services/MockTerminal.ts"

const ConsoleLayer = TestConsole.layer
const FileSystemLayer = FileSystem.layerNoop({})
const PathLayer = Path.layer
const TerminalLayer = MockTerminal.layer

const TestLayer = Layer.mergeAll(
  ConsoleLayer,
  FileSystemLayer,
  PathLayer,
  TerminalLayer
)

const escape = String.fromCharCode(27)
const bell = String.fromCharCode(7)

const stripAnsi = (text: string) => {
  let result = ""
  let skipping = false
  for (let index = 0; index < text.length; index++) {
    const char = text[index]
    if (skipping) {
      if ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z")) {
        skipping = false
      }
      continue
    }
    if (char === escape) {
      skipping = true
      continue
    }
    result += char
  }
  return result
}

const toFrames = (lines: ReadonlyArray<unknown>) =>
  lines
    .map((line) => stripAnsi(String(line)))
    .filter((line) => line.split(bell).join("").trim().length > 0)

const findFrame = (frames: ReadonlyArray<string>, text: string) => frames.find((frame) => frame.includes(text))

describe("Prompt.autoComplete", () => {
  it.effect("filters choices as you type", () =>
    Effect.gen(function*() {
      const prompt = Prompt.autoComplete({
        message: "Pick fruit",
        choices: [
          { title: "Apple", value: "apple" },
          { title: "Banana", value: "banana" },
          { title: "Cherry", value: "cherry" }
        ]
      })

      yield* MockTerminal.inputText("ban")
      yield* MockTerminal.inputKey("enter")

      const result = yield* Prompt.run(prompt)
      assert.strictEqual(result, "banana")

      const output = yield* TestConsole.logLines
      const frames = toFrames(output)
      const filteredFrame = findFrame(frames, "[filter: ban]")

      assert.isTrue(filteredFrame !== undefined)
      assert.isTrue(filteredFrame?.includes("Banana"))
      assert.isFalse(filteredFrame?.includes("Apple"))
    }).pipe(Effect.provide(TestLayer)))

  it.effect("removes the last character on backspace", () =>
    Effect.gen(function*() {
      const prompt = Prompt.autoComplete({
        message: "Pick item",
        choices: [
          { title: "Alpha", value: "alpha" },
          { title: "Beta", value: "beta" },
          { title: "Delta", value: "delta" }
        ]
      })

      yield* MockTerminal.inputText("al")
      yield* MockTerminal.inputKey("backspace")
      yield* MockTerminal.inputKey("enter")

      const result = yield* Prompt.run(prompt)
      assert.strictEqual(result, "alpha")

      const output = yield* TestConsole.logLines
      const frames = toFrames(output)
      const narrowedFrame = findFrame(frames, "[filter: al]")
      const expandedFrame = findFrame(frames, "[filter: a]")

      assert.isTrue(narrowedFrame !== undefined)
      assert.isTrue(expandedFrame !== undefined)
      assert.isFalse(narrowedFrame?.includes("Beta"))
      assert.isTrue(expandedFrame?.includes("Beta"))
    }).pipe(Effect.provide(TestLayer)))

  it.effect("renders empty message and beeps on submit with no matches", () =>
    Effect.gen(function*() {
      const prompt = Prompt.autoComplete({
        message: "Pick pet",
        choices: [
          { title: "Cat", value: "cat" },
          { title: "Dog", value: "dog" }
        ]
      })

      yield* MockTerminal.inputText("zzz")
      yield* MockTerminal.inputKey("enter")
      for (let i = 0; i < 3; i++) {
        yield* MockTerminal.inputKey("backspace")
      }
      yield* MockTerminal.inputKey("enter")

      const result = yield* Prompt.run(prompt)
      assert.strictEqual(result, "cat")

      const output = yield* TestConsole.logLines
      const frames = toFrames(output)

      assert.isTrue(output.some((line) => String(line).includes("\x07")))
      assert.isTrue(findFrame(frames, "No matches") !== undefined)
    }).pipe(Effect.provide(TestLayer)))

  it.effect("beeps when submitting a disabled choice", () =>
    Effect.gen(function*() {
      const prompt = Prompt.autoComplete({
        message: "Pick mode",
        choices: [
          { title: "Slow", value: "slow", disabled: true },
          { title: "Fast", value: "fast" }
        ]
      })

      yield* MockTerminal.inputKey("enter")
      yield* MockTerminal.inputKey("down")
      yield* MockTerminal.inputKey("enter")

      const result = yield* Prompt.run(prompt)
      assert.strictEqual(result, "fast")

      const output = yield* TestConsole.logLines
      assert.isTrue(output.some((line) => String(line).includes("\x07")))
    }).pipe(Effect.provide(TestLayer)))

  it.effect("renders empty message with no choices", () =>
    Effect.gen(function*() {
      const prompt = Prompt.autoComplete({
        message: "Pick option",
        choices: []
      })

      yield* MockTerminal.inputKey("c", { ctrl: true })
      const exit = yield* Prompt.run(prompt).pipe(Effect.exit)
      assert.isTrue(exit._tag === "Failure")

      const output = yield* TestConsole.logLines
      const frames = toFrames(output)

      assert.isTrue(findFrame(frames, "No matches") !== undefined)
    }).pipe(Effect.provide(TestLayer)))
})
