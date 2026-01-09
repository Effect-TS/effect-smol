#!/usr/bin/env node

import { readdir, readFile, writeFile } from "fs/promises"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

// Convert to ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = join(__dirname, "..")
const packageJsonPath = join(projectRoot, "package.json")
const DEFAULT_CLI_COMMAND = "myapp"

interface VisualFile {
  name: string
  category: "help" | "error"
  path: string
  description: string
}

const categoryDescriptions = {
  help: "Help screens showing command documentation",
  error: "Error messages with contextual help and validation"
}

const categoryOrdering: Record<VisualFile["category"], Array<string>> = {
  help: [
    "root-help",
    "copy-help",
    "build-help",
    "deploy-help",
    "deploy-staging-help",
    "deploy-production-help",
    "db-help",
    "db-migrate-help",
    "db-seed-help"
  ],
  error: [
    "missing-args-copy",
    "missing-destination",
    "typo-copy",
    "unknown-command",
    "unknown-flag",
    "typo-deploy"
  ]
}

const getCategoryEmoji = (category: string) => {
  switch (category) {
    case "help":
      return "📚"
    case "error":
      return "❌"
    default:
      return "📄"
  }
}

async function generateGallery() {
  console.log("🎨 Generating visual documentation gallery...")

  const visualsDir = join(projectRoot, "visuals")
  const categories = ["help", "error"]

  const cliCommand = await resolveCliCommand()

  const allVisuals: Array<VisualFile> = []

  // Collect all SVG files
  for (const category of categories) {
    const categoryDir = join(visualsDir, category)
    try {
      const files = await readdir(categoryDir)
      const svgFiles = files.filter((f) => f.endsWith(".svg"))

      for (const file of svgFiles) {
        const name = file.replace(".svg", "")
        const description = getDescription(name, category as any)
        allVisuals.push({
          name,
          category: category as any,
          path: join(category, file),
          description
        })
      }
    } catch {
      console.warn(`Category ${category} not found, skipping...`)
    }
  }

  // Generate README content
  const readme = generateReadmeContent(sortVisuals(allVisuals), cliCommand)
  await writeFile(join(visualsDir, "README.md"), readme)

  // Generate index.html for better viewing
  const html = generateHtmlGallery(sortVisuals(allVisuals), cliCommand)
  await writeFile(join(visualsDir, "index.html"), html)

  console.log(`✅ Generated gallery with ${allVisuals.length} visuals`)
  console.log(`📖 README: ${join(visualsDir, "README.md")}`)
  console.log(`🌐 HTML: ${join(visualsDir, "index.html")}`)
}

function getDescription(name: string, category: "help" | "error"): string {
  // Map scenario names to descriptions
  const descriptions: Record<string, string> = {
    // Help
    "root-help": "Main application help",
    "copy-help": "Copy command help",
    "build-help": "Build command help",
    "deploy-help": "Deploy command help (with subcommands)",
    "deploy-staging-help": "Deploy staging help",
    "deploy-production-help": "Deploy production help",
    "db-help": "Database operations help",
    "db-migrate-help": "Database migration help",
    "db-seed-help": "Database seed help",

    // Errors
    "unknown-flag": "Unknown flag error with suggestions",
    "unknown-command": "Unknown command error",
    "typo-copy": "Typo in command name (suggests \"copy\")",
    "missing-args-copy": "Missing required arguments for copy",
    "missing-destination": "Missing destination argument",
    "typo-deploy": "Typo in deploy subcommand (suggests \"production\")"
  }

  return descriptions[name] || `${category} scenario: ${name}`
}

