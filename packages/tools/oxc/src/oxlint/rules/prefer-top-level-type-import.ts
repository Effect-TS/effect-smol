import type { CreateRule, ESTree, Fixer, Visitor } from "oxlint"

/**
 * This rule enforces `import type { X }` over `import { type X }` for pure type imports.
 *
 * It only applies when ALL specifiers in an import are type-only. Mixed imports like
 * `import { type X, value }` are left unchanged.
 */
const rule: CreateRule = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Prefer top-level type imports (`import type { X }`) over inline type specifiers (`import { type X }`) for pure type imports"
    },
    fixable: "code"
  },
  create(context) {
    function handleImportDeclaration(node: ESTree.ImportDeclaration) {
      // Skip if already a type import
      if (node.importKind === "type") return

      // Only check imports with specifiers (not side-effect imports)
      const specifiers = node.specifiers
      if (specifiers.length === 0) return

      // Filter to only ImportSpecifier nodes (not default or namespace imports)
      const importSpecifiers = specifiers.filter(
        (s): s is ESTree.ImportSpecifier => s.type === "ImportSpecifier"
      )

      // If there are default or namespace imports mixed in, skip
      if (importSpecifiers.length !== specifiers.length) return

      // Check if ALL specifiers are type imports
      const allTypeImports = importSpecifiers.every((s) => s.importKind === "type")
      if (!allTypeImports) return

      // All specifiers are type-only, suggest using top-level type import
      const source = node.source.value
      const importNames = importSpecifiers.map((s) => {
        const imported = s.imported.type === "Identifier" ? s.imported.name : s.imported.value
        const local = s.local.name
        return imported === local ? imported : `${imported} as ${local}`
      })

      const fixedImport = `import type { ${importNames.join(", ")} } from "${source}"`

      context.report({
        node,
        message: "Use `import type { ... }` for pure type imports instead of `import { type ... }`",
        fix: (fixer: Fixer) => fixer.replaceTextRange(node.range, fixedImport)
      })
    }

    return {
      ImportDeclaration: handleImportDeclaration
    } as Visitor
  }
}

export default rule
