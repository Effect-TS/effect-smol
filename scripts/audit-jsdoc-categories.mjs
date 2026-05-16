#!/usr/bin/env node

// Collects files that need JSDoc category cleanup into a per-file queue.
// This script deliberately does not judge category quality; category taxonomy
// redesign is handled by reviewers/agents working directly in each source file.

import * as Fs from "node:fs"
import * as Path from "node:path"
import * as Process from "node:process"
import ts from "typescript"

const cwd = Process.cwd()
const args = Process.argv.slice(2)
const outputDirectory = getArg("--output-dir") ?? "reports/jsdoc-categories"

const files = listSourceFiles(Path.join(cwd, "packages"))
const entries = []
let topLevelRelevantTotal = 0
let topLevelMissingCategoryTotal = 0
let topLevelCategoryWithoutSinceTotal = 0
let topLevelNamespaceCategoryTotal = 0
let nestedJSDocTotal = 0
let nestedMissingCategoryTotal = 0
let nestedCategoryTotal = 0

for (const file of files) {
  const source = Fs.readFileSync(file, "utf8")
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const summary = summarizeFile(sourceFile)

  topLevelRelevantTotal += summary.topLevelRelevant
  topLevelMissingCategoryTotal += summary.topLevelMissingCategory
  topLevelCategoryWithoutSinceTotal += summary.topLevelCategoryWithoutSince
  topLevelNamespaceCategoryTotal += summary.topLevelNamespaceCategory
  nestedJSDocTotal += summary.nestedJSDoc
  nestedMissingCategoryTotal += summary.nestedMissingCategory
  nestedCategoryTotal += summary.nestedCategory

  if (
    summary.topLevelRelevant === 0 &&
    summary.topLevelNamespaceCategory === 0 &&
    summary.nestedJSDoc === 0
  ) {
    continue
  }

  entries.push({
    file: normalizePath(Path.relative(cwd, file)),
    packageName: getPackageName(file),
    moduleName: getModuleName(file),
    ...summary
  })
}

entries.sort((a, b) =>
  a.packageName.localeCompare(b.packageName) ||
  a.moduleName.localeCompare(b.moduleName) ||
  a.file.localeCompare(b.file)
)

writeQueue(entries, {
  files: files.length,
  topLevelRelevant: topLevelRelevantTotal,
  topLevelMissingCategory: topLevelMissingCategoryTotal,
  topLevelCategoryWithoutSince: topLevelCategoryWithoutSinceTotal,
  topLevelNamespaceCategory: topLevelNamespaceCategoryTotal,
  nestedJSDoc: nestedJSDocTotal,
  nestedMissingCategory: nestedMissingCategoryTotal,
  nestedCategory: nestedCategoryTotal
})

console.log(`Scanned ${files.length} source file(s).`)
console.log(`Queued ${entries.length} file(s) for JSDoc category cleanup.`)
console.log(`Found ${topLevelRelevantTotal} non-namespace top-level exported JSDoc block(s) with @since or @category.`)
console.log(`Found ${topLevelMissingCategoryTotal} non-namespace top-level exported @since block(s) missing @category.`)
console.log(`Found ${topLevelNamespaceCategoryTotal} namespace @category tag(s) to remove.`)
console.log(`Found ${nestedMissingCategoryTotal} nested JSDoc block(s) missing @category.`)
console.log(`Wrote ${Path.join(outputDirectory, "queue.md")}.`)

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
        entry.name === "index.ts" ||
        entry.name.endsWith(".d.ts") ||
        entry.name.endsWith(".test.ts") ||
        entry.name.endsWith(".tst.ts") ||
        entry.name.endsWith("Generated.ts")
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

