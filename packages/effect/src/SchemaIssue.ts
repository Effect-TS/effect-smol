/**
 * @since 4.0.0
 */
import type { StandardSchemaV1 } from "@standard-schema/spec"
import { format, formatPath, type Formatter as FormatterI } from "./Formatter.ts"
import * as InternalAnnotations from "./internal/schema/annotations.ts"
import * as Option from "./Option.ts"
import { hasProperty } from "./Predicate.ts"
import * as Redacted from "./Redacted.ts"
import type * as Schema from "./Schema.ts"
import type * as AST from "./SchemaAST.ts"

const TypeId = "~effect/SchemaIssue/Issue"

/**
 * @since 4.0.0
 */
export function isIssue(u: unknown): u is Issue {
  return hasProperty(u, TypeId)
}

/**
 * @category model
 * @since 4.0.0
 */
export type Leaf =
  | InvalidType
  | InvalidValue
  | MissingKey
  | UnexpectedKey
  | Forbidden
  | OneOf

/**
 * @category model
 * @since 4.0.0
 */
export type Issue =
  | Leaf
  // composite
  | Filter
  | Encoding
  | Pointer
  | Composite
  | AnyOf

class Base {
  readonly [TypeId] = TypeId
  toString(this: Issue): string {
    return defaultFormatter(this)
  }
}

/**
 * Issue that occurs when a filter fails.
 *
 * @category model
 * @since 4.0.0
 */
export class Filter extends Base {
  readonly _tag = "Filter"
  /**
   * The input value that caused the issue.
   */
  readonly actual: unknown
  /**
   * The filter that failed.
   */
  readonly filter: AST.Filter<unknown>
  /**
   * The issue that occurred.
   */
  readonly issue: Issue

  constructor(
    /**
     * The input value that caused the issue.
     */
    actual: unknown,
    /**
     * The filter that failed.
     */
    filter: AST.Filter<any>,
    /**
     * The issue that occurred.
     */
    issue: Issue
  ) {
    super()
    this.actual = actual
    this.filter = filter
    this.issue = issue
  }
}

/**
 * Issue that occurs when a transformation fails.
 *
 * @category model
 * @since 4.0.0
 */
export class Encoding extends Base {
  readonly _tag = "Encoding"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The issue that occurred.
   */
  readonly issue: Issue

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The issue that occurred.
     */
    issue: Issue
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.issue = issue
  }
}

/**
 * Issue that points to a specific location in the input.
 *
 * @category model
 * @since 4.0.0
 */
export class Pointer extends Base {
  readonly _tag = "Pointer"
  /**
   * The path to the location in the input that caused the issue.
   */
  readonly path: ReadonlyArray<PropertyKey>
  /**
   * The issue that occurred.
   */
  readonly issue: Issue

  constructor(
    /**
     * The path to the location in the input that caused the issue.
     */
    path: ReadonlyArray<PropertyKey>,
    /**
     * The issue that occurred.
     */
    issue: Issue
  ) {
    super()
    this.path = path
    this.issue = issue
  }
}

/**
 * Issue that occurs when a required key or index is missing.
 *
 * @category model
 * @since 4.0.0
 */
export class MissingKey extends Base {
  readonly _tag = "MissingKey"
  /**
   * The metadata for the issue.
   */
  readonly annotations: Schema.Annotations.Key<unknown> | undefined

  constructor(
    /**
     * The metadata for the issue.
     */
    annotations: Schema.Annotations.Key<unknown> | undefined
  ) {
    super()
    this.annotations = annotations
  }
}

/**
 * Issue that occurs when an unexpected key or index is encountered.
 *
 * @category model
 * @since 4.0.0
 */
export class UnexpectedKey extends Base {
  readonly _tag = "UnexpectedKey"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: unknown

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: unknown
  ) {
    super()
    this.ast = ast
    this.actual = actual
  }
}

/**
 * Issue that contains multiple issues.
 *
 * @category model
 * @since 4.0.0
 */
export class Composite extends Base {
  readonly _tag = "Composite"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The issues that occurred.
   */
  readonly issues: readonly [Issue, ...Array<Issue>]

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The issues that occurred.
     */
    issues: readonly [Issue, ...Array<Issue>]
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.issues = issues
  }
}

/**
 * Issue that occurs when the type of the input is different from the expected
 * type.
 *
 * @category model
 * @since 4.0.0
 */
export class InvalidType extends Base {
  readonly _tag = "InvalidType"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.AST
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.AST,
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>
  ) {
    super()
    this.ast = ast
    this.actual = actual
  }
}

