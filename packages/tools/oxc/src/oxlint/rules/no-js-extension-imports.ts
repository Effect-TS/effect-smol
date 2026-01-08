import type { Fixer, Rule, RuleContext } from "../types.ts"

interface ImportOrExportDeclaration {
  type: string
  source: {
    value: string
    range: [number, number]
  }
  range: [number, number]
}

const jsExtensions = [".js", ".jsx", ".mjs", ".cjs"]
const extensionMap: Record<string, string> = {
  ".js": ".ts",
  ".jsx": ".tsx",
  ".mjs": ".mts",
  ".cjs": ".cts"
}

function isRelativeImport(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../")
}

function getJsExtension(source: string): string | undefined {
  for (const ext of jsExtensions) {
    if (source.endsWith(ext)) {
      return ext
    }
  }
  return undefined
}

const rule: Rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow .js, .jsx, .mjs and .cjs extensions in relative imports, use .ts, .tsx, .mts or .cts instead"
    },
    fixable: "code"
  },
  create(context: RuleContext) {
    function checkImportSource(node: unknown) {
      const n = node as ImportOrExportDeclaration
      if (!n.source) return

      const source = n.source.value
      if (!isRelativeImport(source)) return

      const ext = getJsExtension(source)
      if (!ext) return

      const tsExt = extensionMap[ext]
      const fixedSource = source.slice(0, -ext.length) + tsExt

      context.report({
        node: n.source,
        message: `Use "${tsExt}" extension instead of "${ext}" for relative imports`,
        fix: (fixer: Fixer) => fixer.replaceTextRange(n.source.range, `"${fixedSource}"`)
      })
    }

    return {
      ImportDeclaration: checkImportSource,
      ExportAllDeclaration: checkImportSource,
      ExportNamedDeclaration: checkImportSource
    }
  }
}

export default rule
