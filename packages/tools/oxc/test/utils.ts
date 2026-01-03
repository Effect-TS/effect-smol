import type { Rule, RuleContext } from "@effect/oxc/oxlint/types"

export interface ReportedError {
  node: unknown
  message: string
}

export interface TestContext {
  errors: Array<ReportedError>
  context: RuleContext
}

export const createTestContext = (sourceCode = ""): TestContext => {
  const errors: Array<ReportedError> = []
  const context: RuleContext = {
    report(options) {
      errors.push(options)
    },
    sourceCode: {
      getText(_node?: unknown) {
        return sourceCode
      }
    }
  }
  return { errors, context }
}

export const runRule = <T extends Record<string, (node: unknown) => void>>(
  rule: Rule,
  visitor: keyof T,
  node: unknown,
  sourceCode = ""
): Array<ReportedError> => {
  const { context, errors } = createTestContext(sourceCode)
  const visitors = rule.create(context)
  const handler = visitors[visitor as string]
  if (handler) {
    handler(node)
  }
  return errors
}