/**
 * Issue that occurs when the data of the input is invalid.
 *
 * @category model
 * @since 4.0.0
 */
export class InvalidValue extends Base {
  readonly _tag = "InvalidValue"
  /**
   * The value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The metadata for the issue.
   */
  readonly annotations: Schema.Annotations.Issue | undefined

  constructor(
    /**
     * The value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The metadata for the issue.
     */
    annotations?: Schema.Annotations.Issue | undefined
  ) {
    super()
    this.actual = actual
    this.annotations = annotations
  }
}

/**
 * Issue that occurs when a forbidden operation is encountered, such as when
 * encountering an Effect that is not allowed to execute (e.g., using
 * `runSync`).
 *
 * @category model
 * @since 4.0.0
 */
export class Forbidden extends Base {
  readonly _tag = "Forbidden"
  /**
   * The input value that caused the issue.
   */
  readonly actual: Option.Option<unknown>
  /**
   * The metadata for the issue.
   */
  readonly annotations: Schema.Annotations.Issue | undefined

  constructor(
    /**
     * The input value that caused the issue.
     */
    actual: Option.Option<unknown>,
    /**
     * The metadata for the issue.
     */
    annotations: Schema.Annotations.Issue | undefined
  ) {
    super()
    this.actual = actual
    this.annotations = annotations
  }
}

/**
 * Issue that occurs when a value does not match any of the schemas in the
 * union.
 *
 * @category model
 * @since 4.0.0
 */
export class AnyOf extends Base {
  readonly _tag = "AnyOf"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.Union
  /**
   * The input value that caused the issue.
   */
  readonly actual: unknown
  /**
   * The issues that occurred.
   */
  readonly issues: ReadonlyArray<Issue>

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.Union,
    /**
     * The input value that caused the issue.
     */
    actual: unknown,
    /**
     * The issues that occurred.
     */
    issues: ReadonlyArray<Issue>
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.issues = issues
  }
}

/**
 * Issue that occurs when a value matches multiple union members but the
 * schema is configured to only allow one.
 *
 * @category model
 * @since 4.0.0
 */
export class OneOf extends Base {
  readonly _tag = "OneOf"
  /**
   * The schema that caused the issue.
   */
  readonly ast: AST.Union
  /**
   * The input value that caused the issue.
   */
  readonly actual: unknown
  /**
   * The schemas that were successful.
   */
  readonly successes: ReadonlyArray<AST.AST>

  constructor(
    /**
     * The schema that caused the issue.
     */
    ast: AST.Union,
    /**
     * The input value that caused the issue.
     */
    actual: unknown,
    /**
     * The schemas that were successful.
     */
    successes: ReadonlyArray<AST.AST>
  ) {
    super()
    this.ast = ast
    this.actual = actual
    this.successes = successes
  }
}

/**
 * @since 4.0.0
 */
export function getActual(issue: Issue): Option.Option<unknown> {
  switch (issue._tag) {
    case "Pointer":
    case "MissingKey":
      return Option.none()
    case "InvalidType":
    case "InvalidValue":
    case "Forbidden":
    case "Encoding":
    case "Composite":
      return issue.actual
    case "AnyOf":
    case "UnexpectedKey":
    case "OneOf":
    case "Filter":
      return Option.some(issue.actual)
  }
}

/** @internal */
export function make(
  input: unknown,
  out: undefined | boolean | string | Issue | {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
  }
) {
  if (isIssue(out)) {
    return out
  }
  if (out === undefined) {
    return undefined
  }
  if (typeof out === "boolean") {
    return out ? undefined : new InvalidValue(Option.some(input))
  }
  if (typeof out === "string") {
    return new InvalidValue(Option.some(input), { message: out })
  }
  return new Pointer(
    out.path,
    new InvalidValue(Option.some(input), { message: out.message })
  )
}

/**
 * A `Formatter` for `Issue` objects.
 *
 * @category Formatter
 * @since 4.0.0
 */
export interface Formatter<out Format> extends FormatterI<Issue, Format> {}

/**
 * @category Formatter
 * @since 4.0.0
 */
export type LeafHook = (issue: Leaf) => string

/**
 * @category Formatter
 * @since 4.0.0
 */
