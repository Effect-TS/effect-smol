/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type * as Effect from "./Effect.js"
import { formatUnknown, memoizeThunk } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import type * as Result from "./Result.js"
import type { SchemaParserResult } from "./SchemaParserResult.js"

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
export type Parser<I, O> = (i: I, options: ParseOptions) => SchemaParserResult<O, Issue>

/**
 * @category model
 * @since 4.0.0
 */
export class Transformation<DE, DT, ET = DE, EE = DT> {
  constructor(
    readonly decode: Parser<DE, DT>,
    readonly encode: Parser<EE, ET>,
    readonly annotations?: AnnotationsNs.Documentation
  ) {}
  flip(): Transformation<EE, ET, DT, DE> {
    return new Transformation(this.encode, this.decode, this.annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class EncodeWrapper<E, T> {
  readonly _tag = "EncodeWrapper"
  constructor(
    readonly transformation: Transformation<E, T>
  ) {}
  flip(): EncodeWrapper<T, E> {
    return new EncodeWrapper(this.transformation.flip())
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class ContextWrapper<E, T> {
  readonly _tag = "ContextWrapper"
  constructor(
    readonly transformation: Transformation<Option.Option<E>, Option.Option<T>>,
    readonly isOptional: boolean
  ) {}
  flip(): ContextWrapper<T, E> {
    return new ContextWrapper(this.transformation.flip(), this.isOptional)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Wrapper = EncodeWrapper<any, any> | ContextWrapper<any, any>

/**
 * @category model
 * @since 4.0.0
 */
export class Encoding {
  readonly transformations: ReadonlyArray<Wrapper>
  readonly to: AST
  constructor(
    transformations: ReadonlyArray<Wrapper>,
    to: AST
  ) {
    if (to.encoding !== undefined) {
      this.transformations = [...transformations, ...to.encoding.transformations]
      this.to = to.encoding.to
    } else {
      this.transformations = transformations
      this.to = to
    }
  }
}

/**
 * @since 4.0.0
 */
export declare namespace AnnotationsNs {
  /**
   * @category annotations
   * @since 4.0.0
   */
  export interface Documentation extends Annotations {
    readonly title?: string
    readonly description?: string
    readonly documentation?: string
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
    readonly output: Option.Option<unknown>
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
    readonly actual: Option.Option<unknown>,
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
  flip(): Refinement {
    return this
  }
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
export class Context {
  constructor(
    readonly isOptional: boolean,
    readonly isReadonly: boolean,
    readonly defaults: {
      decode: Option.Option<unknown> | Effect.Effect<unknown>
      encode: Option.Option<unknown> | Effect.Effect<unknown>
    } | undefined,
    readonly encodedKey: PropertyKey | undefined
  ) {}
  flip(): Context {
    if (this.defaults === undefined) {
      return this
    }
    return new Context(this.isOptional, this.isReadonly, {
      decode: this.defaults.encode,
      encode: this.defaults.decode
    }, this.encodedKey)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export abstract class Extensions implements Annotated {
  constructor(
    readonly annotations: Annotations,
    readonly modifiers: ReadonlyArray<Modifier>,
    readonly encoding: Encoding | undefined,
    readonly context: Context | undefined
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
    readonly parser: (
      typeParameters: ReadonlyArray<AST>
    ) => (u: unknown, self: Declaration, options: ParseOptions) => SchemaParserResult<any, unknown>,
    annotations: Annotations,
    modifiers: ReadonlyArray<Modifier>,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
export const neverKeyword = new NeverKeyword({}, [], undefined, undefined)

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
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
export const stringKeyword = new StringKeyword({}, [], undefined, undefined)

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
export const numberKeyword = new NumberKeyword({}, [], undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class PropertySignature implements Annotated {
  constructor(
    readonly name: PropertyKey,
    readonly type: AST,
    readonly annotations: Annotations
  ) {}
  get isOptional(): boolean {
    return this.type.context !== undefined ? this.type.context.isOptional : false
  }
  get isReadonly(): boolean {
    return this.type.context !== undefined ? this.type.context.isReadonly : true
  }
  toString() {
    return (this.isReadonly ? "readonly " : "") + String(this.name) + (this.isOptional ? "?" : "") + ": " +
      this.type
  }
  flip(): PropertySignature {
    throw new Error("flip not implemented")
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
  flip(): IndexSignature {
    throw new Error("flip not implemented")
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
  flip(): Element {
    throw new Error("flip not implemented")
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
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
    readonly encode: (input: any) => Result.Result<any, Issue>,
    readonly decode: (input: any) => Result.Result<any, Issue>,
    readonly annotations: Annotations
  ) {}
  toString() {
    const name = this.ctor.name
    const identifier = this.identifier !== name ? `[${this.identifier}]` : ""
    return `${name}${identifier}`
  }
  flip(): Ctor {
    return new Ctor(this.ctor, this.identifier, this.decode, this.encode, this.annotations)
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
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
    this.thunk = memoizeThunk(thunk)
  }

  protected get label(): string {
    return "Suspend"
  }
}

// -------------------------------------------------------------------------------------
// Private APIs
// -------------------------------------------------------------------------------------

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

function appendModifier<A extends AST>(ast: A, modifier: Modifier): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.modifiers.value = [...ast.modifiers, modifier]
  })
}

function appendModifierEncoded(ast: AST, modifier: Modifier): AST {
  return ast.encoding === undefined ?
    appendModifier(ast, modifier) :
    replaceEncoding(ast, new Encoding(ast.encoding.transformations, appendModifier(ast.encoding.to, modifier)))
}

function replaceEncoding<A extends AST>(ast: A, encoding: Encoding | undefined): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding
  })
}

function replaceContext<A extends AST>(ast: A, context: Context): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.context.value = context
  })
}

function appendWrapper<A extends AST>(ast: A, wrapper: Wrapper, to: AST): A {
  return replaceEncoding(
    ast,
    ast.encoding === undefined ?
      new Encoding([wrapper], to) :
      new Encoding([...ast.encoding.transformations, wrapper], to)
  )
}

/**
 * Maps over the array but will return the original array if no changes occur.
 */
function mapOrSame<A>(
  as: Arr.NonEmptyReadonlyArray<A>,
  f: (a: A) => A
): Arr.NonEmptyReadonlyArray<A>
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

function memoize<O>(f: (ast: AST) => O): (ast: AST) => O {
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
export function annotate<A extends AST>(ast: A, annotations: Annotations): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = { ...ast.annotations, ...annotations }
  })
}

/** @internal */
export function filter<A extends AST>(ast: A, refinement: Refinement): A {
  return appendModifier(ast, refinement)
}

/** @internal */
export function filterEncoded(ast: AST, refinement: Refinement): AST {
  return appendModifierEncoded(ast, refinement)
}

/** @internal */
export function appendCtor<A extends AST>(ast: A, ctor: Ctor): A {
  return appendModifier(ast, ctor)
}

/** @internal */
export function optional<A extends AST>(ast: A): A {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(true, ast.context.isReadonly, ast.context.defaults, ast.context.encodedKey) :
      new Context(true, true, { decode: Option.none(), encode: Option.none() }, undefined)
  )
}

/** @internal */
export function mutable<A extends AST>(ast: A): A {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(ast.context.isOptional, false, ast.context.defaults, ast.context.encodedKey) :
      new Context(false, false, { decode: Option.none(), encode: Option.none() }, undefined)
  )
}

function required<A extends AST>(ast: A): A {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(false, ast.context.isReadonly, ast.context.defaults, ast.context.encodedKey) :
      new Context(false, true, { decode: Option.none(), encode: Option.none() }, undefined)
  )
}

/** @internal */
export function encodeOptionalToRequired<A extends AST, From, To>(
  ast: A,
  transformation: Transformation<Option.Option<To>, Option.Option<From>>,
  to: AST
): A {
  return appendWrapper(ast, new ContextWrapper(transformation, false), required(to))
}

/** @internal */
export function encodeRequiredToOptional<T extends AST, From, To>(
  ast: T,
  transformation: Transformation<Option.Option<To>, Option.Option<From>>,
  to: AST
): T {
  return appendWrapper(ast, new ContextWrapper(transformation, true), optional(to))
}

/** @internal */
export function encodeToKey<T extends AST>(ast: T, key: PropertyKey): T {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(ast.context.isOptional, ast.context.isReadonly, ast.context.defaults, key) :
      new Context(false, true, { decode: Option.none(), encode: Option.none() }, key)
  )
}

/** @internal */
export function withConstructorDefault<T extends AST>(
  ast: T,
  value: Option.Option<unknown> | Effect.Effect<unknown>
): T {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(
        ast.context.isOptional,
        ast.context.isReadonly,
        ast.context.defaults !== undefined
          ? { decode: value, encode: ast.context.defaults.encode }
          : { decode: value, encode: Option.none() },
        ast.context.encodedKey
      ) :
      new Context(false, true, { decode: value, encode: Option.none() }, undefined)
  )
}

