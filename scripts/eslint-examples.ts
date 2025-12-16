import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Array, Cause, Effect, Filter, Stream } from "effect"
import { FileSystem, Path } from "effect"
import * as ChildProcess from "node:child_process"

const exec = (command: string, options?: ChildProcess.ExecOptions) =>
  Effect.callback<string, Cause.UnknownError>((resume) => {
    ChildProcess.exec(command, options, (error, stdout) => {
      if (error) {
        resume(Effect.fail(new Cause.UnknownError(error)))
      } else {
        resume(Effect.succeed(stdout.toString()))
      }
    })
  })

const run = Effect.fnUntraced(function*(files: Array<string>) {
  const fs = yield* FileSystem.FileSystem
  const pathService = yield* Path.Path

  const outDir = pathService.join("scratchpad", "eslint")
  yield* fs.remove(outDir, { recursive: true, force: true })
  yield* fs.makeDirectory(outDir, { recursive: true })

  let exampleId = 0

  const results = yield* Stream.fromArray(files).pipe(
    Stream.filter((file) => file.endsWith(".ts") ? file : Filter.failVoid),
    Stream.bindTo("file"),
    Stream.bindEffect("contents", ({ file }) => fs.readFileString(file), { concurrency: 10 }),
    Stream.let("examples", ({ contents }) =>
      Array.reverse(findExamples(contents)).map((o) => ({
        ...o,
        outFile: pathService.join(outDir, `${exampleId++}.ts`)
      } as const))),
    Stream.tap(({ examples, file }) => Effect.log(`Processing ${file} (${examples.length})`)),
    Stream.tap(
      ({ examples }) =>
        Effect.forEach(examples, ({ code, outFile }) => fs.writeFileString(outFile, code), { concurrency: 10 }),
      { concurrency: 3 }
    ),
    Stream.runCollect
  )

  yield* Effect.log("Formatting examples...")
  yield* exec("pnpm eslint --fix scratchpad/eslint/*.ts").pipe(
    Effect.ignore
  )

  yield* Stream.fromArray(results).pipe(
    Stream.tap(({ examples, file }) => Effect.log(`Updating ${file} (${examples.length})`)),
    Stream.mapEffect(({ contents, examples, file }) =>
      Stream.fromArray(examples).pipe(
        Stream.bindEffect("newCode", ({ outFile }) => fs.readFileString(outFile), { concurrency: 10 }),
        Stream.runFold(
          () => ["", contents.length] as [string, number],
          (acc, { endPos, leading, newCode, startPos }) => {
            const after = contents.slice(endPos, acc[1])
            acc[0] = newCode
              .trim()
              .split("\n")
              .map((line) => (leading + "* " + line).trimEnd())
              .join("\n")
              + after
              + acc[0]
            acc[1] = startPos
            return acc
          }
        ),
        Effect.flatMap(([newContents, pos]) => fs.writeFileString(file, contents.slice(0, pos) + newContents))
      ), { concurrency: 3 }),
    Stream.runDrain
  )
})

const findExamples = (content: string) => {
  const start = /^( +)\* ```ts.*$/gm
  const end = /^ +\* ```/gm
  const examples: Array<{
    readonly code: string
    readonly leading: string
    readonly startPos: number
    readonly endPos: number
  }> = []
  while (true) {
    const match = start.exec(content)
    if (!match) break
    const startPos = match.index + match[0].length + 1
    end.lastIndex = startPos
    const endMatch = end.exec(content)
    if (!endMatch) break
    const leading = match[1]
    const endPos = endMatch.index - 1
    const code = content
      .slice(startPos, endPos)
      .split("\n")
      .map((line) => line.startsWith(`${leading}*`) ? line.slice(leading.length + 2) : line.trim())
      .join("\n")
    examples.push({
      leading,
      code,
      startPos,
      endPos
    })
    start.lastIndex = endMatch.index + endMatch[0].length + 1
  }
  return examples
}

run(process.argv.slice(2)).pipe(
  Effect.provide(NodeServices.layer),
  NodeRuntime.runMain
)
