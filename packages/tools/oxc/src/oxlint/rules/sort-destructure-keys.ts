import type { Rule } from "../types.js"

const rule: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Require sorted destructure keys" },
    fixable: "code"
  },
  create(context) {
    return {
      ObjectPattern(node: unknown) {
        const n = node as { properties: Array<{ type: string; key: { type: string; name: string } }> }
        const props = n.properties.filter(
          (p) => p.type === "Property" && p.key.type === "Identifier"
        )
        const keys = props.map((p) => p.key.name)
        const sorted = [...keys].sort()

        for (let i = 0; i < keys.length; i++) {
          if (keys[i] !== sorted[i]) {
            context.report({
              node,
              message: "Destructure keys should be sorted alphabetically"
            })
            break
          }
        }
      }
    }
  }
}

export default rule
