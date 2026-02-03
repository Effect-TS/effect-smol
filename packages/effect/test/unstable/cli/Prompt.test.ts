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

describe("Prompt.float", () => {
  it.effect("renders appended input without literal parsed", () =>
    Effect.gen(function*() {
      const prompt = Prompt.float({ message: "Rate" })

      yield* MockTerminal.inputText("12.5")
      yield* MockTerminal.inputKey("enter")

      const result = yield* Prompt.run(prompt)
      assert.strictEqual(result, 12.5)

      const output = yield* TestConsole.logLines
      const frames = toFrames(output)
      const rendered = frames.join("\n")

      assert.isTrue(rendered.includes("12.5"))
      assert.isFalse(rendered.includes("parsed"))
    }).pipe(Effect.provide(TestLayer)))
})
