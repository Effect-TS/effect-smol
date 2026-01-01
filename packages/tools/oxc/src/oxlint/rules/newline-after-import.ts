import type { Rule } from "../types.ts"

interface StatementNode {
  type: string
  loc?: {
    start: { line: number }
    end: { line: number }
  }
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
    return {
      Program(node: unknown) {
        const n = node as ProgramNode
        const body = n.body

        // Check each import that is followed by a non-import statement
        for (let i = 0; i < body.length - 1; i++) {
          const current = body[i]
          const next = body[i + 1]

          // If current is an import and next is NOT an import
          if (current.type === "ImportDeclaration" && next.type !== "ImportDeclaration") {
            // Check if there's a newline between import and next statement
            if (current.loc && next.loc) {
              const importEndLine = current.loc.end.line
              const nextStartLine = next.loc.start.line

              // Require at least one blank line (difference > 1)
              if (nextStartLine - importEndLine < 2) {
                context.report({
                  node: current,
                  message: "Expected 1 empty line after import statement not followed by another import"
                })
              }
            }
          }
        }
      }
    }
  }
}

export default rule
