import type { Rule, RuleContext } from "@effect/oxc/oxlint/types"

export interface ReportedError {
  node: unknown
  message: string
}

export interface TestContext {
  errors: Array<ReportedError>
  context: RuleContext
}

export interface TestContextOptions {
  sourceCode?: string
  filename?: string
  cwd?: string
  ruleOptions?: Array<unknown>
}

export const createTestContext = (options: TestContextOptions = {}): TestContext => {
  const {
    sourceCode = "",
    filename = "/test/file.ts",
    cwd = "/test",
    ruleOptions = []
  } = options

  const errors: Array<ReportedError> = []
  const context: RuleContext = {
    id: "test/rule",
    filename,
    physicalFilename: filename,
    options: ruleOptions,
    getFilename: () => filename,
    getCwd: () => cwd,
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
  options: TestContextOptions = {}
): Array<ReportedError> => {
  const { context, errors } = createTestContext(options)
  const visitors = rule.create(context)
  const handler = visitors[visitor as string]
  if (handler) {
    handler(node)
  }
  return errors
}
