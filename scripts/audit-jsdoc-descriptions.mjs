#!/usr/bin/env node

// Collects exported, non-internal JSDoc descriptions into review chunks.
// This script deliberately does not judge quality; human/agent reviewers read
// the chunks and write only the descriptions they flag into the backlog.

import * as Fs from "node:fs"
import * as Path from "node:path"
import * as Process from "node:process"
import ts from "typescript"

const cwd = Process.cwd()
const args = Process.argv.slice(2)
const outputDirectory = getArg("--output-dir") ?? "reports/jsdoc-descriptions"
const chunkSize = Number(getArg("--chunk-size") ?? 120)

const ignoredBasenames = new Set(["Generated.ts", "index.ts"])
const declarationKinds = new Set([
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.VariableStatement
])

const files = listSourceFiles(Path.join(cwd, "packages"))
const entries = []
let skippedInternal = 0

for (const file of files) {
  const source = Fs.readFileSync(file, "utf8")
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)

  visitSourceFile(sourceFile, (node, exportPath) => {
    const jsdoc = getLeadingJSDoc(node)
    if (jsdoc === undefined) {
      return
    }

    const parsed = parseJSDoc(sourceFile, jsdoc)
    if (parsed.tags.includes("internal")) {
      skippedInternal++
      return
    }

    const declarations = getExportedDeclarations(sourceFile, node)
    for (const declaration of declarations) {
      const position = sourceFile.getLineAndCharacterOfPosition(declaration.position)
      entries.push({
        packageName: getPackageName(file),
        moduleName: getModuleName(file),
        file: normalizePath(Path.relative(cwd, file)),
        line: position.line + 1,
        apiName: [...exportPath, declaration.name].join("."),
        apiKind: declaration.kind,
        description: parsed.description,
        tags: parsed.tags
      })
    }
  })
}

entries.sort((a, b) =>
  a.packageName.localeCompare(b.packageName) ||
  a.moduleName.localeCompare(b.moduleName) ||
  a.line - b.line ||
  a.apiName.localeCompare(b.apiName)
)

writeInventory(entries, {
  files: files.length,
  skippedInternal
})

console.log(`Collected ${entries.length} exported non-internal JSDoc declaration(s) from ${files.length} file(s).`)
console.log(`Skipped ${skippedInternal} @internal JSDoc declaration(s).`)
console.log(`Wrote inventory and review chunks to ${outputDirectory}.`)

function getArg(name) {
  const direct = args.find((arg) => arg.startsWith(`${name}=`))
  if (direct !== undefined) {
    return direct.slice(name.length + 1)
  }
  const index = args.indexOf(name)
  return index === -1 ? undefined : args[index + 1]
}

function listSourceFiles(root) {
  const out = []

  function visit(directory) {
    for (const entry of Fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = Path.join(directory, entry.name)
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "docs" ||
          entry.name === "test" ||
          entry.name === "typetest"
        ) {
          continue
        }
        visit(fullPath)
        continue
      }

      if (!entry.isFile() || !entry.name.endsWith(".ts")) {
        continue
      }
      if (
        entry.name.endsWith(".d.ts") ||
        entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".tst.ts") ||
        ignoredBasenames.has(entry.name)
      ) {
        continue
      }
      if (!normalizePath(fullPath).includes("/src/")) {
        continue
      }
      out.push(fullPath)
    }
  }

  visit(root)
  return out.sort((a, b) => normalizePath(a).localeCompare(normalizePath(b)))
}

