#!/usr/bin/env tsx

import { exec } from "child_process"
import { mkdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { promisify } from "util"

// Convert to ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")
const packageJsonPath = join(projectRoot, "package.json")
const DEFAULT_CLI_COMMAND = "myapp"
const CLI_ENTRY = join("src", "cli.ts")

const execAsync = promisify(exec)

// Import ansi-to-svg
const ansiToSvg = await import("ansi-to-svg").then((m) => m.default)

interface Scenario {
  name: string
  cmd: string
  category: "help" | "error"
  description: string
}

const scenarios: Array<Scenario> = [
  // Help screens
  { name: "root-help", cmd: "--help", category: "help", description: "Main application help" },
  { name: "copy-help", cmd: "copy --help", category: "help", description: "Copy command help" },
  { name: "build-help", cmd: "build --help", category: "help", description: "Build command help" },
  {
    name: "deploy-help",
    cmd: "deploy --help",
    category: "help",
    description: "Deploy command help (with subcommands)"
  },
  { name: "deploy-staging-help", cmd: "deploy staging --help", category: "help", description: "Deploy staging help" },
  {
    name: "deploy-production-help",
    cmd: "deploy production --help",
    category: "help",
    description: "Deploy production help"
  },
  { name: "db-help", cmd: "db --help", category: "help", description: "Database operations help" },
  { name: "db-migrate-help", cmd: "db migrate --help", category: "help", description: "Database migration help" },
  { name: "db-seed-help", cmd: "db seed --help", category: "help", description: "Database seed help" },

  // Error scenarios
  {
    name: "unknown-flag",
    cmd: "--unknown-flag",
    category: "error",
    description: "Unknown flag error with suggestions"
  },
  { name: "unknown-command", cmd: "unknown-cmd", category: "error", description: "Unknown command error" },
  { name: "typo-copy", cmd: "cpy", category: "error", description: "Typo in command name (should suggest \"copy\")" },
  { name: "missing-args-copy", cmd: "copy", category: "error", description: "Missing required arguments for copy" },
  { name: "missing-destination", cmd: "copy src.txt", category: "error", description: "Missing destination argument" },
  {
    name: "typo-deploy",
    cmd: "deploy prod",
    category: "error",
    description: "Typo in deploy subcommand (should suggest \"production\")"
  }
]

const ansiColorPalette = {
  black: "#1d1f21",
  red: "#cc6566",
  green: "#b6bd68",
  yellow: "#f0c674",
  blue: "#82a2be",
  magenta: "#b294bb",
  cyan: "#8abeb7",
  white: "#c4c8c6",
  gray: "#666666",
  redBright: "#d54e53",
  greenBright: "#b9ca4b",
  yellowBright: "#e7c547",
  blueBright: "#7aa6da",
  magentaBright: "#c397d8",
  cyanBright: "#70c0b1",
  whiteBright: "#eaeaea",
  bgBlack: "#1d1f21",
  bgRed: "#cc6566",
  bgGreen: "#b6bd68",
  bgYellow: "#f0c674",
  bgBlue: "#82a2be",
  bgMagenta: "#b294bb",
  bgCyan: "#8abeb7",
  bgWhite: "#c4c8c6",
  bgGray: "#666666",
  bgRedBright: "#d54e53",
  bgGreenBright: "#b9ca4b",
  bgYellowBright: "#e7c547",
  bgBlueBright: "#7aa6da",
  bgMagentaBright: "#c397d8",
  bgCyanBright: "#70c0b1",
  bgWhiteBright: "#eaeaea",
  backgroundColor: "#282c34",
  foregroundColor: "#ffffff"
}

async function captureOutput(cmd: string): Promise<{ stdout: string; stderr: string; success: boolean }> {
  try {
    console.log(`Running: ${await resolveCliCommand()} ${cmd}`)

    const runner = `pnpm exec tsx ${JSON.stringify(CLI_ENTRY)} ${cmd}`.trim()
    const { stderr, stdout } = await execAsync(runner, {
      cwd: projectRoot,
      env: {
        ...process.env,
        FORCE_COLOR: "1", // Force ANSI colors
        NO_COLOR: undefined, // Remove any NO_COLOR env var
        TERM: "xterm-256color" // Set terminal type
      },
      encoding: "utf8"
    })
    return { stdout: stripRunnerNoise(stdout), stderr: stripRunnerNoise(stderr), success: true }
  } catch (error: any) {
    // CLI errors (like missing args) are expected for some scenarios
    console.log(`Command failed (expected for error scenarios): ${error.message}`)
    return {
      stdout: stripRunnerNoise(error.stdout || ""),
      stderr: stripRunnerNoise(error.stderr || ""),
      success: false
    }
  }
}

async function generateSvg(text: string, filename: string, category: string) {
  if (!text.trim()) {
    console.warn(`No output for ${filename}, skipping...`)
    return
  }

  // Pad text to ensure consistent SVG width
  const lines = text.split("\n")
  const maxLength = Math.max(...lines.map((line) => line.length))
  if (maxLength < 100 && lines.length > 0) {
    // Pad the last line to 100 characters for consistent width
    const lastIndex = lines.length - 1
    lines[lastIndex] = lines[lastIndex].padEnd(100, " ")
    text = lines.join("\n")
  }

  const outputDir = join(projectRoot, "visuals", category)
  await mkdir(outputDir, { recursive: true })

  const svg = ansiToSvg(text, {
    colors: ansiColorPalette,
    width: 120, // Terminal width in characters (wider for consistency)
    height: null, // Auto height based on content
    paddingTop: 20,
    paddingLeft: 20,
    paddingBottom: 20,
    paddingRight: 20,
    fontFamily: "Monaco, Menlo, Ubuntu Mono, monospace",
    fontSize: 14
  })

  const outputPath = join(outputDir, `${filename}.svg`)
  await writeFile(outputPath, svg)
  console.log(`Generated: ${outputPath}`)
}

async function main() {
  console.log("🎨 Generating visual documentation for simple-cli...")

  const results: Array<{ scenario: Scenario; output: string; isStderr: boolean }> = []

  for (const scenario of scenarios) {
    console.log(`\n📸 Capturing: ${scenario.description}`)

    const { stderr, stdout } = await captureOutput(scenario.cmd)

    // For error scenarios, combine stdout (help) and stderr (error message)
    // For help scenarios, just use stdout
    const output = scenario.category === "error"
      ? combineHelpAndError(stdout, stderr)
      : stdout
    const isStderr = false // Always treat as combined output

    if (output.trim()) {
      await generateSvg(output, scenario.name, scenario.category)
      results.push({ scenario, output, isStderr })
    } else {
      console.warn(`No output captured for ${scenario.name}`)
    }
  }

  console.log(`\n✅ Generated ${results.length} visual outputs`)
  console.log(`📁 Check the visuals/ directory for SVG files`)

  // Generate a simple index
  const indexContent = `# Generated Visual Documentation\n\n` +
    `Generated on: ${new Date().toISOString()}\n` +
    `Total scenarios: ${results.length}\n\n` +
    results.map((r) => `- **${r.scenario.name}**: ${r.scenario.description}`).join("\n")

  await writeFile(join(projectRoot, "visuals", "index.md"), indexContent)
  console.log(`📋 Created index at visuals/index.md`)
}

function stripRunnerNoise(value: string): string {
  if (!value) {
    return value
  }

  const normalized = value.replace(/\r\n/g, "\n")
  const filtered = normalized
    .split("\n")
    .filter((line) => !line.startsWith("> "))

  return filtered.join("\n").trimEnd()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

let cachedCliCommand: string | null = null

async function resolveCliCommand(): Promise<string> {
  if (cachedCliCommand) {
    return cachedCliCommand
  }

  try {
    const raw = await readFile(packageJsonPath, "utf8")
    const parsed = JSON.parse(raw)

    if (isRecord(parsed)) {
      const binField = parsed["bin"]
      if (isRecord(binField)) {
        const binKeys = Object.keys(binField)
        if (binKeys.length > 0) {
          cachedCliCommand = binKeys[0]
          return cachedCliCommand
        }
      }

      const nameField = parsed["name"]
      if (typeof nameField === "string" && nameField.length > 0) {
        cachedCliCommand = nameField
        return cachedCliCommand
      }
    }
  } catch (error) {
    console.warn("Unable to determine CLI command from package.json, falling back to default", error)
  }

  cachedCliCommand = DEFAULT_CLI_COMMAND
  return cachedCliCommand
}

function combineHelpAndError(stdout: string, stderr: string): string {
  const helpSection = stdout.trimEnd()
  const errorSection = stderr.replace(/^\s+/, "").trimEnd()

  if (helpSection.length === 0) {
    return errorSection
  }

  if (errorSection.length === 0) {
    return helpSection
  }

  return `${helpSection}\n\n${errorSection}`
}

main().catch(console.error)
