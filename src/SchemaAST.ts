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
export class FinalTransform {
  readonly _tag = "FinalTransform"
  constructor(
    readonly encode: (a: any, options: ParseOptions) => any,
    readonly decode: (i: any, options: ParseOptions) => any
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformOrFail {
  readonly _tag = "FinalTransformOrFail"
  constructor(
    readonly encode: (a: any, options: ParseOptions) => Result.Result<any, Issue>,
    readonly decode: (i: any, options: ParseOptions) => Result.Result<any, Issue>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformOrFailEffect {
  readonly _tag = "FinalTransformOrFailEffect"
  constructor(
    readonly encode: (a: any, options: ParseOptions) => Effect.Effect<any, Issue, any>,
    readonly decode: (i: any, options: ParseOptions) => Effect.Effect<any, Issue, any>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class Transformation {
  constructor(
    readonly from: AST,
    readonly transformation:
      | FinalTransform
      | FinalTransformOrFail
      | FinalTransformOrFailEffect,
    readonly annotations: Annotations
  ) {}
  toString() {
    const title = this.annotations.title
    return Predicate.isString(title) ? title : "<transformation>"
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
  | TransformationIssue
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
export class TransformationIssue {
  /**
   * @since 3.10.0
   */
  readonly _tag = "TransformationIssue"
  constructor(
    readonly isDecoding: boolean,
    readonly transformation: Transformation,
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
export class Declaration implements Annotated {
  readonly _tag = "Declaration"

  constructor(
    readonly typeParameters: ReadonlyArray<AST>,
    readonly encode: DeclarationParser | DeclarationParserEffect,
    readonly decode: DeclarationParser | DeclarationParserEffect,
    readonly refinements: ReadonlyArray<Refinement>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {}

  toString() {
    // TODO
    const self = "Declaration"
    return formatExtensions(this, self)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NeverKeyword implements Annotated {
  readonly _tag = "NeverKeyword"
  constructor(
    readonly refinements: ReadonlyArray<Refinement>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {}

  toString() {
    // TODO
    const self = "NeverKeyword"
    return formatExtensions(this, self)
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
export class Literal implements Annotated {
  readonly _tag = "Literal"
  constructor(
    readonly literal: LiteralValue,
    readonly refinements: ReadonlyArray<Refinement>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {}
  toString() {
    // TODO
    const self = formatUnknown(this.literal)
    return formatExtensions(this, self)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class StringKeyword implements Annotated {
  readonly _tag = "StringKeyword"
  constructor(
    readonly refinements: ReadonlyArray<Refinement>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {}

  toString() {
    // TODO
    const self = "StringKeyword"
    return formatExtensions(this, self)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NumberKeyword implements Annotated {
  readonly _tag = "NumberKeyword"
  constructor(
    readonly refinements: ReadonlyArray<Refinement>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {}

  toString() {
    // TODO
    const self = "NumberKeyword"
    return formatExtensions(this, self)
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
export class TupleType implements Annotated {
  readonly _tag = "TupleType"
  constructor(
    readonly elements: ReadonlyArray<AST>,
    readonly rest: ReadonlyArray<AST>,
    readonly refinements: ReadonlyArray<Refinement>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {
  }

  toString() {
    // TODO
    const self = "TupleType"
    return formatExtensions(this, self)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Constructor {
  readonly _tag = "Constructor"
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
export class TypeLiteral implements Annotated {
  readonly _tag = "TypeLiteral"
  constructor(
    readonly propertySignatures: ReadonlyArray<PropertySignature>,
    readonly indexSignatures: ReadonlyArray<IndexSignature>,
    readonly refinements: ReadonlyArray<Refinement | Constructor>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {
    // TODO: check for duplicate property signatures
    // TODO: check for duplicate index signatures
  }

  toString() {
    // TODO
    const self = "TypeLiteral"
    return formatExtensions(this, self)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Suspend implements Annotated {
  readonly _tag = "Suspend"
  constructor(
    readonly f: () => AST,
    readonly refinements: ReadonlyArray<Refinement>,
    readonly transformations: ReadonlyArray<Transformation>,
    readonly annotations: Annotations
  ) {
    this.f = memoizeThunk(f)
  }

  toString() {
    // TODO
    const self = "Suspend"
    return formatExtensions(this, self)
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
export const annotate = <T extends AST>(ast: T, annotations: Annotations): T => {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = { ...ast.annotations, ...annotations }
  })
}

/**
 * @since 4.0.0
 */
export const filter = <T extends AST>(ast: T, refinement: Refinement): T => {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.refinements.value = [...ast.refinements, refinement]
  })
}

/**
 * @since 4.0.0
 */
export const construct = (ast: TypeLiteral, ctor: Constructor): TypeLiteral => {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.refinements.value = [...ast.refinements, ctor]
  })
}

/**
 * @since 4.0.0
 */
export const transform = (
  from: AST,
  to: AST,
  decode: (input: any) => any,
  encode: (input: any) => any,
  annotations: Annotations
): AST => {
  const transformation = new Transformation(from, new FinalTransform(encode, decode), annotations)
  return modifyOwnPropertyDescriptors(to, (d) => {
    d.transformations.value = [...to.transformations, transformation]
  })
}

/**
 * @since 4.0.0
 */
export const transformOrFail = (
  from: AST,
  to: AST,
  decode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  encode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  annotations: Annotations
): AST => {
  const transformation = new Transformation(from, new FinalTransformOrFail(encode, decode), annotations)
  return modifyOwnPropertyDescriptors(to, (d) => {
    d.transformations.value = [...to.transformations, transformation]
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
        new Declaration(typeParameters, ast.decode, ast.encode, ast.refinements, [], ast.annotations)
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
        new TypeLiteral(propertySignatures, indexSignatures, ast.refinements, [], ast.annotations)
    }
    case "Suspend":
      return new Suspend(() => typeAST(ast.f()), ast.refinements, [], ast.annotations)
  }
  return ast
}

function formatExtensions(ast: AST, self: string): string {
  let out = self
  for (const refinement of ast.refinements) {
    switch (refinement._tag) {
      case "Refinement":
        out += ` & ${refinement}`
        break
      case "Constructor":
        out = `${refinement}(${out})`
        break
    }
  }
  if (ast.transformations.length > 0) {
    out = `(${ast.transformations.map((t) => String(t.from)).join(" <-> ")} <-> ${out})`
  }
  return out
}
