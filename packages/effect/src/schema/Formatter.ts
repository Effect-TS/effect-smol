/**
 * @since 4.0.0
 */
import type { StandardSchemaV1 } from "@standard-schema/spec"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as util from "../internal/schema/util.ts"
import type * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import * as Check from "./Check.ts"
import type * as Issue from "./Issue.ts"

/**
 * @category Model
 * @since 4.0.0
 */
export interface Formatter<Out> {
  readonly format: (issue: Issue.Issue) => Out
}

/** @internal */
export const formatUnknown = util.formatUnknown // TODO: make this public?

/**
 * @category Model
 * @since 4.0.0
 */
export type LeafHook = (issue: Issue.Leaf) => string

/**
 * @category LeafHook
 * @since 4.0.0
 */
export const defaultLeafHook: LeafHook = (issue): string => {
  const message = findMessage(issue)
  if (message !== undefined) return message
  switch (issue._tag) {
    case "InvalidType":
      return getExpectedMessage(AST.getExpected(issue.ast), formatUnknownOption(issue.actual))
    case "InvalidValue":
      return `Invalid data ${formatUnknownOption(issue.actual)}`
    case "MissingKey":
      return "Missing key"
    case "UnexpectedKey":
      return "Unexpected key"
    case "Forbidden":
      return "Forbidden operation"
    case "OneOf":
      return `Expected exactly one member to match the input ${formatUnknown(issue.actual)}`
  }
}

/**
 * @category Model
 * @since 4.0.0
 */
export type CheckHook = (issue: Issue.Filter) => string | undefined

/**
 * @category CheckHook
 * @since 4.0.0
 */
export const defaultCheckHook: CheckHook = (issue): string | undefined => {
  return findMessage(issue.issue) ?? findMessage(issue)
}

// -----------------------------------------------------------------------------
// makeStandardSchemaV1
// -----------------------------------------------------------------------------

/**
 * @category Formatter
 * @since 4.0.0
 */
export function makeStandardSchemaV1(options?: {
  readonly leafHook?: LeafHook | undefined
  readonly checkHook?: CheckHook | undefined
}): Formatter<StandardSchemaV1.FailureResult> {
  return {
    format: (issue) => ({
      issues: toDefaultIssues(issue, [], options?.leafHook ?? defaultLeafHook, options?.checkHook ?? defaultCheckHook)
    })
  }
}

// A subtype of StandardSchemaV1.Issue
type DefaultIssue = {
  readonly message: string
  readonly path: ReadonlyArray<PropertyKey>
}

function getExpectedMessage(expected: string, actual: string): string {
  return `Expected ${expected}, got ${actual}`
}

function toDefaultIssues(
  issue: Issue.Issue,
  path: ReadonlyArray<PropertyKey>,
  leafHook: LeafHook,
  checkHook: CheckHook
): Array<DefaultIssue> {
  switch (issue._tag) {
    case "Filter": {
      const message = checkHook(issue)
      if (message !== undefined) {
        return [{ path, message }]
      }
      switch (issue.issue._tag) {
        case "InvalidValue":
          return [{
            path,
            message: getExpectedMessage(formatCheck(issue.filter), formatUnknown(issue.actual))
          }]
        default:
          return toDefaultIssues(issue.issue, path, leafHook, checkHook)
      }
    }
    case "Encoding":
      return toDefaultIssues(issue.issue, path, leafHook, checkHook)
    case "Pointer":
      return toDefaultIssues(issue.issue, [...path, ...issue.path], leafHook, checkHook)
    case "Composite":
      return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook, checkHook))
    case "AnyOf": {
      if (issue.issues.length === 0) {
        return [{
          path,
          message: findMessage(issue) ??
            getExpectedMessage(AST.getExpected(issue.ast), formatUnknownOption(issue.actual))
        }]
      }
      return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook, checkHook))
    }
    default:
      return [{ path, message: leafHook(issue) }]
  }
}

function formatCheck<T>(filter: Check.Check<T>): string {
  const out = filter.annotations?.description ?? filter.annotations?.title
  if (Predicate.isString(out)) return out

  const brand = Check.getBrand(filter)
  if (brand !== undefined) return `Brand<"${String(brand)}">`

  switch (filter._tag) {
    case "Filter":
      return "<filter>"
    case "FilterGroup":
      return filter.checks.map((check) => formatCheck(check)).join(" & ")
  }
}

// -----------------------------------------------------------------------------
// makeDefault
// -----------------------------------------------------------------------------

/**
 * The default formatter used across the Effect ecosystem to keep the bundle
 * size small.
 *
 * @category Formatter
 * @since 4.0.0
 */
export function makeDefault(): Formatter<string> {
  return {
    format: (issue) =>
      toDefaultIssues(issue, [], defaultLeafHook, defaultCheckHook)
        .map(formatDefaultIssue)
        .join("\n")
  }
}

function formatDefaultIssue(issue: DefaultIssue): string {
  let out = issue.message
  if (issue.path && issue.path.length > 0) {
    const path = util.formatPath(issue.path as ReadonlyArray<PropertyKey>)
    out += `\n  at ${path}`
  }
  return out
}

function findMessage(issue: Issue.Issue): string | undefined {
  switch (issue._tag) {
    case "InvalidType":
    case "OneOf":
    case "Composite":
    case "AnyOf":
      return getMessageAnnotation(issue.ast.annotations)
    case "InvalidValue":
    case "Forbidden":
      return getMessageAnnotation(issue.annotations)
    case "MissingKey":
      return getMessageAnnotation(issue.annotations, "missingKeyMessage")
    case "UnexpectedKey":
      return getMessageAnnotation(issue.ast.annotations, "unexpectedKeyMessage")
    case "Filter":
      return getMessageAnnotation(issue.filter.annotations)
    case "Encoding":
      return findMessage(issue.issue)
  }
}

function getMessageAnnotation(
  annotations: Annotations.Annotations | undefined,
  type: "message" | "missingKeyMessage" | "unexpectedKeyMessage" = "message"
): string | undefined {
  const message = annotations?.[type]
  if (Predicate.isString(message)) return message
}

function formatUnknownOption(actual: Option.Option<unknown>): string {
  if (Option.isNone(actual)) return "no value provided"
  return formatUnknown(actual.value)
}
