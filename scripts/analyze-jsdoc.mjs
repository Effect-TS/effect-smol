#!/usr/bin/env node

import * as Fs from "node:fs"
import * as Path from "node:path"
import * as Process from "node:process"

/**
 * Analyzes TypeScript files for missing JSDoc examples and category tags
 */
class JSDocAnalyzer {
  constructor() {
    this.results = {
      totalFiles: 0,
      totalExports: 0,
      missingExamples: 0,
      missingCategories: 0,
      fileDetails: [],
      missingItems: []
    }
  }

  /**
   * Get all TypeScript files in the effect/src directory (excluding subdirectories)
   */
  getEffectFiles() {
    const effectSrcDir = Path.join(Process.cwd(), "packages/effect/src")
    const files = Fs.readdirSync(effectSrcDir)

    return files
      .filter((file) => file.endsWith(".ts"))
      .filter((file) => !file.endsWith(".test.ts"))
      .filter((file) => {
        // Only include files, not directories
        const fullPath = Path.join(effectSrcDir, file)
        return Fs.statSync(fullPath).isFile()
      })
      .map((file) => Path.join(effectSrcDir, file))
  }

  /**
   * Extract exported members from a TypeScript file
   */
  extractExports(content, filename) {
    const exports = []
    const lines = content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()

      // Skip comments and empty lines
      if (line.startsWith("//") || line.startsWith("*") || !line) continue

      // Match various export patterns
      const exportPatterns = [
        /^export\s+const\s+(\w+)/,
        /^export\s+function\s+(\w+)/,
        /^export\s+type\s+(\w+)/,
        /^export\s+interface\s+(\w+)/,
        /^export\s+class\s+(\w+)/,
        /^export\s+enum\s+(\w+)/,
        /^export\s+namespace\s+(\w+)/
      ]

      for (const pattern of exportPatterns) {
        const match = line.match(pattern)
        if (match) {
          const exportName = match[1]

          // Skip re-exports and certain patterns
          if (line.includes("from ") || exportName.startsWith("_")) {
            continue
          }

          // Find associated JSDoc block
          const jsdoc = this.findJSDocBlock(lines, i)

          exports.push({
            name: exportName,
            line: i + 1,
            type: this.getExportType(line),
            hasExample: jsdoc.hasExample,
            hasCategory: jsdoc.hasCategory,
            jsdocStart: jsdoc.start,
            filename: Path.basename(filename)
          })
          break
        }
      }
    }

