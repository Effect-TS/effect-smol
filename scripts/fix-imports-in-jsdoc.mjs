#!/usr/bin/env node

/* eslint-env node */
/* global console, process */

import { readdirSync, readFileSync, statSync, writeFileSync } from "fs"
import { join } from "path"

function findTsFiles(dir) {
  const files = []

  function traverse(currentDir) {
    const entries = readdirSync(currentDir)

    for (const entry of entries) {
      const fullPath = join(currentDir, entry)
      const stat = statSync(fullPath)

      if (stat.isDirectory()) {
        // Skip node_modules and other irrelevant directories
        if (!entry.startsWith(".") && entry !== "node_modules" && entry !== "dist" && entry !== "build") {
          traverse(fullPath)
        }
      } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
        files.push(fullPath)
      }
    }
  }

  traverse(dir)
  return files
}

function cleanJSDocCodeContent(codeContent) {
  // Remove JSDoc comment prefixes (* ) from each line
  return codeContent
    .split("\n")
    .map((line) => line.replace(/^\s*\*\s?/, ""))
    .join("\n")
    .trim()
}

function addJSDocPrefixes(codeContent) {
  // Add JSDoc comment prefixes (* ) to each line
  return codeContent
    .split("\n")
    .map((line) => line.length > 0 ? ` * ${line}` : " *")
    .join("\n")
}

function extractAndFixJSDocExamples(content) {
  const issues = []
  let hasChanges = false
  let modifiedContent = content

  // Find all JSDoc blocks
  const jsdocBlocks = content.match(/\/\*\*[\s\S]*?\*\//g) || []

  for (const block of jsdocBlocks) {
    // Find @example sections with code blocks
    const exampleMatches = block.match(/@example[\s\S]*?(?=@\w+|$|\*\/)/g) || []

    for (const example of exampleMatches) {
      const codeBlockMatch = example.match(/(```ts\n)([\s\S]*?)(```)/g)

      if (codeBlockMatch) {
        for (const fullCodeBlock of codeBlockMatch) {
          const codeMatch = fullCodeBlock.match(/```ts\n([\s\S]*?)```/)
          if (codeMatch) {
            const rawCodeContent = codeMatch[1]
            const cleanCodeContent = cleanJSDocCodeContent(rawCodeContent)
            const duplicates = findDuplicatedImports(cleanCodeContent)

            if (duplicates.length > 0) {
              issues.push({
                duplicates,
                codeBlock: fullCodeBlock
              })

              // Fix the code block
              const fixedCodeContent = consolidateImports(cleanCodeContent, duplicates)
              const fixedCodeWithPrefixes = addJSDocPrefixes(fixedCodeContent)
              const fixedCodeBlock = `\`\`\`ts\n${fixedCodeWithPrefixes}\n * \`\`\``

              modifiedContent = modifiedContent.replace(fullCodeBlock, fixedCodeBlock)
              hasChanges = true
            }
          }
        }
      }
    }
  }

  return { issues, hasChanges, modifiedContent }
}

function findDuplicatedImports(codeContent) {
  const imports = []
  const lines = codeContent.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const importMatch = line.match(/^import\s+\{([^}]+)\}\s+from\s+["'](@?effect[^"']*?)["']/)

    if (importMatch) {
      const packageName = importMatch[2]
      const importedNames = importMatch[1]
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0)

      imports.push({
        packageName,
        importedNames,
        line: i + 1,
        fullLine: line
      })
    }
  }

  // Group by package name and find duplicates
  const packageGroups = {}
  for (const imp of imports) {
    if (!packageGroups[imp.packageName]) {
      packageGroups[imp.packageName] = []
    }
    packageGroups[imp.packageName].push(imp)
  }

  const duplicates = []
  for (const [packageName, importList] of Object.entries(packageGroups)) {
    if (importList.length > 1) {
      duplicates.push({
        packageName,
        imports: importList,
        count: importList.length
      })
    }
  }

  return duplicates
}

