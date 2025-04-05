/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type * as Effect from "./Effect.js"
import { formatUnknown, memoizeThunk } from "./internal/schema/util.js"
import * as Option from "./Option.js"
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
export class Parse<I, O> {
  readonly _tag = "Parse"
  constructor(
    readonly parse: (i: I, options: ParseOptions) => O
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class ParseResult<I, O> {
  readonly _tag = "ParseResult"
  constructor(
    readonly parseResult: (i: I, options: ParseOptions) => Result.Result<O, Issue>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class ParseEffect<I, O> {
  readonly _tag = "ParseEffect"
  constructor(
    readonly parseEffect: (i: I, options: ParseOptions) => Effect.Effect<O, Issue, any>
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export type Parsing<I, O> =
  | Parse<I, O>
  | ParseResult<I, O>
  | ParseEffect<I, O>

/**
 * @category model
 * @since 4.0.0
 */
export class EncodeTransformation<I, O> implements Annotated {
  readonly _tag = "EncodeTransformation"
  constructor(
    readonly encode: Parsing<I, O>,
    readonly decode: Parsing<O, I>,
    readonly annotations: Annotations
  ) {}
  flip(): EncodeTransformation<O, I> {
    return new EncodeTransformation(this.decode, this.encode, this.annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class ContextTransformation<I, O> {
  readonly _tag = "ContextTransformation"
  constructor(
    readonly encode: Parsing<Option.Option<I>, Option.Option<O>>,
    readonly decode: Parsing<Option.Option<O>, Option.Option<I>>,
    readonly isOptional: boolean
  ) {}
  flip(): ContextTransformation<O, I> {
    return new ContextTransformation(this.decode, this.encode, this.isOptional)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Transformation = EncodeTransformation<any, any> | ContextTransformation<any, any>

/**
 * @category model
 * @since 4.0.0
 */
export class Encoding {
  readonly transformations: ReadonlyArray<Transformation>
  readonly to: AST
  constructor(
    transformations: ReadonlyArray<Transformation>,
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
export class Context {
  static readonly default = new Context(false, true, Option.none(), undefined)
  constructor(
    readonly isOptional: boolean,
    readonly isReadonly: boolean,
    readonly constructorDefaultValue: Option.Option<unknown> | Effect.Effect<unknown>,
    readonly encodedKey: PropertyKey | undefined
  ) {}
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
    readonly encode: DeclarationParser | DeclarationParserEffect,
    readonly decode: DeclarationParser | DeclarationParserEffect,
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

function appendModifier<T extends AST>(ast: T, modifier: Modifier): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.modifiers.value = [...ast.modifiers, modifier]
  })
}

function appendModifierEncoded(ast: AST, modifier: Modifier): AST {
  return ast.encoding === undefined ?
    appendModifier(ast, modifier) :
    replaceEncoding(ast, new Encoding(ast.encoding.transformations, appendModifier(ast.encoding.to, modifier)))
}

function replaceEncoding<T extends AST>(ast: T, encoding: Encoding | undefined): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding
  })
}

function replaceContext<T extends AST>(ast: T, context: Context): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.context.value = context
  })
}

function appendTransformation<T extends AST>(ast: T, transformation: Transformation, to: AST): T {
  return replaceEncoding(
    ast,
    ast.encoding === undefined ?
      new Encoding([transformation], to) :
      new Encoding([...ast.encoding.transformations, transformation], to)
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

/** @internal */
export function annotate<T extends AST>(ast: T, annotations: Annotations): T {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.annotations.value = { ...ast.annotations, ...annotations }
  })
}

/** @internal */
export function filter<T extends AST>(ast: T, refinement: Refinement): T {
  return appendModifier(ast, refinement)
}

/** @internal */
export function filterEncoded(ast: AST, refinement: Refinement): AST {
  return appendModifierEncoded(ast, refinement)
}

/** @internal */
export function appendCtor<T extends AST>(ast: T, ctor: Ctor): T {
  return appendModifier(ast, ctor)
}

/** @internal */
export function optional<T extends AST>(ast: T): T {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(true, ast.context.isReadonly, ast.context.constructorDefaultValue, ast.context.encodedKey) :
      new Context(true, true, Option.none(), undefined)
  )
}

/** @internal */
export function mutable<T extends AST>(ast: T): T {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(ast.context.isOptional, false, ast.context.constructorDefaultValue, ast.context.encodedKey) :
      new Context(false, false, Option.none(), undefined)
  )
}

function required<T extends AST>(ast: T): T {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(false, ast.context.isReadonly, ast.context.constructorDefaultValue, ast.context.encodedKey) :
      new Context(false, true, Option.none(), undefined)
  )
}

/** @internal */
export function encodeOptionalToRequired<T extends AST, From, To>(
  ast: T,
  transformations: {
    encode: (input: Option.Option<From>) => To
    decode: (input: To) => Option.Option<From>
  },
  to: AST
): T {
  const transformation = new ContextTransformation<From, To>(
    new Parse((o) => Option.some(transformations.encode(o))),
    new Parse((o) => Option.flatMap(o, transformations.decode)),
    false
  )
  return appendTransformation(ast, transformation, required(to))
}

/** @internal */
export function encodeRequiredToOptional<T extends AST, From, To>(
  ast: T,
  transformations: {
    encode: (input: From) => Option.Option<To>
    decode: (input: Option.Option<To>) => From
  },
  to: AST
): T {
  const transformation = new ContextTransformation<From, To>(
    new Parse((o) => Option.flatMap(o, transformations.encode)),
    new Parse((o) => Option.some(transformations.decode(o))),
    true
  )
  return appendTransformation(ast, transformation, optional(to))
}

/** @internal */
export function encodeToKey<T extends AST>(ast: T, key: PropertyKey): T {
  return replaceContext(
    ast,
    ast.context !== undefined ?
      new Context(ast.context.isOptional, ast.context.isReadonly, ast.context.constructorDefaultValue, key) :
      new Context(false, true, Option.none(), key)
  )
}

/** @internal */
export function decodeFrom(
  from: AST,
  to: AST,
  decode: (input: any) => any,
  encode: (input: any) => any,
  annotations?: Annotations
): AST {
  return encodeTo(to, from, encode, decode, annotations)
}

/** @internal */
export function encodeTo(
  from: AST,
  to: AST,
  encode: (input: any) => any,
  decode: (input: any) => any,
  annotations?: Annotations
): AST {
  return appendTransformation(
    from,
    new EncodeTransformation(new Parse(encode), new Parse(decode), annotations ?? {}),
    to
  )
}

/** @internal */
export function decodeResultFrom<A extends AST>(
  from: AST,
  to: A,
  decode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  encode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  annotations?: Annotations
): A {
  return encodeResultTo(to, from, encode, decode, annotations)
}

/** @internal */
export function encodeResultTo<A extends AST>(
  from: A,
  to: AST,
  encode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  decode: (input: any, options: ParseOptions) => Result.Result<any, Issue>,
  annotations?: Annotations
): A {
  return appendTransformation(
    from,
    new EncodeTransformation(new ParseResult(encode), new ParseResult(decode), annotations ?? {}),
    to
  )
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
      const tps = changeMap(ast.typeParameters, typeAST)
      return tps === ast.typeParameters ?
        ast :
        new Declaration(tps, ast.encode, ast.decode, ast.annotations, [], undefined, undefined)
    }
    case "TypeLiteral": {
      const pss = changeMap(ast.propertySignatures, (ps) => {
        const type = typeAST(ps.type)
        return type === ps.type
          ? ps
          : new PropertySignature(ps.name, type, ps.annotations)
      })
      const iss = changeMap(ast.indexSignatures, (is) => {
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
      const tps = changeMap(ast.typeParameters, encodedAST)
      return tps === ast.typeParameters ?
        ast :
        new Declaration(tps, ast.encode, ast.decode, ast.annotations, [], undefined, undefined)
    }
    case "TypeLiteral": {
      const pss = changeMap(ast.propertySignatures, (ps) => {
        const type = encodedAST(ps.type)
        return type === ps.type
          ? ps
          : new PropertySignature(ps.name, type, ps.annotations)
      })
      const iss = changeMap(ast.indexSignatures, (is) => {
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
      const tps = changeMap(ast.typeParameters, flip)
      const modified = ast.modifiers.map((m) => m.flip())
      return tps === ast.typeParameters && modified === ast.modifiers ?
        ast :
        new Declaration(tps, ast.decode, ast.encode, ast.annotations, modified, undefined, ast.context)
    }
    case "Literal":
    case "NeverKeyword":
    case "StringKeyword":
    case "NumberKeyword":
      return ast
    case "TupleType": {
      const elements = changeMap(ast.elements, (e) => {
        const flipped = flip(e.ast)
        return flipped === e.ast ? e : new Element(flipped, e.isOptional, e.annotations)
      })
      const rest = changeMap(ast.rest, flip)
      return elements === ast.elements && rest === ast.rest ?
        ast :
        new TupleType(elements, rest, ast.annotations, ast.modifiers, ast.encoding, ast.context)
    }
    case "TypeLiteral": {
      const pss = changeMap(ast.propertySignatures, (ps) => {
        const flipped = flip(ps.type)
        return flipped === ps.type ? ps : new PropertySignature(ps.name, flipped, ps.annotations)
      })
      const iss = changeMap(ast.indexSignatures, (is) => {
        const flipped = flip(is.type)
        return flipped === is.type ? is : new IndexSignature(is.parameter, flipped, is.isReadonly)
      })
      return pss === ast.propertySignatures && iss === ast.indexSignatures ?
        ast :
        new TypeLiteral(pss, iss, ast.annotations, ast.modifiers, ast.encoding, ast.context)
    }
    case "Suspend": {
      const thunk = ast.thunk()
      const flipped = flip(thunk)
      return flipped === thunk ?
        ast :
        new Suspend(() => flipped, ast.annotations, ast.modifiers, undefined, ast.context)
    }
  }
})