export const defaultLeafHook: LeafHook = (issue): string => {
  const message = findMessage(issue)
  if (message !== undefined) return message
  switch (issue._tag) {
    case "InvalidType":
      return getExpectedMessage(InternalAnnotations.getExpected(issue.ast), formatOption(issue.actual))
    case "InvalidValue":
      return `Invalid data ${formatOption(issue.actual)}`
    case "MissingKey":
      return "Missing key"
    case "UnexpectedKey":
      return `Unexpected key with value ${format(issue.actual)}`
    case "Forbidden":
      return "Forbidden operation"
    case "OneOf":
      return `Expected exactly one member to match the input ${format(issue.actual)}`
  }
}

/**
 * @category Formatter
 * @since 4.0.0
 */
export type CheckHook = (issue: Filter) => string | undefined

/**
 * @category Formatter
 * @since 4.0.0
 */
export const defaultCheckHook: CheckHook = (issue): string | undefined => {
  return findMessage(issue.issue) ?? findMessage(issue)
}

/**
 * @category Formatter
 * @since 4.0.0
 */
export function makeFormatterStandardSchemaV1(options?: {
  readonly leafHook?: LeafHook | undefined
  readonly checkHook?: CheckHook | undefined
}): Formatter<StandardSchemaV1.FailureResult> {
  return (issue) => ({
    issues: toDefaultIssues(issue, [], options?.leafHook ?? defaultLeafHook, options?.checkHook ?? defaultCheckHook)
  })
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
  issue: Issue,
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
            message: getExpectedMessage(formatCheck(issue.filter), format(issue.actual))
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
      const message = findMessage(issue)
      if (issue.issues.length === 0) {
        if (message !== undefined) return [{ path, message }]

        const expected = getExpectedMessage(InternalAnnotations.getExpected(issue.ast), format(issue.actual))
        return [{ path, message: expected }]
      }
      return issue.issues.flatMap((issue) => toDefaultIssues(issue, path, leafHook, checkHook))
    }
    default:
      return [{ path, message: leafHook(issue) }]
  }
}

function formatCheck<T>(check: AST.Check<T>): string {
  const expected = check.annotations?.expected
  if (typeof expected === "string") return expected

  switch (check._tag) {
    case "Filter":
      return "<filter>"
    case "FilterGroup":
      return check.checks.map((check) => formatCheck(check)).join(" & ")
  }
}

/**
 * The default formatter used across the Effect ecosystem to keep the bundle
 * size small.
 *
 * @category Formatter
 * @since 4.0.0
 */
export function makeFormatterDefault(): Formatter<string> {
  return (issue) =>
    toDefaultIssues(issue, [], defaultLeafHook, defaultCheckHook)
      .map(formatDefaultIssue)
      .join("\n")
}

/** @internal */
export const defaultFormatter = makeFormatterDefault()

function formatDefaultIssue(issue: DefaultIssue): string {
  let out = issue.message
  if (issue.path && issue.path.length > 0) {
    const path = formatPath(issue.path as ReadonlyArray<PropertyKey>)
    out += `\n  at ${path}`
  }
  return out
}

function findMessage(issue: Issue): string | undefined {
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
      return getMessageAnnotation(issue.annotations, "messageMissingKey")
    case "UnexpectedKey":
      return getMessageAnnotation(issue.ast.annotations, "messageUnexpectedKey")
    case "Filter":
      return getMessageAnnotation(issue.filter.annotations)
    case "Encoding":
      return findMessage(issue.issue)
  }
}

function getMessageAnnotation(
  annotations: Schema.Annotations.Annotations | undefined,
  type: "message" | "messageMissingKey" | "messageUnexpectedKey" = "message"
): string | undefined {
  const message = annotations?.[type]
  if (typeof message === "string") return message
}

function formatOption(actual: Option.Option<unknown>): string {
  if (Option.isNone(actual)) return "no value provided"
  return format(actual.value)
}

/** @internal */
export function redact(issue: Issue): Issue {
  switch (issue._tag) {
    case "MissingKey":
      return issue
    case "Forbidden":
      return new Forbidden(Option.map(issue.actual, Redacted.make), issue.annotations)
    case "Filter":
      return new Filter(Redacted.make(issue.actual), issue.filter, redact(issue.issue))
    case "Pointer":
      return new Pointer(issue.path, redact(issue.issue))

    case "Encoding":
    case "InvalidType":
    case "InvalidValue":
    case "Composite":
      return new InvalidValue(Option.map(issue.actual, Redacted.make))

    case "AnyOf":
    case "OneOf":
    case "UnexpectedKey":
      return new InvalidValue(Option.some(Redacted.make(issue.actual)))
  }
}
