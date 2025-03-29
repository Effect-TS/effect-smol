/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type * as Effect from "./Effect.js"
import { memoizeThunk } from "./internal/schema/util.js"
import type * as Result from "./Result.js"

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransform {
  readonly _tag = "FinalTransform"
  constructor(
    readonly encode: (a: any, self: AST, options: ParseOptions) => any,
    readonly decode: (i: any, self: AST, options: ParseOptions) => any
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformOrFail {
  readonly _tag = "FinalTransformOrFail"
  constructor(
    readonly encode: (a: any, self: AST, options: ParseOptions) => Result.Result<any, Issue>,
    readonly decode: (i: any, self: AST, options: ParseOptions) => Result.Result<any, Issue>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class FinalTransformOrFailEffect {
  readonly _tag = "FinalTransformOrFailEffect"
  constructor(
    readonly encode: (a: any, self: AST, options: ParseOptions) => Effect.Effect<any, Issue, any>,
    readonly decode: (i: any, self: AST, options: ParseOptions) => Effect.Effect<any, Issue, any>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class Transformation {
  constructor(
    readonly to: AST,
    readonly transformation:
      | FinalTransform
      | FinalTransformOrFail
      | FinalTransformOrFailEffect,
    readonly annotations: Annotations
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class AST {
  constructor(
    readonly type: Type,
    readonly transformations: ReadonlyArray<Transformation>
  ) {}
  toString() {
    const type = String(this.type)
    return this.transformations.length === 0 ?
      type :
      `${this.transformations.map((t) => String(t.to)).join(" <-> ")} <-> ${type}`
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Type {
  constructor(
    readonly node: Node,
    readonly refinements: ReadonlyArray<Refinement>
  ) {}
  toString() {
    const node = String(this.node)
    return this.refinements.length === 0 ?
      node :
      `${node} | ${this.refinements.map(() => "<filter>").join(" | ")}`
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Node =
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
  // | TupleType
  | TypeLiteral
  // | Union
  | Suspend
// | Transformation

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
  | ValidationIssue
  | MissingPropertyKeyIssue
  | UnexpectedPropertyKeyIssue
  | ForbiddenIssue
  // composite
  | RefinementIssue
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
    readonly ast: AST,
    readonly actual: unknown,
    readonly refinement: Refinement,
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
}

/**
 * Issue that occurs when a required key or index is missing.
 *
 * @category model
 * @since 4.0.0
 */
export class MissingPropertyKeyIssue {
  readonly _tag = "MissingPropertyKeyIssue"
  constructor(
    readonly ast: AST,
    readonly propertyKey: PropertyKey,
    readonly actual: unknown,
    readonly message?: string
  ) {}
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
 * The `ValidationIssue` variant of the `Issue` type represents an error that
 * occurs when the `actual` value does not conform to the expected type or fails
 * to meet specified refinements. The `ast` field specifies the expected type or
 * structure, and the `actual` field contains the value that caused the error.
 *
 * @category model
 * @since 4.0.0
 */
export class ValidationIssue {
  readonly _tag = "ValidationIssue"
  constructor(
    readonly ast: AST,
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
export type Filter = (input: any, self: AST, options: ParseOptions) => Issue | undefined

/**
 * @category model
 * @since 4.0.0
 */
export interface Refinement {
  readonly filter: Filter
  readonly annotations: Annotations
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
    readonly annotations: Annotations
  ) {}

  toString() {
    // TODO
    return "<Declaration>"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NeverKeyword implements Annotated {
  readonly _tag = "NeverKeyword"
  constructor(
    readonly annotations: Annotations = {}
  ) {}

  toString() {
    // TODO
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
export class Literal implements Annotated {
  readonly _tag = "Literal"
  constructor(
    readonly literal: LiteralValue,
    readonly annotations: Annotations
  ) {}
  toString() {
    // TODO
    return "Literal"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class StringKeyword implements Annotated {
  readonly _tag = "StringKeyword"
  constructor(
    readonly annotations: Annotations = {}
  ) {}

  toString() {
    // TODO
    return "StringKeyword"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NumberKeyword implements Annotated {
  readonly _tag = "NumberKeyword"
  constructor(
    readonly annotations: Annotations = {}
  ) {}

  toString() {
    // TODO
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
export class TypeLiteral implements Annotated {
  readonly _tag = "TypeLiteral"
  constructor(
    readonly propertySignatures: ReadonlyArray<PropertySignature>,
    readonly indexSignatures: ReadonlyArray<IndexSignature>,
    readonly annotations: Annotations = {}
  ) {
    // TODO: check for duplicate property signatures
    // TODO: check for duplicate index signatures
  }

  toString() {
    // TODO
    return "TypeLiteral"
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
    readonly annotations: Annotations = {}
  ) {
    this.f = memoizeThunk(f)
  }

  toString() {
    // TODO
    return "<Suspend>"
  }
}

// -------------------------------------------------------------------------------------
// APIs
// -------------------------------------------------------------------------------------

/**
 * Merges a set of new annotations with existing ones, potentially overwriting
 * any duplicates.
 *
 * @since 4.0.0
 */
export const annotate = <T extends AST>(ast: T, annotations: Annotations): T => {
  const d = Object.getOwnPropertyDescriptors(ast.type.node)
  d.annotations.value = { ...d.annotations, ...annotations }
  return Object.create(Object.getPrototypeOf(ast), d)
}

/**
 * @since 4.0.0
 */
export const filter = (ast: AST, refinement: Refinement): AST => {
  return new AST(new Type(ast.type.node, [...ast.type.refinements, refinement]), ast.transformations)
}

/**
 * @since 4.0.0
 */
export const transform = (ast: AST, transformation: Transformation): AST => {
  return new AST(ast.type, [...ast.transformations, transformation])
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

const typeNode = (node: Node): Node => {
  switch (node._tag) {
    case "Declaration": {
      const typeParameters = changeMap(node.typeParameters, typeAST)
      return typeParameters === node.typeParameters ?
        node :
        new Declaration(typeParameters, node.encode, node.decode, node.annotations)
    }
    case "TypeLiteral": {
      const propertySignatures = changeMap(node.propertySignatures, (ps) => {
        const type = typeAST(ps.type)
        return type === ps.type
          ? ps
          : new PropertySignature(ps.name, type, ps.isOptional, ps.isReadonly, ps.annotations)
      })
      const indexSignatures = changeMap(node.indexSignatures, (is) => {
        const type = typeAST(is.type)
        return type === is.type ? is : new IndexSignature(is.parameter, type, is.isReadonly)
      })
      return propertySignatures === node.propertySignatures && indexSignatures === node.indexSignatures ?
        node :
        new TypeLiteral(propertySignatures, indexSignatures, node.annotations)
    }
    case "Suspend":
      return new Suspend(() => typeAST(node.f()), node.annotations)
  }
  return node
}

const typeSchema = (schema: Type): Type => {
  const node = typeNode(schema.node)
  return node === schema.node ?
    schema :
    new Type(node, schema.refinements)
}

/**
 * @since 4.0.0
 */
export const typeAST = (ast: AST): AST => {
  const schema = typeSchema(ast.type)
  return schema === ast.type ?
    ast :
    new AST(schema, ast.transformations)
}
