import type { CreateRule, ESTree, Visitor } from "oxlint"

function isSchemaOpaqueExtension(node: ESTree.Class): boolean {
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

const rule: CreateRule = {
  meta: {
    type: "problem",
    docs: { description: "Disallow instance fields in Schema.Opaque classes" }
  },
  create(context) {
    function checkClass(node: ESTree.Class) {
      if (!isSchemaOpaqueExtension(node)) return
      for (const element of node.body.body) {
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
    } as Visitor
  }
}

export default rule
