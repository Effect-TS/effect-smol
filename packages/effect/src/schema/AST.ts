/**
 * @since 4.0.0
 */

import * as Arr from "../Array.ts"
import * as Effect from "../Effect.ts"
import * as internalRecord from "../internal/record.ts"
import { formatPropertyKey, memoizeThunk, ownKeys } from "../internal/schema/util.ts"
import * as Option from "../Option.ts"
import * as Predicate from "../Predicate.ts"
import * as RegEx from "../RegExp.ts"
import * as Result from "../Result.ts"
import type { Annotated } from "./Annotations.ts"
import type * as Annotations from "./Annotations.ts"
import type * as Check from "./Check.ts"
import * as Getter from "./Getter.ts"
import * as Issue from "./Issue.ts"
import type * as Schema from "./Schema.ts"
import type * as ToParser from "./ToParser.ts"
import * as Transformation_ from "./Transformation.ts"

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
export type Middleware = Transformation_.Middleware<any, any, any, any, any, any>

/**
 * @category model
 * @since 4.0.0
 */
export type Transformation = Transformation_.Transformation<any, any, any, any>

/**
 * @category model
 * @since 4.0.0
 */
export class Link {
  readonly to: AST
  readonly transformation: Transformation | Middleware

  constructor(
    to: AST,
    transformation: Transformation | Middleware
  ) {
    this.to = to
    this.transformation = transformation
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Encoding = readonly [Link, ...ReadonlyArray<Link>]

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

  /** @internal */
  readonly "~variant"?: "make" | undefined
}

/**
 * @category model
 * @since 4.0.0
 */
export class Context {
  readonly isOptional: boolean
  readonly isMutable: boolean
  /** Used for constructor default values (e.g. `withConstructorDefault` API) */
  readonly defaultValue: Encoding | undefined
  /** Used for constructor encoding (e.g. `Class` API) */
  readonly make: Encoding | undefined
  readonly annotations: Annotations.Key | undefined