function generateReadmeContent(visuals: Array<VisualFile>, cliCommand: string): string {
  const groupedByCategory = visuals.reduce((acc, visual) => {
    if (!acc[visual.category]) {
      acc[visual.category] = []
    }
    acc[visual.category].push(visual)
    return acc
  }, {} as Record<string, Array<VisualFile>>)

  let content = `# Simple CLI Visual Documentation

Generated on: ${new Date().toISOString()}

This directory contains visual documentation for the Effect CLI example, showing various help screens, error messages, and successful command executions.

## Quick Links

`

  // Generate table of contents
  Object.keys(groupedByCategory).forEach((category) => {
    const emoji = getCategoryEmoji(category)
    content += `- [${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}](#${category})\n`
  })

  content += "\n---\n\n"

  // Generate sections for each category
  Object.entries(groupedByCategory).forEach(([category, items]) => {
    const emoji = getCategoryEmoji(category)
    const description = categoryDescriptions[category as keyof typeof categoryDescriptions]

    content += `## ${emoji} ${category.charAt(0).toUpperCase() + category.slice(1)}\n\n`
    content += `${description}\n\n`

    const orderedItems = sortVisuals(items, category as VisualFile["category"])

    orderedItems.forEach((visual) => {
      content += `### ${visual.description}\n\n`

      const commandHint = getCommandFromName(visual.name)
      if (commandHint) {
        content += "```bash\n"
        content += `${formatCommand(cliCommand, commandHint)}\n`
        content += "```\n\n"
      }

      content += `![${visual.description}](${visual.path})\n\n`
      content += "---\n\n"
    })
  })

  content += `## Usage

To regenerate these visuals:

\`\`\`bash
npm run generate-visuals
\`\`\`

To view the HTML gallery, open \`index.html\` in your browser.

## Implementation

The visuals are generated using:
- **ansi-to-svg**: Converts terminal output with ANSI colors to SVG
- **Effect CLI**: Provides colored help output and error messages
- **Custom HelpFormatter**: Forces colors even when output is piped

Each SVG preserves the original terminal colors and formatting for an authentic CLI experience.`

  return content
}

