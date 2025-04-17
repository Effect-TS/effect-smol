/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import type * as Effect from "./Effect.js"
import { formatPropertyKey, formatUnknown, memoizeThunk } from "./internal/schema/util.js"
import * as Option from "./Option.js"
import * as Predicate from "./Predicate.js"
import * as Result from "./Result.js"
import type * as SchemaParserResult from "./SchemaParserResult.js"

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
  | UnknownKeyword
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

/**
 * @category model
 * @since 4.0.0
 */
export type Parser<I, O, R> = (i: I, options: ParseOptions) => SchemaParserResult.SchemaParserResult<O, R>

/**
 * PartialIso represents a partial isomorphism between types E (source) and T (view).
 * It provides functions to convert from E to T and back from T to E, possibly failing
 * in either direction (represented by an SchemaParserResult).
 *
 * @category model
 * @since 4.0.0
 */
export class PartialIso<E, T, RD = never, RE = never> {
  constructor(
    readonly decode: Parser<E, T, RD>,
    readonly encode: Parser<T, E, RE>,
    readonly annotations?: Annotations.Documentation
  ) {}
  flip(): PartialIso<T, E, RE, RD> {
    return new PartialIso(this.encode, this.decode, this.annotations)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Transformation<E, T, RD = never, RE = never>
  extends PartialIso<Option.Option<E>, Option.Option<T>, RD, RE>
{}

/**
 * @category model
 * @since 4.0.0
 */
export type UntypedTransformation = Transformation<any, any, unknown, unknown>

/**
 * @category model
 * @since 4.0.0
 */
export class Link {
  constructor(
    readonly transformation: UntypedTransformation,
    readonly to: AST
  ) {}
  flip(): Link {
    return new Link(this.transformation.flip(), flip(this.to))
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Encoding {
  constructor(
    readonly links: Arr.NonEmptyReadonlyArray<Link>
  ) {}
}

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

  readonly variant?: "make" | undefined
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
  | FilterIssue
  | EncodingIssue
  | PointerIssue
  | CompositeIssue

/**
 * Error that occurs when a filter has an error.
 *
 * @category model
 * @since 4.0.0
 */
export class FilterIssue {
  readonly _tag = "FilterIssue"
  constructor(
    readonly filter: Filter,
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
    readonly actual: Option.Option<unknown>,
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
    readonly actual: Option.Option<unknown>,
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
    readonly actual: Option.Option<unknown>,
    readonly message?: string
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class Filter {
  constructor(
    readonly filter: (
      input: any,
      options: ParseOptions
    ) => Issue | undefined | Effect.Effect<Issue | undefined, never, unknown>,
    readonly annotations?: Annotations
  ) {}
  toString() {
    const title = this.annotations?.title
    return Predicate.isString(title) ? title : "<filter>"
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class FilterGroup {
  readonly _tag = "FilterGroup"
  constructor(
    readonly filters: ReadonlyArray<Filter>
  ) {}
  toString() {
    return this.filters.map(String).join(" & ")
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Filters = readonly [FilterGroup, ...ReadonlyArray<FilterGroup>]

/**
 * @category model
 * @since 4.0.0
 */
export class Modifier {
  constructor(
    readonly isOptional: boolean,
    readonly isReadonly: boolean
  ) {}
}

/**
 * @category model
 * @since 4.0.0
 */
export class Context {
  constructor(
    readonly type: Modifier | undefined,
    readonly encoded: Modifier | undefined,
    readonly makePreprocessing: UntypedTransformation | undefined,
    readonly encodedKey: PropertyKey | undefined
  ) {}
  typeAST() {
    if (this.encodedKey === undefined) {
      return this
    }
    return new Context(this.type, undefined, this.makePreprocessing, undefined)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export abstract class Extensions implements Annotated {
  constructor(
    readonly annotations: Annotations | undefined,
    readonly filters: Filters | undefined,
    readonly encoding: Encoding | undefined,
    readonly context: Context | undefined
  ) {}

  protected abstract get label(): string

  toString() {
    let out = this.label
    if (this.filters) {
      for (const m of this.filters) {
        out += ` & ${m}`
      }
    }
    if (this.encoding) {
      const links = this.encoding.links
      const to = encodedAST(links[links.length - 1].to)
      if (this.context) {
        let context = this.context.encoded?.isReadonly === false ? "" : "readonly "
        context += this.context.encodedKey ? formatPropertyKey(this.context.encodedKey) : "_"
        context += this.context.encoded?.isOptional === true ? "?" : ""
        out = `${out} <-> ${context}: ${to}`
      } else {
        out = `${out} <-> ${to}`
      }
    } else {
      if (this.context) {
        const context = this.context.encodedKey ? ` (${formatPropertyKey(this.context.encodedKey)})` : ""
        out = `${out}${context}`
      }
    }
    return out
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Ctor {
  constructor(
    readonly ctor: new(...args: ReadonlyArray<any>) => any,
    readonly identifier: string
  ) {}
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
    ) => (u: unknown, self: Declaration, options: ParseOptions) => SchemaParserResult.SchemaParserResult<any, unknown>,
    readonly ctor: Ctor | undefined,
    annotations: Annotations | undefined,
    filters: Filters | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, filters, encoding, context)
  }

  protected get label(): string {
    const identifier = this.ctor?.identifier
    return Predicate.isString(identifier) ? identifier : "<Declaration>"
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
export const neverKeyword = new NeverKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class UnknownKeyword extends Extensions {
  readonly _tag = "UnknownKeyword"

  protected get label(): string {
    return "unknown"
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
export type LiteralValue = string | number | boolean | null | bigint

/**
 * @category model
 * @since 4.0.0
 */
export class Literal extends Extensions {
  readonly _tag = "Literal"
  constructor(
    readonly literal: LiteralValue,
    annotations: Annotations | undefined,
    filters: Filters | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, filters, encoding, context)
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
export const stringKeyword = new StringKeyword(undefined, undefined, undefined, undefined)

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
export const numberKeyword = new NumberKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class PropertySignature implements Annotated {
  constructor(
    readonly name: PropertyKey,
    readonly type: AST,
    readonly annotations: Annotations | undefined
  ) {}
  isOptional(): boolean {
    return this.type.context?.type?.isOptional ?? false
  }
  isReadonly(): boolean {
    return this.type.context?.type?.isReadonly ?? true
  }
  toString() {
    return (this.isReadonly() ? "readonly " : "") + formatPropertyKey(this.name) + (this.isOptional() ? "?" : "") +
      ": " +
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
    readonly type: AST
  ) {
    // TODO: check that parameter is a Parameter
  }
  isReadonly(): boolean {
    return this.type.context?.type?.isReadonly ?? true
  }
  toString() {
    return (this.isReadonly() ? "readonly " : "") + `[x: ${this.parameter}]: ${this.type}`
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class Element implements Annotated {
  constructor(
    readonly ast: AST,
    readonly annotations: Annotations | undefined
  ) {}
  isOptional(): boolean {
    return this.ast.context?.type?.isOptional ?? false
  }
  toString() {
    return String(this.ast) + (this.isOptional() ? "?" : "")
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
    annotations: Annotations | undefined,
    filters: Filters | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, filters, encoding, context)
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
export class TypeLiteral extends Extensions {
  readonly _tag = "TypeLiteral"
  constructor(
    readonly propertySignatures: ReadonlyArray<PropertySignature>,
    readonly indexSignatures: ReadonlyArray<IndexSignature>,
    annotations: Annotations | undefined,
    filters: Filters | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, filters, encoding, context)
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
    annotations: Annotations | undefined,
    filters: Filters | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, filters, encoding, context)
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

function appendFilterGroup<A extends AST>(ast: A, filterGroup: FilterGroup): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    if (ast.filters) {
      d.filters.value = [...ast.filters, filterGroup]
    } else {
      d.filters.value = [filterGroup]
    }
  })
}

function appendFilterGroupEncoded(ast: AST, filterGroup: FilterGroup): AST {
  if (ast.encoding) {
    const links = ast.encoding.links
    const last = links[links.length - 1]
    const newLast = new Link(last.transformation, appendFilterGroupEncoded(last.to, filterGroup))
    return replaceEncoding(ast, new Encoding(Arr.append(links.slice(0, links.length - 1), newLast)))
  } else {
    return appendFilterGroup(ast, filterGroup)
  }
}

function replaceEncoding<A extends AST>(ast: A, encoding: Encoding | undefined): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.encoding.value = encoding
  })
}

function replaceContext<A extends AST>(ast: A, context: Context | undefined): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.context.value = context
  })
}

/** @internal */
export function replaceFilters<A extends AST>(ast: A, filters: Filters | undefined): A {
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.filters.value = filters
  })
}

function appendTransformation<A extends AST>(
  ast: A,
  transformation: UntypedTransformation,
  to: AST
): A {
  const link = new Link(transformation, to)
  if (ast.encoding) {
    return replaceEncoding(ast, new Encoding([...ast.encoding.links, link]))
  } else {
    return replaceEncoding(ast, new Encoding([link]))
  }
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
export function filter<A extends AST>(ast: A, filter: Filter): A {
  return filterGroup(ast, [filter])
}

/** @internal */
export function filterGroup<A extends AST>(ast: A, filters: ReadonlyArray<Filter>): A {
  return appendFilterGroup(ast, new FilterGroup(filters))
}

/** @internal */
export function filterEncoded(ast: AST, filter: Filter): AST {
  return appendFilterGroupEncoded(ast, new FilterGroup([filter]))
}

/** @internal */
export function optional<A extends AST>(ast: A): A {
  if (ast.context) {
    return replaceContext(
      ast,
      new Context(
        new Modifier(true, ast.context.type?.isReadonly ?? true),
        new Modifier(true, ast.context.encoded?.isReadonly ?? true),
        ast.context.makePreprocessing,
        ast.context.encodedKey
      )
    )
  } else {
    return replaceContext(
      ast,
      new Context(new Modifier(true, true), new Modifier(true, true), undefined, undefined)
    )
  }
}

/** @internal */
export function mutable<A extends AST>(ast: A): A {
  if (ast.context) {
    return replaceContext(
      ast,
      new Context(
        new Modifier(ast.context.type?.isOptional ?? false, false),
        new Modifier(ast.context.encoded?.isOptional ?? false, false),
        ast.context.makePreprocessing,
        ast.context.encodedKey
      )
    )
  } else {
    return replaceContext(
      ast,
      new Context(new Modifier(false, false), new Modifier(false, false), undefined, undefined)
    )
  }
}

/** @internal */
export function encodedKey<A extends AST>(ast: A, key: PropertyKey): A {
  if (ast.context) {
    return replaceContext(
      ast,
      new Context(ast.context.type, ast.context.encoded, ast.context.makePreprocessing, key)
    )
  } else {
    return replaceContext(
      ast,
      new Context(undefined, undefined, undefined, key)
    )
  }
}

/** @internal */
export function getEncodedKey(ast: AST): PropertyKey | undefined {
  if (ast.encoding) {
    for (let i = ast.encoding.links.length - 1; i >= 0; i--) {
      const key = getEncodedKey(ast.encoding.links[i].to)
      if (key) {
        return key
      }
    }
  }
  if (ast.context) {
    return ast.context.encodedKey
  }
}

/** @internal */
export function withConstructorDefault<A extends AST>(
  ast: A,
  parser: Parser<Option.Option<unknown>, Option.Option<unknown>, unknown>,
  annotations?: Annotations.Documentation
): A {
  const transformation = new Transformation(
    (o, options) => {
      if (Option.isNone(o) || (Option.isSome(o) && o.value === undefined)) {
        return parser(o, options)
      }
      return Result.ok(o)
    },
    Result.ok,
    annotations
  )

  if (ast.context) {
    return replaceContext(
      ast,
      new Context(
        ast.context.type,
        ast.context.encoded,
        transformation,
        ast.context.encodedKey
      )
    )
  } else {
    return replaceContext(
      ast,
      new Context(undefined, undefined, transformation, undefined)
    )
  }
}

function mergeContexts(from: Context | undefined, to: Context | undefined): Context | undefined {
  if (from) {
    if (to) {
      return new Context(
        to.type,
        from.encoded,
        to.makePreprocessing,
        from.encodedKey
      )
    } else {
      return new Context(
        undefined,
        from.encoded,
        undefined,
        from.encodedKey
      )
    }
  } else {
    if (to) {
      return new Context(
        to.type,
        undefined,
        to.makePreprocessing,
        to.encodedKey
      )
    }
  }
}

/** @internal */
export function decodeTo<E, T, RD, RE>(from: AST, to: AST, transformation: Transformation<E, T, RD, RE>): AST {
  const context = mergeContexts(from.context, to.context)
  if (context) {
    to = replaceContext(to, context)
  }
  return appendTransformation(to, transformation, from)
}

// -------------------------------------------------------------------------------------
// Public APIs
// -------------------------------------------------------------------------------------

const typeAST_ = (ast: AST, includeModifiers: boolean): AST => {
  if (ast.encoding) {
    return typeAST_(replaceEncoding(ast, undefined), includeModifiers)
  }
  switch (ast._tag) {
    case "Declaration": {
      const tps = mapOrSame(ast.typeParameters, (tp) => typeAST_(tp, includeModifiers))
      const context = ast.context?.typeAST()
      return tps === ast.typeParameters && context === ast.context ?
        ast :
        new Declaration(
          tps,
          ast.parser,
          ast.ctor,
          ast.annotations,
          includeModifiers ? ast.filters : undefined,
          undefined,
          context
        )
    }
    case "TypeLiteral": {
      const pss = mapOrSame(ast.propertySignatures, (ps) => {
        const type = typeAST_(ps.type, includeModifiers)
        return type === ps.type ?
          ps :
          new PropertySignature(ps.name, type, ps.annotations)
      })
      const iss = mapOrSame(ast.indexSignatures, (is) => {
        const type = typeAST_(is.type, includeModifiers)
        return type === is.type ?
          is :
          new IndexSignature(is.parameter, type)
      })
      const context = ast.context?.typeAST()
      return pss === ast.propertySignatures && iss === ast.indexSignatures && context === ast.context ?
        ast :
        new TypeLiteral(
          pss,
          iss,
          ast.annotations,
          includeModifiers ? ast.filters : undefined,
          undefined,
          context
        )
    }
    case "Suspend":
      return new Suspend(
        () => typeAST_(ast.thunk(), includeModifiers),
        ast.annotations,
        includeModifiers ? ast.filters : undefined,
        undefined,
        ast.context?.typeAST()
      )
  }
  return ast
}

/**
 * @since 4.0.0
 */
export const typeAST = memoize((ast: AST): AST => {
  return typeAST_(ast, true)
})

/**
 * @since 4.0.0
 */
export const encodedAST = memoize((ast: AST): AST => {
  return typeAST_(flip(ast), false)
})

/**
 * @since 4.0.0
 */
export const flip = memoize((ast: AST): AST => {
  if (ast.encoding) {
    const links = ast.encoding.links
    const len = links.length
    const last = links[len - 1]
    const ls: Arr.NonEmptyArray<Link> = [
      new Link(links[0].transformation.flip(), flip(replaceEncoding(ast, undefined)))
    ]
    for (let i = 1; i < len; i++) {
      ls.unshift(new Link(links[i].transformation.flip(), flip(links[i - 1].to)))
    }
    const to = flip(last.to)
    if (to.encoding) {
      return replaceEncoding(to, new Encoding([...to.encoding.links, ...ls]))
    } else {
      return replaceEncoding(to, new Encoding(ls))
    }
  }

  switch (ast._tag) {
    case "Declaration": {
      const typeParameters = mapOrSame(ast.typeParameters, flip)
      return typeParameters === ast.typeParameters ?
        ast :
        new Declaration(typeParameters, ast.parser, ast.ctor, ast.annotations, ast.filters, undefined, ast.context)
    }
    case "Literal":
    case "NeverKeyword":
    case "UnknownKeyword":
    case "StringKeyword":
    case "NumberKeyword": {
      return ast
    }
    case "TupleType": {
      const elements = mapOrSame(ast.elements, (e) => {
        const flipped = flip(e.ast)
        return flipped === e.ast ? e : new Element(flipped, e.annotations)
      })
      const rest = mapOrSame(ast.rest, flip)
      return elements === ast.elements && rest === ast.rest ?
        ast :
        new TupleType(elements, rest, ast.annotations, ast.filters, ast.encoding, ast.context)
    }
    case "TypeLiteral": {
      const propertySignatures = mapOrSame(ast.propertySignatures, (ps) => {
        const flipped = flip(ps.type)
        return flipped === ps.type ? ps : new PropertySignature(ps.name, flipped, ps.annotations)
      })
      const indexSignatures = mapOrSame(ast.indexSignatures, (is) => {
        const flipped = flip(is.type)
        return flipped === is.type ? is : new IndexSignature(is.parameter, flipped)
      })
      return propertySignatures === ast.propertySignatures && indexSignatures === ast.indexSignatures ?
        ast :
        new TypeLiteral(propertySignatures, indexSignatures, ast.annotations, ast.filters, ast.encoding, ast.context)
    }
    case "Suspend": {
      return new Suspend(() => flip(ast.thunk()), ast.annotations, ast.filters, undefined, ast.context)
    }
  }
})