function visitSourceFile(sourceFile, onExport) {
  function visit(node, exportPath, exportedNamespaceDepth) {
    if (!declarationKinds.has(node.kind)) {
      ts.forEachChild(node, (child) => visit(child, exportPath, exportedNamespaceDepth))
      return
    }

    const isExported = hasModifier(node, ts.SyntaxKind.ExportKeyword) || exportedNamespaceDepth > 0

    if (isExported) {
      onExport(node, exportPath)
    }

    if (ts.isModuleDeclaration(node) && isExported && node.name !== undefined) {
      const namespaceName = node.name.getText(sourceFile).replaceAll("\"", "")
      if (node.body !== undefined) {
        ts.forEachChild(node.body, (child) => visit(child, [...exportPath, namespaceName], exportedNamespaceDepth + 1))
      }
      return
    }

    ts.forEachChild(node, (child) => visit(child, exportPath, exportedNamespaceDepth))
  }

  ts.forEachChild(sourceFile, (node) => visit(node, [], 0))
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) === true
}

function getLeadingJSDoc(node) {
  const jsdocs = node.jsDoc
  if (jsdocs === undefined || jsdocs.length === 0) {
    return undefined
  }
  return jsdocs[jsdocs.length - 1]
}

function getExportedDeclarations(sourceFile, node) {
  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .filter((declaration) => ts.isIdentifier(declaration.name))
      .map((declaration) => ({
        name: declaration.name.text,
        kind: "value",
        position: declaration.name.getStart(sourceFile)
      }))
  }

  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)) &&
    node.name !== undefined
  ) {
    return [{
      name: node.name.getText(sourceFile),
      kind: getApiKind(node),
      position: node.name.getStart(sourceFile)
    }]
  }

  return []
}

function getApiKind(node) {
  if (ts.isFunctionDeclaration(node)) {
    return "value"
  }
  if (ts.isClassDeclaration(node)) {
    return "class"
  }
  if (ts.isInterfaceDeclaration(node)) {
    return "interface"
  }
  if (ts.isTypeAliasDeclaration(node)) {
    return "type"
  }
  if (ts.isEnumDeclaration(node)) {
    return "enum"
  }
  if (ts.isModuleDeclaration(node)) {
    return "namespace"
  }
  return "value"
}

function parseJSDoc(sourceFile, jsdoc) {
  const raw = sourceFile.text.slice(jsdoc.pos, jsdoc.end)
  const lines = raw
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split(/\r\n|\r|\n/)
    .map((line) => line.replace(/^\s*\* ?/, "").trimEnd())

  const tags = []
  let inFence = false
  let inExample = false
  const descriptionLines = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("```")) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }

    const tag = trimmed.match(/^@([A-Za-z][\w-]*)/)
    if (tag !== null) {
      tags.push(tag[1])
      if (tag[1] === "example") {
        inExample = true
      }
      continue
    }

    if (/^\*\*Examples?\*\*/i.test(trimmed) || /^#{2,}\s+Examples?/i.test(trimmed)) {
      inExample = true
      continue
    }

    if (inExample) {
      continue
    }

    if (trimmed !== "") {
      descriptionLines.push(trimmed)
    }
  }

  return {
    tags: Array.from(new Set(tags)),
    description: normalizeDescription(descriptionLines.join("\n"))
  }
}

function normalizeDescription(description) {
  return description
    .replaceAll(/\{@link\s+([^}\s]+)(?:\s+[^}]*)?\}/g, "$1")
    .replaceAll(/[ \t]+\n/g, "\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim()
}

function writeInventory(entries, summary) {
  const output = Path.join(cwd, outputDirectory)
  const chunksDirectory = Path.join(output, "chunks")
  const findingsDirectory = Path.join(output, "findings")

  Fs.mkdirSync(output, { recursive: true })
  Fs.rmSync(chunksDirectory, { recursive: true, force: true })
  Fs.mkdirSync(chunksDirectory, { recursive: true })
  Fs.mkdirSync(findingsDirectory, { recursive: true })

  Fs.writeFileSync(Path.join(output, "inventory.json"), `${JSON.stringify({
    generatedBy: "node scripts/audit-jsdoc-descriptions.mjs",
    scannedFiles: summary.files,
    skippedInternal: summary.skippedInternal,
    entries
  }, null, 2)}\n`)

  const chunks = []
  for (let start = 0; start < entries.length; start += chunkSize) {
    const chunkEntries = entries.slice(start, start + chunkSize)
    const chunkNumber = String(chunks.length + 1).padStart(3, "0")
    const chunkPath = Path.join(chunksDirectory, `chunk-${chunkNumber}.md`)
    const chunk = {
      number: chunks.length + 1,
      path: normalizePath(Path.relative(cwd, chunkPath)),
      start: start + 1,
      end: start + chunkEntries.length,
      count: chunkEntries.length
    }
    chunks.push(chunk)
    Fs.writeFileSync(chunkPath, renderChunk(chunk, chunkEntries))
  }

  const backlogPath = Path.join(output, "review-needed.md")
  if (!Fs.existsSync(backlogPath)) {
    Fs.writeFileSync(backlogPath, renderBacklogSkeleton(entries, chunks, summary))
  }
}

