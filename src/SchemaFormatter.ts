/**
 * @since 4.0.0
 */
import * as Effect from "./Effect.js"
import { formatPath, formatUnknown } from "./internal/schema/util.js"
import * as Predicate from "./Predicate.js"
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

function formatInvalidIssue(issue: SchemaAST.InvalidIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  return `Invalid value ${formatUnknown(issue.actual)}`
}

function formatMismatchIssue(issue: SchemaAST.MismatchIssue): string {
  if (issue.message !== undefined) {
    return issue.message
  }
  return `Expected ${formatAST(issue.ast)}, actual ${formatUnknown(issue.actual)}`
}

function formatAST(ast: SchemaAST.AST): string {
  let out = String(ast)
  if (ast.refinements.length > 0) {
    out = `${out}${ast.refinements.map((r) => " & " + formatRefinement(r)).join("")}`
  }
  if (ast.transformations.length > 0) {
    out = `(${ast.transformations.map((t) => formatAST(t.from)).join(" <-> ")} <-> ${out})`
  }
  return out
}

function formatRefinement(refinement: SchemaAST.Refinement): string {
  const title = refinement.annotations.title
  return Predicate.isString(title) ? title : "<filter>"
}

function formatTransformation(transformation: SchemaAST.Transformation): string {
  const title = transformation.annotations.title
  return Predicate.isString(title) ? title : "<transformation>"
}

function formatTree(issue: SchemaAST.Issue): Tree<string> {
  switch (issue._tag) {
    case "MismatchIssue":
      return makeTree(formatMismatchIssue(issue))
    case "InvalidIssue":
      return makeTree(formatInvalidIssue(issue))
    case "CompositeIssue":
      return makeTree(formatAST(issue.ast), issue.issues.map(formatTree))
    case "PointerIssue":
      return makeTree(formatPath(issue.path), [formatTree(issue.issue)])
    case "RefinementIssue":
      return makeTree(formatRefinement(issue.refinement), [formatTree(issue.issue)])
    case "TransformationIssue":
      return makeTree(issue.isDecoding ? "decoding" : "encoding", [
        makeTree(formatTransformation(issue.transformation), [formatTree(issue.issue)])
      ])
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