function summarizeFile(sourceFile) {
  const categories = new Map()
  const nestedCategories = new Map()
  let topLevelRelevant = 0
  let topLevelMissingCategory = 0
  let topLevelCategoryWithoutSince = 0
  let topLevelNamespaceCategory = 0
  let nestedJSDoc = 0
  let nestedMissingCategory = 0
  let nestedCategory = 0

  for (const statement of sourceFile.statements) {
    if (!isExportedTopLevelDeclaration(statement)) {
      continue
    }

    let topLevelInternal = false
    const jsdoc = getLeadingJSDoc(statement)
    if (jsdoc !== undefined) {
      const parsed = parseJSDoc(sourceFile, jsdoc)
      topLevelInternal = hasTag(parsed, "internal")
      if (!topLevelInternal && ts.isModuleDeclaration(statement) && hasTag(parsed, "category")) {
        topLevelNamespaceCategory += tagCount(parsed, "category")
      }
      if (
        !topLevelInternal &&
        !ts.isModuleDeclaration(statement) &&
        (hasTag(parsed, "since") || hasTag(parsed, "category"))
      ) {
        topLevelRelevant++

        const categoryValues = tagValues(parsed, "category")
        if (categoryValues.length === 0) {
          topLevelMissingCategory++
        }
        if (!hasTag(parsed, "since")) {
          topLevelCategoryWithoutSince++
        }
        for (const category of categoryValues) {
          categories.set(category, (categories.get(category) ?? 0) + 1)
        }
      }
    }

    if (topLevelInternal) {
      continue
    }

    const nested = summarizeNestedJSDocs(sourceFile, statement)
    nestedJSDoc += nested.count
    nestedMissingCategory += nested.missingCategory
    nestedCategory += nested.category
    for (const category of nested.categories) {
      nestedCategories.set(category.name, (nestedCategories.get(category.name) ?? 0) + category.count)
    }
  }

  return {
    topLevelRelevant,
    topLevelMissingCategory,
    topLevelCategoryWithoutSince,
    topLevelNamespaceCategory,
    nestedJSDoc,
    nestedMissingCategory,
    nestedCategory,
    categories: Array.from(categories, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    nestedCategories: Array.from(nestedCategories, ([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }
}

function isExportedTopLevelDeclaration(node) {
  return (
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    ts.isVariableStatement(node)
  ) && hasModifier(node, ts.SyntaxKind.ExportKeyword)
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) === true
}

function summarizeNestedJSDocs(sourceFile, root) {
  let count = 0
  let missingCategory = 0
  let category = 0
  const categories = new Map()

  function visit(node) {
    if (node !== root) {
      const jsdoc = getLeadingJSDoc(node)
      if (jsdoc !== undefined) {
        const parsed = parseJSDoc(sourceFile, jsdoc)
        if (!hasTag(parsed, "internal")) {
          count++
          const categoryValues = tagValues(parsed, "category")
          if (categoryValues.length === 0) {
            missingCategory++
          }
          category += categoryValues.length
          for (const value of categoryValues) {
            categories.set(value, (categories.get(value) ?? 0) + 1)
          }
        }
      }
    }

    if (ts.isBlock(node)) {
      return
    }

    ts.forEachChild(node, visit)
  }

  ts.forEachChild(root, visit)
  return {
    count,
    missingCategory,
    category,
    categories: Array.from(categories, ([name, count]) => ({ name, count }))
  }
}

function getLeadingJSDoc(node) {
  const jsdocs = node.jsDoc
  if (jsdocs === undefined || jsdocs.length === 0) {
    return undefined
  }
  return jsdocs[jsdocs.length - 1]
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

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("```")) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      continue
    }

    const tag = trimmed.match(/^@([A-Za-z][\w-]*)(?:\s+(.*))?$/)
    if (tag !== null) {
      tags.push({
        name: tag[1],
        value: tag[2]?.trim() ?? ""
      })
    }
  }

  return { tags }
}

function hasTag(jsdoc, name) {
  return jsdoc.tags.some((tag) => tag.name === name)
}

function tagCount(jsdoc, name) {
  return jsdoc.tags.filter((tag) => tag.name === name).length
}

