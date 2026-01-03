import type { Fixer, Rule, RuleContext } from "../types.ts"

interface ImportSpecifier {
  type: string
  importKind?: "type" | "value"
  imported: {
    type: string
    name?: string
    value?: string
  }
  local: {
    name: string
  }
}

interface ImportDeclaration {
  type: string
  importKind?: "type" | "value"
  source: {
    value: string
  }
  specifiers: Array<ImportSpecifier>
  range: [number, number]
}

const packageNames = ["effect"]

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow importing from barrel packages, encourage importing specific modules instead"
    },
    fixable: "code"
  },
  create(context: RuleContext) {
    return {
      ImportDeclaration(node: unknown) {
        const n = node as ImportDeclaration
        // Skip type-only imports
        if (n.importKind === "type") return

        const packageName = n.source.value
        if (!packageNames.includes(packageName)) return

        for (const specifier of n.specifiers) {
          // Only check named imports: import { A, B } from "foo"
          if (specifier.type !== "ImportSpecifier") continue
          // Skip type imports
          if (specifier.importKind === "type") continue

          const moduleName = specifier.imported.type === "Identifier"
            ? specifier.imported.name
            : specifier.imported.value
          const localName = specifier.local.name

          const message = `Use import * as ${localName} from "${packageName}/${moduleName}" instead`

          // Only auto-fix single specifiers
          if (n.specifiers.length === 1) {
            context.report({
              node: specifier,
              message,
              fix: (fixer: Fixer) =>
                fixer.replaceTextRange(
                  n.range,
                  `import * as ${localName} from "${packageName}/${moduleName}"`
                )
            })
          } else {
            context.report({
              node: specifier,
              message
            })
          }
        }
      }
    }
  }
}

export default rule