/** @internal */
export function decodeTo<E, T>(
  from: AST,
  to: AST,
  transformation: Transformation<E, T>
): AST {
  return appendWrapper(to, new EncodeWrapper(transformation), from)
}

// -------------------------------------------------------------------------------------
// Public APIs
// -------------------------------------------------------------------------------------

/**
 * @since 4.0.0
 */
export const typeAST = memoize((ast: AST): AST => {
  if (ast.encoding !== undefined) {
    return typeAST(replaceEncoding(ast, undefined))
  }
  switch (ast._tag) {
    case "Declaration": {
      const tps = mapOrSame(ast.typeParameters, typeAST)
      return tps === ast.typeParameters ?
        ast :
        new Declaration(tps, ast.parser, ast.annotations, [], undefined, undefined)
    }
    case "TypeLiteral": {
      const pss = mapOrSame(ast.propertySignatures, (ps) => {
        const type = typeAST(ps.type)
        return type === ps.type
          ? ps
          : new PropertySignature(ps.name, type, ps.annotations)
      })
      const iss = mapOrSame(ast.indexSignatures, (is) => {
        const type = typeAST(is.type)
        return type === is.type ? is : new IndexSignature(is.parameter, type, is.isReadonly)
      })
      return pss === ast.propertySignatures && iss === ast.indexSignatures ?
        ast :
        new TypeLiteral(pss, iss, ast.annotations, [], undefined, undefined)
    }
    case "Suspend":
      return new Suspend(() => typeAST(ast.thunk()), ast.annotations, [], undefined, undefined)
  }
  return ast
})

