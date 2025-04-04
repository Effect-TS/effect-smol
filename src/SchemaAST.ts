/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type * as Effect from "./Effect.js"
import { formatUnknown, memoizeThunk } from "./internal/schema/util.js"
import type * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import type * as Result from "./Result.js"
/**
 * @category model
 * @since 4.0.0
 */
export type AST =
  | Declaration
  | Literal
  // | UniqueSymbol
  // | UndefinedKeyword
  // | VoidKeyword
  | NeverKeyword
  // | UnknownKeyword
  // | AnyKeyword
  | StringKeyword
  | NumberKeyword
  // | BooleanKeyword
  // | BigIntKeyword
  // | SymbolKeyword
  // | ObjectKeyword
  // | Enums
  // | TemplateLiteral
  | TupleType
  | TypeLiteral
  // | Union
  | Suspend
// | Transformation

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformation<A> {
  readonly _tag = "FinalTransformation"
  constructor(
    readonly encode: (a: A, options: ParseOptions) => A,
    readonly decode: (i: A, options: ParseOptions) => A
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformationResult<A> {
  readonly _tag = "FinalTransformationResult"
  constructor(
    readonly encode: (a: A, options: ParseOptions) => Result.Result<A, Issue>,
    readonly decode: (i: A, options: ParseOptions) => Result.Result<A, Issue>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformationEffect<A> {
  readonly _tag = "FinalTransformationEffect"
  constructor(
    readonly encode: (a: A, options: ParseOptions) => Effect.Effect<A, Issue, any>,
    readonly decode: (i: A, options: ParseOptions) => Effect.Effect<A, Issue, any>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export type Transformation<A> =
  | FinalTransformation<A>
  | FinalTransformationResult<A>
  | FinalTransformationEffect<A>

/**
 * @category model
 * @since 4.0.0
 */
export class DefaultTransformation {
  readonly _tag = "DefaultTransformation"
  constructor(
    readonly transformation: Transformation<any>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class PropertyKeyTransformation {
  readonly _tag = "PropertyKeyTransformation"
  constructor(
    readonly transformation: Transformation<Option.Option<any>>,
    readonly name: PropertyKey | undefined,
    readonly isOptional: boolean,
    readonly isReadonly: boolean
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export type EncodingTransformation = DefaultTransformation | PropertyKeyTransformation

/**
 * @category model
 * @since 4.0.0
 */
export class Encoding {
  constructor(
    readonly transformations: ReadonlyArray<EncodingTransformation>,
    readonly to: AST
  ) {}
  toString() {
    return "<Encoding>"
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
  readonly annotations: Annotations
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
   * When using a `Schema` to parse a value, by default any properties that are
   * not specified in the `Schema` will be stripped out from the output. This is
   * because the `Schema` is expecting a specific shape for the parsed value,
   * and any excess properties do not conform to that shape.
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
   * in the output. This feature is particularly useful when the sequence of
   * keys is important for the consuming processes or when maintaining the input
   * order enhances readability and usability.
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
}

/**
 * @category model
 * @since 4.0.0
 */
export type Issue =
  // leaf
  | MismatchIssue
  | InvalidIssue
  | MissingPropertyKeyIssue
  | UnexpectedPropertyKeyIssue
  | ForbiddenIssue
  // composite
  | RefinementIssue
  | EncodingIssue
  | PointerIssue
  | CompositeIssue

/**
 * Error that occurs when a refinement has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class RefinementIssue {
  readonly _tag = "RefinementIssue"
  constructor(
    readonly refinement: Refinement,
    readonly issue: Issue
  ) {}
}

/**
 * Error that occurs when a transformation has an error.
 *
 * @category model
 * @since 3.10.0
 */
export class EncodingIssue {
  /**
   * @since 3.10.0
   */
  readonly _tag = "EncodingIssue"
  constructor(
    readonly isDecoding: boolean,
    readonly encoding: Encoding,
    readonly issue: Issue
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export type PropertyKeyPath = ReadonlyArray<PropertyKey>

/**
 * Issue that points to a specific location in the input.
 *
 * @category model
 * @since 4.0.0
 */
export class PointerIssue {
  readonly _tag = "PointerIssue"
  constructor(
    readonly path: PropertyKeyPath,
    readonly issue: Issue
  ) {}
}

/**
 * Issue that occurs when an unexpected key or index is present.
 *
 * @category model
 * @since 4.0.0
 */
export class UnexpectedPropertyKeyIssue {
  readonly _tag = "UnexpectedPropertyKeyIssue"
  private constructor() {}
}

/**
 * Issue that occurs when a required key or index is missing.
 *
 * @category model
 * @since 4.0.0
 */
export class MissingPropertyKeyIssue {
  static readonly instance = new MissingPropertyKeyIssue()
  readonly _tag = "MissingPropertyKeyIssue"
  private constructor() {}
}

/**
 * Issue that contains multiple issues.
 *
 * @category model
 * @since 4.0.0
 */
export class CompositeIssue {
  readonly _tag = "CompositeIssue"
  constructor(
    readonly ast: AST,
    readonly actual: unknown,
    readonly issues: Arr.NonEmptyReadonlyArray<Issue>,
    readonly output: unknown
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class MismatchIssue {
  readonly _tag = "MismatchIssue"
  constructor(
    readonly ast: AST,
    readonly actual: unknown,
    readonly message?: string
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class InvalidIssue {
  readonly _tag = "InvalidIssue"
  constructor(
    readonly actual: unknown,
    readonly message?: string
  ) {}
}

/**
 * The `Forbidden` variant of the `Issue` type represents a forbidden operation, such as when encountering an Effect that is not allowed to execute (e.g., using `runSync`).
 *
 * @category model
 * @since 4.0.0
 */
export class ForbiddenIssue {
  readonly _tag = "ForbiddenIssue"
  constructor(
    readonly ast: AST,
    readonly actual: unknown,
    readonly message?: string
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export type Filter = (input: any, options: ParseOptions) => Issue | undefined

/**
 * @category model
 * @since 4.0.0
 */
export class Refinement {
  readonly _tag = "Refinement"
  constructor(
    readonly filter: Filter,
    readonly annotations: Annotations
  ) {}
  toString() {
    const title = this.annotations.title
    return Predicate.isString(title) ? title : "<filter>"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export interface DeclarationParser {
  readonly effect: false
  readonly parser: (input: unknown, options: ParseOptions, self: Declaration) => Result.Result<unknown, unknown>
}

/**
 * @category model
 * @since 4.0.0
 */
export interface DeclarationParserEffect {
  readonly effect: true
  readonly parser: (input: unknown, options: ParseOptions, self: Declaration) => Effect.Effect<unknown, unknown>
}

/**
 * @category model
 * @since 4.0.0
 */
export type Modifier = Refinement | Ctor

/**
 * @category model
 * @since 4.0.0
 */

export abstract class Extensions implements Annotated {
  constructor(
    readonly annotations: Annotations,
    readonly modifiers: ReadonlyArray<Modifier>,
    readonly encoding: Encoding | undefined
  ) {}

  protected abstract get label(): string

  toString() {
    let out = this.label
    for (const modifier of this.modifiers) {
      switch (modifier._tag) {
        case "Refinement":
          out += ` & ${modifier}`
          break
        case "Ctor":
          out = `${modifier}(${out})`
          break
      }
    }
    if (this.encoding !== undefined) {
      out = `${out} <-> ${this.encoding.to}`
    }
    return out
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
    readonly encode: DeclarationParser | DeclarationParserEffect,
    readonly decode: DeclarationParser | DeclarationParserEffect,
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encoding: Encoding | undefined
  ) {
    super(annotations, modifiers, encoding)
  }

  protected get label(): string {
    return "Declaration"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NeverKeyword extends Extensions {
  readonly _tag = "NeverKeyword"

  protected get label(): string {
    return "never"
  }
}

/**
 * @since 4.0.0
 */
export const neverKeyword = new NeverKeyword({}, [], undefined)

/**
 * @category model
 * @since 4.0.0
 */
export type LiteralValue = string | number | boolean | null | bigint

/**
 * @category model
 * @since 4.0.0
 */
export class Literal extends Extensions {
  readonly _tag = "Literal"
  constructor(
    readonly literal: LiteralValue,
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encoding: Encoding | undefined
  ) {
    super(annotations, modifiers, encoding)
  }

  protected get label(): string {
    return formatUnknown(this.literal)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class StringKeyword extends Extensions {
  readonly _tag = "StringKeyword"

  protected get label(): string {
    return "string"
  }
}

/**
 * @since 4.0.0
 */
export const stringKeyword = new StringKeyword({}, [], undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class NumberKeyword extends Extensions {
  readonly _tag = "NumberKeyword"

  protected get label(): string {
    return "number"
  }
}

/**
 * @since 4.0.0
 */
export const numberKeyword = new NumberKeyword({}, [], undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class PropertySignature implements Annotated {
  constructor(
    readonly name: PropertyKey,
    readonly type: AST,
    readonly isOptional: boolean,
    readonly isReadonly: boolean,
    readonly annotations: Annotations
  ) {}

  toString() {
    return (this.isReadonly ? "readonly " : "") + String(this.name) + (this.isOptional ? "?" : "") + ": " +
      this.type
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
    readonly isReadonly: boolean
  ) {
    // TODO: check that parameter is a Parameter
  }

  toString() {
    return (this.isReadonly ? "readonly " : "") + `[x: ${this.parameter}]: ${this.type}`
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Element implements Annotated {
  constructor(
    readonly ast: AST,
    readonly isOptional: boolean,
    readonly annotations: Annotations
  ) {}
  toString() {
    return String(this.ast) + (this.isOptional ? "?" : "")
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TupleType extends Extensions {
  readonly _tag = "TupleType"
  constructor(
    readonly elements: ReadonlyArray<Element>,
    readonly rest: ReadonlyArray<AST>,
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encoding: Encoding | undefined
  ) {
    super(annotations, modifiers, encoding)
  }

  protected get label(): string {
    const elements = this.elements.map(String)
      .join(", ")
    return Arr.matchLeft(this.rest, {
      onEmpty: () => `readonly [${elements}]`,
      onNonEmpty: (h, t) => {
        const head = String(h)

        if (t.length > 0) {
          const tail = t.map(String).join(", ")
          if (this.elements.length > 0) {
            return `readonly [${elements}, ...${head}[], ${tail}]`
          } else {
            return `readonly [...${head}[], ${tail}]`
          }
        } else {
          if (this.elements.length > 0) {
            return `readonly [${elements}, ...${head}[]]`
          } else {
            return `ReadonlyArray<${head}>`
          }
        }
      }
    })
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Ctor {
  readonly _tag = "Ctor"
  constructor(
    readonly ctor: new(...args: ReadonlyArray<any>) => any,
    readonly identifier: string,
    readonly annotations: Annotations
  ) {}
  toString() {
    const name = this.ctor.name
    const identifier = this.identifier !== name ? `[${this.identifier}]` : ""
    return `${name}${identifier}`
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
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encoding: Encoding | undefined
  ) {
    super(annotations, modifiers, encoding)
    // TODO: check for duplicate property signatures
    // TODO: check for duplicate index signatures
  }

  protected get label(): string {
    if (this.propertySignatures.length > 0) {
      const pss = this.propertySignatures.map(String).join("; ")
      if (this.indexSignatures.length > 0) {
        return `{ ${pss}; ${this.indexSignatures} }`
      } else {
        return `{ ${pss} }`
      }
    } else {
      if (this.indexSignatures.length > 0) {
        return `{ ${this.indexSignatures} }`
      } else {
        return "{}"
      }
    }
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
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encoding: Encoding | undefined
  ) {
    super(annotations, modifiers, encoding)
    this.thunk = memoizeThunk(thunk)
  }

  protected get label(): string {
    return "Suspend"
  }
}

// -------------------------------------------------------------------------------------
// APIs
// -------------------------------------------------------------------------------------

function modifyOwnPropertyDescriptors<T extends AST>(
  ast: T,
  f: (
    d: { [P in keyof T]: TypedPropertyDescriptor<T[P]> }
  ) => void
): T {
  const d = Object.getOwnPropertyDescriptors(ast)
  f(d)
  return Object.create(Object.getPrototypeOf(ast), d)
}

/**
 * Merges a set of new annotations with existing ones, potentially overwriting
 * any duplicates.
 *
 * @since 4.0.0
 */
export function annotate<T extends AST>(ast: T, annotations: Annotations): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = { ...ast.annotations, ...annotations }
  })
}

/**
 * @since 4.0.0
 */
export function appendModifier<T extends AST>(ast: T, modifier: Modifier): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.modifiers.value = [...ast.modifiers, modifier]
  })
}

/**
 * @since 4.0.0
 */
export function appendModifierEncoded(ast: AST, modifier: Modifier): AST {
  return ast.encoding === undefined ?
    appendModifier(ast, modifier) :
    replaceEncoding(ast, new Encoding(ast.encoding.transformations, appendModifier(ast.encoding.to, modifier)))
}

/**
 * @since 4.0.0
 */
export function replaceEncoding<T extends AST>(ast: T, encoding: Encoding): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding
  })
}

/**
 * @since 4.0.0
 */
export function appendEncodingTransformation<T extends AST>(
  ast: T,
  transformation: EncodingTransformation,
  to: AST
): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = ast.encoding === undefined ?
      new Encoding([transformation], to) :
      new Encoding([...ast.encoding.transformations, transformation], to)
  })
}

/**
 * @since 4.0.0
 */
export function decodeFrom(
  from: AST,
  to: AST,
  decode: (input: any) => any,
  encode: (input: any) => any
): AST {
  return encodeTo(to, from, encode, decode)
}

/**
 * @since 4.0.0
 */
export function encodeTo(
  from: AST,
  to: AST,
  encode: (input: any) => any,
  decode: (input: any) => any
): AST {
  return appendEncodingTransformation(
    from,
    new DefaultTransformation(new FinalTransformation(encode, decode)),
    to
  )
}

/**
 * @since 4.0.0
 */
export function decodeOrFailFrom<A extends AST>(
  from: AST,
  to: A,
  decode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  encode: (input: any, options: ParseOptions) => Result.Result<any, Issue>
): A {
  return encodeOrFailTo(to, from, encode, decode)
}

/**
 * @since 4.0.0
 */
export function encodeOrFailTo<A extends AST>(
  from: A,
  to: AST,
  encode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  decode: (input: any, options: ParseOptions) => Result.Result<any, Issue>
): A {
  return appendEncodingTransformation(
    from,
    new DefaultTransformation(new FinalTransformationResult(encode, decode)),
    to
  )
}

function changeMap<A>(
  as: Arr.NonEmptyReadonlyArray<A>,
  f: (a: A) => A
): Arr.NonEmptyReadonlyArray<A>
function changeMap<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A>
function changeMap<A>(as: ReadonlyArray<A>, f: (a: A) => A): ReadonlyArray<A> {
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

function memoize<A>(f: (ast: AST) => A): (ast: AST) => A {
  const cache = new WeakMap<AST, A>()
  return (ast) => {
    if (cache.has(ast)) {
      return cache.get(ast)!
    }
    const result = f(ast)
    cache.set(ast, result)
    return result
  }
}

/**
 * @since 4.0.0
 */
export const typeAST = memoize((ast: AST): AST => {
  switch (ast._tag) {
    case "Declaration": {
      const tps = changeMap(ast.typeParameters, typeAST)
      return tps === ast.typeParameters ?
        ast :
        new Declaration(tps, ast.decode, ast.encode, ast.annotations, [], undefined)
    }
    case "TypeLiteral": {
      const pss = changeMap(ast.propertySignatures, (ps) => {
        const type = typeAST(ps.type)
        return type === ps.type
          ? ps
          : new PropertySignature(ps.name, type, ps.isOptional, ps.isReadonly, ps.annotations)
      })
      const iss = changeMap(ast.indexSignatures, (is) => {
        const type = typeAST(is.type)
        return type === is.type ? is : new IndexSignature(is.parameter, type, is.isReadonly)
      })
      return pss === ast.propertySignatures && iss === ast.indexSignatures ?
        ast :
        new TypeLiteral(pss, iss, ast.annotations, [], undefined)
    }
    case "Suspend":
      return new Suspend(() => typeAST(ast.thunk()), ast.annotations, [], undefined)
  }
  return ast
})
