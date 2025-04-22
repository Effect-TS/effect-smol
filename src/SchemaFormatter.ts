/**
 * @since 4.0.0
 */

import { formatPath, formatUnknown } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as SchemaAST from "./SchemaAST.js"

/**
 * @category Formatting
 * @since 4.0.0
 */
export interface SchemaFormatter<Out> {
  readonly format: (issue: SchemaAST.Issue) => Out
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

function formatInvalidIssue(issue: SchemaAST.InvalidIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  if (Option.isNone(issue.actual)) {
    return "No value provided"
  }
  return `Invalid value ${formatUnknown(issue.actual.value)}`
}

function formatMismatchIssue(issue: SchemaAST.MismatchIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  if (Option.isNone(issue.actual)) {
    return `Expected ${SchemaAST.format(issue.ast)} but no value was provided`
  }
  return `Expected ${SchemaAST.format(issue.ast)}, actual ${formatUnknown(issue.actual.value)}`
}

function formatTree(issue: SchemaAST.Issue): Tree<string> {
  switch (issue._tag) {
    case "MismatchIssue":
      return makeTree(formatMismatchIssue(issue))
    case "InvalidIssue":
      return makeTree(formatInvalidIssue(issue))
    case "CompositeIssue":
      return makeTree(SchemaAST.format(issue.ast), issue.issues.map(formatTree))
    case "PointerIssue":
      return makeTree(formatPath(issue.path), [formatTree(issue.issue)])
    case "FilterIssue":
      return makeTree(SchemaAST.formatFilter(issue.filter), [formatTree(issue.issue)])
    case "EncodingIssue":
      return makeTree("decoding / encoding failure", [formatTree(issue.issue)])
    case "UnexpectedIssue":
      return makeTree("Unexpected value")
    case "MissingIssue":
      return makeTree("Missing value")
    case "ForbiddenIssue":
      return makeTree("Forbidden operation")
  }
}

/**
 * @category formatting
 * @since 4.0.0
 */
export const TreeFormatter: SchemaFormatter<string> = {
  format: (issue) => drawTree(formatTree(issue))
}