function consolidateImports(codeContent, duplicates) {
  const lines = codeContent.split("\n")
  const linesToRemove = new Set()

  // Process each package with duplicates
  for (const duplicate of duplicates) {
    const { imports, packageName } = duplicate

    // Collect all imported names
    const allImportedNames = new Set()
    let firstImportLineIndex = -1

    for (const imp of imports) {
      if (firstImportLineIndex === -1) {
        firstImportLineIndex = imp.line - 1 // Convert to 0-based index
      } else {
        linesToRemove.add(imp.line - 1) // Mark duplicate lines for removal
      }

      for (const name of imp.importedNames) {
        allImportedNames.add(name)
      }
    }

    // Create consolidated import
    const sortedNames = Array.from(allImportedNames).sort()
    const consolidatedImport = `import { ${sortedNames.join(", ")} } from "${packageName}"`

    // Replace the first import line with the consolidated one
    if (firstImportLineIndex >= 0) {
      lines[firstImportLineIndex] = consolidatedImport
    }
  }

  // Remove duplicate import lines (in reverse order to maintain indices)
  const sortedLinesToRemove = Array.from(linesToRemove).sort((a, b) => b - a)
  for (const lineIndex of sortedLinesToRemove) {
    lines.splice(lineIndex, 1)
  }

  return lines.join("\n")
}

function analyzeFile(filePath, shouldFix = false) {
  try {
    const originalContent = readFileSync(filePath, "utf8")
    const result = extractAndFixJSDocExamples(originalContent)

    // Write back the fixed content if there were changes
    if (shouldFix && result.hasChanges) {
      writeFileSync(filePath, result.modifiedContent, "utf8")
    }

    return { issues: result.issues, hasChanges: result.hasChanges }
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`)
    return { issues: [], hasChanges: false }
  }
}

function main() {
  const rootDir = process.cwd()
  const args = process.argv.slice(2)
  const shouldFix = args.includes("--fix")
  const tsFiles = findTsFiles(rootDir)

  let totalIssues = 0
  let filesWithIssues = 0
  let filesFixed = 0

  if (shouldFix) {
    console.log("🔧 Auto-fixing duplicated Effect imports in JSDoc examples...\n")
  } else {
    console.log("🔍 Searching for duplicated Effect imports in JSDoc examples...\n")
  }

  for (const filePath of tsFiles) {
    const result = analyzeFile(filePath, shouldFix)
    const { hasChanges, issues } = result

    if (issues.length > 0) {
      filesWithIssues++
      if (hasChanges) {
        filesFixed++
      }

      const relativePath = filePath.replace(rootDir + "/", "")

      if (shouldFix) {
        console.log(`${hasChanges ? "✅" : "⚠️"} ${relativePath}${hasChanges ? " (FIXED)" : " (SKIPPED)"}`)
      } else {
        console.log(`📁 ${relativePath}`)
      }

      if (!shouldFix) {
        for (let i = 0; i < issues.length; i++) {
          const issue = issues[i]
          totalIssues++
          console.log(`  └─ Example #${i + 1}:`)

          for (const duplicate of issue.duplicates) {
            console.log(`     🔸 Package "${duplicate.packageName}" imported ${duplicate.count} times:`)
            for (const imp of duplicate.imports) {
              console.log(`       • Line ${imp.line}: ${imp.fullLine}`)
            }
          }

          // Show a preview of the problematic code block
          const preview = issue.codeBlock
            .replace(/```ts\n/, "")
            .replace(/```$/, "")
            .split("\n")
            .slice(0, 10)
            .map((line) => `       ${line}`)
            .join("\n")

          console.log(`     Code preview:`)
          console.log(preview)
          if (issue.codeBlock.split("\n").length > 10) {
            console.log(`       ...`)
          }
          console.log("")
        }
        console.log("")
      } else {
        // In fix mode, just count the issues
        totalIssues += issues.length
      }
    }
  }

  if (totalIssues === 0) {
    console.log("✅ No duplicated Effect imports found in JSDoc examples!")
  } else if (shouldFix) {
    console.log(`\n🔧 Auto-fix Summary:`)
    console.log(`   • Files with issues: ${filesWithIssues}`)
    console.log(`   • Files successfully fixed: ${filesFixed}`)
    console.log(`   • Total duplicated import issues fixed: ${totalIssues}`)
    console.log(`\n💡 Run the script again without --fix to verify the fixes.`)
  } else {
    console.log(`📊 Summary:`)
    console.log(`   • Files with issues: ${filesWithIssues}`)
    console.log(`   • Total duplicated import issues: ${totalIssues}`)
    console.log(`\n💡 Tips:`)
    console.log(`   • Run with --fix to automatically consolidate imports`)
    console.log(`   • Example: import { Effect, Metric, Schedule } from "effect"`)
  }
}

main()
