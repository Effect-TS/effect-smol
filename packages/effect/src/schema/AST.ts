/**
 * @since 4.0.0
 */

import * as Cause from "../Cause.ts"
import * as Arr from "../collections/Array.ts"
import type * as Combiner from "../data/Combiner.ts"
import * as Filter_ from "../data/Filter.ts"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Result from "../data/Result.ts"
import * as Effect from "../Effect.ts"
import type * as Exit from "../Exit.ts"
import { memoize } from "../Function.ts"
import { format, formatPropertyKey } from "../interfaces/Inspectable.ts"
import * as Pipeable from "../interfaces/Pipeable.ts"
import { effectIsExit } from "../internal/effect.ts"
import * as internalRecord from "../internal/record.ts"
import * as RegEx from "../RegExp.ts"
import * as Annotations from "./Annotations.ts"
import * as Getter from "./Getter.ts"
import * as Issue from "./Issue.ts"
import type * as Parser from "./Parser.ts"
import type * as Schema from "./Schema.ts"
import * as Transformation from "./Transformation.ts"

/**
 * @category model
 * @since 4.0.0
 */
export type AST =
  | Declaration
  | Null
  | Undefined
  | Void
  | Never
  | Unknown
  | Any
  | String
  | Number
  | Boolean
  | BigInt
  | Symbol
  | Literal
  | UniqueSymbol
  | ObjectKeyword
  | Enum
  | TemplateLiteral
  | Arrays
  | Objects
  | Union
  | Suspend

function makeGuard<T extends AST["_tag"]>(tag: T) {
  return (ast: AST): ast is Extract<AST, { _tag: T }> => ast._tag === tag
}

/**
 * @category Guard
 * @since 4.0.0
 */