function renderBacklogSkeleton(entries, chunks, summary) {
  return [
    "# JSDoc Description Review Needed",
    "",
    "Generated by `node scripts/audit-jsdoc-descriptions.mjs`.",
    "",
    "This backlog is intentionally empty until reviewers judge the inventory chunks.",
    "The script only detects exported declarations with leading JSDoc blocks that are not tagged `@internal`; it does not decide whether a description is good.",
    "",
    "## Summary",
    "",
    `- Source files scanned: ${summary.files}`,
    `- Exported non-internal JSDoc declarations collected: ${entries.length}`,
    `- @internal JSDoc declarations skipped: ${summary.skippedInternal}`,
    `- Review chunks: ${chunks.length}`,
    "- Review-needed entries remaining: 0",
    "",
    "## Review Chunks",
    "",
    ...chunks.map((chunk) => `- [${Path.basename(chunk.path, ".md")}](${chunk.path}) (${chunk.count} entries, ${chunk.start}-${chunk.end})`),
    "",
    "## Entries",
    "",
    "No reviewed findings have been merged yet.",
    ""
  ].join("\n")
}

function renderChunk(chunk, entries) {
  const lines = [
    `# JSDoc Description Inventory ${String(chunk.number).padStart(3, "0")}`,
    "",
    "This file is reviewer input, not a backlog. Judge each description manually.",
    "Only copy flagged descriptions into `reports/jsdoc-descriptions/review-needed.md` or a worker findings file.",
    "",
    "For each flagged entry, record: severity, issue labels, reason, current description, and suggested replacement.",
    "",
    `Entries: ${chunk.start}-${chunk.end}`,
    ""
  ]

  let currentPackage = ""
  let currentModule = ""

  for (const entry of entries) {
    if (entry.packageName !== currentPackage) {
      currentPackage = entry.packageName
      currentModule = ""
      lines.push("", `## ${entry.packageName}`)
    }
    if (entry.moduleName !== currentModule) {
      currentModule = entry.moduleName
      lines.push("", `### ${entry.moduleName}`)
    }

    lines.push(
      "",
      `#### ${entry.apiName}`,
      "",
      `- File: \`${entry.file}:${entry.line}\``,
      `- API kind: \`${entry.apiKind}\``,
      `- Tags: ${entry.tags.length === 0 ? "(none)" : entry.tags.map((tag) => `\`${tag}\``).join(", ")}`,
      "- Current description:",
      "",
      "```md",
      entry.description === "" ? "(missing)" : entry.description,
      "```"
    )
  }

  lines.push("")
  return lines.join("\n")
}

function getPackageName(file) {
  const relative = normalizePath(Path.relative(cwd, file))
  const parts = relative.split("/")
  const srcIndex = parts.indexOf("src")
  return parts.slice(0, srcIndex).join("/")
}

function getModuleName(file) {
  const relative = normalizePath(Path.relative(cwd, file))
  const parts = relative.split("/")
  const srcIndex = parts.indexOf("src")
  return parts.slice(srcIndex + 1).join("/").replace(/\.ts$/, "")
}

function normalizePath(file) {
  return file.split(Path.sep).join("/")
}
