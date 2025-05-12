/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import * as Effect from "./Effect.js"
import { formatPropertyKey, memoizeThunk, ownKeys } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as RegEx from "./RegExp.js"
import * as Result from "./Result.js"
import type * as Schema from "./Schema.js"
import type * as SchemaCheck from "./SchemaCheck.js"
import * as SchemaIssue from "./SchemaIssue.js"
import type * as SchemaParser from "./SchemaParser.js"
import type * as SchemaResult from "./SchemaResult.js"
import type * as SchemaTransformation from "./SchemaTransformation.js"
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

/**
 * @category model
 * @since 4.0.0
 */
export type Middleware = SchemaTransformation.SchemaMiddleware<any, any, any, any, any, any>

/**
 * @category model
 * @since 4.0.0
 */
export type Transformation = SchemaTransformation.SchemaTransformation<any, any, any, any>

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
 * @since 4.0.0
 */
export declare namespace Annotations {
  /**
   * @category annotations
   * @since 4.0.0
   */
  export interface Documentation extends Annotations {
    readonly title?: string
    readonly description?: string
    readonly documentation?: string
  }

  /**
   * @category Model
   * @since 4.0.0
   */
  export interface Bottom<T> extends Documentation {
    readonly default?: T
    readonly examples?: ReadonlyArray<T>
  }

  /**
   * @category Model
   * @since 4.0.0
   */
  export interface Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> extends Bottom<T> {
    readonly declaration?: {
      readonly title?: string
    }
    readonly serialization?: {
      readonly json?: (
        typeParameters: { readonly [K in keyof TypeParameters]: Schema.Schema<TypeParameters[K]["Encoded"]> }
      ) => Link
    }
  }

  /**
   * @category annotations
   * @since 4.0.0
   */
  export interface Filter extends Documentation {
    readonly jsonSchema?: {
      readonly type: "fragment"
      readonly fragment: object
    }
    readonly meta?: {
      readonly id: string
      readonly [x: string]: unknown
    }
  }
}

/**
 * @category annotations
 * @since 4.0.0
 */
export interface Annotations {
  readonly [x: string]: unknown
}

/**
 * @category model
 * @since 4.0.0
 */
export interface Annotated {
  readonly annotations: Annotations | undefined
}

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
   * Handles missing properties in data structures. By default, missing
   * properties are treated as if present with an `undefined` value. To treat
   * missing properties as errors, set the `exact` option to `true`. This
   * setting is already enabled by default for `is` and `asserts` functions,
   * treating absent properties strictly unless overridden.
   *
   * default: false
   */
  readonly exact?: boolean | undefined

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
    readonly isReadonly: boolean,
    readonly constructorDefault: Transformation | undefined
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export type Checks = readonly [SchemaCheck.SchemaCheck<any>, ...ReadonlyArray<SchemaCheck.SchemaCheck<any>>]

/**
 * @category model
 * @since 4.0.0
 */