function tagValues(jsdoc, name) {
  return jsdoc.tags
    .filter((tag) => tag.name === name)
    .map((tag) => tag.value.trim())
    .filter((value) => value !== "")
}

function writeQueue(entries, summary) {
  const output = Path.join(cwd, outputDirectory)
  Fs.mkdirSync(output, { recursive: true })
  Fs.writeFileSync(Path.join(output, "queue.md"), renderQueue(entries, summary))
}

function renderQueue(entries, summary) {
  const lines = [
    "# JSDoc Category Cleanup Queue",
    "",
    "Generated by `node scripts/audit-jsdoc-categories.mjs`.",
    "",
    "This file is a work queue, not a semantic audit result. The script only partitions files that contain non-namespace top-level exported JSDoc blocks with `@since` or `@category`, namespace JSDoc blocks with `@category`, or nested JSDoc blocks inside top-level exports.",
    "",
    "## Swarm Instructions",
    "",
    "- Use one worker per file.",
    "- Keep at most 6 workers active at a time.",
    "- Workers may edit only `@category` lines in their assigned source file.",
    "- For non-namespace top-level exported JSDocs, redesign the file-local category taxonomy for generated docs navigation.",
    "- For non-namespace top-level exported JSDocs with `@since` but no `@category`, add a category from the file-local taxonomy.",
    "- For namespace JSDocs, remove `@category`.",
    "- For nested JSDocs inside top-level exported declarations, add or improve `@category` using the file-local taxonomy.",
    "- Do not edit descriptions, examples, `@since`, runtime code, types, imports, exports, or generated `index.ts` files.",
    "- Only the coordinator should update this queue.",
    "- Mark a file as done by changing `[ ]` to `[x]`; leave a short note when a category decision was ambiguous.",
    "",
    "## Summary",
    "",
    `- Source files scanned: ${summary.files}`,
    `- Files queued: ${entries.length}`,
    `- Non-namespace top-level exported JSDoc blocks with @since or @category: ${summary.topLevelRelevant}`,
    `- Non-namespace top-level exported @since blocks missing @category: ${summary.topLevelMissingCategory}`,
    `- Non-namespace top-level exported @category blocks missing @since: ${summary.topLevelCategoryWithoutSince}`,
    `- Namespace @category tags to remove: ${summary.topLevelNamespaceCategory}`,
    `- Nested JSDoc blocks inside top-level exports: ${summary.nestedJSDoc}`,
    `- Nested JSDoc blocks missing @category: ${summary.nestedMissingCategory}`,
    `- Existing nested @category tags: ${summary.nestedCategory}`,
    "",
    "## Files",
    ""
  ]

  for (const entry of entries) {
    lines.push(
      `- [ ] \`${entry.file}\``,
      `  - Package: \`${entry.packageName}\``,
      `  - Module: \`${entry.moduleName}\``,
      `  - Non-namespace top-level relevant JSDocs: ${entry.topLevelRelevant}`,
      `  - Missing non-namespace top-level @category: ${entry.topLevelMissingCategory}`,
      `  - Non-namespace top-level @category without @since: ${entry.topLevelCategoryWithoutSince}`,
      `  - Namespace @category tags to remove: ${entry.topLevelNamespaceCategory}`,
      `  - Nested JSDoc blocks: ${entry.nestedJSDoc}`,
      `  - Nested JSDoc blocks missing @category: ${entry.nestedMissingCategory}`,
      `  - Existing nested @category tags: ${entry.nestedCategory}`,
      `  - Current top-level categories: ${renderCategories(entry.categories)}`,
      `  - Current nested categories: ${renderCategories(entry.nestedCategories)}`
    )
  }

  lines.push("")
  return lines.join("\n")
}

function renderCategories(categories) {
  if (categories.length === 0) {
    return "(none)"
  }
  return categories.map((category) => `\`${category.name}\` (${category.count})`).join(", ")
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
