/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type * as Effect from "./Effect.js"
import { formatUnknown, memoizeThunk } from "./internal/schema/util.js"
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
export class FinalTransformation {
  readonly _tag = "FinalTransformation"
  constructor(
    readonly encode: (a: any, options: ParseOptions) => any,
    readonly decode: (i: any, options: ParseOptions) => any
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformationResult {
  readonly _tag = "FinalTransformationResult"
  constructor(
    readonly encode: (a: any, options: ParseOptions) => Result.Result<any, Issue>,
    readonly decode: (i: any, options: ParseOptions) => Result.Result<any, Issue>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformationEffect {
  readonly _tag = "FinalTransformationEffect"
  constructor(
    readonly encode: (a: any, options: ParseOptions) => Effect.Effect<any, Issue, any>,
    readonly decode: (i: any, options: ParseOptions) => Effect.Effect<any, Issue, any>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class Encoding {
  constructor(
    readonly transformation:
      | FinalTransformation
      | FinalTransformationResult
      | FinalTransformationEffect,
    readonly to: AST,
    readonly annotations: Annotations
  ) {}
  toString() {
    const title = this.annotations.title
    return Predicate.isString(title) ? title : "<Encoding>"
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

abstract class Extensions implements Annotated {
  constructor(
    readonly annotations: Annotations,
    readonly modifiers: ReadonlyArray<Modifier>,
    readonly encodings: ReadonlyArray<Encoding>
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
    for (const encoding of this.encodings) {
      out = `(${out} <-> ${encoding.to})`
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
    encodings: ReadonlyArray<Encoding>
  ) {
    super(annotations, modifiers, encodings)
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
    return "NeverKeyword"
  }
}

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
    encodings: ReadonlyArray<Encoding>
  ) {
    super(annotations, modifiers, encodings)
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
    return "StringKeyword"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NumberKeyword extends Extensions {
  readonly _tag = "NumberKeyword"

  protected get label(): string {
    return "NumberKeyword"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class PropertySignature implements Annotated {
  readonly _tag = "PropertySignature"
  constructor(
    readonly name: PropertyKey,
    readonly type: AST,
    readonly isOptional: boolean,
    readonly isReadonly: boolean,
    readonly annotations: Annotations
  ) {}

  toString() {
    // TODO
    return "PropertySignature"
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
    // TODO
    return "IndexSignature"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class TupleType extends Extensions {
  readonly _tag = "TupleType"
  constructor(
    readonly elements: ReadonlyArray<AST>,
    readonly rest: ReadonlyArray<AST>,
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encodings: ReadonlyArray<Encoding>
  ) {
    super(annotations, modifiers, encodings)
  }

  protected get label(): string {
    return "TupleType"
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
    encodings: ReadonlyArray<Encoding>
  ) {
    super(annotations, modifiers, encodings)
    // TODO: check for duplicate property signatures
    // TODO: check for duplicate index signatures
  }

  protected get label(): string {
    return "TypeLiteral"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Suspend extends Extensions {
  readonly _tag = "Suspend"
  constructor(
    readonly f: () => AST,
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encodings: ReadonlyArray<Encoding>
  ) {
    super(annotations, modifiers, encodings)
    this.f = memoizeThunk(f)
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
export function decodeFrom(
  from: AST,
  to: AST,
  decode: (input: any) => any,
  encode: (input: any) => any,
  annotations: Annotations
): AST {
  return encodeTo(to, from, encode, decode, annotations)
}

/**
 * @since 4.0.0
 */
export function encodeTo(
  from: AST,
  to: AST,
  encode: (input: any) => any,
  decode: (input: any) => any,
  annotations: Annotations
): AST {
  const encoding = new Encoding(new FinalTransformation(encode, decode), to, annotations)
  return modifyOwnPropertyDescriptors(from, (d) => {
    d.encodings.value = [...from.encodings, encoding]
  })
}

/**
 * @since 4.0.0
 */
export function decodeOrFailFrom(
  from: AST,
  to: AST,
  decode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  encode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  annotations: Annotations
): AST {
  return encodeOrFailTo(to, from, encode, decode, annotations)
}

/**
 * @since 4.0.0
 */
export function encodeOrFailTo(
  from: AST,
  to: AST,
  encode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  decode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  annotations: Annotations
): AST {
  const encoding = new Encoding(new FinalTransformationResult(encode, decode), to, annotations)
  return modifyOwnPropertyDescriptors(from, (d) => {
    d.encodings.value = [...from.encodings, encoding]
  })
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

/**
 * @since 4.0.0
 */
export const typeAST = (ast: AST): AST => {
  switch (ast._tag) {
    case "Declaration": {
      const typeParameters = changeMap(ast.typeParameters, typeAST)
      return typeParameters === ast.typeParameters ?
        ast :
        new Declaration(typeParameters, ast.decode, ast.encode, ast.annotations, [], [])
    }
    case "TypeLiteral": {
      const propertySignatures = changeMap(ast.propertySignatures, (ps) => {
        const type = typeAST(ps.type)
        return type === ps.type
          ? ps
          : new PropertySignature(ps.name, type, ps.isOptional, ps.isReadonly, ps.annotations)
      })
      const indexSignatures = changeMap(ast.indexSignatures, (is) => {
        const type = typeAST(is.type)
        return type === is.type ? is : new IndexSignature(is.parameter, type, is.isReadonly)
      })
      return propertySignatures === ast.propertySignatures && indexSignatures === ast.indexSignatures ?
        ast :
        new TypeLiteral(propertySignatures, indexSignatures, ast.annotations, [], [])
    }
    case "Suspend":
      return new Suspend(() => typeAST(ast.f()), ast.annotations, [], [])
  }
  return ast
}
