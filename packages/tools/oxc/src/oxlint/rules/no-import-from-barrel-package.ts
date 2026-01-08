import * as fs from "node:fs"
import * as path from "node:path"
import type { Rule, RuleContext } from "../types.ts"

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
}

interface RuleOptions {
  // Regex patterns to match barrel imports (e.g., "^effect$", "^effect/[a-z]")
  checkPatterns?: Array<string>
  // Whether to check relative imports that resolve to index files
  checkRelativeIndexImports?: boolean
}

// Extensions to check when resolving imports
const extensions = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]

function getModuleName(specifier: ImportSpecifier): string | undefined {
  return specifier.imported.type === "Identifier"
    ? specifier.imported.name
    : specifier.imported.value
}

function isRelativeImport(source: string): boolean {
  return source.startsWith("./") || source.startsWith("../")
}

function hasIndexFile(dirPath: string): boolean {
  for (const ext of extensions) {
    if (fs.existsSync(path.join(dirPath, `index${ext}`))) {
      return true
    }
  }
  return false
}

function isIndexImport(importPath: string): boolean {
  const basename = path.basename(importPath)
  // Check if importing "index" directly or "index.ts" etc.
  return basename === "index" || /^index\.(ts|tsx|js|jsx|mts|cts|mjs|cjs)$/.test(basename)
}

function resolvesToBarrel(importSource: string, currentFile: string): boolean {
  const dir = path.dirname(currentFile)
  const resolved = path.resolve(dir, importSource)

  // Check if importing an index file directly
  if (isIndexImport(importSource)) {
    return true
  }

  // Check if importing a directory with index file
  if (hasIndexFile(resolved)) {
    return true
  }

  return false
}

function createBarrelMatcher(options: RuleOptions): (source: string, currentFile: string) => boolean {
  const patterns = (options.checkPatterns ?? []).map((p) => new RegExp(p))
  const checkRelative = options.checkRelativeIndexImports !== false

  return (source: string, currentFile: string): boolean => {
    // Check relative imports using file system
    if (isRelativeImport(source)) {
      return checkRelative && resolvesToBarrel(source, currentFile)
    }

    // Check regex patterns
    for (const pattern of patterns) {
      if (pattern.test(source)) {
        return true
      }
    }

    return false
  }
}

const rule: Rule = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow importing from barrel files (index.ts), encourage importing specific modules instead"
    },
    schema: [
      {
        type: "object",
        properties: {
          checkPatterns: {
            type: "array",
            items: { type: "string" },
            description: "Regex patterns to match barrel imports"
          },
          checkRelativeIndexImports: {
            type: "boolean",
            description: "Whether to check relative imports that resolve to index files"
          }
        },
        additionalProperties: false
      }
    ]
  },
  create(context: RuleContext) {
    const currentFile = context.filename
    const options: RuleOptions = (context.options[0] as RuleOptions) ?? {}
    const isBarrelImport = createBarrelMatcher(options)

    return {
      ImportDeclaration(node: unknown) {
        const n = node as ImportDeclaration
        // Skip type-only imports
        if (n.importKind === "type") return

        const importSource = n.source.value

        // Check if this import resolves to a barrel file
        if (!isBarrelImport(importSource, currentFile)) return

        // Separate specifiers by type
        const namespaceSpecifiers: Array<ImportSpecifier> = []
        const namedValueSpecifiers: Array<ImportSpecifier> = []

        for (const specifier of n.specifiers) {
          if (specifier.type === "ImportNamespaceSpecifier") {
            namespaceSpecifiers.push(specifier)
          } else if (specifier.type === "ImportSpecifier") {
            if (specifier.importKind !== "type") {
              namedValueSpecifiers.push(specifier)
            }
          }
        }

        // Report namespace imports
        for (const specifier of namespaceSpecifiers) {
          context.report({
            node: specifier,
            message:
              `Do not use namespace import from barrel file "${importSource}", import from specific modules instead`
          })
        }

        // Report named value imports
        for (const specifier of namedValueSpecifiers) {
          const moduleName = getModuleName(specifier)
          const localName = specifier.local.name
          const message = isRelativeImport(importSource)
            ? `Do not import "${moduleName}" from barrel file "${importSource}", import from specific module instead`
            : `Use import * as ${localName} from "${importSource}/${moduleName}" instead`
          context.report({
            node: specifier,
            message
          })
        }
      }
    }
  }
}

export default rule
