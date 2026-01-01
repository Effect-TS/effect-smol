import type { Rule } from "../types.js"

interface PropertyNode {
  type: string
  shorthand?: boolean
  method?: boolean
  computed?: boolean
  key: {
    type: string
    name?: string
  }
  value: {
    type: string
    name?: string
  }
}

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: { description: "Require object literal shorthand syntax" },
    fixable: "code"
  },
  create(context) {
    return {
      Property(node: unknown) {
        const n = node as PropertyNode

        // Skip if already shorthand or is a method
        if (n.shorthand || n.method) return

        // Skip computed properties
        if (n.computed) return

        // Only check identifier keys and values
        if (n.key.type !== "Identifier" || n.value.type !== "Identifier") return

        // Check if key and value have the same name
        if (n.key.name === n.value.name) {
          context.report({
            node,
            message: "Expected property shorthand"
          })
        }
      }
    }
  }
}

export default rule
