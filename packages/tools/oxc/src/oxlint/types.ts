export interface RuleMeta {
  type: "problem" | "suggestion" | "layout"
  docs: { description: string }
  fixable?: "code" | "whitespace"
}

export interface RuleContext {
  report(options: { node: unknown; message: string }): void
  sourceCode: {
    getText(node?: unknown): string
  }
}

export interface Rule {
  meta: RuleMeta
  create(context: RuleContext): Record<string, (node: unknown) => void>
}
