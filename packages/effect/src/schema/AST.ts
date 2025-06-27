/**
 * @since 4.0.0
 */

import * as Arr from "../Array.js"
import * as Effect from "../Effect.js"
import * as internalRecord from "../internal/record.js"
import { formatPropertyKey, memoizeThunk, ownKeys } from "../internal/schema/util.js"
import * as Option from "../Option.js"
import * as Predicate from "../Predicate.js"
import * as RegEx from "../RegExp.js"
import * as Result from "../Result.js"
import type { Annotated } from "./Annotations.js"
import type * as Annotations from "./Annotations.js"
import type * as Check from "./Check.js"
import * as Getter from "./Getter.js"
import * as Issue from "./Issue.js"
import type * as Schema from "./Schema.js"
import * as SchemaResult from "./SchemaResult.js"
import type * as ToParser from "./ToParser.js"
import * as Transformation_ from "./Transformation.js"

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

/** @internal */
export const isDeclaration = makeGuard("Declaration")
/** @internal */
export const isNullKeyword = makeGuard("NullKeyword")
/** @internal */
export const isUndefinedKeyword = makeGuard("UndefinedKeyword")
/** @internal */
export const isVoidKeyword = makeGuard("VoidKeyword")
/** @internal */
export const isNeverKeyword = makeGuard("NeverKeyword")
/** @internal */
export const isUnknownKeyword = makeGuard("UnknownKeyword")
/** @internal */
export const isAnyKeyword = makeGuard("AnyKeyword")
/** @internal */
export const isStringKeyword = makeGuard("StringKeyword")
/** @internal */
export const isNumberKeyword = makeGuard("NumberKeyword")
/** @internal */
export const isBooleanKeyword = makeGuard("BooleanKeyword")
/** @internal */
export const isBigIntKeyword = makeGuard("BigIntKeyword")
/** @internal */
export const isSymbolKeyword = makeGuard("SymbolKeyword")
/** @internal */
export const isLiteralType = makeGuard("LiteralType")
/** @internal */
export const isUniqueSymbol = makeGuard("UniqueSymbol")
/** @internal */
export const isObjectKeyword = makeGuard("ObjectKeyword")
/** @internal */
export const isEnums = makeGuard("Enums")
/** @internal */
export const isTemplateLiteral = makeGuard("TemplateLiteral")
/** @internal */
export const isTupleType = makeGuard("TupleType")
/** @internal */
export const isTypeLiteral = makeGuard("TypeLiteral")
/** @internal */
export const isUnionType = makeGuard("UnionType")
/** @internal */
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
  constructor(
    readonly to: AST,
    readonly transformation: Transformation | Middleware
  ) {}
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
  constructor(
    readonly isOptional: boolean,
    readonly isMutable: boolean,
    /** Used for constructor default values (e.g. `withConstructorDefault` API) */
    readonly defaultValue: Encoding | undefined,
    /** Used for constructor encoding (e.g. `Class` API) */
    readonly make: Encoding | undefined,
    readonly annotations: Annotations.Key | undefined
  ) {}
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
  constructor(
    readonly annotations: Annotations.Annotations | undefined,
    readonly checks: Checks | undefined,
    readonly encoding: Encoding | undefined,
    readonly context: Context | undefined
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export abstract class Abstract extends Base {
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
}

/**
 * @category model
 * @since 4.0.0
 */
export class Declaration extends Base {
  readonly _tag = "Declaration"

  constructor(
    readonly typeParameters: ReadonlyArray<AST>,
    readonly run: (
      typeParameters: ReadonlyArray<AST>
    ) => (input: unknown, self: Declaration, options: ParseOptions) => SchemaResult.SchemaResult<any, any>,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
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
  parser() {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntraced(function*(oinput, options) {
      if (Option.isNone(oinput)) {
        return Option.none()
      }
      const parser = ast.run(ast.typeParameters)
      const sr = parser(oinput.value, ast, options)
      if (Result.isResult(sr)) {
        if (Result.isErr(sr)) {
          return yield* Effect.fail(sr.err)
        }
        return Option.some(sr.ok)
      } else {
        return Option.some(yield* sr)
      }
    })
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NullKeyword extends Abstract {
  readonly _tag = "NullKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isNull)
  }
}

/**
 * @since 4.0.0
 */
export const nullKeyword = new NullKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class UndefinedKeyword extends Abstract {
  readonly _tag = "UndefinedKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isUndefined)
  }
}

/**
 * @since 4.0.0
 */
export const undefinedKeyword = new UndefinedKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class VoidKeyword extends Abstract {
  readonly _tag = "VoidKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isUndefined)
  }
}

/**
 * @since 4.0.0
 */
export const voidKeyword = new VoidKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class NeverKeyword extends Abstract {
  readonly _tag = "NeverKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isNever)
  }
}

