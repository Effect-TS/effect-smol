/**
 * @since 4.0.0
 */
import * as Effect from "./Effect.js"
import { formatPath, formatUnknown } from "./internal/schema/util.js"
import type * as Result from "./Result.js"
import type * as SchemaAST from "./SchemaAST.js"

/**
 * @category Formatting
 * @since 4.0.0
 */
export interface SchemaFormatter<A> {
  readonly format: (issue: SchemaAST.Issue) => Result.Result<A> | Effect.Effect<A>
}

interface Forest<A> extends ReadonlyArray<Tree<A>> {}

interface Tree<A> {
  readonly value: A
  readonly forest: Forest<A>
}

const makeTree = <A>(value: A, forest: Forest<A> = []): Tree<A> => ({
  value,
  forest
})

const drawTree = (tree: Tree<string>): string => tree.value + draw("\n", tree.forest)

const draw = (indentation: string, forest: Forest<string>): string => {
  let r = ""
  const len = forest.length
  let tree: Tree<string>
  for (let i = 0; i < len; i++) {
    tree = forest[i]
    const isLast = i === len - 1
    r += indentation + (isLast ? "└" : "├") + "─ " + tree.value
    r += draw(indentation + (len > 1 && !isLast ? "│  " : "   "), tree.forest)
  }
  return r
}

function getValidationIssueMessage(issue: SchemaAST.ValidationIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  const expected = String(issue.ast)
  return `Expected ${expected}, actual ${formatUnknown(issue.actual)}`
}

function formatTree(issue: SchemaAST.Issue): Tree<string> {
  switch (issue._tag) {
    case "ValidationIssue":
      return makeTree(getValidationIssueMessage(issue))
    case "CompositeIssue":
      return makeTree(String(issue.ast), issue.issues.map(formatTree))
    case "PointerIssue":
      return makeTree(formatPath(issue.path), [formatTree(issue.issue)])
    case "RefinementIssue":
      return makeTree(String(issue.ast), [formatTree(issue.issue)])
    case "UnexpectedPropertyKeyIssue":
      return makeTree(`Unexpected property key`)
    default:
      return makeTree("TODO")
  }
}

/**
 * @category formatting
 * @since 3.10.0
 */
export const TreeFormatter: SchemaFormatter<string> = {
  format: (issue) => Effect.succeed(drawTree(formatTree(issue)))
}