  constructor(
    isOptional: boolean,
    isMutable: boolean,
    /** Used for constructor default values (e.g. `withConstructorDefault` API) */
    defaultValue: Encoding | undefined = undefined,
    /** Used for constructor encoding (e.g. `Class` API) */
    make: Encoding | undefined = undefined,
    annotations: Annotations.Key | undefined = undefined
  ) {
    this.isOptional = isOptional
    this.isMutable = isMutable
    this.defaultValue = defaultValue
    this.make = make
    this.annotations = annotations
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Checks = readonly [Check.Check<any>, ...ReadonlyArray<Check.Check<any>>]

/**
 * @category model
 * @since 4.0.0
 */
export abstract class Base implements Annotated {
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
  typeAST(this: AST): AST {
    return replaceEncoding(this, undefined)
  }
  /** @internal */
  flip(this: AST): AST {
    if (this.encoding) {
      return flipEncoding(this, this.encoding)
    }
    return this
  }
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
  typeAST(): Declaration {
    const tps = mapOrSame(this.typeParameters, (tp) => typeAST(tp))
    return !this.encoding && tps === this.typeParameters ?
      this :
      new Declaration(tps, this.run, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  flip(): AST {
    if (this.encoding) {
      return flipEncoding(this, this.encoding)
    }
    const typeParameters = mapOrSame(this.typeParameters, flip)
    return typeParameters === this.typeParameters ?
      this :
      new Declaration(typeParameters, this.run, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  parser(): ToParser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    const run = ast.run(ast.typeParameters)
    return function(oinput, options) {
      if (Option.isNone(oinput)) {
        return Effect.succeed(Option.none())
      }
      return run(oinput.value, ast, options).pipe(Effect.mapEager(Option.some))
    }
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
    return fromRefinement(this, Predicate.isNull)
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
    return fromRefinement(this, Predicate.isUndefined)
  }
}

/**
 * @since 4.0.0
 */
export const undefinedKeyword = new UndefinedKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class VoidKeyword extends AbstractParser {
  readonly _tag = "VoidKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isUndefined)
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
    return fromRefinement(
      this,
      (input): input is typeof this.enums[number][1] => this.enums.some(([_, value]) => value === input)
    )
  }
}

/**
 * @since 4.0.0
 */
export const objectKeyword = new ObjectKeyword()

/**
 * @since 4.0.0
 */
export declare namespace TemplateLiteral {
  /**
   * @category model
   * @since 4.0.0
   */
  export type ASTPart =
    | StringKeyword
    | NumberKeyword
    | BigIntKeyword
    | LiteralType
    | TemplateLiteral
    | UnionType<ASTPart>
  /**
   * @since 4.0.0
   */
  export type LiteralPart = string | number | bigint
  /**
   * @since 4.0.0
   */
  export type Part = ASTPart | LiteralPart
  /**
   * @since 4.0.0
   */
  export type Parts = ReadonlyArray<Part>
}

function isASTPart(ast: AST): ast is TemplateLiteral.ASTPart {
  switch (ast._tag) {
    case "StringKeyword":
    case "NumberKeyword":
    case "BigIntKeyword":
    case "LiteralType":
    case "TemplateLiteral":
      return true
    case "UnionType":
      return ast.types.every(isASTPart)
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
  readonly parts: ReadonlyArray<AST | TemplateLiteral.LiteralPart>
  /** @internal */
  readonly flippedParts: ReadonlyArray<TemplateLiteral.ASTPart>

  constructor(
    parts: ReadonlyArray<AST | TemplateLiteral.LiteralPart>,
    annotations?: Annotations.Annotations,
    checks?: Checks,
    encoding?: Encoding,
    context?: Context
  ) {
    super(annotations, checks, encoding, context)
    this.parts = parts
    const flippedParts: Array<TemplateLiteral.ASTPart> = []
    for (const part of parts) {
      if (Predicate.isObject(part)) {
        const flipped = flip(part)
        if (isASTPart(flipped)) {
          flippedParts.push(flipped)
        } else {
          throw new Error("Invalid TemplateLiteral part")
        }
      } else {
        flippedParts.push(new LiteralType(part))
      }
    }
    this.flippedParts = flippedParts
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    const parser = go(this.asTemplateLiteralParser())
    return (oinput: Option.Option<unknown>, options: ParseOptions) =>
      parser(oinput, options).pipe(
        Effect.mapBothEager({
          onSuccess: () => oinput,
          onFailure: () => new Issue.InvalidType(this, oinput)
        })
      )
  }
  /** @internal */
  asTemplateLiteralParser() {
    const elements = this.flippedParts.map((part) => flip(addPartCoercion(part)))
    const tuple = new TupleType(false, elements, [])
    const regex = getTemplateLiteralRegExp(this)
    return decodeTo(
      stringKeyword,
      tuple,
      new Transformation_.Transformation(
        Getter.map((s: string) => {
          const match = regex.exec(s)
          if (match) {
            return match.slice(1, elements.length + 1)
          }
          return []
        }),
        Getter.map((parts) => parts.join(""))
      )
    )
  }
}

function addPartNumberCoercion(part: NumberKeyword | LiteralType): AST {
  return decodeTo(part, stringKeyword, Transformation_.numberFromString.flip())
}

function addPartBigIntCoercion(part: BigIntKeyword | LiteralType): AST {
  return decodeTo(part, stringKeyword, Transformation_.bigintFromString.flip())
}

function addPartCoercion(part: TemplateLiteral.ASTPart): AST {
  switch (part._tag) {
    case "NumberKeyword":
      return addPartNumberCoercion(part)
    case "BigIntKeyword":
      return addPartBigIntCoercion(part)
    case "UnionType":
      return new UnionType(part.types.map(addPartCoercion), part.mode)
    case "LiteralType": {
      if (Predicate.isNumber(part.literal)) {
        return addPartNumberCoercion(part)
      } else if (Predicate.isBigInt(part.literal)) {
        return addPartBigIntCoercion(part)
      } else {
        return part
      }
    }
    default:
      return part
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
    return fromRefinement(this, (input): input is typeof this.symbol => input === this.symbol)
  }
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
    return fromRefinement(this, (input): input is typeof this.literal => input === this.literal)
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
}

/**
 * @since 4.0.0
 */
export const stringKeyword = new StringKeyword()

/**
 * @category model
 * @since 4.0.0
 */
export class NumberKeyword extends AbstractParser {
  readonly _tag = "NumberKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isNumber)
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
export type Combine<Key extends PropertyKey, Value> = (
  a: readonly [key: Key, value: Value],
  b: readonly [key: Key, value: Value]
) => readonly [key: Key, value: Value]

/**
 * @category model
 * @since 4.0.0
 */
export class Merge {
  readonly decode: Combine<PropertyKey, any> | undefined
  readonly encode: Combine<PropertyKey, any> | undefined

  constructor(
    decode: Combine<PropertyKey, any> | undefined,
    encode: Combine<PropertyKey, any> | undefined
  ) {
    this.decode = decode
    this.encode = encode
  }
  /** @internal */
  flip(): Merge {
    return new Merge(this.encode, this.decode)
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
  readonly merge: Merge | undefined

  constructor(
    isMutable: boolean,
    parameter: AST,
    type: AST,
    merge: Merge | undefined
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
  typeAST(): TupleType {
    const elements = mapOrSame(this.elements, typeAST)
    const rest = mapOrSame(this.rest, typeAST)
    return !this.encoding && elements === this.elements && rest === this.rest ?
      this :
      new TupleType(this.isMutable, elements, rest, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  flip(): AST {
    if (this.encoding) {
      return flipEncoding(this, this.encoding)
    }
    const elements = mapOrSame(this.elements, flip)
    const rest = mapOrSame(this.rest, flip)
    return !this.encoding && elements === this.elements && rest === this.rest ?
      this :
      new TupleType(this.isMutable, elements, rest, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntracedEager(function*(oinput, options) {
      if (Option.isNone(oinput)) {
        return Option.none()
      }
      const input = oinput.value

      // If the input is not an array, return early with an error
      if (!Arr.isArray(input)) {
        return yield* Effect.fail(new Issue.InvalidType(ast, oinput))
      }

      const output: Array<unknown> = []
      const issues: Array<Issue.Issue> = []
      const errorsAllOption = options?.errors === "all"

      let i = 0
      // ---------------------------------------------
      // handle elements
      // ---------------------------------------------
      for (; i < ast.elements.length; i++) {
        const element = ast.elements[i]
        const value = i < input.length ? Option.some(input[i]) : Option.none()
        const parser = go(element)
        const keyAnnotations = element.context?.annotations
        const r = yield* Effect.result(parser(value, options))
        if (Result.isFailure(r)) {
          const issue = new Issue.Pointer([i], r.failure)
          if (errorsAllOption) {
            issues.push(issue)
          } else {
            return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
          }
        } else {
          if (Option.isSome(r.success)) {
            output[i] = r.success.value
          } else {
            if (!isOptional(element)) {
              const issue = new Issue.Pointer([i], new Issue.MissingKey(keyAnnotations))
              if (errorsAllOption) {
                issues.push(issue)
              } else {
                return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
              }
            }
          }
        }
      }
      // ---------------------------------------------
      // handle rest element
      // ---------------------------------------------
      const len = input.length
      if (Arr.isNonEmptyReadonlyArray(ast.rest)) {
        const [head, ...tail] = ast.rest
        const parser = go(head)
        const keyAnnotations = head.context?.annotations
        for (; i < len - tail.length; i++) {
          const r = yield* Effect.result(parser(Option.some(input[i]), options))
          if (Result.isFailure(r)) {
            const issue = new Issue.Pointer([i], r.failure)
            if (errorsAllOption) {
              issues.push(issue)
            } else {
              return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
            }
          } else {
            if (Option.isSome(r.success)) {
              output[i] = r.success.value
            } else {
              const issue = new Issue.Pointer([i], new Issue.MissingKey(keyAnnotations))
              if (errorsAllOption) {
                issues.push(issue)
              } else {
                return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
              }
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
            const r = yield* Effect.result(parser(Option.some(input[i]), options))
            if (Result.isFailure(r)) {
              const issue = new Issue.Pointer([i], r.failure)
              if (errorsAllOption) {
                issues.push(issue)
              } else {
                return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
              }
            } else {
              if (Option.isSome(r.success)) {
                output[i] = r.success.value
              } else {
                const issue = new Issue.Pointer([i], new Issue.MissingKey(keyAnnotations))
                if (errorsAllOption) {
                  issues.push(issue)
                } else {
                  return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
                }
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
            issues.push(issue)
          } else {
            return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
          }
        }
      }
      if (Arr.isNonEmptyArray(issues)) {
        return yield* Effect.fail(new Issue.Composite(ast, oinput, issues))
      }
      return Option.some(output)
    })
  }
}

function getIndexSignatureHash(ast: AST): string {
  return isTemplateLiteral(ast) ?
    ast.parts.map((part) => Predicate.isObject(part) ? `\${${getIndexSignatureHash(part)}}` : String(part)).join("") :
    ast._tag
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
  typeAST(): TypeLiteral {
    const pss = mapOrSame(this.propertySignatures, (ps) => {
      const type = typeAST(ps.type)
      return type === ps.type ?
        ps :
        new PropertySignature(ps.name, type)
    })
    const iss = mapOrSame(this.indexSignatures, (is) => {
      const parameter = typeAST(is.parameter)
      const type = typeAST(is.type)
      return parameter === is.parameter && type === is.type && is.merge === undefined ?
        is :
        new IndexSignature(is.isMutable, parameter, type, undefined)
    })
    return !this.encoding && pss === this.propertySignatures && iss === this.indexSignatures ?
      this :
      new TypeLiteral(pss, iss, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  flip(): AST {
    if (this.encoding) {
      return flipEncoding(this, this.encoding)
    }
    const propertySignatures = mapOrSame(this.propertySignatures, (ps) => {
      const type = flip(ps.type)
      return type === ps.type ? ps : new PropertySignature(ps.name, type)
    })
    const indexSignatures = mapOrSame(this.indexSignatures, (is) => {
      const parameter = flip(is.parameter)
      const type = flip(is.type)
      const merge = is.merge?.flip()
      return parameter === is.parameter && type === is.type && merge === is.merge
        ? is
        : new IndexSignature(is.isMutable, parameter, type, merge)
    })
    return !this.encoding && propertySignatures === this.propertySignatures &&
        indexSignatures === this.indexSignatures ?
      this :
      new TypeLiteral(
        propertySignatures,
        indexSignatures,
        this.annotations,
        this.checks,
        undefined,
        this.context
      )
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    const expectedKeys: Array<PropertyKey> = []
    const expectedKeysMap: Record<PropertyKey, null> = {}
    for (const ps of ast.propertySignatures) {
      expectedKeys.push(ps.name)
      expectedKeysMap[ps.name] = null
    }
    // ---------------------------------------------
    // handle empty struct
    // ---------------------------------------------
    if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
      return fromRefinement(ast, Predicate.isNotNullable)
    }
    return Effect.fnUntracedEager(function*(oinput, options) {
      if (Option.isNone(oinput)) {
        return Option.none()
      }
      const input = oinput.value

      // If the input is not a record, return early with an error
      if (!Predicate.isRecord(input)) {
        return yield* Effect.fail(new Issue.InvalidType(ast, oinput))
      }

      const out: Record<PropertyKey, unknown> = {}
      const issues: Array<Issue.Issue> = []
      const errorsAllOption = options?.errors === "all"
      const onExcessPropertyError = options?.onExcessProperty === "error"
      const onExcessPropertyPreserve = options?.onExcessProperty === "preserve"

      // ---------------------------------------------
      // handle excess properties
      // ---------------------------------------------
      let inputKeys: Array<PropertyKey> | undefined
      if (ast.indexSignatures.length === 0 && (onExcessPropertyError || onExcessPropertyPreserve)) {
        inputKeys = ownKeys(input)
        for (const key of inputKeys) {
          if (!Object.hasOwn(expectedKeysMap, key)) {
            // key is unexpected
            if (onExcessPropertyError) {
              const issue = new Issue.Pointer([key], new Issue.UnexpectedKey(ast, input[key]))
              if (errorsAllOption) {
                issues.push(issue)
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
      for (const ps of ast.propertySignatures) {
        const name = ps.name
        const type = ps.type
        let value: Option.Option<unknown> = Option.none()
        if (Object.hasOwn(input, name)) {
          value = Option.some(input[name])
        }
        const parser = go(type)
        const keyAnnotations = type.context?.annotations
        const r = yield* Effect.result(parser(value, options))
        if (Result.isFailure(r)) {
          const issue = new Issue.Pointer([name], r.failure)
          if (errorsAllOption) {
            issues.push(issue)
            continue
          } else {
            return yield* Effect.fail(
              new Issue.Composite(ast, oinput, [issue])
            )
          }
        } else {
          if (Option.isSome(r.success)) {
            internalRecord.set(out, name, r.success.value)
          } else {
            if (!isOptional(ps.type)) {
              const issue = new Issue.Pointer([name], new Issue.MissingKey(keyAnnotations))
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(
                  new Issue.Composite(ast, oinput, [issue])
                )
              }
            }
          }
        }
      }

      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      for (const is of ast.indexSignatures) {
        const keys = getIndexSignatureKeys(input, is)
        for (const key of keys) {
          const parserKey = go(is.parameter)
          const rKey = (yield* Effect.result(parserKey(Option.some(key), options))) as Result.Result<
            Option.Option<PropertyKey>,
            Issue.Issue
          >
          if (Result.isFailure(rKey)) {
            const issue = new Issue.Pointer([key], rKey.failure)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(
                new Issue.Composite(ast, oinput, [issue])
              )
            }
          }

          const value: Option.Option<unknown> = Option.some(input[key])
          const parserValue = go(is.type)
          const rValue = yield* Effect.result(parserValue(value, options))
          if (Result.isFailure(rValue)) {
            const issue = new Issue.Pointer([key], rValue.failure)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(
                new Issue.Composite(ast, oinput, [issue])
              )
            }
          } else {
            if (Option.isSome(rKey.success) && Option.isSome(rValue.success)) {
              const k2 = rKey.success.value
              const v2 = rValue.success.value
              if (is.merge && is.merge.decode && Object.hasOwn(out, k2)) {
                const [k, v] = is.merge.decode([k2, out[k2]], [k2, v2])
                internalRecord.set(out, k, v)
              } else {
                internalRecord.set(out, k2, v2)
              }
            }
          }
        }
      }

      if (Arr.isNonEmptyArray(issues)) {
        return yield* Effect.fail(new Issue.Composite(ast, oinput, issues))
      }
      if (options?.propertyOrder === "original") {
        // preserve input keys order
        const keys = (inputKeys ?? ownKeys(input)).concat(expectedKeys)
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
    ownKeys(fields).map((key) => {
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

function getCandidateTypes(ast: AST): ReadonlyArray<Type> {
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
  typeAST(): UnionType<A> {
    const types = mapOrSame(this.types, typeAST)
    return !this.encoding && types === this.types ?
      this :
      new UnionType(types, this.mode, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  flip(): AST {
    if (this.encoding) {
      return flipEncoding(this, this.encoding)
    }
    const types = mapOrSame(this.types, flip)
    return types === this.types ?
      this :
      new UnionType(types, this.mode, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntracedEager(function*(oinput, options) {
      if (Option.isNone(oinput)) {
        return Option.none()
      }
      const input = oinput.value
      const oneOf = ast.mode === "oneOf"
      const candidates = getCandidates(input, ast.types)
      const issues: Array<Issue.Issue> = []

      const tracking: {
        out: Option.Option<unknown> | undefined
        successes: Array<AST>
      } = {
        out: undefined,
        successes: []
      }
      for (const candidate of candidates) {
        const parser = go(candidate)
        const r = yield* Effect.result(parser(oinput, options))
        if (Result.isFailure(r)) {
          issues.push(r.failure)
          continue
        } else {
          if (tracking.out && oneOf) {
            tracking.successes.push(candidate)
            return yield* Effect.fail(new Issue.OneOf(ast, input, tracking.successes))
          }
          tracking.out = r.success
          tracking.successes.push(candidate)
          if (!oneOf) {
            break
          }
        }
      }

      if (tracking.out) {
        return tracking.out
      } else if (Arr.isNonEmptyArray(issues)) {
        return yield* Effect.fail(new Issue.AnyOf(ast, oinput, issues))
      } else {
        return yield* Effect.fail(new Issue.InvalidType(ast, oinput))
      }
    })
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
  typeAST(): Suspend {
    return new Suspend(() => typeAST(this.thunk()), this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  flip(): AST {
    if (this.encoding) {
      return flipEncoding(this, this.encoding)
    }
    return new Suspend(() => flip(this.thunk()), this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser): ToParser.Parser {
    return go(this.thunk())
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

function applyEncoded<A extends AST>(ast: A, f: (ast: AST) => AST): A {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    return replaceEncoding(
      ast,
      Arr.append(
        links.slice(0, links.length - 1),
        new Link(f(last.to), last.transformation)
      )
    )
  } else {
    return ast
  }
}

/** @internal */
export function decodingMiddleware(ast: AST, middleware: Middleware): AST {
  return appendTransformation(ast, middleware, typeAST(ast))
}

/** @internal */
export function encodingMiddleware(ast: AST, middleware: Middleware): AST {
  return appendTransformation(encodedAST(ast), middleware, ast)
}

function appendTransformation<A extends AST>(
  from: AST,
  transformation: Transformation | Middleware,
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
  const out = Arr.allocate(as.length) as Array<A>
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
export function memoize<A extends AST, O>(f: (ast: A) => O): (ast: A) => O {
  const cache = new WeakMap<AST, O>()
  return (ast) => {
    if (cache.has(ast)) {
      return cache.get(ast)!
    }
    const result = f(ast)
    cache.set(ast, result)
    return result
  }
}

/** @internal */
export function annotate<A extends AST>(ast: A, annotations: Annotations.Annotations): A {
  if (ast.checks) {
    const last = ast.checks[ast.checks.length - 1]
    return replaceChecks(ast, Arr.append(ast.checks.slice(0, -1), last.annotate(annotations)))
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = { ...ast.annotations, ...annotations }
  })
}

/** @internal */
export function annotateKey<A extends AST>(ast: A, annotations: Annotations.Documentation): A {
  const context = ast.context ?
    new Context(ast.context.isOptional, ast.context.isMutable, ast.context.defaultValue, ast.context.make, {
      ...ast.context.annotations,
      ...annotations
    }) :
    new Context(false, false, undefined, undefined, annotations)
  return replaceContext(ast, context)
}

/** @internal */
export function optionalKey<A extends AST>(ast: A): A {
  const context = ast.context ?
    new Context(true, ast.context.isMutable, ast.context.defaultValue, ast.context.make, ast.context.annotations) :
    new Context(true, false)
  return applyEncoded(replaceContext(ast, context), optionalKey)
}

/** @internal */
export function mutableKey<A extends AST>(ast: A): A {
  const context = ast.context ?
    new Context(ast.context.isOptional, true, ast.context.defaultValue, ast.context.make, ast.context.annotations) :
    new Context(false, true)
  return applyEncoded(replaceContext(ast, context), mutableKey)
}

/** @internal */
export function withConstructorDefault<A extends AST>(
  ast: A,
  defaultValue: (input: Option.Option<undefined>) => Option.Option<unknown> | Effect.Effect<Option.Option<unknown>>
): A {
  const transformation = new Transformation_.Transformation(
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
    new Context(ast.context.isOptional, ast.context.isMutable, encoding, ast.context.make, ast.context.annotations) :
    new Context(false, false, encoding)
  return replaceContext(ast, context)
}

/** @internal */
export function decodeTo<A extends AST>(
  from: AST,
  to: A,
  transformation: Transformation
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
                  ast.context.make,
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

function getRecordKeyLiterals(ast: AST): ReadonlyArray<PropertyKey> {
  switch (ast._tag) {
    case "LiteralType":
      if (Predicate.isPropertyKey(ast.literal)) {
        return [ast.literal]
      }
      break
    case "UnionType":
      return ast.types.flatMap(getRecordKeyLiterals)
  }
  return []
}

/** @internal */
export function record(key: AST, value: AST, merge: Merge | undefined): TypeLiteral {
  const literals = getRecordKeyLiterals(key)
  if (literals.length > 0) {
    return new TypeLiteral(literals.map((literal) => new PropertySignature(literal, value)), [])
  }
  return new TypeLiteral([], [new IndexSignature(false, key, value, merge)])
}

/** @internal */
export function isOptional(ast: AST): boolean {
  return ast.context?.isOptional ?? false
}

// -------------------------------------------------------------------------------------
// Public APIs
// -------------------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export const typeAST = memoize(<A extends AST>(ast: A): A => {
  return ast.typeAST() as A
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
  return ast.flip()
})

/** @internal */
export function formatIsMutable(isMutable: boolean | undefined): string {
  return isMutable === true ? "" : "readonly "
}

/** @internal */
export function formatIsOptional(isOptional: boolean | undefined): string {
  return isOptional === true ? "?" : ""
}

function formatPropertySignature(ps: PropertySignature): string {
  return formatIsMutable(ps.type.context?.isMutable)
    + formatPropertyKey(ps.name)
    + formatIsOptional(ps.type.context?.isOptional)
    + ": "
    + format(ps.type)
}

function formatPropertySignatures(pss: ReadonlyArray<PropertySignature>): string {
  return pss.map(formatPropertySignature).join("; ")
}

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

function formatIndexSignature(is: IndexSignature): string {
  return formatIsMutable(is.isMutable) + `[x: ${format(is.parameter)}]: ${format(is.type)}`
}

function formatIndexSignatures(iss: ReadonlyArray<IndexSignature>): string {
  return iss.map(formatIndexSignature).join("; ")
}

function formatElements(es: ReadonlyArray<AST>): string {
  return es.map((e) => format(e) + formatIsOptional(e.context?.isOptional)).join(", ")
}

function formatTail(tail: ReadonlyArray<AST>): string {
  return tail.map(format).join(", ")
}

const formatTemplateLiteral = (ast: TemplateLiteral): string =>
  "`" + ast.flippedParts.map((ast) => formatTemplateLiteralASTPart(typeAST(ast))).join("") +
  "`"

function formatTemplateLiteralASTPart(part: TemplateLiteral.ASTPart): string {
  switch (part._tag) {
    case "LiteralType":
      return String(part.literal)
    case "StringKeyword":
    case "NumberKeyword":
    case "BigIntKeyword":
    case "TemplateLiteral":
      return "${" + format(part) + "}"
    case "UnionType":
      return "${" + part.types.map(formatTemplateLiteralASTWithinUnion).join(" | ") + "}"
  }
}

const formatTemplateLiteralASTWithinUnion = (part: TemplateLiteral.ASTPart): string => {
  if (isUnionType(part)) {
    return part.types.map(formatTemplateLiteralASTWithinUnion).join(" | ")
  }
  return format(part)
}

/** @internal */
export const format = memoize((ast: AST): string => {
  switch (ast._tag) {
    case "Declaration": {
      const title = ast.annotations?.title
      if (Predicate.isString(title)) {
        const tps = ast.typeParameters.map(format)
        return `${title}${tps.length > 0 ? `<${tps.join(", ")}>` : ""}`
      }
      return "<Declaration>"
    }
    case "LiteralType":
      return JSON.stringify(ast.literal)
    case "NeverKeyword":
      return "never"
    case "AnyKeyword":
      return "any"
    case "UnknownKeyword":
      return "unknown"
    case "NullKeyword":
      return "null"
    case "UndefinedKeyword":
      return "undefined"
    case "StringKeyword":
      return "string"
    case "NumberKeyword":
      return "number"
    case "BooleanKeyword":
      return "boolean"
    case "SymbolKeyword":
      return "symbol"
    case "BigIntKeyword":
      return "bigint"
    case "UniqueSymbol":
      return ast.symbol.toString()
    case "VoidKeyword":
      return "void"
    case "ObjectKeyword":
      return "object"
    case "Enums":
      return `<enum ${ast.enums.length} value(s): ${ast.enums.map(([_, value]) => JSON.stringify(value)).join(" | ")}>`
    case "TemplateLiteral":
      return formatTemplateLiteral(ast)
    case "TupleType": {
      if (ast.rest.length === 0) {
        return `${formatIsMutable(ast.isMutable)}[${formatElements(ast.elements)}]`
      }
      const [h, ...tail] = ast.rest
      const head = format(h)

      if (tail.length > 0) {
        if (ast.elements.length > 0) {
          return `${formatIsMutable(ast.isMutable)}[${formatElements(ast.elements)}, ...Array<${head}>, ${
            formatTail(tail)
          }]`
        } else {
          return `${formatIsMutable(ast.isMutable)}[...Array<${head}>, ${formatTail(tail)}]`
        }
      } else {
        if (ast.elements.length > 0) {
          return `${formatIsMutable(ast.isMutable)}[${formatElements(ast.elements)}, ...Array<${head}>]`
        } else {
          return `${ast.isMutable ? "Array<" : "ReadonlyArray<"}${head}>`
        }
      }
    }
    case "TypeLiteral": {
      if (ast.propertySignatures.length > 0) {
        const pss = formatPropertySignatures(ast.propertySignatures)
        if (ast.indexSignatures.length > 0) {
          return `{ ${pss}; ${formatIndexSignatures(ast.indexSignatures)} }`
        } else {
          return `{ ${pss} }`
        }
      } else {
        if (ast.indexSignatures.length > 0) {
          return `{ ${formatIndexSignatures(ast.indexSignatures)} }`
        } else {
          return "{}"
        }
      }
    }
    case "UnionType": {
      if (ast.types.length === 0) {
        return "never"
      } else {
        return ast.types.map(format).join(ast.mode === "oneOf" ? " ⊻ " : " | ")
      }
    }
    case "Suspend":
      return "#"
  }
})

function getTemplateLiteralSource(ast: TemplateLiteral, top: boolean): string {
  return ast.flippedParts.map((part) =>
    handleTemplateLiteralASTPartParens(part, getTemplateLiteralASTPartPattern(part), top)
  ).join("")
}

/** @internal */
export const getTemplateLiteralRegExp = memoize((ast: TemplateLiteral): RegExp => {
  return new RegExp(`^${getTemplateLiteralSource(ast, true)}$`)
})

// any string, including newlines
const STRING_KEYWORD_PATTERN = "[\\s\\S]*"
// floating point or integer, with optional exponent
const NUMBER_KEYWORD_PATTERN = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?"
// signed integer only (no leading “+”)
const BIGINT_KEYWORD_PATTERN = "-?\\d+"

function getTemplateLiteralASTPartPattern(part: TemplateLiteral.ASTPart): string {
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

function handleTemplateLiteralASTPartParens(part: TemplateLiteral.ASTPart, s: string, top: boolean): string {
  if (isUnionType(part)) {
    if (!top) {
      return `(?:${s})`
    }
  } else if (!top) {
    return s
  }
  return `(${s})`
}

/** @internal */
export function fromRefinement<T>(
  ast: AST,
  refinement: (input: unknown) => input is T
): ToParser.Parser {
  return (oinput) => {
    if (Option.isNone(oinput)) {
      return Effect.succeedNone
    }
    const u = oinput.value
    return refinement(u)
      ? Effect.succeed(Option.some(u))
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
