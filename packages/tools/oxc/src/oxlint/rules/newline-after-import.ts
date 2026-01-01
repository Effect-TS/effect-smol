import type { Rule } from "../types.ts"

interface StatementNode {
  type: string
  start?: number
  end?: number
  range?: [number, number]
}

interface ProgramNode {
  type: string
  body: Array<StatementNode>
}

const rule: Rule = {
  meta: {
    type: "layout",
    docs: { description: "Require a newline after import statements" },
    fixable: "whitespace"
  },
  create(context) {
    const sourceCode = context.sourceCode

    return {
      Program(node: unknown) {
        const n = node as ProgramNode
        const body = n.body

        // Find the last import
        let lastImportIndex = -1
        for (let i = 0; i < body.length; i++) {
          if (body[i].type === "ImportDeclaration") {
            lastImportIndex = i
          }
        }

        // If there's a last import and something after it
        if (lastImportIndex >= 0 && lastImportIndex < body.length - 1) {
          const lastImport = body[lastImportIndex]
          const importEnd = lastImport.end ?? 0

          // Get full source text and find what's after the import
          const text = sourceCode.getText()
          const textAfterImport = text.slice(importEnd)

          // Check if there's a blank line (two newlines) before non-whitespace content
          // Match: newline, then optionally whitespace-only lines, then the first non-whitespace
          const match = textAfterImport.match(/^(\r?\n)([ \t]*\r?\n)?/)

          if (!match || !match[2]) {
            // No blank line found - either no newline at all, or content on next line
            context.report({
              node: lastImport,
              message: "Expected 1 empty line after import statement not followed by another import",
              fix(fixer) {
                // Insert a newline after the import
                return fixer.insertTextAfter(lastImport, "\n")
              }
            })
          }
        }
      }
    }
  }
}

export default rule
