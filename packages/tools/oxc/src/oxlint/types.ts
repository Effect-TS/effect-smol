export interface RuleMeta {
  type: "problem" | "suggestion" | "layout"
  docs: { description: string }
  fixable?: "code" | "whitespace"
  schema?: unknown
}

export interface Fixer {
  insertTextAfter(node: unknown, text: string): unknown
  insertTextBefore(node: unknown, text: string): unknown
  replaceText(node: unknown, text: string): unknown
  replaceTextRange(range: [number, number], text: string): unknown
}

export interface RuleContext {
  id: string
  filename: string
  physicalFilename: string
  options: Array<unknown>
  getFilename(): string
  getCwd(): string
  report(options: {
    node: unknown
    message: string
    fix?: (fixer: Fixer) => unknown
  }): void
  sourceCode: {
    getText(node?: unknown): string
  }
}

export interface Rule {
  meta: RuleMeta
  create(context: RuleContext): Record<string, (node: unknown) => void>
}