/**
 * @since 4.0.0
 */
export const neverKeyword = new NeverKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class AnyKeyword extends Abstract {
  readonly _tag = "AnyKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isUnknown)
  }
}

/**
 * @since 4.0.0
 */
export const anyKeyword = new AnyKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class UnknownKeyword extends Abstract {
  readonly _tag = "UnknownKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isUnknown)
  }
}

/**
 * @since 4.0.0
 */
export const unknownKeyword = new UnknownKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class ObjectKeyword extends Abstract {
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
export class Enums extends Abstract {
  readonly _tag = "Enums"
  constructor(
    readonly enums: ReadonlyArray<readonly [string, string | number]>,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
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
export const objectKeyword = new ObjectKeyword(undefined, undefined, undefined, undefined)

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
export class TemplateLiteral extends Abstract {
  readonly _tag = "TemplateLiteral"
  /** @internal */
  readonly flippedParts: ReadonlyArray<TemplateLiteral.ASTPart>
  constructor(
    readonly parts: ReadonlyArray<AST | TemplateLiteral.LiteralPart>,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
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
        flippedParts.push(new LiteralType(part, undefined, undefined, undefined, undefined))
      }
    }
    this.flippedParts = flippedParts
  }
  /** @internal */
  parser(go: (ast: AST) => ToParser.Parser<unknown, unknown>) {
    const parser = go(this.asTemplateLiteralParser())
    return (oinput: Option.Option<unknown>, options: ParseOptions) =>
      parser(oinput, options).pipe(
        SchemaResult.mapBoth({
          onSuccess: () => oinput,
          onFailure: () => new Issue.InvalidType(this, oinput)
        })
      )
  }
  /** @internal */
  asTemplateLiteralParser() {
    const elements = this.flippedParts.map((part) => flip(addPartCoercion(part)))
    const tuple = new TupleType(false, elements, [], undefined, undefined, undefined, undefined)
    const regex = getTemplateLiteralRegExp(this)
    return decodeTo(
      stringKeyword,
      tuple,
      new Transformation_.Transformation(
        Getter.transform((s: string) => {
          const match = regex.exec(s)
          if (match) {
            return match.slice(1, elements.length + 1)
          }
          return []
        }),
        Getter.transform((parts) => parts.join(""))
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
      return new UnionType(
        part.types.map(addPartCoercion),
        part.mode,
        undefined,
        undefined,
        undefined,
        undefined
      )
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
export class UniqueSymbol extends Abstract {
  readonly _tag = "UniqueSymbol"
  constructor(
    readonly symbol: symbol,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
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
export class LiteralType extends Abstract {
  readonly _tag = "LiteralType"
  constructor(
    readonly literal: Literal,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
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
export class StringKeyword extends Abstract {
  readonly _tag = "StringKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isString)
  }
}

/**
 * @since 4.0.0
 */
export const stringKeyword = new StringKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class NumberKeyword extends Abstract {
  readonly _tag = "NumberKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isNumber)
  }
}

/**
 * @since 4.0.0
 */
export const numberKeyword = new NumberKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class BooleanKeyword extends Abstract {
  readonly _tag = "BooleanKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isBoolean)
  }
}

/**
 * @since 4.0.0
 */
export const booleanKeyword = new BooleanKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class SymbolKeyword extends Abstract {
  readonly _tag = "SymbolKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isSymbol)
  }
}

/**
 * @since 4.0.0
 */
export const symbolKeyword = new SymbolKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class BigIntKeyword extends Abstract {
  readonly _tag = "BigIntKeyword"
  /** @internal */
  parser() {
    return fromRefinement(this, Predicate.isBigInt)
  }
}

/**
 * @since 4.0.0
 */
export const bigIntKeyword = new BigIntKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class PropertySignature {
  constructor(
    readonly name: PropertyKey,
    readonly type: AST
  ) {}
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
  constructor(
    readonly decode: Combine<PropertyKey, any> | undefined,
    readonly encode: Combine<PropertyKey, any> | undefined
  ) {}
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
  constructor(
    readonly isMutable: boolean,
    readonly parameter: AST,
    readonly type: AST,
    readonly merge: Merge | undefined
  ) {
    // TODO: check that parameter is a Parameter
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TupleType extends Base {
  readonly _tag = "TupleType"
  constructor(
    readonly isMutable: boolean,
    readonly elements: ReadonlyArray<AST>,
    readonly rest: ReadonlyArray<AST>,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)

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
  parser(go: (ast: AST) => ToParser.Parser<unknown, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntraced(function*(oinput, options) {
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
        const r = yield* Effect.result(SchemaResult.asEffect(parser(value, options)))
        if (Result.isErr(r)) {
          const issue = new Issue.Pointer([i], r.err)
          if (errorsAllOption) {
            issues.push(issue)
          } else {
            return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
          }
        } else {
          if (Option.isSome(r.ok)) {
            output[i] = r.ok.value
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
          const r = yield* Effect.result(SchemaResult.asEffect(parser(Option.some(input[i]), options)))
          if (Result.isErr(r)) {
            const issue = new Issue.Pointer([i], r.err)
            if (errorsAllOption) {
              issues.push(issue)
            } else {
              return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[i] = r.ok.value
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
            const r = yield* Effect.result(SchemaResult.asEffect(parser(Option.some(input[i]), options)))
            if (Result.isErr(r)) {
              const issue = new Issue.Pointer([i], r.err)
              if (errorsAllOption) {
                issues.push(issue)
              } else {
                return yield* Effect.fail(new Issue.Composite(ast, oinput, [issue]))
              }
            } else {
              if (Option.isSome(r.ok)) {
                output[i] = r.ok.value
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
  constructor(
    readonly propertySignatures: ReadonlyArray<PropertySignature>,
    readonly indexSignatures: ReadonlyArray<IndexSignature>,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)

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
  parser(go: (ast: AST) => ToParser.Parser<unknown, unknown>) {
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
    return Effect.fnUntraced(function*(oinput, options) {
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
              out[key] = input[key]
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
        const r = yield* Effect.result(SchemaResult.asEffect(parser(value, options)))
        if (Result.isErr(r)) {
          const issue = new Issue.Pointer([name], r.err)
          if (errorsAllOption) {
            issues.push(issue)
            continue
          } else {
            return yield* Effect.fail(
              new Issue.Composite(ast, oinput, [issue])
            )
          }
        } else {
          if (Option.isSome(r.ok)) {
            internalRecord.set(out, name, r.ok.value)
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
          const rKey =
            (yield* Effect.result(SchemaResult.asEffect(parserKey(Option.some(key), options)))) as Result.Result<
              Option.Option<PropertyKey>,
              Issue.Issue
            >
          if (Result.isErr(rKey)) {
            const issue = new Issue.Pointer([key], rKey.err)
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
          const rValue = yield* Effect.result(SchemaResult.asEffect(parserValue(value, options)))
          if (Result.isErr(rValue)) {
            const issue = new Issue.Pointer([key], rValue.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(
                new Issue.Composite(ast, oinput, [issue])
              )
            }
          } else {
            if (Option.isSome(rKey.ok) && Option.isSome(rValue.ok)) {
              const k2 = rKey.ok.value
              const v2 = rValue.ok.value
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
            preserved[key] = out[key]
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
    checks,
    undefined,
    undefined
  )
}

/** @internal */
export function getAST<S extends Schema.Top>(self: S): S["ast"] {
  return self.ast
}

/** @internal */
export function tuple<Elements extends Schema.Tuple.Elements>(
  elements: Elements,
  checks: Checks | undefined
): TupleType {
  return new TupleType(false, elements.map((e) => e.ast), [], undefined, checks, undefined, undefined)
}

/** @internal */
export function union<Members extends ReadonlyArray<Schema.Top>>(
  members: Members,
  mode: "anyOf" | "oneOf",
  checks: Checks | undefined
): UnionType<Members[number]["ast"]> {
  return new UnionType(members.map(getAST), mode, undefined, checks, undefined, undefined)
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
  return new TypeLiteral(
    propertySignatures,
    indexSignatures,
    undefined,
    checks,
    undefined,
    undefined
  )
}

/** @internal */
export function tupleWithRest(ast: TupleType, rest: ReadonlyArray<AST>): TupleType {
  if (process.env.NODE_ENV !== "production") {
    if (ast.encoding) {
      throw new Error("TupleWithRest does not support encodings")
    }
  }
  return new TupleType(
    ast.isMutable,
    ast.elements,
    rest,
    undefined,
    ast.checks,
    undefined,
    undefined
  )
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

function getInputType(input: unknown): Type {
  if (input === null) {
    return "null"
  }
  if (Array.isArray(input)) {
    return "array"
  }
  return typeof input
}

const getCandidateTypes = memoize((ast: AST): ReadonlyArray<Type> | Type | null => {
  switch (ast._tag) {
    case "NullKeyword":
      return "null"
    case "UndefinedKeyword":
    case "VoidKeyword":
      return "undefined"
    case "StringKeyword":
    case "TemplateLiteral":
      return "string"
    case "NumberKeyword":
      return "number"
    case "BooleanKeyword":
      return "boolean"
    case "SymbolKeyword":
    case "UniqueSymbol":
      return "symbol"
    case "BigIntKeyword":
      return "bigint"
    case "TypeLiteral":
    case "ObjectKeyword":
      return ["object", "array"]
    case "Enums":
      return ["string", "number"]
    case "TupleType":
      return "array"
    case "LiteralType":
      return typeof ast.literal
    case "Declaration":
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "UnionType":
    case "Suspend":
      return null
  }
})

/**
 * The goal is to reduce the number of a union members that will be checked.
 * This is useful to reduce the number of issues that will be returned.
 *
 * @internal
 */
export function getCandidates(input: unknown, types: ReadonlyArray<AST>): ReadonlyArray<AST> {
  const type = getInputType(input)
  if (type) {
    return types.filter((ast) => {
      const encoded = encodedAST(ast)
      const types = getCandidateTypes(encoded)
      const out = types === null || types === type || types.includes(type)
      if (out) {
        switch (encoded._tag) {
          case "LiteralType":
            return encoded.literal === input
          case "UniqueSymbol":
            return encoded.symbol === input
        }
      }
      return out
    })
  }
  return types
}

/**
 * @category model
 * @since 4.0.0
 */
export class UnionType<A extends AST = AST> extends Base {
  readonly _tag = "UnionType"
  constructor(
    readonly types: ReadonlyArray<A>,
    readonly mode: "anyOf" | "oneOf",
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
  }
  /** @internal */
  typeAST(): UnionType<A> {
    const types = mapOrSame(this.types, typeAST)
    return types === this.types ?
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
  parser(go: (ast: AST) => ToParser.Parser<unknown, unknown>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntraced(function*(oinput, options) {
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
        const r = yield* Effect.result(SchemaResult.asEffect(parser(oinput, options)))
        if (Result.isErr(r)) {
          issues.push(r.err)
          continue
        } else {
          if (tracking.out && oneOf) {
            tracking.successes.push(candidate)
            return yield* SchemaResult.fail(new Issue.OneOf(ast, input, tracking.successes))
          }
          tracking.out = r.ok
          tracking.successes.push(candidate)
          if (!oneOf) {
            break
          }
        }
      }

      if (tracking.out) {
        return tracking.out
      } else if (Arr.isNonEmptyArray(issues)) {
        return yield* SchemaResult.fail(new Issue.AnyOf(ast, oinput, issues))
      } else {
        return yield* SchemaResult.fail(new Issue.InvalidType(ast, oinput))
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
  constructor(
    readonly thunk: () => AST,
    annotations: Annotations.Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
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
  parser(go: (ast: AST) => ToParser.Parser<unknown, unknown>) {
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
 */
function mapOrSame<A>(as: Arr.NonEmptyReadonlyArray<A>, f: (a: A) => A): Arr.NonEmptyReadonlyArray<A>
function mapOrSame<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A>
function mapOrSame<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A> {
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
    new Context(true, false, undefined, undefined, undefined)
  return applyEncoded(replaceContext(ast, context), optionalKey)
}

/** @internal */
export function mutableKey<A extends AST>(ast: A): A {
  const context = ast.context ?
    new Context(ast.context.isOptional, true, ast.context.defaultValue, ast.context.make, ast.context.annotations) :
    new Context(false, true, undefined, undefined, undefined)
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
        const dv = defaultValue(o as Option.Option<undefined>)
        return Effect.isEffect(dv) ? dv : Result.ok(dv)
      } else {
        return Result.ok(o)
      }
    }),
    Getter.passthrough()
  )
  const encoding: Encoding = [new Link(unknownKeyword, transformation)]
  const context = ast.context ?
    new Context(ast.context.isOptional, ast.context.isMutable, encoding, ast.context.make, ast.context.annotations) :
    new Context(false, false, encoding, undefined, undefined)
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
                : new Context(false, isMutable, undefined, undefined, undefined)
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
    return new TypeLiteral(
      literals.map((literal) => new PropertySignature(literal, value)),
      [],
      undefined,
      undefined,
      undefined,
      undefined
    )
  }
  return new TypeLiteral(
    [],
    [new IndexSignature(false, key, value, merge)],
    undefined,
    undefined,
    undefined,
    undefined
  )
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
): ToParser.Parser<T, never> {
  return (oinput) => {
    if (Option.isNone(oinput)) {
      return SchemaResult.succeedNone
    }
    const u = oinput.value
    return refinement(u)
      ? SchemaResult.succeed(Option.some(u))
      : SchemaResult.fail(new Issue.InvalidType(ast, oinput))
  }
}

/** @internal */
export const enumsToLiterals = memoize((ast: Enums): UnionType<LiteralType> => {
  return new UnionType(
    ast.enums.map((e) => new LiteralType(e[1], { title: e[0] }, undefined, undefined, undefined)),
    "anyOf",
    undefined,
    undefined,
    undefined,
    undefined
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
