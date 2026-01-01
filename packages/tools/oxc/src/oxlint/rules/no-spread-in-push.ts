import type { Rule } from "../types.ts"

interface CallExpressionNode {
  callee: {
    type: string
    property?: { name: string }
  }
  arguments: Array<{ type: string }>
}

const rule: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow spread arguments in Array.push" }
  },
  create(context) {
    return {
      CallExpression(node: unknown) {
        const n = node as CallExpressionNode
        const callee = n.callee
        if (callee.type !== "MemberExpression") return
        if (callee.property?.name !== "push") return

        for (const arg of n.arguments) {
          if (arg.type === "SpreadElement") {
            context.report({
              node: arg,
              message: "Do not use spread arguments in Array.push"
            })
          }
        }
      }
    }
  }
}

export default rule