/**
 * @since 4.0.0
 */
export const encodedAST = memoize((ast: AST): AST => {
  if (ast.encoding !== undefined) {
    return encodedAST(ast.encoding.to)
  }
  switch (ast._tag) {
    case "Declaration": {
      const tps = mapOrSame(ast.typeParameters, encodedAST)
      return tps === ast.typeParameters ?
        ast :
        new Declaration(tps, ast.parser, ast.annotations, [], undefined, undefined)
    }
    case "TypeLiteral": {
      const pss = mapOrSame(ast.propertySignatures, (ps) => {
        const type = encodedAST(ps.type)
        return type === ps.type
          ? ps
          : new PropertySignature(ps.name, type, ps.annotations)
      })
      const iss = mapOrSame(ast.indexSignatures, (is) => {
        const type = encodedAST(is.type)
        return type === is.type ? is : new IndexSignature(is.parameter, type, is.isReadonly)
      })
      return pss === ast.propertySignatures && iss === ast.indexSignatures ?
        ast :
        new TypeLiteral(pss, iss, ast.annotations, [], undefined, undefined)
    }
    case "Suspend":
      return new Suspend(() => encodedAST(ast.thunk()), ast.annotations, [], undefined, undefined)
  }
  return ast
})

/**
 * @since 4.0.0
 */
export const flip = memoize((ast: AST): AST => {
  if (ast.encoding !== undefined) {
    const to = ast.encoding.to
    const transformations = ast.encoding.transformations.map((t) => t.flip())
    const from = replaceEncoding(ast, undefined)
    return replaceEncoding(to, new Encoding(transformations, from))
  }

  switch (ast._tag) {
    case "Declaration": {
      const context = ast.context?.flip()
      const tps = mapOrSame(ast.typeParameters, flip)
      const modified = ast.modifiers.map((m) => m.flip())
      return tps === ast.typeParameters && modified === ast.modifiers && context === ast.context ?
        ast :
        new Declaration(tps, ast.parser, ast.annotations, modified, undefined, context)
    }
    case "Literal":
    case "NeverKeyword":
    case "StringKeyword":
    case "NumberKeyword": {
      const context = ast.context?.flip()
      return context === ast.context || context === undefined ?
        ast :
        replaceContext(ast, context)
    }
    case "TupleType": {
      const context = ast.context?.flip()
      const elements = mapOrSame(ast.elements, (e) => {
        const flipped = flip(e.ast)
        return flipped === e.ast ? e : new Element(flipped, e.isOptional, e.annotations)
      })
      const rest = mapOrSame(ast.rest, flip)
      return elements === ast.elements && rest === ast.rest && context === ast.context ?
        ast :
        new TupleType(elements, rest, ast.annotations, ast.modifiers, ast.encoding, context)
    }
    case "TypeLiteral": {
      const context = ast.context?.flip()
      const pss = mapOrSame(ast.propertySignatures, (ps) => {
        const flipped = flip(ps.type)
        return flipped === ps.type ? ps : new PropertySignature(ps.name, flipped, ps.annotations)
      })
      const iss = mapOrSame(ast.indexSignatures, (is) => {
        const flipped = flip(is.type)
        return flipped === is.type ? is : new IndexSignature(is.parameter, flipped, is.isReadonly)
      })
      return pss === ast.propertySignatures && iss === ast.indexSignatures && context === ast.context ?
        ast :
        new TypeLiteral(pss, iss, ast.annotations, ast.modifiers, ast.encoding, context)
    }
    case "Suspend": {
      const context = ast.context?.flip()
      const thunk = ast.thunk()
      const flipped = flip(thunk)
      return flipped === thunk && context === ast.context ?
        ast :
        new Suspend(() => flipped, ast.annotations, ast.modifiers, undefined, context)
    }
  }
})