export abstract class Extensions implements Annotated {
  constructor(
    readonly annotations: Annotations | undefined,
    readonly checks: Checks | undefined,
    readonly encoding: Encoding | undefined,
    readonly context: Context | undefined
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export abstract class Concrete extends Extensions {
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
export class Declaration extends Extensions {
  readonly _tag = "Declaration"

  constructor(
    readonly typeParameters: ReadonlyArray<AST>,
    readonly run: (
      typeParameters: ReadonlyArray<AST>
    ) => (u: unknown, self: Declaration, options: ParseOptions) => SchemaResult.SchemaResult<any, any>,
    annotations: Annotations | undefined,
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
export class NullKeyword extends Concrete {
  readonly _tag = "NullKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isNull)
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
export class UndefinedKeyword extends Concrete {
  readonly _tag = "UndefinedKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isUndefined)
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
export class VoidKeyword extends Concrete {
  readonly _tag = "VoidKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isUnknown)
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
export class NeverKeyword extends Concrete {
  readonly _tag = "NeverKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isNever)
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
export class AnyKeyword extends Concrete {
  readonly _tag = "AnyKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isUnknown)
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
export class UnknownKeyword extends Concrete {
  readonly _tag = "UnknownKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isUnknown)
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
export class ObjectKeyword extends Concrete {
  readonly _tag = "ObjectKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isObject)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Enums extends Concrete {
  readonly _tag = "Enums"
  constructor(
    readonly enums: ReadonlyArray<readonly [string, string | number]>,
    annotations: Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
  }
  /** @internal */
  parser() {
    return fromPredicate(this, (u): u is any => this.enums.some(([_, value]) => value === u))
  }
}

/**
 * @since 4.0.0
 */
export const objectKeyword = new ObjectKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export type TemplateLiteralSpanType =
  | StringKeyword
  | NumberKeyword
  | LiteralType
  | TemplateLiteral
  | UnionType<TemplateLiteralSpanType>

/**
 * @category model
 * @since 4.0.0
 */
export class TemplateLiteralSpan {
  constructor(
    readonly type: TemplateLiteralSpanType,
    readonly literal: string
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class TemplateLiteral extends Concrete {
  readonly _tag = "TemplateLiteral"
  constructor(
    readonly head: string,
    readonly spans: Arr.NonEmptyReadonlyArray<TemplateLiteralSpan>,
    annotations: Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
  }
  /** @internal */
  parser() {
    const regex = getTemplateLiteralRegExp(this)
    return fromPredicate(this, (u) => Predicate.isString(u) && regex.test(u))
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
export class UniqueSymbol extends Concrete {
  readonly _tag = "UniqueSymbol"
  constructor(
    readonly symbol: symbol,
    annotations: Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
  }
  /** @internal */
  parser() {
    return fromPredicate(this, (u) => u === this.symbol)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class LiteralType extends Concrete {
  readonly _tag = "LiteralType"
  constructor(
    readonly literal: LiteralValue,
    annotations: Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
  }
  /** @internal */
  parser() {
    return fromPredicate(this, (u) => u === this.literal)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class StringKeyword extends Concrete {
  readonly _tag = "StringKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isString)
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
export class NumberKeyword extends Concrete {
  readonly _tag = "NumberKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isNumber)
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
export class BooleanKeyword extends Concrete {
  readonly _tag = "BooleanKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isBoolean)
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
export class SymbolKeyword extends Concrete {
  readonly _tag = "SymbolKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isSymbol)
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
export class BigIntKeyword extends Concrete {
  readonly _tag = "BigIntKeyword"
  /** @internal */
  parser() {
    return fromPredicate(this, Predicate.isBigInt)
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
    readonly parameter: AST,
    readonly type: AST,
    readonly merge: Merge | undefined
  ) {
    // TODO: check that parameter is a Parameter
  }
  isReadonly(): boolean {
    return this.type.context?.isReadonly ?? true
  }
  isOptional(): boolean {
    return this.type.context?.isOptional ?? false
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TupleType extends Extensions {
  readonly _tag = "TupleType"
  constructor(
    readonly isReadonly: boolean,
    readonly elements: ReadonlyArray<AST>,
    readonly rest: ReadonlyArray<AST>,
    annotations: Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
  }
  /** @internal */
  typeAST(): TupleType {
    const elements = mapOrSame(this.elements, typeAST)
    const rest = mapOrSame(this.rest, typeAST)
    return !this.encoding && elements === this.elements && rest === this.rest ?
      this :
      new TupleType(this.isReadonly, elements, rest, this.annotations, this.checks, undefined, this.context)
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
      new TupleType(this.isReadonly, elements, rest, this.annotations, this.checks, undefined, this.context)
  }
  /** @internal */
  parser(go: (ast: AST) => SchemaParser.Parser<any, any>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntraced(function*(oinput, options) {
      if (Option.isNone(oinput)) {
        return Option.none()
      }
      const input = oinput.value

      // If the input is not an array, return early with an error
      if (!Arr.isArray(input)) {
        return yield* Effect.fail(new SchemaIssue.InvalidType(ast, oinput))
      }

      const output: Array<unknown> = []
      const issues: Array<SchemaIssue.Issue> = []
      const errorsAllOption = options?.errors === "all"

      let i = 0
      for (; i < ast.elements.length; i++) {
        const element = ast.elements[i]
        const value = i < input.length ? Option.some(input[i]) : Option.none()
        const parser = go(element)
        const r = yield* Effect.result(parser(value, options))
        if (Result.isErr(r)) {
          const issue = new SchemaIssue.Pointer([i], r.err)
          if (errorsAllOption) {
            issues.push(issue)
            continue
          } else {
            return yield* Effect.fail(new SchemaIssue.Composite(ast, oinput, [issue]))
          }
        } else {
          if (Option.isSome(r.ok)) {
            output[i] = r.ok.value
          } else {
            if (!element.context?.isOptional) {
              const issue = new SchemaIssue.Pointer([i], new SchemaIssue.MissingKey())
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(new SchemaIssue.Composite(ast, oinput, [issue]))
              }
            }
          }
        }
      }
      const len = input.length
      if (Arr.isNonEmptyReadonlyArray(ast.rest)) {
        const [head, ...tail] = ast.rest
        const parser = go(head)
        for (; i < len - tail.length; i++) {
          const r = yield* Effect.result(parser(Option.some(input[i]), options))
          if (Result.isErr(r)) {
            const issue = new SchemaIssue.Pointer([i], r.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(new SchemaIssue.Composite(ast, oinput, [issue]))
            }
          } else {
            if (Option.isSome(r.ok)) {
              output[i] = r.ok.value
            } else {
              const issue = new SchemaIssue.Pointer([i], new SchemaIssue.MissingKey())
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(new SchemaIssue.Composite(ast, oinput, [issue]))
              }
            }
          }
        }
      }
      if (Arr.isNonEmptyArray(issues)) {
        return yield* Effect.fail(new SchemaIssue.Composite(ast, oinput, issues))
      }
      return Option.some(output)
    })
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TypeLiteral extends Extensions {
  readonly _tag = "TypeLiteral"
  constructor(
    readonly propertySignatures: ReadonlyArray<PropertySignature>,
    readonly indexSignatures: ReadonlyArray<IndexSignature>,
    annotations: Annotations | undefined,
    checks: Checks | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, checks, encoding, context)
    // TODO: check for duplicate property signatures
    // TODO: check for duplicate index signatures
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
        new IndexSignature(parameter, type, undefined)
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
        : new IndexSignature(parameter, type, merge)
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
  parser(go: (ast: AST) => SchemaParser.Parser<any, any>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    // Handle empty Struct({}) case
    if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
      return fromPredicate(ast, Predicate.isNotNullable)
    }
    const getOwnKeys = ownKeys // TODO: can be optimized?
    return Effect.fnUntraced(function*(oinput, options) {
      if (Option.isNone(oinput)) {
        return Option.none()
      }
      const input = oinput.value

      // If the input is not a record, return early with an error
      if (!Predicate.isRecord(input)) {
        return yield* Effect.fail(new SchemaIssue.InvalidType(ast, oinput))
      }

      const output: Record<PropertyKey, unknown> = {}
      const issues: Array<SchemaIssue.Issue> = []
      const errorsAllOption = options?.errors === "all"
      const keys = getOwnKeys(input)

      for (const ps of ast.propertySignatures) {
        const name = ps.name
        const type = ps.type
        let value: Option.Option<unknown> = Option.none()
        if (Object.prototype.hasOwnProperty.call(input, name)) {
          value = Option.some(input[name])
        }
        const parser = go(type)
        const r = yield* Effect.result(parser(value, options))
        if (Result.isErr(r)) {
          const issue = new SchemaIssue.Pointer([name], r.err)
          if (errorsAllOption) {
            issues.push(issue)
            continue
          } else {
            return yield* Effect.fail(
              new SchemaIssue.Composite(ast, oinput, [issue])
            )
          }
        } else {
          if (Option.isSome(r.ok)) {
            output[name] = r.ok.value
          } else {
            if (!ps.type.context?.isOptional) {
              const issue = new SchemaIssue.Pointer([name], new SchemaIssue.MissingKey())
              if (errorsAllOption) {
                issues.push(issue)
                continue
              } else {
                return yield* Effect.fail(
                  new SchemaIssue.Composite(ast, oinput, [issue])
                )
              }
            }
          }
        }
      }

      for (const is of ast.indexSignatures) {
        for (const key of keys) {
          const parserKey = go(is.parameter)
          const rKey = (yield* Effect.result(parserKey(Option.some(key), options))) as Result.Result<
            Option.Option<PropertyKey>,
            SchemaIssue.Issue
          >
          if (Result.isErr(rKey)) {
            const issue = new SchemaIssue.Pointer([key], rKey.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(
                new SchemaIssue.Composite(ast, oinput, [issue])
              )
            }
          }

          const value: Option.Option<unknown> = Option.some(input[key])
          const parserValue = go(is.type)
          const rValue = yield* Effect.result(parserValue(value, options))
          if (Result.isErr(rValue)) {
            const issue = new SchemaIssue.Pointer([key], rValue.err)
            if (errorsAllOption) {
              issues.push(issue)
              continue
            } else {
              return yield* Effect.fail(
                new SchemaIssue.Composite(ast, oinput, [issue])
              )
            }
          } else {
            if (Option.isSome(rKey.ok) && Option.isSome(rValue.ok)) {
              const k2 = rKey.ok.value
              const v2 = rValue.ok.value
              if (is.merge && is.merge.decode && Object.prototype.hasOwnProperty.call(output, k2)) {
                const [k, v] = is.merge.decode([k2, output[k2]], [k2, v2])
                output[k] = v
              } else {
                output[k2] = v2
              }
            }
          }
        }
      }

      if (Arr.isNonEmptyArray(issues)) {
        return yield* Effect.fail(new SchemaIssue.Composite(ast, oinput, issues))
      }
      return Option.some(output)
    })
  }
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
    case "Declaration":
    case "LiteralType":
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "UnionType":
    case "Suspend":
      return null
  }
})

function getCandidates(input: unknown, types: ReadonlyArray<AST>): ReadonlyArray<AST> {
  const type = getInputType(input)
  if (type) {
    return types.filter((ast) => {
      const types = getCandidateTypes(encodedAST(ast))
      return types === null || types === type || types.includes(type)
    })
  }
  return types
}

/**
 * @category model
 * @since 4.0.0
 */
export class UnionType<A extends AST = AST> extends Extensions {
  readonly _tag = "UnionType"
  constructor(
    readonly types: ReadonlyArray<A>,
    readonly mode: "anyOf" | "oneOf",
    annotations: Annotations | undefined,
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
  parser(go: (ast: AST) => SchemaParser.Parser<any, any>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const ast = this
    return Effect.fnUntraced(function*(oinput, options) {
      if (Option.isNone(oinput)) {
        return Option.none()
      }
      const input = oinput.value
      const oneOf = ast.mode === "oneOf"
      const candidates = getCandidates(input, ast.types)
      const issues: Array<SchemaIssue.Issue> = []

      let out: Option.Option<any> | undefined = undefined
      for (const candidate of candidates) {
        const parser = go(candidate)
        const r = yield* Effect.result(parser(oinput, options))
        if (Result.isErr(r)) {
          issues.push(r.err)
          continue
        } else {
          if (out && oneOf) {
            return yield* Effect.fail(new SchemaIssue.OneOf(ast, input))
          }
          out = r.ok
          if (!oneOf) {
            break
          }
        }
      }

      if (out) {
        return out
      } else if (Arr.isNonEmptyArray(issues)) {
        if (candidates.length === 1) {
          return yield* Effect.fail(issues[0])
        } else {
          return yield* Effect.fail(new SchemaIssue.Composite(ast, oinput, issues))
        }
      } else {
        return yield* Effect.fail(new SchemaIssue.InvalidType(ast, oinput))
      }
    })
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Suspend extends Extensions {
  readonly _tag = "Suspend"
  constructor(
    readonly thunk: () => AST,
    annotations: Annotations | undefined,
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
  parser(go: (ast: AST) => SchemaParser.Parser<any, any>) {
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
  if (ast.checks) {
    return replaceChecks(ast, [...ast.checks, ...checks])
  } else {
    return replaceChecks(ast, checks)
  }
}

/** @internal */
export function appendEncodedChecks<A extends AST>(ast: A, checks: Checks): A {
  if (ast.encoding) {
    const links = ast.encoding
    const last = links[links.length - 1]
    return replaceEncoding(
      ast,
      Arr.append(
        links.slice(0, links.length - 1),
        new Link(appendEncodedChecks(last.to, checks), last.transformation)
      )
    )
  } else {
    return appendChecks(ast, checks)
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
  if (to.encoding) {
    return replaceEncoding(to, [...to.encoding, link])
  } else {
    return replaceEncoding(to, [link])
  }
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

function modifyAnnotations<A extends AST>(
  ast: A,
  f: (annotations: Annotations | undefined) => Annotations | undefined
): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = f(ast.annotations)
  })
}

/** @internal */
export function annotate<A extends AST>(ast: A, annotations: Annotations): A {
  return modifyAnnotations(ast, (existing) => {
    return { ...existing, ...annotations }
  })
}

/** @internal */
export function optionalKey<A extends AST>(ast: A): A {
  if (ast.context) {
    return replaceContext(
      ast,
      new Context(
        true,
        ast.context.isReadonly ?? true,
        ast.context.constructorDefault
      )
    )
  } else {
    return replaceContext(
      ast,
      new Context(true, true, undefined)
    )
  }
}

/** @internal */
export function mutableKey<A extends AST>(ast: A): A {
  if (ast.context) {
    return replaceContext(
      ast,
      new Context(
        ast.context.isOptional ?? false,
        false,
        ast.context.constructorDefault
      )
    )
  } else {
    return replaceContext(
      ast,
      new Context(false, false, undefined)
    )
  }
}

/** @internal */
export function setConstructorDefault<A extends AST>(
  ast: A,
  constructorDefault: Transformation
): A {
  if (ast.context) {
    return replaceContext(ast, new Context(ast.context.isOptional, ast.context.isReadonly, constructorDefault))
  } else {
    return replaceContext(ast, new Context(false, true, constructorDefault))
  }
}

/** @internal */
export function decodeTo(from: AST, to: AST, transformation: Transformation): AST {
  return appendTransformation(from, transformation, to)
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

function formatIsReadonly(isReadonly: boolean | undefined): string {
  return isReadonly === false ? "" : "readonly "
}

function formatIsOptional(isOptional: boolean | undefined): string {
  return isOptional === true ? "?" : ""
}

function formatPropertySignature(ps: PropertySignature): string {
  return formatIsReadonly(ps.type.context?.isReadonly)
    + formatPropertyKey(ps.name)
    + formatIsOptional(ps.type.context?.isOptional)
    + ": "
    + format(ps.type)
}

function formatPropertySignatures(pss: ReadonlyArray<PropertySignature>): string {
  return pss.map(formatPropertySignature).join("; ")
}

function formatIndexSignature(is: IndexSignature): string {
  return formatIsReadonly(is.isReadonly()) + `[x: ${format(is.parameter)}]: ${format(is.type)}`
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
  "`" + ast.head + ast.spans.map((span) => formatTemplateLiteralSpan(span)).join("") +
  "`"

const formatTemplateLiteralSpan = (span: TemplateLiteralSpan): string => {
  return formatTemplateLiteralSpanType(span.type) + span.literal
}

function formatTemplateLiteralSpanType(type: TemplateLiteralSpanType): string {
  switch (type._tag) {
    case "LiteralType":
      return String(type.literal)
    case "StringKeyword":
      return "${string}"
    case "NumberKeyword":
      return "${number}"
    case "TemplateLiteral":
      return "${" + format(type) + "}"
    case "UnionType":
      return "${" + type.types.map(formatTemplateLiteralSpanUnionType).join(" | ") + "}"
  }
}

const formatTemplateLiteralSpanUnionType = (type: TemplateLiteralSpanType): string => {
  switch (type._tag) {
    case "LiteralType":
    case "StringKeyword":
    case "NumberKeyword":
    case "TemplateLiteral":
      return format(type)
    case "UnionType":
      return type.types.map(formatTemplateLiteralSpanUnionType).join(" | ")
  }
}

function formatAST(ast: AST): string {
  const title = ast.annotations?.title
  if (Predicate.isString(title)) {
    return title
  }
  switch (ast._tag) {
    case "Declaration": {
      const title = ast.annotations?.title
      if (Predicate.isString(title)) {
        return title
      }
      const declaration = ast.annotations?.declaration
      if (declaration && Predicate.hasProperty(declaration, "title")) {
        const tps = ast.typeParameters.map(format)
        return `${declaration.title}${tps.length > 0 ? `<${tps.join(", ")}>` : ""}`
      }
      return "<Declaration>"
    }
    case "LiteralType":
      return JSON.stringify(String(ast.literal))
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
        return `${formatIsReadonly(ast.isReadonly)}[${formatElements(ast.elements)}]`
      }
      const [h, ...tail] = ast.rest
      const head = format(h)

      if (tail.length > 0) {
        if (ast.elements.length > 0) {
          return `${formatIsReadonly(ast.isReadonly)}[${formatElements(ast.elements)}, ...${head}[], ${
            formatTail(tail)
          }]`
        } else {
          return `${formatIsReadonly(ast.isReadonly)}[...${head}[], ${formatTail(tail)}]`
        }
      } else {
        if (ast.elements.length > 0) {
          return `${formatIsReadonly(ast.isReadonly)}[${formatElements(ast.elements)}, ...${head}[]]`
        } else {
          return `${ast.isReadonly ? "ReadonlyArray<" : "Array<"}${head}>`
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
}

/** @internal */
export function formatCheck(filter: SchemaCheck.SchemaCheck<any>): string {
  const title = filter.annotations?.title
  if (Predicate.isString(title)) {
    return title
  }
  return filter._tag === "Filter" ? "<filter>" : "<filterGroup>"
}

/** @internal */
export function formatParser(parser: Transformation["decode"]): string {
  const title = parser.annotations?.title
  if (Predicate.isString(title)) {
    return title
  }
  return "<parser>"
}

function formatEncoding(encoding: Encoding): string {
  const links = encoding
  const last = links[links.length - 1]
  const to = encodedAST(last.to)
  if (to.context) {
    let context = formatIsReadonly(to.context.isReadonly)
    context += formatIsOptional(to.context.isOptional)
    return ` <-> ${context}: ${format(to)}`
  } else {
    return ` <-> ${format(to)}`
  }
}

/** @internal */
export const format = memoize((ast: AST): string => {
  let out = formatAST(ast)
  if (ast.checks) {
    for (const modifier of ast.checks) {
      out += ` & ${formatCheck(modifier)}`
    }
  }
  if (ast.encoding) {
    out += formatEncoding(ast.encoding)
  }
  return out
})

const makeGuard = <T extends AST["_tag"]>(tag: T) => (ast: AST): ast is Extract<AST, { _tag: T }> => ast._tag === tag

/** @internal */
export const isNullKeyword = makeGuard("NullKeyword")
/** @internal */
export const isUndefinedKeyword = makeGuard("UndefinedKeyword")
/** @internal */
export const isStringKeyword = makeGuard("StringKeyword")
/** @internal */
export const isNumberKeyword = makeGuard("NumberKeyword")
/** @internal */
export const isBooleanKeyword = makeGuard("BooleanKeyword")
/** @internal */
export const isSymbolKeyword = makeGuard("SymbolKeyword")
/** @internal */
export const isTupleType = makeGuard("TupleType")
/** @internal */
export const isTypeLiteral = makeGuard("TypeLiteral")
/** @internal */
export const isUnionType = makeGuard("UnionType")
/** @internal */
export const isSuspend = makeGuard("Suspend")
/** @internal */
export const isLiteral = makeGuard("LiteralType")
/** @internal */
export const isTemplateLiteral = makeGuard("TemplateLiteral")
/** @internal */
export const isUnion = makeGuard("UnionType")

/** @internal */
export const getTemplateLiteralRegExp = (ast: TemplateLiteral): RegExp =>
  new RegExp(`^${getTemplateLiteralPattern(ast, false, true)}$`)

const getTemplateLiteralPattern = (ast: TemplateLiteral, capture: boolean, top: boolean): string => {
  let pattern = ``
  if (ast.head !== "") {
    const head = RegEx.escape(ast.head)
    pattern += capture && top ? `(${head})` : head
  }

  for (const span of ast.spans) {
    const spanPattern = getTemplateLiteralSpanTypePattern(span.type, capture)
    pattern += handleTemplateLiteralSpanTypeParens(span.type, spanPattern, capture, top)
    if (span.literal !== "") {
      const literal = RegEx.escape(span.literal)
      pattern += capture && top ? `(${literal})` : literal
    }
  }

  return pattern
}

const STRING_KEYWORD_PATTERN = "[\\s\\S]*" // any string, including newlines
const NUMBER_KEYWORD_PATTERN = "[+-]?\\d*\\.?\\d+(?:[Ee][+-]?\\d+)?"

const getTemplateLiteralSpanTypePattern = (type: TemplateLiteralSpanType, capture: boolean): string => {
  switch (type._tag) {
    case "LiteralType":
      return RegEx.escape(String(type.literal))
    case "StringKeyword":
      return STRING_KEYWORD_PATTERN
    case "NumberKeyword":
      return NUMBER_KEYWORD_PATTERN
    case "TemplateLiteral":
      return getTemplateLiteralPattern(type, capture, false)
    case "UnionType":
      return type.types.map((type) => getTemplateLiteralSpanTypePattern(type, capture)).join("|")
  }
}

const handleTemplateLiteralSpanTypeParens = (
  type: TemplateLiteralSpanType,
  s: string,
  capture: boolean,
  top: boolean
) => {
  if (isUnion(type)) {
    if (capture && !top) {
      return `(?:${s})`
    }
  } else if (!capture || !top) {
    return s
  }
  return `(${s})`
}

/** @internal */
export const fromPredicate =
  (ast: AST, predicate: (u: unknown) => boolean): SchemaParser.Parser<any, any> => (oinput) => {
    if (Option.isNone(oinput)) {
      return Effect.succeedNone
    }
    const u = oinput.value
    return predicate(u) ? Effect.succeed(Option.some(u)) : Effect.fail(new SchemaIssue.InvalidType(ast, oinput))
  }
