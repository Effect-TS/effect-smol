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
        // we expect node.superClass to be a CallExpression
        // whose callee is itself a CallExpression of Schema.Opaque
        if (!node.superClass || node.superClass.type !== "CallExpression") return false
        const inner = node.superClass.callee
        if (!inner || inner.type !== "CallExpression") return false
        const fn = inner.callee
        // fn should be MemberExpression: Schema.Opaque
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
      return {
        ClassDeclaration(node) {
          if (!isSchemaOpaqueExtension(node)) {
            return
          }

          // inside this class, any PropertyDefinition -> error
          for (const element of node.body.body) {
            if (element.type === "PropertyDefinition") {
              context.report({
                node: element,
                messageId: "noFields"
              })
            }
          }
        },
        // also catch class expressions if you use them:
        ClassExpression(node) {
          if (!isSchemaOpaqueExtension(node)) return

          for (const element of node.body.body) {
            if (element.type === "PropertyDefinition") {
              context.report({
                node: element,
                messageId: "noFields"
              })
            }
          }
        }
      }
    }
  }
}