function generateHtmlGallery(visuals: Array<VisualFile>, cliCommand: string): string {
  const groupedByCategory = visuals.reduce((acc, visual) => {
    if (!acc[visual.category]) {
      acc[visual.category] = []
    }
    acc[visual.category].push(visual)
    return acc
  }, {} as Record<string, Array<VisualFile>>)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simple CLI Visual Documentation</title>
  <style>
    :root {
      color-scheme: dark;
    }
    body {
      margin: 0;
      padding: 48px 0 96px;
      background: #05080c;
      color: #e6edf3;
      font-family: 'IBM Plex Mono', 'SFMono-Regular', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      line-height: 1.55;
    }
    main {
      max-width: 960px;
      margin: 0 auto;
      padding: 0 32px;
      display: flex;
      flex-direction: column;
      gap: 72px;
    }
    .category {
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .category-title {
      font-size: 1rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #9ecbff;
      display: inline-flex;
      align-items: center;
      gap: 12px;
    }
    .category-title::before {
      content: attr(data-emoji);
      font-size: 1.2rem;
    }
    .category-description {
      margin-top: 4px;
      color: #6e7681;
      font-size: 0.8rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .visual-item {
      background: #0d1117;
      border: 1px solid #1f2a37;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
    }
    .visual-title {
      font-size: 1.05rem;
      margin: 0 0 18px;
      color: #f0f6fc;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .command-hint {
      background: #09121d;
      border: 1px solid #1f2a37;
      border-radius: 10px;
      padding: 18px 20px;
      margin: 0 0 28px;
      box-shadow: inset 0 0 0 1px rgba(88, 166, 255, 0.25);
    }
    .command-label {
      display: block;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: #58a6ff;
      margin-bottom: 10px;
    }
    .command-code {
      margin: 0;
      padding: 12px 16px;
      background: #03070c;
      border-radius: 6px;
      border: 1px solid #1f2a37;
      font-size: 1.02rem;
      line-height: 1.4;
      color: #f0f6fc;
      white-space: pre-wrap;
    }
    .visual-svg {
      width: 100%;
      height: auto;
      border-radius: 6px;
      border: 1px solid #1f2a37;
      background: #05080c;
      box-shadow: 0 14px 32px rgba(1, 6, 15, 0.6);
    }
  </style>
</head>
<body>
  <main>
    ${
    Object.entries(groupedByCategory).map(([category, items]) => `
      <section id="${category}" class="category">
        <div>
          <span class="category-title" data-emoji="${getCategoryEmoji(category)}">
            ${category.toUpperCase()}
          </span>
          <div class="category-description">
            ${categoryDescriptions[category as keyof typeof categoryDescriptions]}
          </div>
        </div>
        ${
      sortVisuals(items, category as VisualFile["category"]).map((visual) => renderVisualItem(visual, cliCommand)).join(
        ""
      )
    }
      </section>
    `).join("")
  }
  </main>
</body>
</html>`

  return html
}

function renderVisualItem(visual: VisualFile, cliCommand: string): string {
  const commandHint = getCommandFromName(visual.name)
  const commandSection = commandHint
    ? `
            <div class="command-hint">
              <span class="command-label">Command</span>
              <pre class="command-code">${formatCommand(cliCommand, commandHint)}</pre>
            </div>
          `
    : ""

  return `
          <div class="visual-item">
            <div class="visual-title">${visual.description}</div>
            ${commandSection}
            <img src="${visual.path}" alt="${visual.description}" class="visual-svg">
          </div>
        `
}

function getCommandFromName(name: string): string | null {
  const commandMap: Record<string, string> = {
    "root-help": "--help",
    "copy-help": "copy --help",
    "build-help": "build --help",
    "deploy-help": "deploy --help",
    "deploy-staging-help": "deploy staging --help",
    "deploy-production-help": "deploy production --help",
    "db-help": "db --help",
    "db-migrate-help": "db migrate --help",
    "db-seed-help": "db seed --help",

    "unknown-flag": "--unknown-flag",
    "unknown-command": "unknown-cmd",
    "typo-copy": "cpy",
    "missing-args-copy": "copy",
    "missing-destination": "copy src.txt",
    "typo-deploy": "deploy prod",
    "production-no-confirm": "deploy production",

    "copy-success": "copy src.txt dest.txt --recursive --force",
    "build-success": "build --watch --minify --out-dir dist",
    "deploy-staging-success": "deploy staging --skip-tests --force",
    "deploy-production-success": "deploy production --confirm --skip-tests",
    "db-migrate-success": "db migrate --up --count 3",
    "db-seed-success": "db seed --env dev --reset"
  }

  return commandMap[name] || null
}

function formatCommand(cliCommand: string, command: string): string {
  const trimmed = command.trim()
  return trimmed.length > 0 ? `${cliCommand} ${trimmed}` : cliCommand
}

function sortVisuals(visuals: Array<VisualFile>, category?: VisualFile["category"]): Array<VisualFile> {
  const next = [...visuals]
  const order = category ? categoryOrdering[category] : undefined

  if (!order) {
    return next.sort((a, b) => a.name.localeCompare(b.name))
  }

  return next.sort((a, b) => {
    const indexA = order.indexOf(a.name)
    const indexB = order.indexOf(b.name)

    if (indexA === -1 && indexB === -1) {
      return a.name.localeCompare(b.name)
    }
    if (indexA === -1) {
      return 1
    }
    if (indexB === -1) {
      return -1
    }
    return indexA - indexB
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

async function resolveCliCommand(): Promise<string> {
  try {
    const raw = await readFile(packageJsonPath, "utf8")
    const parsed = JSON.parse(raw)

    if (isRecord(parsed)) {
      const binField = parsed["bin"]
      if (isRecord(binField)) {
        const binKeys = Object.keys(binField)
        if (binKeys.length > 0) {
          return binKeys[0]
        }
      }

      const nameField = parsed["name"]
      if (typeof nameField === "string" && nameField.length > 0) {
        return nameField
      }
    }
  } catch (error) {
    console.warn("Unable to determine CLI command from package.json, falling back to default", error)
  }

  return DEFAULT_CLI_COMMAND
}

main().catch(console.error)

async function main() {
  await generateGallery()
}
