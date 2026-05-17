import * as ChildProcess from "node:child_process"
import * as Fs from "node:fs"
import * as Path from "node:path"

const files = process.argv.slice(2)

if (files.length === 0) {
  console.error("Usage: node scripts/check-cookbook-schedule.mjs <markdown-file...>")
  process.exit(1)
}

const outputDirectory = Path.join("scratchpad", ".markdown-examples")

function parseFenceInfo(info) {
  const parts = info.trim().split(/\s+/).filter(Boolean)
  const language = parts[0] ?? ""
  const metadata = new Set(parts.slice(1))
  return {
    language,
    noCheck: metadata.has("no-check"),
    runnable: metadata.has("runnable"),
    deterministic: metadata.has("deterministic")
  }
}

function isTypeScript(language) {
  return language === "ts" || language === "typescript"
}

function hasNoCheckComment(lines, index) {
  return /^<!--\s*no-check:\s*.+-->$/.test(lines[index - 1] ?? "")
}

function extractExamples(file) {
  const lines = Fs.readFileSync(file, "utf8").split(/\r?\n/)
  const examples = []
  let open = undefined

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]

    if (!line.startsWith("```")) {
      if (open !== undefined) {
        open.lines.push(line)
      }
      continue
    }

    if (open === undefined) {
      const info = parseFenceInfo(line.slice(3))
      if (isTypeScript(info.language) && info.noCheck && !hasNoCheckComment(lines, index)) {
        throw new Error(`${file}:${index + 1} has a no-check TypeScript fence without an immediately preceding <!-- no-check: ... --> comment`)
      }
      open = {
        startLine: index + 1,
        info,
        lines: []
      }
      continue
    }

    if (isTypeScript(open.info.language)) {
      examples.push({
        file,
        startLine: open.startLine,
        code: open.lines.join("\n"),
        noCheck: open.info.noCheck,
        runnable: open.info.runnable,
        deterministic: open.info.deterministic
      })
    }
    open = undefined
  }

  if (open !== undefined) {
    throw new Error(`${file}:${open.startLine} has an unclosed code fence`)
  }

  return examples
}

function sanitizeFileName(file) {
  return file.replaceAll(Path.sep, "_").replaceAll(/[^a-zA-Z0-9_.-]/g, "_")
}

function run(command, args) {
  const result = ChildProcess.spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  })

  if (result.error !== undefined) {
    throw result.error
  }

  return result.status ?? 1
}

function stripAnsi(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, "")
}

function normalizeOutput(text) {
  return stripAnsi(text).trimEnd()
}

function expectedOutput(example) {
  const lines = example.code.split("\n")
  const outputLine = lines.findIndex((line) => line.trim() === "// Output:")

  if (outputLine === -1) {
    throw new Error(`${example.file}:${example.startLine} is deterministic but has no // Output: comment`)
  }

  const output = []
  for (const line of lines.slice(outputLine + 1)) {
    const match = /^\/\/ ?(.*)$/.exec(line)
    if (match === null) {
      if (line.trim() === "") {
        continue
      }
      break
    }
    output.push(match[1])
  }

  return output.join("\n")
}

function runExample(example) {
  const result = ChildProcess.spawnSync("node", [example.generatedFile], {
    encoding: "utf8",
    shell: process.platform === "win32"
  })

  if (result.error !== undefined) {
    throw result.error
  }

  if ((result.status ?? 1) !== 0) {
    console.error(`${example.file}:${example.startLine} failed while running`)
    if (result.stdout.length > 0) {
      console.error(result.stdout)
    }
    if (result.stderr.length > 0) {
      console.error(result.stderr)
    }
  }

  if (example.deterministic && normalizeOutput(result.stdout) !== normalizeOutput(expectedOutput(example))) {
    console.error(`${example.file}:${example.startLine} output did not match // Output:`)
    console.error("Expected:")
    console.error(expectedOutput(example))
    console.error("Actual:")
    console.error(normalizeOutput(result.stdout))
    return 1
  }

  return result.status ?? 1
}

Fs.rmSync(outputDirectory, { recursive: true, force: true })
Fs.mkdirSync(outputDirectory, { recursive: true })

try {
  const examples = files.flatMap(extractExamples)
  const checkedExamples = examples.filter((example) => !example.noCheck)

  const generatedFiles = checkedExamples.map((example, index) => {
    const generatedFile = Path.join(
      outputDirectory,
      `${String(index + 1).padStart(3, "0")}-${sanitizeFileName(example.file)}-L${example.startLine}.ts`
    )
    Fs.writeFileSync(
      generatedFile,
      `// Generated from ${example.file}:${example.startLine}\n${example.code}\n`
    )
    return { ...example, generatedFile }
  })

  if (generatedFiles.length > 0) {
    const status = run("pnpm", [
      "exec",
      "tsc",
      "--noEmit",
      "--skipLibCheck",
      "--moduleResolution",
      "bundler",
      "--module",
      "esnext",
      "--target",
      "es2022",
      "--lib",
      "esnext,dom",
      "--types",
      "node",
      "--strict",
      "--ignoreConfig",
      "--allowImportingTsExtensions",
      ...generatedFiles.map((example) => example.generatedFile)
    ])

    if (status !== 0) {
      process.exit(status)
    }
  }

  const runnableExamples = generatedFiles.filter((example) => example.runnable)
  const deterministicExamples = runnableExamples.filter((example) => example.deterministic)
  for (const example of runnableExamples) {
    const status = runExample(example)
    if (status !== 0) {
      process.exit(status)
    }
  }

  console.log(
    `Checked ${checkedExamples.length} TypeScript example(s) from ${files.length} Markdown file(s); ran ${runnableExamples.length}; compared ${deterministicExamples.length}`
  )
} finally {
  Fs.rmSync(outputDirectory, { recursive: true, force: true })
}