export const isDeclaration = makeGuard("Declaration")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isNull = makeGuard("Null")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isUndefined = makeGuard("Undefined")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isVoid = makeGuard("Void")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isNever = makeGuard("Never")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isUnknown = makeGuard("Unknown")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isAny = makeGuard("Any")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isString = makeGuard("String")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isNumber = makeGuard("Number")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isBoolean = makeGuard("Boolean")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isBigInt = makeGuard("BigInt")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isSymbol = makeGuard("Symbol")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isLiteral = makeGuard("Literal")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isUniqueSymbol = makeGuard("UniqueSymbol")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isObjectKeyword = makeGuard("ObjectKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isEnum = makeGuard("Enum")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isTemplateLiteral = makeGuard("TemplateLiteral")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isArrays = makeGuard("Arrays")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isObjects = makeGuard("Objects")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isUnion = makeGuard("Union")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isSuspend = makeGuard("Suspend")

/**
 * @category model
 * @since 4.0.0
 */
export class Link {
  readonly to: AST
  readonly transformation:
    | Transformation.Transformation<any, any, any, any>
    | Transformation.Middleware<any, any, any, any, any, any>

  constructor(
    to: AST,
    transformation:
      | Transformation.Transformation<any, any, any, any>
      | Transformation.Middleware<any, any, any, any, any, any>
  ) {
    this.to = to
    this.transformation = transformation
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Encoding = readonly [Link, ...Array<Link>]

/**
 * @category model
 * @since 4.0.0
 */
export interface ParseOptions {
  /**
   * The `errors` option allows you to receive all parsing errors when
   * attempting to parse a value using a schema. By default only the first error
   * is returned, but by setting the `errors` option to `"all"`, you can receive
   * all errors that occurred during the parsing process. This can be useful for
   * debugging or for providing more comprehensive error messages to the user.
   *
   * default: "first"
   */
  readonly errors?: "first" | "all" | undefined

  /**
   * When using a `Objects` to parse a value, by default any properties that
   * are not specified in the schema will be stripped out from the output. This
   * is because the `Objects` is expecting a specific shape for the parsed
   * value, and any excess properties do not conform to that shape.
   *
   * However, you can use the `onExcessProperty` option (default value:
   * `"ignore"`) to trigger a parsing error. This can be particularly useful in
   * cases where you need to detect and handle potential errors or unexpected
   * values.
   *
   * If you want to allow excess properties to remain, you can use
   * `onExcessProperty` set to `"preserve"`.
   *
   * default: "ignore"
   */
  readonly onExcessProperty?: "ignore" | "error" | "preserve" | undefined

  /**
   * The `propertyOrder` option provides control over the order of object fields
   * in the output. This feature is useful when the sequence of keys is
   * important for the consuming processes or when maintaining the input order
   * enhances readability and usability.
   *
   * By default, the `propertyOrder` option is set to `"none"`. This means that
   * the internal system decides the order of keys to optimize parsing speed.
   * The order of keys in this mode should not be considered stable, and it's
   * recommended not to rely on key ordering as it may change in future updates
   * without notice.
   *
   * Setting `propertyOrder` to `"original"` ensures that the keys are ordered
   * as they appear in the input during the decoding/encoding process.
   *
   * default: "none"
   */
  readonly propertyOrder?: "none" | "original" | undefined
}

/** @internal */
export const defaultParseOptions: ParseOptions = {}

/**
 * @category model
 * @since 4.0.0
 */
export class Context {
  readonly isOptional: boolean
  readonly isMutable: boolean
  /** Used for constructor default values (e.g. `withConstructorDefault` API) */
  readonly defaultValue: Encoding | undefined
  readonly annotations: Annotations.Key<unknown> | undefined

  constructor(
    isOptional: boolean,
    isMutable: boolean,
    /** Used for constructor default values (e.g. `withConstructorDefault` API) */
    defaultValue: Encoding | undefined = undefined,
    annotations: Annotations.Key<unknown> | undefined = undefined
  ) {
    this.isOptional = isOptional
    this.isMutable = isMutable
    this.defaultValue = defaultValue
    this.annotations = annotations
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Checks = readonly [Check<any>, ...Array<Check<any>>]

/**
 * @category model
 * @since 4.0.0
 */
export abstract class Base {
  readonly annotations: Annotations.Annotations | undefined
  readonly checks: Checks | undefined
  readonly encoding: Encoding | undefined
  readonly context: Context | undefined

  constructor(
    annotations: Annotations.Annotations | undefined = undefined,
    checks: Checks | undefined = undefined,
    encoding: Encoding | undefined = undefined,
    context: Context | undefined = undefined
  ) {
    this.annotations = annotations
    this.checks = checks
    this.encoding = encoding
    this.context = context
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Declaration extends Base {
  readonly _tag = "Declaration"
  readonly typeParameters: ReadonlyArray<AST>
  readonly run: (
    typeParameters: ReadonlyArray<AST>
  ) => (input: unknown, self: Declaration, options: ParseOptions) => Effect.Effect<any, Issue.Issue, any>

  constructor(
    typeParameters: ReadonlyArray<AST>,
    run: (
      typeParameters: ReadonlyArray<AST>
    ) => (input: unknown, self: Declaration, options: ParseOptions) => Effect.Effect<any, Issue.Issue, any>,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.typeParameters = typeParameters
    this.run = run
  }
  /** @internal */
  getParser(): Parser.Parser {
    const run = this.run(this.typeParameters)
    return (oinput, options) => {
      if (Option.isNone(oinput)) return Effect.succeedNone
      return Effect.mapEager(run(oinput.value, this, options), Option.some)
    }
  }
  /** @internal */
  recur(recur: (ast: AST) => AST) {
    const tps = mapOrSame(this.typeParameters, recur)
    return tps === this.typeParameters ?
      this :
      new Declaration(tps, this.run, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  getExpected(): string {
    // Annotations on checks are ignored internally
    const expected = this.annotations?.identifier ?? this.annotations?.title ?? this.annotations?.expected
    if (typeof expected === "string") return expected
    return "<Declaration>"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Null extends Base {
  readonly _tag = "Null"
  /** @internal */
  getParser() {
    return fromConst(this, null)
  }
  /** @internal */
  getExpected(): string {
    return "null"
  }
}

const null_ = new Null()
export {
  /**
   * @since 4.0.0
   */
  null_ as null
}

/**
 * @category model
 * @since 4.0.0
 */
export class Undefined extends Base {
  readonly _tag = "Undefined"
  /** @internal */
  getParser() {
    return fromConst(this, undefined)
  }
  /** @internal */
  encodeToNull(): AST {
    return replaceEncoding(this, [undefinedToNull])
  }
  /** @internal */
  getExpected(): string {
    return "undefined"
  }
}

const undefinedToNull = new Link(
  null_,
  new Transformation.Transformation(
    Getter.transform(() => undefined),
    Getter.transform(() => null)
  )
)

const undefined_ = new Undefined()
export {
  /**
   * @since 4.0.0
   */
  undefined_ as undefined
}

/**
 * @category model
 * @since 4.0.0
 */
export class Void extends Base {
  readonly _tag = "Void"
  /** @internal */
  getParser() {
    return fromConst(this, undefined)
  }
  /** @internal */
  encodeToNull(): AST {
    return replaceEncoding(this, [undefinedToNull])
  }
  /** @internal */
  getExpected(): string {
    return "void"
  }
}

const void_ = new Void()
export {
  /**
   * @since 4.0.0
   */
  void_ as void
}

/**
 * @category model
 * @since 4.0.0
 */
export class Never extends Base {
  readonly _tag = "Never"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isNever)
  }
  /** @internal */
  getExpected(): string {
    return "never"
  }
}

/**
 * @since 4.0.0
 */
export const never = new Never()

/**
 * @category model
 * @since 4.0.0
 */
export class Any extends Base {
  readonly _tag = "Any"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isUnknown)
  }
  /** @internal */
  getExpected(): string {
    return "any"
  }
}

/**
 * @since 4.0.0
 */
export const any = new Any()

/**
 * @category model
 * @since 4.0.0
 */
export class Unknown extends Base {
  readonly _tag = "Unknown"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isUnknown)
  }
  /** @internal */
  getExpected(): string {
    return "unknown"
  }
}

/**
 * @since 4.0.0
 */
export const unknown = new Unknown()

/**
 * @category model
 * @since 4.0.0
 */
export class ObjectKeyword extends Base {
  readonly _tag = "ObjectKeyword"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isObjectKeyword)
  }
  /** @internal */
  getExpected(): string {
    return "object | array | function"
  }
}

/**
 * @since 4.0.0
 */
export const objectKeyword = new ObjectKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class Enum extends Base {
  readonly _tag = "Enum"
  readonly enums: ReadonlyArray<readonly [string, string | number]>

  constructor(
    enums: ReadonlyArray<readonly [string, string | number]>,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.enums = enums
  }
  /** @internal */
  getParser() {
    const values = new Set<unknown>(this.enums.map(([, v]) => v))
    return fromRefinement(
      this,
      (input): input is typeof this.enums[number][1] => values.has(input)
    )
  }
  /** @internal */
  encodeToString(): AST {
    if (this.enums.some(([_, v]) => typeof v === "number")) {
      const coercions = Object.fromEntries(this.enums.map(([_, v]) => [globalThis.String(v), v]))
      return replaceEncoding(this, [
        new Link(
          new Union(Object.keys(coercions).map((k) => new Literal(k)), "anyOf"),
          new Transformation.Transformation(
            Getter.transform((s) => coercions[s]),
            Getter.String()
          )
        )
      ])
    }
    return this
  }
  /** @internal */
  getExpected(): string {
    return this.enums.map(([_, value]) => JSON.stringify(value)).join(" | ")
  }
}

type TemplateLiteralPart =
  | String
  | Number
  | BigInt
  | Literal
  | TemplateLiteral
  | Union<TemplateLiteralPart>

function isTemplateLiteralPart(ast: AST): ast is TemplateLiteralPart {
  switch (ast._tag) {
    case "String":
    case "Number":
    case "BigInt":
    case "Literal":
    case "TemplateLiteral":
      return true
    case "Union":
      return ast.types.every(isTemplateLiteralPart)
    default:
      return false
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TemplateLiteral extends Base {
  readonly _tag = "TemplateLiteral"
  readonly parts: ReadonlyArray<AST>
  /** @internal */
  readonly encodedParts: ReadonlyArray<TemplateLiteralPart>

  constructor(
    parts: ReadonlyArray<AST>,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    const encodedParts: Array<TemplateLiteralPart> = []
    for (const part of parts) {
      const encoded = encodedAST(part)
      if (isTemplateLiteralPart(encoded)) {
        encodedParts.push(encoded)
      } else {
        throw new Error(`Invalid TemplateLiteral part ${encoded._tag}`)
      }
    }
    this.parts = parts
    this.encodedParts = encodedParts
  }
  /** @internal */
  getParser(recur: (ast: AST) => Parser.Parser): Parser.Parser {
    const parser = recur(this.asTemplateLiteralParser())
    return (oinput: Option.Option<unknown>, options: ParseOptions) =>
      Effect.mapBothEager(parser(oinput, options), {
        onSuccess: () => oinput,
        onFailure: (issue) => new Issue.Composite(this, oinput, [issue])
      })
  }
  /** @internal */
  getExpected(): string {
    return "string"
  }
  /** @internal */
  asTemplateLiteralParser(): Arrays {
    const tuple = new Arrays(false, this.parts.map(templateLiteralPartFromString), [])
    const regex = getTemplateLiteralRegExp(this)
    return decodeTo(
      string,
      tuple,
      new Transformation.Transformation(
        Getter.transformOrFail((s: string) => {
          const match = regex.exec(s)
          if (match) return Effect.succeed(match.slice(1, this.parts.length + 1))
          return Effect.fail(
            new Issue.InvalidValue(Option.some(s), {
              message: `Expected a value matching ${regex.source}, got ${format(s)}`
            })
          )
        }),
        Getter.transform((parts) => parts.join(""))
      )
    )
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class UniqueSymbol extends Base {
  readonly _tag = "UniqueSymbol"
  readonly symbol: symbol

  constructor(
    symbol: symbol,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.symbol = symbol
  }
  /** @internal */
  getParser() {
    return fromConst(this, this.symbol)
  }
  /** @internal */
  encodeToString(): AST {
    return replaceEncoding(this, [symbolToString])
  }
  /** @internal */
  getExpected(): string {
    return globalThis.String(this.symbol)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type LiteralValue = string | number | boolean | bigint

/**
 * @category model
 * @since 4.0.0
 */
export class Literal extends Base {
  readonly _tag = "Literal"
  readonly literal: LiteralValue

  constructor(
    literal: LiteralValue,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    if (typeof literal === "number" && !globalThis.Number.isFinite(literal)) {
      throw new Error(`LiteralType must be a finite number, got: ${literal}`)
    }
    this.literal = literal
  }
  /** @internal */
  getParser() {
    return fromConst(this, this.literal)
  }
  /** @internal */
  encodeToJson(): AST {
    return typeof this.literal === "bigint" ? literalToString(this) : this
  }
  /** @internal */
  encodeToString(): AST {
    return typeof this.literal === "string" ? this : literalToString(this)
  }
  /** @internal */
  getExpected(): string {
    return typeof this.literal === "string" ? JSON.stringify(this.literal) : globalThis.String(this.literal)
  }
}

function literalToString(ast: Literal): Literal {
  const literalAsString = globalThis.String(ast.literal)
  return replaceEncoding(ast, [
    new Link(
      new Literal(literalAsString),
      new Transformation.Transformation(
        Getter.transform(() => ast.literal),
        Getter.transform(() => literalAsString)
      )
    )
  ])
}

/**
 * @category model
 * @since 4.0.0
 */
export class String extends Base {
  readonly _tag = "String"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isString)
  }
  /** @internal */
  getExpected(): string {
    return "string"
  }
}

/**
 * @since 4.0.0
 */
export const string = new String()

/**
 * **Default Json Serializer**
 *
 * - If the number is finite, it is serialized as a number.
 * - If the number is infinite or NaN, it is serialized as a string.
 *
 * @category model
 * @since 4.0.0
 */
export class Number extends Base {
  readonly _tag = "Number"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isNumber)
  }
  /** @internal */
  encodeToNumberOrNonFiniteLiterals(): AST {
    return replaceEncoding(this, [numberToNumberOrNonFiniteLiterals])
  }
  /** @internal */
  encodeToString(): AST {
    return replaceEncoding(this, [numberToString])
  }
  /** @internal */
  getExpected(): string {
    return "number"
  }
}

/**
 * @since 4.0.0
 */
export const number = new Number()

/**
 * @category model
 * @since 4.0.0
 */
export class Boolean extends Base {
  readonly _tag = "Boolean"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isBoolean)
  }
  /** @internal */
  getExpected(): string {
    return "boolean"
  }
}

/**
 * @since 4.0.0
 */
export const boolean = new Boolean()

/**
 * @category model
 * @since 4.0.0
 */
export class Symbol extends Base {
  readonly _tag = "Symbol"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isSymbol)
  }
  /** @internal */
  encodeToString(): AST {
    return replaceEncoding(this, [symbolToString])
  }
  /** @internal */
  getExpected(): string {
    return "symbol"
  }
}

/**
 * @since 4.0.0
 */
export const symbol = new Symbol()

/**
 * @category model
 * @since 4.0.0
 */
export class BigInt extends Base {
  readonly _tag = "BigInt"
  /** @internal */
  getParser() {
    return fromRefinement(this, Predicate.isBigInt)
  }
  /** @internal */
  encodeToString(): AST {
    return replaceEncoding(this, [bigIntToString])
  }
  /** @internal */
  getExpected(): string {
    return "bigint"
  }
}

/**
 * @since 4.0.0
 */
export const bigInt = new BigInt()

/**
 * Describes both tuples and arrays.
 *
 * @category model
 * @since 4.0.0
 */
export class Arrays extends Base {
  readonly _tag = "Arrays"
  readonly isMutable: boolean
  readonly elements: ReadonlyArray<AST>
  readonly rest: ReadonlyArray<AST>

  constructor(
    isMutable: boolean,
    elements: ReadonlyArray<AST>,
    rest: ReadonlyArray<AST>,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.isMutable = isMutable
    this.elements = elements
    this.rest = rest

    // A required element cannot follow an optional element. ts(1257)
    const i = elements.findIndex(isOptional)
    if (i !== -1 && (elements.slice(i + 1).some((e) => !isOptional(e)) || rest.length > 1)) {
      throw new Error("A required element cannot follow an optional element. ts(1257)")
    }

    // An optional element cannot follow a rest element.ts(1266)
    if (rest.length > 1 && rest.slice(1).some(isOptional)) {
      throw new Error("An optional element cannot follow a rest element. ts(1266)")
    }
  }
  /** @internal */
  getParser(recur: (ast: AST) => Parser.Parser): Parser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    const elements = ast.elements.map((ast) => ({ ast, parser: recur(ast) }))
    const rest = ast.rest.map((ast) => ({ ast, parser: recur(ast) }))
    const elementLen = elements.length
    return Effect.fnUntracedEager(function*(oinput, options) {
      if (oinput._tag === "None") {
        return oinput
      }
      const input = oinput.value

      // If the input is not an array, return early with an error
      if (!Array.isArray(input)) {
        return yield* Effect.fail(new Issue.InvalidType(ast, oinput))
      }

      const output: Array<unknown> = []
      let issues: Arr.NonEmptyArray<Issue.Issue> | undefined
      const errorsAllOption = options.errors === "all"

      let i = 0
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      for (; i < elementLen; i++) {
        const e = elements[i]
        const value = i < input.length ? Option.some(input[i]) : Option.none()
        const eff = e.parser(value, options)
        const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
        if (exit._tag === "Failure") {
          const issueElement = Cause.filterError(exit.cause)
          if (Filter_.isFail(issueElement)) {
            return yield* exit
          }
          const issue = new Issue.Pointer([i], issueElement)
          if (errorsAllOption) {
            if (issues) issues.push(issue)
            else issues = [issue]
          } else {
            return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
          }
        } else if (exit.value._tag === "Some") {
          output[i] = exit.value.value
        } else if (!isOptional(e.ast)) {
          const issue = new Issue.Pointer([i], new Issue.MissingKey(e.ast.context?.annotations))
          if (errorsAllOption) {
            if (issues) issues.push(issue)
            else issues = [issue]
          } else {
            return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
          }
        }
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      const len = input.length
      if (ast.rest.length > 0) {
        const [head, ...tail] = rest
        const keyAnnotations = head.ast.context?.annotations
        for (; i < len - tail.length; i++) {
          const eff = head.parser(Option.some(input[i]), options)
          const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
          if (exit._tag === "Failure") {
            const issueRest = Cause.filterError(exit.cause)
            if (Filter_.isFail(issueRest)) {
              return yield* exit
            }
            const issue = new Issue.Pointer([i], issueRest)
            if (errorsAllOption) {
              if (issues) issues.push(issue)
              else issues = [issue]
            } else {
              return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
            }
          } else if (exit.value._tag === "Some") {
            output[i] = exit.value.value
          } else {
            const issue = new Issue.Pointer([i], new Issue.MissingKey(keyAnnotations))
            if (errorsAllOption) {
              if (issues) issues.push(issue)
              else issues = [issue]
            } else {
              return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
            }
          }
        }
        // ---------------------------------------------
        // handle post rest elements
        // ---------------------------------------------
        for (let j = 0; j < tail.length; j++) {
          if (len < i + 1) {
            continue
          } else {
            const tailj = tail[j]
            const keyAnnotations = tailj.ast.context?.annotations
            const eff = tailj.parser(Option.some(input[i]), options)
            const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
            if (exit._tag === "Failure") {
              const issueRest = Cause.filterError(exit.cause)
              if (Filter_.isFail(issueRest)) {
                return yield* exit
              }
              const issue = new Issue.Pointer([i], issueRest)
              if (errorsAllOption) {
                if (issues) issues.push(issue)
                else issues = [issue]
              } else {
                return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
              }
            } else if (exit.value._tag === "Some") {
              output[i] = exit.value.value
            } else {
              const issue = new Issue.Pointer([i], new Issue.MissingKey(keyAnnotations))
              if (errorsAllOption) {
                if (issues) issues.push(issue)
                else issues = [issue]
              } else {
                return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
              }
            }
          }
        }
      } else {
        // ---------------------------------------------
        // handle excess indexes
        // ---------------------------------------------
        for (let i = elementLen; i <= len - 1; i++) {
          const issue = new Issue.Pointer([i], new Issue.UnexpectedKey(ast, input[i]))
          if (errorsAllOption) {
            if (issues) issues.push(issue)
            else issues = [issue]
          } else {
            return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
          }
        }
      }
      if (issues) {
        return yield* Effect.fail(new Issue.Composite(ast, oinput, issues))
      }
      return Option.some(output)
    })
  }
  /** @internal */
  recur(recur: (ast: AST) => AST) {
    const elements = mapOrSame(this.elements, recur)
    const rest = mapOrSame(this.rest, recur)
    return elements === this.elements && rest === this.rest ?
      this :
      new Arrays(this.isMutable, elements, rest, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  getExpected(): string {
    return "array"
  }
}

function getIndexSignatureHash(ast: AST): string {
  if (isTemplateLiteral(ast)) {
    return ast.parts.map((part) =>
      isLiteral(part) ? globalThis.String(part.literal) : `\${${getIndexSignatureHash(part)}}`
    )
      .join("")
  }
  return ast._tag
}

/** @internal */
export function getIndexSignatureKeys(
  input: { readonly [x: PropertyKey]: unknown },
  parameter: AST
): ReadonlyArray<PropertyKey> {
  const p = encodedAST(parameter)
  switch (p._tag) {
    case "TemplateLiteral": {
      const regex = getTemplateLiteralRegExp(p)
      return Object.keys(input).filter((key) => regex.test(key))
    }
    case "Symbol":
      return Object.getOwnPropertySymbols(input)
    case "Number":
      return Object.keys(input).filter((key) => isNumberStringRegExp.test(key))
    default:
      return Object.keys(input)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class PropertySignature {
  readonly name: PropertyKey
  readonly type: AST

  constructor(
    name: PropertyKey,
    type: AST
  ) {
    this.name = name
    this.type = type
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class KeyValueCombiner {
  readonly decode: Combiner.Combiner<readonly [key: PropertyKey, value: any]> | undefined
  readonly encode: Combiner.Combiner<readonly [key: PropertyKey, value: any]> | undefined

  constructor(
    decode: Combiner.Combiner<readonly [key: PropertyKey, value: any]> | undefined,
    encode: Combiner.Combiner<readonly [key: PropertyKey, value: any]> | undefined
  ) {
    this.decode = decode
    this.encode = encode
  }
  /** @internal */
  flip(): KeyValueCombiner {
    return new KeyValueCombiner(this.encode, this.decode)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class IndexSignature {
  readonly parameter: AST
  readonly type: AST
  readonly merge: KeyValueCombiner | undefined

  constructor(
    parameter: AST,
    type: AST,
    merge: KeyValueCombiner | undefined
  ) {
    this.parameter = parameter
    this.type = type
    this.merge = merge
    if (isOptional(type) && !containsUndefined(type)) {
      throw new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.")
    }
  }
}

/**
 * Describes both structs and records.
 *
 * @category model
 * @since 4.0.0
 */
export class Objects extends Base {
  readonly _tag = "Objects"
  readonly propertySignatures: ReadonlyArray<PropertySignature>
  readonly indexSignatures: ReadonlyArray<IndexSignature>

  constructor(
    propertySignatures: ReadonlyArray<PropertySignature>,
    indexSignatures: ReadonlyArray<IndexSignature>,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.propertySignatures = propertySignatures
    this.indexSignatures = indexSignatures

    // Duplicate property signatures
    let duplicates = propertySignatures.map((ps) => ps.name).filter((name, i, arr) => arr.indexOf(name) !== i)
    if (duplicates.length > 0) {
      throw new Error(`Duplicate identifiers: ${JSON.stringify(duplicates)}. ts(2300)`)
    }

    // Duplicate index signatures
    duplicates = indexSignatures.map((is) => getIndexSignatureHash(is.parameter)).filter((s, i, arr) =>
      arr.indexOf(s) !== i
    )
    if (duplicates.length > 0) {
      throw new Error(`Duplicate index signatures: ${JSON.stringify(duplicates)}. ts(2374)`)
    }
  }
  /** @internal */
  getParser(recur: (ast: AST) => Parser.Parser): Parser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    const expectedKeys: Array<PropertyKey> = []
    const expectedKeysSet = new Set<PropertyKey>()
    const properties: Array<{
      readonly ps: PropertySignature
      readonly parser: Parser.Parser
      readonly name: PropertyKey
      readonly type: AST
    }> = []
    const propertyCount = ast.propertySignatures.length
    for (const ps of ast.propertySignatures) {
      expectedKeys.push(ps.name)
      expectedKeysSet.add(ps.name)
      properties.push({
        ps,
        parser: recur(ps.type),
        name: ps.name,
        type: ps.type
      })
    }
    const indexCount = ast.indexSignatures.length
    // ---------------------------------------------
    // handle empty struct
    // ---------------------------------------------
    if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
      return fromRefinement(ast, Predicate.isNotNullish)
    }
    return Effect.fnUntracedEager(function*(oinput, options) {
      if (oinput._tag === "None") {
        return oinput
      }
      const input = oinput.value as Record<PropertyKey, unknown>

      // If the input is not a record, return early with an error
      if (!(typeof input === "object" && input !== null && !Array.isArray(input))) {
        return yield* Effect.fail(new Issue.InvalidType(ast, oinput))
      }

      const out: Record<PropertyKey, unknown> = {}
      let issues: Arr.NonEmptyArray<Issue.Issue> | undefined
      const errorsAllOption = options.errors === "all"
      const onExcessPropertyError = options.onExcessProperty === "error"
      const onExcessPropertyPreserve = options.onExcessProperty === "preserve"

      // ---------------------------------------------
      // handle excess properties
      // ---------------------------------------------
      let inputKeys: Array<PropertyKey> | undefined
      if (ast.indexSignatures.length === 0 && (onExcessPropertyError || onExcessPropertyPreserve)) {
        inputKeys = Reflect.ownKeys(input)
        for (let i = 0; i < inputKeys.length; i++) {
          const key = inputKeys[i]
          if (!expectedKeysSet.has(key)) {
            // key is unexpected
            if (onExcessPropertyError) {
              const issue = new Issue.Pointer([key], new Issue.UnexpectedKey(ast, input[key]))
              if (errorsAllOption) {
                if (issues) {
                  issues.push(issue)
                } else {
                  issues = [issue]
                }
                continue
              } else {
                return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
              }
            } else {
              // preserve key
              internalRecord.set(out, key, input[key])
            }
          }
        }
      }

      // ---------------------------------------------
      // handle property signatures
      // ---------------------------------------------
      for (let i = 0; i < propertyCount; i++) {
        const p = properties[i]
        const value: Option.Option<unknown> = Object.hasOwn(input, p.name)
          ? Option.some(input[p.name])
          : Option.none()
        const eff = p.parser(value, options)
        const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
        if (exit._tag === "Failure") {
          const issueProp = Cause.filterError(exit.cause)
          if (Filter_.isFail(issueProp)) {
            return yield* exit
          }
          const issue = new Issue.Pointer([p.name], issueProp)
          if (errorsAllOption) {
            if (issues) issues.push(issue)
            else issues = [issue]
            continue
          } else {
            return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
          }
        } else if (exit.value._tag === "Some") {
          internalRecord.set(out, p.name, exit.value.value)
        } else if (!isOptional(p.type)) {
          const issue = new Issue.Pointer([p.name], new Issue.MissingKey(p.type.context?.annotations))
          if (errorsAllOption) {
            if (issues) issues.push(issue)
            else issues = [issue]
            continue
          } else {
            return yield* Effect.fail(
              new Issue.Composite(ast, oinput, [issue])
            )
          }
        }
      }

      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      if (indexCount > 0) {
        for (let i = 0; i < indexCount; i++) {
          const is = ast.indexSignatures[i]
          const keys = getIndexSignatureKeys(input, is.parameter)
          for (let j = 0; j < keys.length; j++) {
            const key = keys[j]
            const parserKey = recur(indexSignatureParameterFromString(is.parameter))
            const effKey = parserKey(Option.some(key), options)
            const exitKey = (effectIsExit(effKey) ? effKey : yield* Effect.exit(effKey)) as Exit.Exit<
              Option.Option<PropertyKey>,
              Issue.Issue
            >
            if (exitKey._tag === "Failure") {
              const issueKey = Cause.filterError(exitKey.cause)
              if (Filter_.isFail(issueKey)) {
                return yield* exitKey
              }
              const issue = new Issue.Pointer([key], issueKey)
              if (errorsAllOption) {
                if (issues) issues.push(issue)
                else issues = [issue]
                continue
              }
              return yield* Effect.fail(
                new Issue.Composite(ast, oinput, [issue])
              )
            }

            const value: Option.Option<unknown> = Option.some(input[key])
            const parserValue = recur(is.type)
            const effValue = parserValue(value, options)
            const exitValue = effectIsExit(effValue) ? effValue : yield* Effect.exit(effValue)
            if (exitValue._tag === "Failure") {
              const issueValue = Cause.filterError(exitValue.cause)
              if (Filter_.isFail(issueValue)) {
                return yield* exitValue
              }
              const issue = new Issue.Pointer([key], issueValue)
              if (errorsAllOption) {
                if (issues) issues.push(issue)
                else issues = [issue]
                continue
              } else {
                return yield* Effect.fail(
                  new Issue.Composite(ast, oinput, [issue])
                )
              }
            } else if (exitKey.value._tag === "Some" && exitValue.value._tag === "Some") {
              const k2 = exitKey.value.value
              const v2 = exitValue.value.value
              if (is.merge && is.merge.decode && Object.hasOwn(out, k2)) {
                const [k, v] = is.merge.decode.combine([k2, out[k2]], [k2, v2])
                internalRecord.set(out, k, v)
              } else {
                internalRecord.set(out, k2, v2)
              }
            }
          }
        }
      }

      if (issues) {
        return yield* Effect.fail(new Issue.Composite(ast, oinput, issues))
      }
      if (options.propertyOrder === "original") {
        // preserve input keys order
        const keys = (inputKeys ?? Reflect.ownKeys(input)).concat(expectedKeys)
        const preserved: Record<PropertyKey, unknown> = {}
        for (const key of keys) {
          if (Object.hasOwn(out, key)) {
            internalRecord.set(preserved, key, out[key])
          }
        }
        return Option.some(preserved)
      }
      return Option.some(out)
    })
  }
  private rebuild(
    recur: (ast: AST) => AST,
    flipMerge: boolean
  ): Objects {
    const props = mapOrSame(this.propertySignatures, (ps) => {
      const t = recur(ps.type)
      return t === ps.type ? ps : new PropertySignature(ps.name, t)
    })

    const indexes = mapOrSame(this.indexSignatures, (is) => {
      const p = recur(is.parameter)
      const t = recur(is.type)
      const merge = flipMerge ? is.merge?.flip() : is.merge
      return p === is.parameter && t === is.type && merge === is.merge
        ? is
        : new IndexSignature(p, t, merge)
    })

    return props === this.propertySignatures && indexes === this.indexSignatures
      ? this
      : new Objects(props, indexes, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  flip(recur: (ast: AST) => AST): AST {
    return this.rebuild(recur, true)
  }
  /** @internal */
  recur(recur: (ast: AST) => AST): AST {
    return this.rebuild(recur, false)
  }
  /** @internal */
  getExpected(): string {
    if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0) return "object | array"
    return "object"
  }
}

function mergeChecks(checks: Checks | undefined, b: AST): Checks | undefined {
  if (!checks) {
    return b.checks
  }
  if (!b.checks) {
    return checks
  }
  return [...checks, ...b.checks]
}

/** @internal */
export function struct<Fields extends Schema.Struct.Fields>(
  fields: Fields,
  checks: Checks | undefined
): Objects {
  return new Objects(
    Reflect.ownKeys(fields).map((key) => {
      return new PropertySignature(key, fields[key].ast)
    }),
    [],
    undefined,
    checks
  )
}

/** @internal */
export function getAST<S extends Schema.Top>(self: S): S["ast"] {
  return self.ast
}

/** @internal */
export function tuple<Elements extends Schema.Tuple.Elements>(
  elements: Elements,
  checks: Checks | undefined = undefined
): Arrays {
  return new Arrays(false, elements.map((e) => e.ast), [], undefined, checks)
}

/** @internal */
export function union<Members extends ReadonlyArray<Schema.Top>>(
  members: Members,
  mode: "anyOf" | "oneOf",
  checks: Checks | undefined
): Union<Members[number]["ast"]> {
  return new Union(members.map(getAST), mode, undefined, checks)
}

/** @internal */
export function structWithRest(ast: Objects, records: ReadonlyArray<Objects>): Objects {
  if (ast.encoding || records.some((r) => r.encoding)) {
    throw new Error("StructWithRest does not support encodings")
  }
  let propertySignatures = ast.propertySignatures
  let indexSignatures = ast.indexSignatures
  let checks = ast.checks
  for (const r of records) {
    propertySignatures = propertySignatures.concat(r.propertySignatures)
    indexSignatures = indexSignatures.concat(r.indexSignatures)
    checks = mergeChecks(checks, r)
  }
  return new Objects(propertySignatures, indexSignatures, undefined, checks)
}

/** @internal */
export function tupleWithRest(ast: Arrays, rest: ReadonlyArray<AST>): Arrays {
  if (ast.encoding) {
    throw new Error("TupleWithRest does not support encodings")
  }
  return new Arrays(ast.isMutable, ast.elements, rest, undefined, ast.checks)
}

type Type =
  | "null"
  | "array"
  | "object"
  | "string"
  | "number"
  | "boolean"
  | "symbol"
  | "undefined"
  | "bigint"
  | "function"

/** @internal */
export type Sentinel = {
  readonly key: PropertyKey
  readonly literal: LiteralValue
}

function getCandidateTypes(ast: AST): ReadonlyArray<Type> {
  switch (ast._tag) {
    case "Null":
      return ["null"]
    case "Undefined":
    case "Void":
      return ["undefined"]
    case "String":
    case "TemplateLiteral":
      return ["string"]
    case "Number":
      return ["number"]
    case "Boolean":
      return ["boolean"]
    case "Symbol":
    case "UniqueSymbol":
      return ["symbol"]
    case "BigInt":
      return ["bigint"]
    case "Arrays":
      return ["array"]
    case "ObjectKeyword":
      return ["object", "array", "function"]
    case "Objects":
      return ast.propertySignatures.length || ast.indexSignatures.length
        ? ["object"]
        : ["object", "array"]
    case "Enum":
      return ["string", "number"]
    case "Literal":
      return [typeof ast.literal]
    default:
      return [
        "null",
        "undefined",
        "string",
        "number",
        "boolean",
        "symbol",
        "bigint",
        "object",
        "array",
        "function"
      ]
  }
}

/** @internal */
export function collectSentinels(ast: AST): Array<Sentinel> | undefined {
  switch (ast._tag) {
    case "Declaration": {
      const s = ast.annotations?.["~sentinels"]
      return Array.isArray(s) && s.length ? s : undefined
    }
    case "Objects": {
      const v = ast.propertySignatures.flatMap((ps) =>
        isLiteral(ps.type) && !isOptional(ps.type)
          ? [{ key: ps.name, literal: ps.type.literal }]
          : []
      )
      return v.length ? v : undefined
    }
    case "Arrays": {
      const v = ast.elements.flatMap((e, i) =>
        isLiteral(e) && !isOptional(e)
          ? [{ key: i, literal: e.literal }]
          : []
      )
      return v.length ? v : undefined
    }
    case "Suspend":
      return collectSentinels(ast.thunk())
  }
}

type CandidateIndex = {
  byType?: { [K in Type]?: Array<AST> }
  bySentinel?: Map<PropertyKey, Map<LiteralValue, Array<AST>>>
  otherwise?: { [K in Type]?: Array<AST> }
}

const candidateIndexCache = new WeakMap<ReadonlyArray<AST>, CandidateIndex>()

function getIndex(types: ReadonlyArray<AST>): CandidateIndex {
  let idx = candidateIndexCache.get(types)
  if (idx) return idx

  idx = {}
  for (const a of types) {
    const encoded = encodedAST(a)
    if (isNever(encoded)) continue

    const types = getCandidateTypes(encoded)
    const sentinels = collectSentinels(encoded)

    // by-type (always filled – cheap primary filter)
    idx.byType ??= {}
    for (const t of types) (idx.byType[t] ??= []).push(a)

    if (sentinels?.length) { // discriminated variants
      idx.bySentinel ??= new Map()
      for (const { key, literal } of sentinels) {
        let m = idx.bySentinel.get(key)
        if (!m) idx.bySentinel.set(key, m = new Map())
        let arr = m.get(literal)
        if (!arr) m.set(literal, arr = [])
        arr.push(a)
      }
    } else { // non-discriminated
      idx.otherwise ??= {}
      for (const t of types) (idx.otherwise[t] ??= []).push(a)
    }
  }

  candidateIndexCache.set(types, idx)
  return idx
}

function filterLiterals(input: any) {
  return (ast: AST) => {
    const encoded = encodedAST(ast)
    return encoded._tag === "Literal" ?
      encoded.literal === input
      : encoded._tag === "UniqueSymbol" ?
      encoded.symbol === input
      : true
  }
}

/**
 * The goal is to reduce the number of a union members that will be checked.
 * This is useful to reduce the number of issues that will be returned.
 *
 * @internal
 */
export function getCandidates(input: any, types: ReadonlyArray<AST>): ReadonlyArray<AST> {
  const idx = getIndex(types)
  const runtimeType: Type = input === null ? "null" : Array.isArray(input) ? "array" : typeof input

  // 1. Try sentinel-based dispatch (most selective)
  if (idx.bySentinel) {
    const base = idx.otherwise?.[runtimeType] ?? []
    if (runtimeType === "object" || runtimeType === "array") {
      for (const [k, m] of idx.bySentinel) {
        if (Object.hasOwn(input, k)) {
          const match = m.get((input as any)[k])
          if (match) return [...match, ...base].filter(filterLiterals(input))
        }
      }
    }
    return base
  }

  // 2. Fallback: runtime-type dispatch only
  return (idx.byType?.[runtimeType] ?? []).filter(filterLiterals(input))
}

/**
 * @category model
 * @since 4.0.0
 */
export class Union<A extends AST = AST> extends Base {
  readonly _tag = "Union"
  readonly types: ReadonlyArray<A>
  readonly mode: "anyOf" | "oneOf"

  constructor(
    types: ReadonlyArray<A>,
    mode: "anyOf" | "oneOf",
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.types = types
    this.mode = mode
  }
  /** @internal */
  getParser(recur: (ast: AST) => Parser.Parser): Parser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntracedEager(function*(oinput, options) {
      if (oinput._tag === "None") {
        return oinput
      }
      const input = oinput.value
      const oneOf = ast.mode === "oneOf"
      const candidates = getCandidates(input, ast.types)
      let issues: Arr.NonEmptyArray<Issue.Issue> | undefined

      const tracking: {
        out: Option.Option<unknown> | undefined
        successes: Array<AST>
      } = {
        out: undefined,
        successes: []
      }
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        const parser = recur(candidate)
        const eff = parser(oinput, options)
        const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
        if (exit._tag === "Failure") {
          const issue = Cause.filterError(exit.cause)
          if (Filter_.isFail(issue)) {
            return yield* exit
          }
          if (issues) issues.push(issue)
          else issues = [issue]
          continue
        } else {
          if (tracking.out && oneOf) {
            tracking.successes.push(candidate)
            return yield* Effect.fail(new Issue.OneOf(ast, input, tracking.successes))
          }
          tracking.out = exit.value
          tracking.successes.push(candidate)
          if (!oneOf) {
            break
          }
        }
      }

      if (tracking.out) {
        return tracking.out
      } else {
        return yield* Effect.fail(new Issue.AnyOf(ast, input, issues ?? []))
      }
    })
  }
  /** @internal */
  recur(recur: (ast: AST) => AST) {
    const types = mapOrSame(this.types, recur)
    return types === this.types ?
      this :
      new Union(types, this.mode, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  getExpected(getExpected: (ast: AST) => string): string {
    if (this.types.length === 0) return "never"
    const expected = this.types.map((type) => {
      const encoded = encodedAST(type)
      switch (encoded._tag) {
        case "Arrays": {
          const literals = encoded.elements.filter(isLiteral)
          if (literals.length > 0) {
            return `${formatIsMutable(encoded.isMutable)}[ ${
              literals.map((e) => getExpected(e) + formatIsOptional(e.context?.isOptional)).join(", ")
            }, ... ]`
          }
          break
        }
        case "Objects": {
          const literals = encoded.propertySignatures.filter((ps) => isLiteral(ps.type))
          if (literals.length > 0) {
            return `{ ${
              literals.map((ps) =>
                `${formatIsMutable(ps.type.context?.isMutable)}${formatPropertyKey(ps.name)}${
                  formatIsOptional(ps.type.context?.isOptional)
                }: ${getExpected(ps.type)}`
              ).join(", ")
            }, ... }`
          }
          break
        }
      }
      return getExpected(encoded)
    })
    return Array.from(new Set(expected)).join(" | ")
  }
}

const numberToNumberOrNonFiniteLiterals = new Link(
  new Union(
    [number, new Literal("Infinity"), new Literal("-Infinity"), new Literal("NaN")],
    "anyOf"
  ),
  new Transformation.Transformation(
    Getter.Number(),
    Getter.transform((n) => globalThis.Number.isFinite(n) ? n : globalThis.String(n))
  )
)

function formatIsMutable(isMutable: boolean | undefined): string {
  return isMutable ? "" : "readonly "
}

function formatIsOptional(isOptional: boolean | undefined): string {
  return isOptional ? "?" : ""
}

/** @internal */
export function memoizeThunk<A>(f: () => A): () => A {
  let done = false
  let a: A
  return () => {
    if (done) {
      return a
    }
    a = f()
    done = true
    return a
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Suspend extends Base {
  readonly _tag = "Suspend"
  readonly thunk: () => AST

  constructor(
    thunk: () => AST,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.thunk = memoizeThunk(thunk)
  }
  /** @internal */
  getParser(recur: (ast: AST) => Parser.Parser): Parser.Parser {
    return recur(this.thunk())
  }
  /** @internal */
  recur(recur: (ast: AST) => AST) {
    return new Suspend(() => recur(this.thunk()), this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  getExpected(getExpected: (ast: AST) => string): string {
    return getExpected(this.thunk())
  }
}

// -----------------------------------------------------------------------------
// Checks
// -----------------------------------------------------------------------------

/**
 * @category model
 * @since 4.0.0
 */
export class Filter<in E> extends Pipeable.Class {
  readonly _tag = "Filter"
  readonly run: (input: E, self: AST, options: ParseOptions) => Issue.Issue | undefined
  readonly annotations: Annotations.Filter | undefined
  /**
   * Whether the parsing process should be aborted after this check has failed.
   */
  readonly aborted: boolean

  constructor(
    run: (input: E, self: AST, options: ParseOptions) => Issue.Issue | undefined,
    annotations: Annotations.Filter | undefined = undefined,
    /**
     * Whether the parsing process should be aborted after this check has failed.
     */
    aborted: boolean = false
  ) {
    super()
    this.run = run
    this.annotations = annotations
    this.aborted = aborted
  }
  annotate(annotations: Annotations.Filter): Filter<E> {
    return new Filter(this.run, Annotations.combine(this.annotations, annotations), this.aborted)
  }
  abort(): Filter<E> {
    return new Filter(this.run, this.annotations, true)
  }
  and<T extends E>(other: Refine<T, E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E> {
    return new FilterGroup([this, other], annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class FilterGroup<in E> extends Pipeable.Class {
  readonly _tag = "FilterGroup"
  readonly checks: readonly [Check<E>, Check<E>, ...Array<Check<E>>]
  readonly annotations: Annotations.Filter | undefined

  constructor(
    checks: readonly [Check<E>, Check<E>, ...Array<Check<E>>],
    annotations: Annotations.Filter | undefined = undefined
  ) {
    super()
    this.checks = checks
    this.annotations = annotations
  }
  annotate(annotations: Annotations.Filter): FilterGroup<E> {
    return new FilterGroup(this.checks, Annotations.combine(this.annotations, annotations))
  }
  and<T extends E>(other: Refine<T, E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E>
  and(other: Check<E>, annotations?: Annotations.Filter): FilterGroup<E> {
    return new FilterGroup([this, other], annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Check<T> = Filter<T> | FilterGroup<T>

/**
 * @category model
 * @since 4.0.0
 */
export interface Refinement<out T extends E, in E> extends Filter<E> {
  readonly Type: T
  annotate(annotations: Annotations.Filter): Refinement<T, E>
  and<T2 extends E2, E2>(
    other: Refine<T2, E2>,
    annotations?: Annotations.Filter
  ): RefinementGroup<T & T2, E & E2>
  and(other: Check<E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
}

/**
 * @category model
 * @since 4.0.0
 */
export interface RefinementGroup<T extends E, E> extends FilterGroup<E> {
  readonly Type: T
  annotate(annotations: Annotations.Filter): RefinementGroup<T, E>
  and<T2 extends E2, E2>(
    other: Refine<T2, E2>,
    annotations?: Annotations.Filter
  ): RefinementGroup<T & T2, E & E2>
  and(other: Check<E>, annotations?: Annotations.Filter): RefinementGroup<T, E>
}

/**
 * @category model
 * @since 4.0.0
 */
export type Refine<T extends E, E> = Refinement<T, E> | RefinementGroup<T, E>

/** @internal */
export function makeFilter<T>(
  filter: (
    input: T,
    ast: AST,
    options: ParseOptions
  ) => undefined | boolean | string | Issue.Issue | {
    readonly path: ReadonlyArray<PropertyKey>
    readonly message: string
  },
  annotations?: Annotations.Filter | undefined,
  aborted: boolean = false
): Filter<T> {
  return new Filter(
    (input, ast, options) => Issue.make(input, filter(input, ast, options)),
    annotations,
    aborted
  )
}

/** @internal */
export function makeRefinedByGuard<T extends E, E>(
  is: (value: E) => value is T,
  annotations?: Annotations.Filter
): Refinement<T, E> {
  return new Filter(
    (input: E) => is(input) ? undefined : new Issue.InvalidValue(Option.some(input)),
    annotations,
    true // after a guard, we always want to abort
  ) as any
}

/** @internal */
export function isNotUndefined<A>(annotations?: Annotations.Filter) {
  return makeRefinedByGuard<Exclude<A, undefined>, A>(
    Predicate.isNotUndefined,
    Annotations.combine({ title: "isNotUndefined", description: "a value other than `undefined`" }, annotations)
  )
}

/** @internal */
export function isSome<A>(annotations?: Annotations.Filter) {
  return makeRefinedByGuard<Option.Some<A>, Option.Option<A>>(
    Option.isSome,
    Annotations.combine({ title: "isSome", description: "a Some value" }, annotations)
  )
}

/** @internal */
export function isNone<A>(annotations?: Annotations.Filter) {
  return makeRefinedByGuard<Option.None<A>, Option.Option<A>>(
    Option.isNone,
    Annotations.combine({ title: "isNone", description: "a None value" }, annotations)
  )
}

/** @internal */
export function isSuccess<A, E>(annotations?: Annotations.Filter) {
  return makeRefinedByGuard<Result.Success<A, E>, Result.Result<A, E>>(
    Result.isSuccess,
    Annotations.combine({ title: "isSuccess", description: "a Result.Success value" }, annotations)
  )
}

/** @internal */
export function isFailure<A, E>(annotations?: Annotations.Filter) {
  return makeRefinedByGuard<Result.Failure<A, E>, Result.Result<A, E>>(
    Result.isFailure,
    Annotations.combine({ title: "isFailure", description: "a Result.Failure value" }, annotations)
  )
}

/** @internal */
export function isPattern(regex: RegExp, annotations?: Annotations.Filter) {
  const source = regex.source
  return makeFilter(
    (s: string) => regex.test(s),
    Annotations.combine({
      expected: `a string matching the regex ${source}`,
      jsonSchemaConstraint: () => ({ pattern: regex.source }),
      meta: {
        _tag: "isPattern",
        regex
      },
      arbitraryConstraint: {
        string: {
          patterns: [regex.source]
        }
      }
    }, annotations)
  )
}

// -----------------------------------------------------------------------------
// AST APIs
// -----------------------------------------------------------------------------

function modifyOwnPropertyDescriptors<A extends AST>(
  ast: A,
  f: (
    d: { [P in keyof A]: TypedPropertyDescriptor<A[P]> }
  ) => void
): A {
  const d = Object.getOwnPropertyDescriptors(ast)
  f(d)
  return Object.create(Object.getPrototypeOf(ast), d)
}

/** @internal */
export function replaceAnnotations<A extends AST>(ast: A, annotations: Annotations.Annotations | undefined): A {
  if (ast.annotations === annotations) {
    return ast
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = annotations
  })
}

/** @internal */
export function replaceEncoding<A extends AST>(ast: A, encoding: Encoding | undefined): A {
  if (ast.encoding === encoding) {
    return ast
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding
  })
}

/** @internal */
export function replaceContext<A extends AST>(ast: A, context: Context | undefined): A {
  if (ast.context === context) {
    return ast
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.context.value = context
  })
}

/** @internal */
export function replaceChecks<A extends AST>(ast: A, checks: Checks | undefined): A {
  if (ast.checks === checks) {
    return ast
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.checks.value = checks
  })
}

/** @internal */
export function appendChecks<A extends AST>(ast: A, checks: Checks): A {
  return replaceChecks(ast, ast.checks ? [...ast.checks, ...checks] : checks)
}

function updateLastLink(encoding: Encoding, f: (ast: AST) => AST): Encoding {
  const links = encoding
  const last = links[links.length - 1]
  const to = f(last.to)
  if (to !== last.to) {
    return Arr.append(encoding.slice(0, encoding.length - 1), new Link(to, last.transformation))
  }
  return encoding
}

/** @internal */
export function serializer(f: (ast: AST) => AST) {
  function out(ast: AST): AST {
    return ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, out)) : f(ast)
  }
  return memoize(out)
}

/** @internal */
export function applyToLastLink(f: (ast: AST) => AST) {
  return <A extends AST>(ast: A): A => ast.encoding ? replaceEncoding(ast, updateLastLink(ast.encoding, f)) : ast
}

/** @internal */
export function decodingMiddleware(
  ast: AST,
  middleware: Transformation.Middleware<any, any, any, any, any, any>
): AST {
  return appendTransformation(ast, middleware, typeAST(ast))
}

/** @internal */
export function encodingMiddleware(
  ast: AST,
  middleware: Transformation.Middleware<any, any, any, any, any, any>
): AST {
  return appendTransformation(encodedAST(ast), middleware, ast)
}

function appendTransformation<A extends AST>(
  from: AST,
  transformation:
    | Transformation.Transformation<any, any, any, any>
    | Transformation.Middleware<any, any, any, any, any, any>,
  to: A
): A {
  const link = new Link(from, transformation)
  return replaceEncoding(to, to.encoding ? [...to.encoding, link] : [link])
}

/**
 * Maps over the array but will return the original array if no changes occur.
 */
function mapOrSame<A>(as: Arr.NonEmptyReadonlyArray<A>, f: (a: A) => A): Arr.NonEmptyReadonlyArray<A>
function mapOrSame<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A>
function mapOrSame<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A> {
  let changed = false
  const out: Array<A> = new Array(as.length)
  for (let i = 0; i < as.length; i++) {
    const a = as[i]
    const fa = f(a)
    if (fa !== a) {
      changed = true
    }
    out[i] = fa
  }
  return changed ? out : as
}

/** @internal */
export function annotate<A extends AST>(ast: A, annotations: Annotations.Annotations): A {
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1]
    return replaceChecks(ast, Arr.append(ast.checks.slice(0, -1), last.annotate(annotations)))
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = Annotations.combine(d.annotations.value, annotations)
  })
}

/** @internal */
export function annotateKey<A extends AST>(ast: A, annotations: Annotations.Key<unknown>): A {
  const context = ast.context ?
    new Context(
      ast.context.isOptional,
      ast.context.isMutable,
      ast.context.defaultValue,
      Annotations.combine(ast.context.annotations, annotations)
    ) :
    new Context(false, false, undefined, annotations)
  return replaceContext(ast, context)
}

/** @internal */
export const optionalKeyLastLink = applyToLastLink(optionalKey)

/** @internal */
export function optionalKey<A extends AST>(ast: A): A {
  const context = ast.context ?
    ast.context.isOptional === false ?
      new Context(true, ast.context.isMutable, ast.context.defaultValue, ast.context.annotations) :
      ast.context :
    new Context(true, false)
  return optionalKeyLastLink(replaceContext(ast, context))
}

const mutableKeyLastLink = applyToLastLink(mutableKey)

/** @internal */
export function mutableKey<A extends AST>(ast: A): A {
  const context = ast.context ?
    ast.context.isMutable === false ?
      new Context(ast.context.isOptional, true, ast.context.defaultValue, ast.context.annotations) :
      ast.context :
    new Context(false, true)
  return mutableKeyLastLink(replaceContext(ast, context))
}

/** @internal */
export function withConstructorDefault<A extends AST>(
  ast: A,
  /**
   * The `input` parameters is `None` if the value is not present and
   * `Some(undefined)` if the value is present but undefined
   */
  defaultValue: (input: Option.Option<undefined>) => Option.Option<unknown> | Effect.Effect<Option.Option<unknown>>
): A {
  const transformation = new Transformation.Transformation(
    new Getter.Getter((o) => {
      if (Option.isNone(Option.filter(o, Predicate.isNotUndefined))) {
        const oe = defaultValue(o as Option.Option<undefined>)
        return Effect.isEffect(oe) ? oe : Effect.succeed(oe)
      } else {
        return Effect.succeed(o)
      }
    }),
    Getter.passthrough()
  )
  const encoding: Encoding = [new Link(unknown, transformation)]
  const context = ast.context ?
    new Context(ast.context.isOptional, ast.context.isMutable, encoding, ast.context.annotations) :
    new Context(false, false, encoding)
  return replaceContext(ast, context)
}

/** @internal */
export function decodeTo<A extends AST>(
  from: AST,
  to: A,
  transformation: Transformation.Transformation<any, any, any, any>
): A {
  return appendTransformation(from, transformation, to)
}

function parseParameter(ast: AST): {
  literals: ReadonlyArray<PropertyKey>
  parameters: ReadonlyArray<AST>
} {
  switch (ast._tag) {
    case "Literal":
      return {
        literals: Predicate.isPropertyKey(ast.literal) ? [ast.literal] : [],
        parameters: []
      }
    case "UniqueSymbol":
      return {
        literals: [ast.symbol],
        parameters: []
      }
    case "String":
    case "Number":
    case "Symbol":
    case "TemplateLiteral":
      return {
        literals: [],
        parameters: [ast]
      }
    case "Union": {
      const out: {
        literals: ReadonlyArray<PropertyKey>
        parameters: ReadonlyArray<AST>
      } = { literals: [], parameters: [] }
      for (let i = 0; i < ast.types.length; i++) {
        const parsed = parseParameter(ast.types[i])
        out.literals = out.literals.concat(parsed.literals)
        out.parameters = out.parameters.concat(parsed.parameters)
      }
      return out
    }
  }
  return { literals: [], parameters: [] }
}

/** @internal */
export function record(key: AST, value: AST, keyValueCombiner: KeyValueCombiner | undefined): Objects {
  const { literals, parameters: indexSignatures } = parseParameter(key)
  return new Objects(
    literals.map((literal) => new PropertySignature(literal, value)),
    indexSignatures.map((parameter) => new IndexSignature(parameter, value, keyValueCombiner))
  )
}

// -------------------------------------------------------------------------------------
// Public APIs
// -------------------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export function isOptional(ast: AST): boolean {
  return ast.context?.isOptional ?? false
}

/**
 * @since 4.0.0
 */
export const typeAST = memoize(<A extends AST>(ast: A): A => {
  if (ast.encoding) {
    return typeAST(replaceEncoding(ast, undefined))
  }
  const out: any = ast
  return out.recur?.(typeAST) ?? out
})

/**
 * @since 4.0.0
 */
export const encodedAST = memoize((ast: AST): AST => {
  return typeAST(flip(ast))
})

function flipEncoding(ast: AST, encoding: Encoding): AST {
  const links = encoding
  const len = links.length
  const last = links[len - 1]
  const ls: Arr.NonEmptyArray<Link> = [
    new Link(flip(replaceEncoding(ast, undefined)), links[0].transformation.flip())
  ]
  for (let i = 1; i < len; i++) {
    ls.unshift(new Link(flip(links[i - 1].to), links[i].transformation.flip()))
  }
  const to = flip(last.to)
  if (to.encoding) {
    return replaceEncoding(to, [...to.encoding, ...ls])
  } else {
    return replaceEncoding(to, ls)
  }
}

/**
 * @since 4.0.0
 */
export const flip = memoize((ast: AST): AST => {
  if (ast.encoding) {
    return flipEncoding(ast, ast.encoding)
  }
  const out: any = ast
  return out.flip?.(flip) ?? out.recur?.(flip) ?? out
})

/** @internal */
export function containsUndefined(ast: AST): boolean {
  switch (ast._tag) {
    case "Undefined":
      return true
    case "Union":
      return ast.types.some(containsUndefined)
    default:
      return false
  }
}

function getTemplateLiteralSource(ast: TemplateLiteral, top: boolean): string {
  return ast.encodedParts.map((part) =>
    handleTemplateLiteralASTPartParens(part, getTemplateLiteralASTPartPattern(part), top)
  ).join("")
}

/** @internal */
export const getTemplateLiteralRegExp = memoize((ast: TemplateLiteral): RegExp => {
  return new RegExp(`^${getTemplateLiteralSource(ast, true)}$`)
})

function getTemplateLiteralASTPartPattern(part: TemplateLiteralPart): string {
  switch (part._tag) {
    case "Literal":
      return RegEx.escape(globalThis.String(part.literal))
    case "String":
      return STRING_PATTERN
    case "Number":
      return NUMBER_PATTERN
    case "BigInt":
      return BIGINT_PATTERN
    case "TemplateLiteral":
      return getTemplateLiteralSource(part, false)
    case "Union":
      return part.types.map(getTemplateLiteralASTPartPattern).join("|")
  }
}

function handleTemplateLiteralASTPartParens(part: TemplateLiteralPart, s: string, top: boolean): string {
  if (isUnion(part)) {
    if (!top) {
      return `(?:${s})`
    }
  } else if (!top) {
    return s
  }
  return `(${s})`
}

function fromConst<const T>(
  ast: AST,
  value: T
): Parser.Parser {
  const succeed = Effect.succeedSome(value)
  return (oinput) => {
    if (oinput._tag === "None") {
      return Effect.succeedNone
    }
    return oinput.value === value
      ? succeed
      : Effect.fail(new Issue.InvalidType(ast, oinput))
  }
}

function fromRefinement<T>(
  ast: AST,
  refinement: (input: unknown) => input is T
): Parser.Parser {
  return (oinput) => {
    if (oinput._tag === "None") {
      return Effect.succeedNone
    }
    return refinement(oinput.value)
      ? Effect.succeed(oinput)
      : Effect.fail(new Issue.InvalidType(ast, oinput))
  }
}

/** @internal */
export const enumsToLiterals = memoize((ast: Enum): Union<Literal> => {
  return new Union(
    ast.enums.map((e) => new Literal(e[1], { title: e[0] })),
    "anyOf"
  )
})

const indexSignatureParameterFromString = serializer((ast) => {
  switch (ast._tag) {
    case "Number":
      return ast.encodeToString()
    case "Union":
      return ast.recur(indexSignatureParameterFromString)
    default:
      return ast
  }
})

const templateLiteralPartFromString = serializer((ast) => {
  switch (ast._tag) {
    case "String":
    case "TemplateLiteral":
      return ast
    case "BigInt":
    case "Number":
    case "Literal":
      return ast.encodeToString()
    case "Union":
      return ast.recur(templateLiteralPartFromString)
    default:
      return ast
  }
})

/**
 * any string, including newlines
 */
const STRING_PATTERN = "[\\s\\S]*?"
/**
 * floating point or integer, with optional exponent
 */
const NUMBER_PATTERN = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?"

const isNumberStringRegExp = new RegExp(`(?:${NUMBER_PATTERN}|Infinity|-Infinity|NaN)`)

/** @internal */
export function isNumberString(annotations?: Annotations.Filter) {
  return isPattern(
    isNumberStringRegExp,
    Annotations.combine({
      description: "a string representing a number",
      meta: {
        _tag: "isNumberString",
        regex: isNumberStringRegExp
      }
    }, annotations)
  )
}

const numberToString = new Link(
  appendChecks(string, [isNumberString()]),
  Transformation.numberFromString
)

/**
 * signed integer only (no leading "+" because TypeScript doesn't support it)
 */
const BIGINT_PATTERN = "-?\\d+"

const isBigIntStringRegExp = new RegExp(BIGINT_PATTERN)

/** @internal */
export function isBigIntString(annotations?: Annotations.Filter) {
  return isPattern(
    isBigIntStringRegExp,
    Annotations.combine({
      description: "a string representing a bigint",
      meta: {
        _tag: "isBigIntString",
        regex: isBigIntStringRegExp
      }
    }, annotations)
  )
}

const bigIntToString = new Link(
  appendChecks(string, [isBigIntString()]),
  new Transformation.Transformation(
    Getter.transform(globalThis.BigInt),
    Getter.String()
  )
)

const isSymbolStringRegExp = /^Symbol\((.*)\)$/

/**
 * to distinguish between Symbol and String, we need to add a check to the string keyword
 */
const symbolToString = new Link(
  appendChecks(string, [isSymbolString()]),
  new Transformation.Transformation(
    Getter.transform((description) => globalThis.Symbol.for(isSymbolStringRegExp.exec(description)![1])),
    Getter.transformOrFail((sym: symbol) => {
      const description = sym.description
      if (description !== undefined) {
        if (globalThis.Symbol.for(description) === sym) {
          return Effect.succeed(globalThis.String(sym))
        }
        return Effect.fail(
          new Issue.Forbidden(Option.some(sym), { message: "cannot serialize to string, Symbol is not registered" })
        )
      }
      return Effect.fail(
        new Issue.Forbidden(Option.some(sym), { message: "cannot serialize to string, Symbol has no description" })
      )
    })
  )
)

/** @internal */
export function isSymbolString(annotations?: Annotations.Filter) {
  return isPattern(
    isSymbolStringRegExp,
    Annotations.combine({
      description: "a string representing a symbol",
      meta: {
        _tag: "isSymbolString",
        regex: isSymbolStringRegExp
      }
    }, annotations)
  )
}

/** @internal */
export function collectIssues<T>(
  checks: ReadonlyArray<Check<T>>,
  value: T,
  issues: Array<Issue.Issue>,
  ast: AST,
  options: ParseOptions
) {
  for (let i = 0; i < checks.length; i++) {
    const check = checks[i]
    if (check._tag === "FilterGroup") {
      collectIssues(check.checks, value, issues, ast, options)
    } else {
      const issue = check.run(value, ast, options)
      if (issue) {
        issues.push(new Issue.Filter(value, check, issue))
        if (check.aborted || options?.errors !== "all") {
          return
        }
      }
    }
  }
}

/** @internal */
export function runChecks<T>(
  checks: readonly [Check<T>, ...Array<Check<T>>],
  s: T
): Result.Result<T, Issue.Issue> {
  const issues: Array<Issue.Issue> = []
  collectIssues(checks, s, issues, unknown, { errors: "all" })
  if (Arr.isArrayNonEmpty(issues)) {
    const issue = new Issue.Composite(unknown, Option.some(s), issues)
    return Result.fail(issue)
  }
  return Result.succeed(s)
}

/** @internal */
export function runRefine<T extends E, E>(refine: Refine<T, E>, s: E): Result.Result<T, Issue.Issue> {
  return runChecks([refine], s) as any
}

/** @internal */
export const ClassTypeId = "~effect/schema/Schema/Class"
