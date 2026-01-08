import type { Rule } from "../types.ts"

interface ASTNode {
  type: string
  superClass?: {
    type: string
    callee?: {
      type: string
      callee?: {
        type: string
        object?: { type: string; name: string }
        property?: { type: string; name: string }
      }
    }
  }
  body: {
    body: Array<{ type: string; static: boolean }>
  }
}

function isSchemaOpaqueExtension(node: ASTNode): boolean {
  const sc = node.superClass
  if (!sc || sc.type !== "CallExpression") return false
  const inner = sc.callee
  if (!inner || inner.type !== "CallExpression") return false
  const fn = inner.callee
  return fn?.type === "MemberExpression" &&
    fn.object?.type === "Identifier" &&
    fn.object.name === "Schema" &&
    fn.property?.type === "Identifier" &&
    fn.property.name === "Opaque"
}

const rule: Rule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow instance fields in Schema.Opaque classes" }
  },
  create(context) {
    function checkClass(node: unknown) {
      const n = node as ASTNode
      if (!isSchemaOpaqueExtension(n)) return
      for (const element of n.body.body) {
        if (element.type === "PropertyDefinition" && !element.static) {
          context.report({
            node: element,
            message: "Classes extending Schema.Opaque must not have instance fields"
          })
        }
      }
    }

    return {
      ClassDeclaration: checkClass,
      ClassExpression: checkClass
    }
  }
}

export default rule
