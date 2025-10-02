/**
 * @since 4.0.0
 */

import * as Cause from "../Cause.ts"
import * as Arr from "../collections/Array.ts"
import type * as Combiner from "../data/Combiner.ts"
import * as Filter from "../data/Filter.ts"
import * as Option from "../data/Option.ts"
import * as Predicate from "../data/Predicate.ts"
import * as Result from "../data/Result.ts"
import * as Effect from "../Effect.ts"
import type * as Exit from "../Exit.ts"
import { memoize } from "../Function.ts"
import { effectIsExit } from "../internal/effect.ts"
import * as internalRecord from "../internal/record.ts"
import * as RegEx from "../RegExp.ts"
import * as Annotations from "./Annotations.ts"
import * as Check from "./Check.ts"
import * as Getter from "./Getter.ts"
import * as Issue from "./Issue.ts"
import type * as Schema from "./Schema.ts"
import type * as ToParser from "./ToParser.ts"
import * as Transformation from "./Transformation.ts"

/**
 * @category model
 * @since 4.0.0
 */
export type AST =
  | Declaration
  | NullKeyword
  | UndefinedKeyword
  | VoidKeyword
  | NeverKeyword
  | UnknownKeyword
  | AnyKeyword
  | StringKeyword
  | NumberKeyword
  | BooleanKeyword
  | BigIntKeyword
  | SymbolKeyword
  | LiteralType
  | UniqueSymbol
  | ObjectKeyword
  | Enums
  | TemplateLiteral
  | TupleType
  | TypeLiteral
  | UnionType
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
export const isNullKeyword = makeGuard("NullKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isUndefinedKeyword = makeGuard("UndefinedKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isVoidKeyword = makeGuard("VoidKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isNeverKeyword = makeGuard("NeverKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isUnknownKeyword = makeGuard("UnknownKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isAnyKeyword = makeGuard("AnyKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isStringKeyword = makeGuard("StringKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isNumberKeyword = makeGuard("NumberKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isBooleanKeyword = makeGuard("BooleanKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isBigIntKeyword = makeGuard("BigIntKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isSymbolKeyword = makeGuard("SymbolKeyword")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isLiteralType = makeGuard("LiteralType")

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
export const isEnums = makeGuard("Enums")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isTemplateLiteral = makeGuard("TemplateLiteral")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isTupleType = makeGuard("TupleType")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isTypeLiteral = makeGuard("TypeLiteral")

/**
 * @category Guard
 * @since 4.0.0
 */
export const isUnionType = makeGuard("UnionType")

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
   * When using a `TypeLiteral` to parse a value, by default any properties that
   * are not specified in the schema will be stripped out from the output. This
   * is because the `TypeLiteral` is expecting a specific shape for the parsed
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
export type Checks = readonly [Check.Check<any>, ...Array<Check.Check<any>>]

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
export abstract class AbstractParser extends Base {
  /** @internal */
  abstract parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser
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
  parser(): ToParser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    const run = ast.run(ast.typeParameters)
    return function(oinput, options) {
      if (Option.isNone(oinput)) {
        return Effect.succeedNone
      }
      return Effect.mapEager(run(oinput.value, ast, options), Option.some)
    }
  }
  /** @internal */
  go(go: (ast: AST) => AST) {
    const tps = mapOrSame(this.typeParameters, go)
    return tps === this.typeParameters ?
      this :
      new Declaration(tps, this.run, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  getExpected(): string {
    // Annotations on checks are ignored internally
    const expected = this.annotations?.identifier ?? this.annotations?.title
    if (Predicate.isString(expected)) return expected
    return "<Declaration>"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NullKeyword extends AbstractParser {
  readonly _tag = "NullKeyword"
  /** @internal */
  parser() {
    return fromConst(this, null)
  }
  /** @internal */
  getExpected(): string {
    return "null"
  }
}

/**
 * @since 4.0.0
 */
export const nullKeyword = new NullKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class UndefinedKeyword extends AbstractParser {
  readonly _tag = "UndefinedKeyword"
  /** @internal */
  parser() {
    return fromConst(this, undefined)
  }
  /** @internal */
  goJson(): AST {
    return replaceEncoding(this, [undefinedJsonLink])
  }
  /** @internal */
  getExpected(): string {
    return "undefined"
  }
}

/**
 * @since 4.0.0
 */
export const undefinedKeyword = new UndefinedKeyword()

const undefinedJsonLink = new Link(
  nullKeyword,
  new Transformation.Transformation(
    Getter.transform(() => undefined),
    Getter.transform(() => null)
  )
)

/**
 * @category model
 * @since 4.0.0
 */
export class VoidKeyword extends AbstractParser {
  readonly _tag = "VoidKeyword"
  /** @internal */
  parser() {
    return fromConst(this, undefined)
  }
  /** @internal */
  goJson(): AST {
    return replaceEncoding(this, [undefinedJsonLink])
  }
  /** @internal */
  getExpected(): string {
    return "void"
  }
}

/**
 * @since 4.0.0
 */
export const voidKeyword = new VoidKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class NeverKeyword extends AbstractParser {
  readonly _tag = "NeverKeyword"
  /** @internal */
  parser() {
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
export const neverKeyword = new NeverKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class AnyKeyword extends AbstractParser {
  readonly _tag = "AnyKeyword"
  /** @internal */
  parser() {
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
export const anyKeyword = new AnyKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class UnknownKeyword extends AbstractParser {
  readonly _tag = "UnknownKeyword"
  /** @internal */
  parser() {
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
export const unknownKeyword = new UnknownKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class ObjectKeyword extends AbstractParser {
  readonly _tag = "ObjectKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isObject)
  }
  /** @internal */
  getExpected(): string {
    return "object | array | function"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Enums extends AbstractParser {
  readonly _tag = "Enums"
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
  parser() {
    const values = new Set<unknown>(this.enums.map(([, v]) => v))
    return fromRefinement(
      this,
      (input): input is typeof this.enums[number][1] => values.has(input)
    )
  }
  /** @internal */
  goStringPojo(): AST {
    if (this.enums.some(([_, v]) => Predicate.isNumber(v))) {
      const coercions = Object.fromEntries(this.enums.map(([_, v]) => [String(v), v]))
      return replaceEncoding(this, [
        new Link(
          new UnionType(Object.keys(coercions).map((k) => new LiteralType(k)), "anyOf"),
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

/**
 * @since 4.0.0
 */
export const objectKeyword = new ObjectKeyword()

type TemplateLiteralPart =
  | StringKeyword
  | NumberKeyword
  | BigIntKeyword
  | LiteralType
  | TemplateLiteral
  | UnionType<TemplateLiteralPart>

function isTemplateLiteralPart(ast: AST): ast is TemplateLiteralPart {
  switch (ast._tag) {
    case "StringKeyword":
    case "NumberKeyword":
    case "BigIntKeyword":
    case "LiteralType":
    case "TemplateLiteral":
      return true
    case "UnionType":
      return ast.types.every(isTemplateLiteralPart)
    default:
      return false
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TemplateLiteral extends AbstractParser {
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
        throw new Error("Invalid TemplateLiteral part")
      }
    }
    this.parts = parts
    this.encodedParts = encodedParts
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    const parser = go(this.asTemplateLiteralParser())
    return (oinput: Option.Option<unknown>, options: ParseOptions) =>
      Effect.mapBothEager(parser(oinput, options), {
        onSuccess: () => oinput,
        onFailure: () => new Issue.InvalidType(this, oinput)
      })
  }
  /** @internal */
  getExpected(): string {
    return formatTemplateLiteral(this)
  }
  /** @internal */
  asTemplateLiteralParser(): TupleType {
    const tuple = goTemplateLiteral(new TupleType(false, this.parts, [])) as TupleType
    const regex = getTemplateLiteralRegExp(this)
    return decodeTo(
      stringKeyword,
      tuple,
      new Transformation.Transformation(
        Getter.transform((s: string) => {
          const match = regex.exec(s)
          if (match) {
            return match.slice(1, this.parts.length + 1)
          }
          return []
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
export type Literal = string | number | boolean | bigint

/**
 * @category model
 * @since 4.0.0
 */
export class UniqueSymbol extends AbstractParser {
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
  parser() {
    return fromConst(this, this.symbol)
  }
  /** @internal */
  goJson(): AST {
    return replaceEncoding(this, [symbolJsonLink])
  }
  /** @internal */
  getExpected(): string {
    return String(this.symbol)
  }
}

/** @internal */
export function coerceLiteral(ast: LiteralType): LiteralType {
  const s = String(ast.literal)
  return replaceEncoding(ast, [
    new Link(
      new LiteralType(s),
      new Transformation.Transformation(
        Getter.transform(() => ast.literal),
        Getter.transform(() => s)
      )
    )
  ])
}

/**
 * @category model
 * @since 4.0.0
 */
export class LiteralType extends AbstractParser {
  readonly _tag = "LiteralType"
  readonly literal: Literal

  constructor(
    literal: Literal,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.literal = literal
    if (process.env.NODE_ENV !== "production") {
      if (Predicate.isNumber(this.literal) && !Number.isFinite(this.literal)) {
        throw new Error("LiteralType must be a finite number")
      }
    }
  }
  /** @internal */
  parser() {
    return fromConst(this, this.literal)
  }
  /** @internal */
  goJson(): AST {
    return Predicate.isBigInt(this.literal) ? coerceLiteral(this) : this
  }
  /** @internal */
  goStringPojo(): AST {
    return Predicate.isString(this.literal) ? this : coerceLiteral(this)
  }
  /** @internal */
  getExpected(): string {
    return Predicate.isString(this.literal) ? JSON.stringify(this.literal) : String(this.literal)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class StringKeyword extends AbstractParser {
  readonly _tag = "StringKeyword"
  /** @internal */
  parser() {
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
export const stringKeyword = new StringKeyword()

/**
 * **Default Json Serializer**
 *
 * - If the number is finite, it is serialized as a number.
 * - If the number is infinite or NaN, it is serialized as a string.
 *
 * @category model
 * @since 4.0.0
 */
export class NumberKeyword extends AbstractParser {
  readonly _tag = "NumberKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isNumber)
  }
  /** @internal */
  goJson(): AST {
    return replaceEncoding(this, [numberJsonLink])
  }
  /** @internal */
  goStringPojo(): AST {
    return replaceEncoding(this, [numberStringPojoLink])
  }
  /** @internal */
  getExpected(): string {
    return "number"
  }
}

/**
 * @since 4.0.0
 */
export const numberKeyword = new NumberKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class BooleanKeyword extends AbstractParser {
  readonly _tag = "BooleanKeyword"
  /** @internal */
  parser() {
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
export const booleanKeyword = new BooleanKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class SymbolKeyword extends AbstractParser {
  readonly _tag = "SymbolKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isSymbol)
  }
  /** @internal */
  goJson(): AST {
    return replaceEncoding(this, [symbolJsonLink])
  }
  /** @internal */
  getExpected(): string {
    return "symbol"
  }
}

/**
 * @since 4.0.0
 */
export const symbolKeyword = new SymbolKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class BigIntKeyword extends AbstractParser {
  readonly _tag = "BigIntKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isBigInt)
  }
  /** @internal */
  goJson(): AST {
    return replaceEncoding(this, [bigIntJsonLink])
  }
  /** @internal */
  getExpected(): string {
    return "bigint"
  }
}

/**
 * @since 4.0.0
 */
export const bigIntKeyword = new BigIntKeyword()

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
  readonly isMutable: boolean
  readonly parameter: AST
  readonly type: AST
  readonly merge: KeyValueCombiner | undefined

  constructor(
    isMutable: boolean,
    parameter: AST,
    type: AST,
    merge: KeyValueCombiner | undefined
  ) {
    this.isMutable = isMutable
    this.parameter = parameter
    this.type = type
    this.merge = merge
    if (process.env.NODE_ENV !== "production") {
      if (isOptional(type) && !containsUndefined(type)) {
        throw new Error("Cannot use `Schema.optionalKey` with index signatures, use `Schema.optional` instead.")
      }
    }
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TupleType extends Base {
  readonly _tag = "TupleType"
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

    if (process.env.NODE_ENV !== "production") {
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
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    const elements = ast.elements.map((ast) => ({
      ast,
      parser: go(ast)
    }))
    const elementCount = elements.length
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
      for (; i < elementCount; i++) {
        const e = elements[i]
        const value = i < input.length ? Option.some(input[i]) : Option.none()
        const eff = e.parser(value, options)
        const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
        if (exit._tag === "Failure") {
          const issueElement = Cause.filterError(exit.cause)
          if (Filter.isFail(issueElement)) {
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
      if (Arr.isReadonlyArrayNonEmpty(ast.rest)) {
        const [head, ...tail] = ast.rest
        const parser = go(head)
        const keyAnnotations = head.context?.annotations
        for (; i < len - tail.length; i++) {
          const eff = parser(Option.some(input[i]), options)
          const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
          if (exit._tag === "Failure") {
            const issueRest = Cause.filterError(exit.cause)
            if (Filter.isFail(issueRest)) {
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
            const parser = go(tail[j])
            const keyAnnotations = tail[j].context?.annotations
            const eff = parser(Option.some(input[i]), options)
            const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
            if (exit._tag === "Failure") {
              const issueRest = Cause.filterError(exit.cause)
              if (Filter.isFail(issueRest)) {
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
        for (let i = ast.elements.length; i <= len - 1; i++) {
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
  go(go: (ast: AST) => AST) {
    const elements = mapOrSame(this.elements, go)
    const rest = mapOrSame(this.rest, go)
    return elements === this.elements && rest === this.rest ?
      this :
      new TupleType(this.isMutable, elements, rest, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  getExpected(): string {
    return "array"
  }
}

function getIndexSignatureHash(ast: AST): string {
  if (isTemplateLiteral(ast)) {
    return ast.parts.map((part) => isLiteralType(part) ? String(part.literal) : `\${${getIndexSignatureHash(part)}}`)
      .join("")
  }
  return ast._tag
}

/** @internal */
export function getIndexSignatureKeys(
  input: { readonly [x: PropertyKey]: unknown },
  is: IndexSignature
): ReadonlyArray<PropertyKey> {
  const parameter = encodedAST(is.parameter)
  switch (parameter._tag) {
    case "TemplateLiteral": {
      const regex = getTemplateLiteralRegExp(parameter)
      return Object.keys(input).filter((key) => regex.test(key))
    }
    case "SymbolKeyword":
      return Object.getOwnPropertySymbols(input)
    case "NumberKeyword":
      return Object.keys(input).filter((key) => numberKeywordPatternRegExp.test(key))
    default:
      return Object.keys(input)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TypeLiteral extends Base {
  readonly _tag = "TypeLiteral"
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

    if (process.env.NODE_ENV !== "production") {
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
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    const expectedKeys: Array<PropertyKey> = []
    const expectedKeysSet = new Set<PropertyKey>()
    const properties: Array<{
      readonly ps: PropertySignature
      readonly parser: ToParser.Parser
      readonly name: PropertyKey
      readonly type: AST
    }> = []
    const propertyCount = ast.propertySignatures.length
    for (const ps of ast.propertySignatures) {
      expectedKeys.push(ps.name)
      expectedKeysSet.add(ps.name)
      properties.push({
        ps,
        parser: go(ps.type),
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
        const value: Option.Option<unknown> = Object.hasOwn(input, p.name) ? Option.some(input[p.name]) : Option.none()
        const eff = p.parser(value, options)
        const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
        if (exit._tag === "Failure") {
          const issueProp = Cause.filterError(exit.cause)
          if (Filter.isFail(issueProp)) {
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
          const keys = getIndexSignatureKeys(input, is)
          for (let j = 0; j < keys.length; j++) {
            const key = keys[j]
            const parserKey = go(goIndexSignature(is.parameter))
            const effKey = parserKey(Option.some(key), options)
            const exitKey = (effectIsExit(effKey) ? effKey : yield* Effect.exit(effKey)) as Exit.Exit<
              Option.Option<PropertyKey>,
              Issue.Issue
            >
            if (exitKey._tag === "Failure") {
              const issueKey = Cause.filterError(exitKey.cause)
              if (Filter.isFail(issueKey)) {
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
            const parserValue = go(is.type)
            const effValue = parserValue(value, options)
            const exitValue = effectIsExit(effValue) ? effValue : yield* Effect.exit(effValue)
            if (exitValue._tag === "Failure") {
              const issueValue = Cause.filterError(exitValue.cause)
              if (Filter.isFail(issueValue)) {
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
    go: (ast: AST) => AST,
    flipMerge: boolean
  ): TypeLiteral {
    const props = mapOrSame(this.propertySignatures, (ps) => {
      const t = go(ps.type)
      return t === ps.type ? ps : new PropertySignature(ps.name, t)
    })

    const indexes = mapOrSame(this.indexSignatures, (is) => {
      const p = go(is.parameter)
      const t = go(is.type)
      const merge = flipMerge ? is.merge?.flip() : is.merge
      return p === is.parameter && t === is.type && merge === is.merge
        ? is
        : new IndexSignature(is.isMutable, p, t, merge)
    })

    return props === this.propertySignatures && indexes === this.indexSignatures
      ? this
      : new TypeLiteral(props, indexes, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  flip(go: (ast: AST) => AST): AST {
    return this.rebuild(go, true)
  }
  /** @internal */
  go(go: (ast: AST) => AST): AST {
    return this.rebuild(go, false)
  }
  /** @internal */
  getExpected(): string {
    if (this.propertySignatures.length === 0 && this.indexSignatures.length === 0) return "object | array"
    const tag = this.propertySignatures.find((ps) => ps.name === "_tag")
    if (tag) return `{ _tag: ${Annotations.getExpected(tag.type)}, ... }`
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
): TypeLiteral {
  return new TypeLiteral(
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
): TupleType {
  return new TupleType(false, elements.map((e) => e.ast), [], undefined, checks)
}

/** @internal */
export function union<Members extends ReadonlyArray<Schema.Top>>(
  members: Members,
  mode: "anyOf" | "oneOf",
  checks: Checks | undefined
): UnionType<Members[number]["ast"]> {
  return new UnionType(members.map(getAST), mode, undefined, checks)
}

/** @internal */
export function structWithRest(ast: TypeLiteral, records: ReadonlyArray<TypeLiteral>): TypeLiteral {
  if (process.env.NODE_ENV !== "production") {
    if (ast.encoding || records.some((r) => r.encoding)) {
      throw new Error("StructWithRest does not support encodings")
    }
  }
  let propertySignatures = ast.propertySignatures
  let indexSignatures = ast.indexSignatures
  let checks = ast.checks
  for (const r of records) {
    propertySignatures = propertySignatures.concat(r.propertySignatures)
    indexSignatures = indexSignatures.concat(r.indexSignatures)
    checks = mergeChecks(checks, r)
  }
  return new TypeLiteral(propertySignatures, indexSignatures, undefined, checks)
}

/** @internal */
export function tupleWithRest(ast: TupleType, rest: ReadonlyArray<AST>): TupleType {
  if (process.env.NODE_ENV !== "production") {
    if (ast.encoding) {
      throw new Error("TupleWithRest does not support encodings")
    }
  }
  return new TupleType(ast.isMutable, ast.elements, rest, undefined, ast.checks)
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
  readonly literal: Literal
}

/** @internal */
export function getCandidateTypes(ast: AST): ReadonlyArray<Type> {
  switch (ast._tag) {
    case "NullKeyword":
      return ["null"]
    case "UndefinedKeyword":
    case "VoidKeyword":
      return ["undefined"]
    case "StringKeyword":
    case "TemplateLiteral":
      return ["string"]
    case "NumberKeyword":
      return ["number"]
    case "BooleanKeyword":
      return ["boolean"]
    case "SymbolKeyword":
    case "UniqueSymbol":
      return ["symbol"]
    case "BigIntKeyword":
      return ["bigint"]
    case "TupleType":
      return ["array"]
    case "ObjectKeyword":
      return ["object", "array", "function"]
    case "TypeLiteral":
      return ast.propertySignatures.length || ast.indexSignatures.length
        ? ["object"]
        : ["object", "array"]
    case "Enums":
      return ["string", "number"]
    case "LiteralType":
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
    case "TypeLiteral": {
      const v = ast.propertySignatures.flatMap((ps) =>
        isLiteralType(ps.type) && !isOptional(ps.type)
          ? [{ key: ps.name, literal: ps.type.literal }]
          : []
      )
      return v.length ? v : undefined
    }
    case "TupleType": {
      const v = ast.elements.flatMap((e, i) =>
        isLiteralType(e) && !isOptional(e)
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
  bySentinel?: Map<PropertyKey, Map<Literal, Array<AST>>>
  otherwise?: { [K in Type]?: Array<AST> }
}

const candidateIndexCache = new WeakMap<ReadonlyArray<AST>, CandidateIndex>()

/** @internal */
function getIndex(types: ReadonlyArray<AST>): CandidateIndex {
  let idx = candidateIndexCache.get(types)
  if (idx) return idx

  idx = {}
  for (const a of types) {
    const encoded = encodedAST(a)
    if (isNeverKeyword(encoded)) continue

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
    return encoded._tag === "LiteralType" ?
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
export class UnionType<A extends AST = AST> extends Base {
  readonly _tag = "UnionType"
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
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
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
        const parser = go(candidate)
        const eff = parser(oinput, options)
        const exit = effectIsExit(eff) ? eff : yield* Effect.exit(eff)
        if (exit._tag === "Failure") {
          const issue = Cause.filterError(exit.cause)
          if (Filter.isFail(issue)) {
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
        return yield* Effect.fail(new Issue.AnyOf(ast, oinput, issues ?? []))
      }
    })
  }
  /** @internal */
  go(go: (ast: AST) => AST) {
    const types = mapOrSame(this.types, go)
    return types === this.types ?
      this :
      new UnionType(types, this.mode, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  getExpected(getExpected: (ast: AST) => string): string {
    if (this.types.length === 0) return "never"
    return Array.from(new Set(this.types.map(getExpected))).join(" | ")
  }
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
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    return go(this.thunk())
  }
  /** @internal */
  go(go: (ast: AST) => AST) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return new Suspend(() => go(ast.thunk()), ast.annotations, ast.checks, undefined, ast.context)
  }
  /** @internal */
  getExpected(getExpected: (ast: AST) => string): string {
    return getExpected(this.thunk())
  }
}

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
export function replaceEncoding<A extends AST>(ast: A, encoding: Encoding | undefined): A {
  if (ast.encoding === encoding) {
    return ast
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding
  })
}

/** @internal */
export function replaceLastLink(encoding: Encoding, link: Link): Encoding {
  return Arr.append(encoding.slice(0, encoding.length - 1), link)
}

function replaceContext<A extends AST>(ast: A, context: Context | undefined): A {
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

/** @internal */
export function apply(f: (ast: AST) => AST): (ast: AST) => AST {
  function out(ast: AST): AST {
    if (ast.encoding) {
      const links = ast.encoding
      const last = links[links.length - 1]
      const to = out(last.to)
      return to === last.to ?
        ast :
        replaceEncoding(ast, replaceLastLink(links, new Link(to, last.transformation)))
    }
    return f(ast)
  }
  return out
}

function applyEncoded<A extends AST>(ast: A, f: (ast: AST) => AST): A {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    const to = f(last.to)
    return to === last.to ?
      ast :
      replaceEncoding(ast, replaceLastLink(links, new Link(to, last.transformation)))
  }
  return ast
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
 *
 * @internal
 */
export function mapOrSame<A>(as: Arr.NonEmptyReadonlyArray<A>, f: (a: A) => A): Arr.NonEmptyReadonlyArray<A>
export function mapOrSame<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A>
export function mapOrSame<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A> {
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
export function optionalKey<A extends AST>(ast: A): A {
  const context = ast.context ?
    new Context(true, ast.context.isMutable, ast.context.defaultValue, ast.context.annotations) :
    new Context(true, false)
  return applyEncoded(replaceContext(ast, context), optionalKey)
}

/** @internal */
export function mutableKey<A extends AST>(ast: A): A {
  const context = ast.context ?
    new Context(ast.context.isOptional, true, ast.context.defaultValue, ast.context.annotations) :
    new Context(false, true)
  return applyEncoded(replaceContext(ast, context), mutableKey)
}

/** @internal */
export function withConstructorDefault<A extends AST>(
  ast: A,
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
  const encoding: Encoding = [new Link(unknownKeyword, transformation)]
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

function mutableContext(ast: AST, isMutable: boolean): AST {
  switch (ast._tag) {
    case "TupleType":
      return new TupleType(isMutable, ast.elements, ast.rest, ast.annotations, ast.checks, ast.encoding, ast.context)
    case "TypeLiteral":
      return new TypeLiteral(
        ast.propertySignatures.map((ps) => {
          const ast = ps.type
          return new PropertySignature(
            ps.name,
            replaceContext(
              ast,
              ast.context
                ? new Context(
                  ast.context.isOptional,
                  isMutable,
                  ast.context.defaultValue,
                  ast.context.annotations
                )
                : new Context(false, isMutable)
            )
          )
        }),
        ast.indexSignatures.map((is) => new IndexSignature(isMutable, is.parameter, is.type, is.merge)),
        ast.annotations,
        ast.checks,
        ast.encoding,
        ast.context
      )
    case "UnionType":
      return new UnionType(ast.types.map(mutable), ast.mode, ast.annotations, ast.checks, ast.encoding, ast.context)
    case "Suspend":
      return new Suspend(() => mutable(ast.thunk()), ast.annotations, ast.checks, ast.encoding, ast.context)
    default:
      return ast
  }
}

/** @internal */
export function mutable<A extends AST>(ast: A): A {
  return mutableContext(ast, true) as A
}

/** @internal */
export function readonly<A extends AST>(ast: A): A {
  return mutableContext(ast, false) as A
}

function parseParameter(ast: AST): {
  literals: ReadonlyArray<PropertyKey>
  parameters: ReadonlyArray<AST>
} {
  switch (ast._tag) {
    case "LiteralType":
      return {
        literals: Predicate.isPropertyKey(ast.literal) ? [ast.literal] : [],
        parameters: []
      }
    case "UniqueSymbol":
      return {
        literals: [ast.symbol],
        parameters: []
      }
    case "StringKeyword":
    case "NumberKeyword":
    case "SymbolKeyword":
    case "TemplateLiteral":
      return {
        literals: [],
        parameters: [ast]
      }
    case "UnionType": {
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
export function record(key: AST, value: AST, keyValueCombiner: KeyValueCombiner | undefined): TypeLiteral {
  const { literals, parameters: indexSignatures } = parseParameter(key)
  return new TypeLiteral(
    literals.map((literal) => new PropertySignature(literal, value)),
    indexSignatures.map((parameter) => new IndexSignature(false, parameter, value, keyValueCombiner))
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
  return out.go?.(typeAST) ?? out
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
  return out.flip?.(flip) ?? out.go?.(flip) ?? out
})

/** @internal */
export function containsUndefined(ast: AST): boolean {
  switch (ast._tag) {
    case "UndefinedKeyword":
      return true
    case "UnionType":
      return ast.types.some(containsUndefined)
    default:
      return false
  }
}

function formatTemplateLiteral(ast: TemplateLiteral): string {
  const formatUnionPart = (part: TemplateLiteralPart): string => {
    if (isUnionType(part)) {
      return part.types.map(formatUnionPart).join(" | ")
    }
    switch (part._tag) {
      case "LiteralType":
        return Annotations.getExpected(part)
      case "StringKeyword":
        return "string"
      case "NumberKeyword":
        return "number"
      case "BigIntKeyword":
        return "bigint"
      case "TemplateLiteral":
        return formatTemplateLiteral(part)
    }
  }

  return "`" + ast.encodedParts.map((part) => {
    switch (part._tag) {
      case "LiteralType":
        return String(part.literal)
      case "StringKeyword":
        return "${string}"
      case "NumberKeyword":
        return "${number}"
      case "BigIntKeyword":
        return "${bigint}"
      case "TemplateLiteral":
        return "${" + formatTemplateLiteral(part) + "}"
      case "UnionType":
        return "${" + part.types.map(formatUnionPart).join(" | ") + "}"
    }
  }).join("") + "`"
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

/**
 * any string, including newlines
 */
const STRING_KEYWORD_PATTERN = "[\\s\\S]*?"
/**
 * floating point or integer, with optional exponent
 */
const NUMBER_KEYWORD_PATTERN = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?"
/**
 * signed integer only (no leading "+")
 */
const BIGINT_KEYWORD_PATTERN = "-?\\d+"

function getTemplateLiteralASTPartPattern(part: TemplateLiteralPart): string {
  switch (part._tag) {
    case "LiteralType":
      return RegEx.escape(String(part.literal))
    case "StringKeyword":
      return STRING_KEYWORD_PATTERN
    case "NumberKeyword":
      return NUMBER_KEYWORD_PATTERN
    case "BigIntKeyword":
      return BIGINT_KEYWORD_PATTERN
    case "TemplateLiteral":
      return getTemplateLiteralSource(part, false)
    case "UnionType":
      return part.types.map((type) => getTemplateLiteralASTPartPattern(type)).join("|")
  }
}

function handleTemplateLiteralASTPartParens(part: TemplateLiteralPart, s: string, top: boolean): string {
  if (isUnionType(part)) {
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
): ToParser.Parser {
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
): ToParser.Parser {
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
export const enumsToLiterals = memoize((ast: Enums): UnionType<LiteralType> => {
  return new UnionType(
    ast.enums.map((e) => new LiteralType(e[1], { title: e[0] })),
    "anyOf"
  )
})

/** @internal */
export function getFilters(checks: Checks | undefined): Array<Check.Filter<any>> {
  if (checks) {
    return checks.flatMap((check) => {
      switch (check._tag) {
        case "Filter":
          return [check]
        case "FilterGroup":
          return getFilters(check.checks)
      }
    })
  }
  return []
}

/**
 * @category Reducer
 * @since 4.0.0
 */
export type ReducerAlg<A> = {
  readonly onEnter?: ((ast: AST, reduce: (ast: AST) => A) => Option.Option<A>) | undefined
  readonly Declaration: (ast: Declaration, reduce: (ast: AST) => A) => A
  readonly NullKeyword: (ast: NullKeyword, reduce: (ast: AST) => A) => A
  readonly UndefinedKeyword: (ast: UndefinedKeyword, reduce: (ast: AST) => A) => A
  readonly VoidKeyword: (ast: VoidKeyword, reduce: (ast: AST) => A) => A
  readonly NeverKeyword: (ast: NeverKeyword, reduce: (ast: AST) => A) => A
  readonly UnknownKeyword: (ast: UnknownKeyword, reduce: (ast: AST) => A) => A
  readonly AnyKeyword: (ast: AnyKeyword, reduce: (ast: AST) => A) => A
  readonly StringKeyword: (ast: StringKeyword, reduce: (ast: AST) => A) => A
  readonly NumberKeyword: (ast: NumberKeyword, reduce: (ast: AST) => A) => A
  readonly BooleanKeyword: (ast: BooleanKeyword, reduce: (ast: AST) => A) => A
  readonly SymbolKeyword: (ast: SymbolKeyword, reduce: (ast: AST) => A) => A
  readonly BigIntKeyword: (ast: BigIntKeyword, reduce: (ast: AST) => A) => A
  readonly UniqueSymbol: (ast: UniqueSymbol, reduce: (ast: AST) => A) => A
  readonly ObjectKeyword: (ast: ObjectKeyword, reduce: (ast: AST) => A) => A
  readonly Enums: (ast: Enums, reduce: (ast: AST) => A) => A
  readonly LiteralType: (ast: LiteralType, reduce: (ast: AST) => A) => A
  readonly TemplateLiteral: (ast: TemplateLiteral, reduce: (ast: AST) => A) => A
  readonly TupleType: (ast: TupleType, reduce: (ast: AST) => A) => A
  readonly TypeLiteral: (ast: TypeLiteral, reduce: (ast: AST) => A) => A
  readonly UnionType: (ast: UnionType, reduce: (ast: AST) => A, getCandidates: (ast: AST) => ReadonlyArray<AST>) => A
  readonly Suspend: (ast: Suspend, reduce: (ast: AST) => A) => A
}

/**
 * @category Reducer
 * @since 4.0.0
 */
export function getReducer<A>(alg: ReducerAlg<A>) {
  return function reduce(ast: AST): A {
    // ---------------------------------------------
    // handle hooks
    // ---------------------------------------------
    if (alg.onEnter) {
      const oa = alg.onEnter(ast, reduce)
      if (Option.isSome(oa)) {
        return oa.value
      }
    }
    // ---------------------------------------------
    // handle AST nodes
    // ---------------------------------------------
    switch (ast._tag) {
      case "UnionType":
        return alg.UnionType(ast, reduce, (t) => getCandidates(t, ast.types))
      default:
        return alg[ast._tag](ast as any, reduce)
    }
  }
}

const goIndexSignature = memoize(apply((ast: AST): AST => {
  switch (ast._tag) {
    case "NumberKeyword":
      return ast.goStringPojo()
    case "UnionType":
      return ast.go(goIndexSignature)
    default:
      return ast
  }
}))

const goTemplateLiteral = memoize(apply((ast: AST): AST => {
  switch (ast._tag) {
    case "StringKeyword":
    case "TemplateLiteral":
      return ast
    case "BigIntKeyword":
      return ast.goJson()
    case "NumberKeyword":
    case "LiteralType":
      return ast.goStringPojo()
    case "TupleType":
    case "UnionType":
      return ast.go(goTemplateLiteral)
  }
  throw new Error(`Unsupported template literal part tag: ${ast._tag}`)
}))

const numberJsonLink = new Link(
  new UnionType(
    [numberKeyword, new LiteralType("Infinity"), new LiteralType("-Infinity"), new LiteralType("NaN")],
    "anyOf"
  ),
  new Transformation.Transformation(
    Getter.Number(),
    Getter.transform((n) => Number.isFinite(n) ? n : String(n))
  )
)

const numberKeywordPatternRegExp = new RegExp(`(?:${NUMBER_KEYWORD_PATTERN}|Infinity|-Infinity|NaN)`)

const numberKeywordPattern = appendChecks(stringKeyword, [
  Check.regex(numberKeywordPatternRegExp, {
    title: "a string representing a number"
  })
])

const numberStringPojoLink = new Link(
  numberKeywordPattern,
  Transformation.numberFromString
)

const bigIntJsonLink = new Link(
  appendChecks(stringKeyword, [
    Check.regex(new RegExp(BIGINT_KEYWORD_PATTERN), { title: "a string representing a bigint" })
  ]),
  new Transformation.Transformation(
    Getter.transform(BigInt),
    Getter.String()
  )
)

const SYMBOL_PATTERN = /^Symbol\((.*)\)$/

/**
 * to distinguish between Symbol and String, we need to add a check to the string keyword
 */
const symbolJsonLink = new Link(
  appendChecks(stringKeyword, [Check.regex(SYMBOL_PATTERN, { title: "a string representing a symbol" })]),
  new Transformation.Transformation(
    Getter.transform((description) => Symbol.for(SYMBOL_PATTERN.exec(description)![1])),
    Getter.transformOrFail((sym: symbol) => {
      const description = sym.description
      if (description !== undefined) {
        if (Symbol.for(description) === sym) {
          return Effect.succeed(String(sym))
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
export function collectIssues<T>(
  checks: ReadonlyArray<Check.Check<T>>,
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
        if (check.abort || options?.errors !== "all") {
          return
        }
      }
    }
  }
}

/** @internal */
export function runChecks<T>(
  checks: readonly [Check.Check<T>, ...Array<Check.Check<T>>],
  s: T
): Result.Result<T, Issue.Issue> {
  const issues: Array<Issue.Issue> = []
  collectIssues(checks, s, issues, unknownKeyword, { errors: "all" })
  if (Arr.isArrayNonEmpty(issues)) {
    const issue = new Issue.Composite(unknownKeyword, Option.some(s), issues)
    return Result.fail(issue)
  }
  return Result.succeed(s)
}

/** @internal */
export function runRefine<T extends E, E>(refine: Check.Refine<T, E>, s: E): Result.Result<T, Issue.Issue> {
  return runChecks([refine], s) as any
}

/** @internal */
export const ClassTypeId = "~effect/schema/Schema/Class"
