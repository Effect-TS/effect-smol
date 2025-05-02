module.exports = {
  "no-opaque-instance-fields": {
    meta: {
      type: "problem",
      docs: {
        description: "disallow instance fields in classes extending Schema.Opaque(...)",
        category: "Best Practices",
        recommended: false
      },
      schema: [], // no options
      messages: {
        noFields: "Classes extending Schema.Opaque(...) must not declare instance fields."
      }
    },
    create(context) {
      // ----------------------------------------------------------------------
      // Helpers
      // ----------------------------------------------------------------------
      function isSchemaOpaqueExtension(node) {
        // expect node.superClass to be a CallExpression
        // whose callee is itself a CallExpression of Schema.Opaque
        const sc = node.superClass
        if (!sc || sc.type !== "CallExpression") return false
        const inner = sc.callee
        if (!inner || inner.type !== "CallExpression") return false
        const fn = inner.callee
        return (
          fn &&
          fn.type === "MemberExpression" &&
          fn.object.type === "Identifier" &&
          fn.object.name === "Schema" &&
          fn.property.type === "Identifier" &&
          fn.property.name === "Opaque"
        )
      }

      // ----------------------------------------------------------------------
      // Public
      // ----------------------------------------------------------------------
      function checkClass(node) {
        if (!isSchemaOpaqueExtension(node)) return

        for (const element of node.body.body) {
          // only report non-static property definitions
          if (
            element.type === "PropertyDefinition" &&
            element.static === false
          ) {
            context.report({
              node: element,
              messageId: "noFields"
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
}