    return exports
  }

  /**
   * Find JSDoc block preceding an export
   */
  findJSDocBlock(lines, exportLineIndex) {
    let hasExample = false
    let hasCategory = false
    let start = -1

    // Look backwards for JSDoc block
    for (let i = exportLineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim()

      // End of JSDoc block
      if (line === "*/") {
        start = i
        continue
      }

      // Start of JSDoc block
      if (line.startsWith("/**")) {
        break
      }

      // Check for @example and @category
      if (line.includes("@example")) {
        hasExample = true
      }
      if (line.includes("@category")) {
        hasCategory = true
      }

      // Stop if we hit another export or non-comment line
      if (line && !line.startsWith("*") && !line.startsWith("//")) {
        break
      }
    }

    return { hasExample, hasCategory, start }
  }

  /**
   * Determine the type of export
   */
  getExportType(line) {
    if (line.includes("const ")) return "const"
    if (line.includes("function ")) return "function"
    if (line.includes("type ")) return "type"
    if (line.includes("interface ")) return "interface"
    if (line.includes("class ")) return "class"
    if (line.includes("enum ")) return "enum"
    if (line.includes("namespace ")) return "namespace"
    return "unknown"
  }

  /**
   * Analyze a single file
   */
  analyzeFile(filepath) {
    const content = Fs.readFileSync(filepath, "utf8")
    const filename = Path.basename(filepath)
    const exports = this.extractExports(content, filepath)

    const fileStats = {
      filename,
      totalExports: exports.length,
      missingExamples: exports.filter((e) => !e.hasExample).length,
      missingCategories: exports.filter((e) => !e.hasCategory).length,
      exports
    }

    // Track missing items for detailed reporting
    exports.forEach((exp) => {
      if (!exp.hasExample || !exp.hasCategory) {
        this.results.missingItems.push({
          file: filename,
          name: exp.name,
          type: exp.type,
          line: exp.line,
          missingExample: !exp.hasExample,
          missingCategory: !exp.hasCategory
        })
      }
    })

    return fileStats
  }

  /**
   * Run analysis on all Effect source files
   */
  analyze() {
    const files = this.getEffectFiles()
    Process.stdout.write(`Analyzing ${files.length} TypeScript files in packages/effect/src/...\n\n`)

    this.results.totalFiles = files.length

    for (const filepath of files) {
      const fileStats = this.analyzeFile(filepath)
      this.results.fileDetails.push(fileStats)

      this.results.totalExports += fileStats.totalExports
      this.results.missingExamples += fileStats.missingExamples
      this.results.missingCategories += fileStats.missingCategories
    }

    this.generateReport()
  }

  /**
   * Generate comprehensive analysis report
   */
  generateReport() {
    const { fileDetails, missingCategories, missingExamples, missingItems, totalExports, totalFiles } = this.results

    Process.stdout.write("=".repeat(60) + "\n")
    Process.stdout.write("         EFFECT JSDOC ANALYSIS REPORT\n")
    Process.stdout.write("=".repeat(60) + "\n")
    Process.stdout.write("\n")

    // Summary Statistics
    Process.stdout.write("📊 SUMMARY STATISTICS\n")
    Process.stdout.write("-".repeat(30) + "\n")
    Process.stdout.write(`Total files analyzed: ${totalFiles}\n`)
    Process.stdout.write(`Total exported members: ${totalExports}\n`)
    Process.stdout.write(
      `Missing @example: ${missingExamples} (${((missingExamples / totalExports) * 100).toFixed(1)}%)\n`
    )
    Process.stdout.write(
      `Missing @category: ${missingCategories} (${((missingCategories / totalExports) * 100).toFixed(1)}%)\n`
    )
    Process.stdout.write("\n")

    // Top files needing attention
    Process.stdout.write("🎯 TOP FILES NEEDING ATTENTION\n")
    Process.stdout.write("-".repeat(40) + "\n")
    const sortedFiles = fileDetails
      .filter((f) => f.missingExamples > 0 || f.missingCategories > 0)
      .sort((a, b) => (b.missingExamples + b.missingCategories) - (a.missingExamples + a.missingCategories))
      .slice(0, 15)

    sortedFiles.forEach((file, index) => {
      Process.stdout.write(`${index + 1}. ${file.filename}\n`)
      Process.stdout.write(
        `   📝 ${file.missingExamples} missing examples, 🏷️  ${file.missingCategories} missing categories\n`
      )
      Process.stdout.write(`   📦 ${file.totalExports} total exports\n`)
    })

    Process.stdout.write("\n")

    // Files with perfect documentation
    const perfectFiles = fileDetails.filter((f) => f.missingExamples === 0 && f.missingCategories === 0)
    if (perfectFiles.length > 0) {
      Process.stdout.write("✅ PERFECTLY DOCUMENTED FILES\n")
      Process.stdout.write("-".repeat(35) + "\n")
      perfectFiles.forEach((file) => {
        Process.stdout.write(`   ${file.filename} (${file.totalExports} exports)\n`)
      })
      Process.stdout.write("\n")
    }

    // Detailed breakdown by type
    Process.stdout.write("📋 BREAKDOWN BY EXPORT TYPE\n")
    Process.stdout.write("-".repeat(35) + "\n")
    const typeStats = {}
    missingItems.forEach((item) => {
      if (!typeStats[item.type]) {
        typeStats[item.type] = { total: 0, missingExample: 0, missingCategory: 0 }
      }
      typeStats[item.type].total++
      if (item.missingExample) typeStats[item.type].missingExample++
      if (item.missingCategory) typeStats[item.type].missingCategory++
    })

    Object.entries(typeStats).forEach(([type, stats]) => {
      Process.stdout.write(
        `${type}: ${stats.missingExample} missing examples, ${stats.missingCategory} missing categories\n`
      )
    })

    Process.stdout.write("\n")

    // Progress tracking
    const documentedExamples = totalExports - missingExamples
    const documentedCategories = totalExports - missingCategories
    Process.stdout.write("📈 DOCUMENTATION PROGRESS\n")
    Process.stdout.write("-".repeat(30) + "\n")
    Process.stdout.write(
      `Examples: ${documentedExamples}/${totalExports} (${
        ((documentedExamples / totalExports) * 100).toFixed(1)
      }% complete)\n`
    )
    Process.stdout.write(
      `Categories: ${documentedCategories}/${totalExports} (${
        ((documentedCategories / totalExports) * 100).toFixed(1)
      }% complete)\n`
    )
    Process.stdout.write("\n")

    Process.stdout.write("=".repeat(60) + "\n")
    Process.stdout.write(`Analysis complete! ${missingExamples + missingCategories} items need attention.\n`)
    Process.stdout.write("=".repeat(60) + "\n")

    // Save detailed results to JSON for further analysis
    const outputFile = "jsdoc-analysis-results.json"
    Fs.writeFileSync(outputFile, JSON.stringify(this.results, null, 2))
    Process.stdout.write(`\n📄 Detailed results saved to: ${outputFile}\n`)
  }
}

// Run the analysis
const analyzer = new JSDocAnalyzer()
analyzer.analyze()
