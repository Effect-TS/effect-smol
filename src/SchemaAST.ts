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
 * @category model
 * @since 4.0.0
 */
export class Parsing<I, O, R> implements Annotated {
  constructor(
    readonly parser: Parser<I, O, R>,
    readonly annotations: Annotations.Documentation | undefined
  ) {}
}

/**
 * PartialIso represents a partial isomorphism between types E (source) and T (view).
 * It provides functions to convert from E to T and back from T to E, possibly failing
 * in either direction (represented by a Parser).
 *
 * @category model
 * @since 4.0.0
 */
export class PartialIso<E, T, RD = never, RE = never> {
  constructor(
    readonly decode: Parsing<E, T, RD>,
    readonly encode: Parsing<T, E, RE>
  ) {}
  flip(): PartialIso<T, E, RE, RD> {
    return new PartialIso(this.encode, this.decode)
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
  | InvalidValueIssue
  | MissingValueIssue
  | UnexpectedValueIssue
  | ForbiddenOperationIssue
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
 * @since 4.0.0
 */
export class EncodingIssue {
  readonly _tag = "EncodingIssue"
  constructor(
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
export class UnexpectedValueIssue {
  static readonly instance = new UnexpectedValueIssue()
  readonly _tag = "UnexpectedValueIssue"
  private constructor() {}
}

/**
 * Issue that occurs when a required key or index is missing.
 *
 * @category model
 * @since 4.0.0
 */
export class MissingValueIssue {
  static readonly instance = new MissingValueIssue()
  readonly _tag = "MissingValueIssue"
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
export class InvalidValueIssue {
  readonly _tag = "InvalidValueIssue"
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
export class ForbiddenOperationIssue {
  readonly _tag = "ForbiddenOperationIssue"
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
    readonly modifier: Modifier | undefined,
    readonly typeDefault: UntypedTransformation | undefined
  ) {}
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
}

/**
 * @category model
 * @since 4.0.0
 */
export class NeverKeyword extends Extensions {
  readonly _tag = "NeverKeyword"
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
}

/**
 * @category model
 * @since 4.0.0
 */
export class StringKeyword extends Extensions {
  readonly _tag = "StringKeyword"
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
    return this.type.context?.modifier?.isOptional ?? false
  }
  isReadonly(): boolean {
    return this.type.context?.modifier?.isReadonly ?? true
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
    return this.type.context?.modifier?.isReadonly ?? true
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
    return this.ast.context?.modifier?.isOptional ?? false
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
    readonly isReadonly: boolean,
    annotations: Annotations | undefined,
    filters: Filters | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, filters, encoding, context)
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

function appendFilters<A extends AST>(ast: A, filters: Filters): A {
  if (ast.filters) {
    return replaceFilters(ast, [...ast.filters, ...filters])
  } else {
    return replaceFilters(ast, filters)
  }
}

function appendFiltersEncoded<A extends AST>(ast: A, filters: Filters): A {
  if (ast.encoding) {
    const links = ast.encoding.links
    const last = links[links.length - 1]
    return replaceEncoding(
      ast,
      new Encoding(
        Arr.append(
          links.slice(0, links.length - 1),
          new Link(last.transformation, appendFiltersEncoded(last.to, filters))
        )
      )
    )
  } else {
    return appendFilters(ast, filters)
  }
}

/** @internal */
export function filter<A extends AST>(ast: A, filter: Filter): A {
  return filterGroup(ast, [filter])
}

/** @internal */
export function filterGroup<A extends AST>(ast: A, filters: ReadonlyArray<Filter>): A {
  return appendFilters(ast, [new FilterGroup(filters)])
}

/** @internal */
export function filterEncoded(ast: AST, filter: Filter): AST {
  return appendFiltersEncoded(ast, [new FilterGroup([filter])])
}

function appendTransformation<A extends AST>(
  from: AST,
  transformation: UntypedTransformation,
  to: A
): A {
  const link = new Link(transformation, from)
  if (to.encoding) {
    return replaceEncoding(to, new Encoding([...to.encoding.links, link]))
  } else {
    return replaceEncoding(to, new Encoding([link]))
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
        new Modifier(true, ast.context.modifier?.isReadonly ?? true),
        ast.context.typeDefault
      )
    )
  } else {
    return replaceContext(
      ast,
      new Context(new Modifier(true, true), undefined)
    )
  }
}

/** @internal */
export function mutableKey<A extends AST>(ast: A): A {
  if (ast.context) {
    return replaceContext(
      ast,
      new Context(
        new Modifier(ast.context.modifier?.isOptional ?? false, false),
        ast.context.typeDefault
      )
    )
  } else {
    return replaceContext(
      ast,
      new Context(new Modifier(false, false), undefined)
    )
  }
}

/** @internal */
export function withConstructorDefault<A extends AST>(
  ast: A,
  parser: Parser<Option.Option<unknown>, Option.Option<unknown>, never>,
  annotations?: Annotations.Documentation
): A {
  const transformation = new Transformation<unknown, unknown, never, never>( // TODO: why the type annotation is needed?
    new Parsing(
      (o, options) => {
        if (Option.isNone(o) || (Option.isSome(o) && o.value === undefined)) {
          return parser(o, options)
        } else {
          return Result.ok(o)
        }
      },
      annotations
    ),
    new Parsing(Result.ok, undefined) // TODO: this is the identity parsing
  )

  if (ast.context) {
    return replaceContext(ast, new Context(ast.context.modifier, transformation))
  } else {
    return replaceContext(ast, new Context(undefined, transformation))
  }
}

/** @internal */
export function decodeTo<E, T, RD, RE>(from: AST, to: AST, transformation: Transformation<E, T, RD, RE>): AST {
  return appendTransformation(from, transformation, to)
}

const typeAST_ = (ast: AST, includeModifiers: boolean): AST => {
  if (ast.encoding) {
    return typeAST_(replaceEncoding(ast, undefined), includeModifiers)
  }
  switch (ast._tag) {
    case "Declaration": {
      const tps = mapOrSame(ast.typeParameters, (tp) => typeAST_(tp, includeModifiers))
      return tps === ast.typeParameters ?
        ast :
        new Declaration(
          tps,
          ast.parser,
          ast.ctor,
          ast.annotations,
          includeModifiers ? ast.filters : undefined,
          undefined,
          ast.context
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
      return pss === ast.propertySignatures && iss === ast.indexSignatures ?
        ast :
        new TypeLiteral(
          pss,
          iss,
          ast.annotations,
          includeModifiers ? ast.filters : undefined,
          undefined,
          ast.context
        )
    }
    case "Suspend":
      return new Suspend(
        () => typeAST_(ast.thunk(), includeModifiers),
        ast.annotations,
        includeModifiers ? ast.filters : undefined,
        undefined,
        ast.context
      )
  }
  return ast
}

// -------------------------------------------------------------------------------------
// Public APIs
// -------------------------------------------------------------------------------------

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
        new TupleType(elements, rest, ast.isReadonly, ast.annotations, ast.filters, ast.encoding, ast.context)
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

function formatIsReadonly(isReadonly: boolean | undefined): string {
  return isReadonly === false ? "" : "readonly "
}

function formatIsOptional(isOptional: boolean | undefined): string {
  return isOptional === true ? "?" : ""
}

function formatPropertySignature(ps: PropertySignature): string {
  return formatIsReadonly(ps.isReadonly())
    + formatPropertyKey(ps.name)
    + formatIsOptional(ps.isOptional())
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

function formatElement(e: Element): string {
  return format(e.ast) + formatIsOptional(e.isOptional())
}

function formatElements(es: ReadonlyArray<Element>): string {
  return es.map(formatElement).join(", ")
}

function formatTail(tail: ReadonlyArray<AST>): string {
  return tail.map(format).join(", ")
}

function formatAST(ast: AST): string {
  switch (ast._tag) {
    case "Declaration": {
      const identifier = ast.ctor?.identifier
      return Predicate.isString(identifier) ? identifier : "<Declaration>"
    }
    case "Literal":
      return formatUnknown(ast.literal)
    case "NeverKeyword":
      return "never"
    case "UnknownKeyword":
      return "unknown"
    case "StringKeyword":
      return "string"
    case "NumberKeyword":
      return "number"
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
          return `${formatIsReadonly(ast.isReadonly)}${head}[]`
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
    case "Suspend":
      return "Suspend"
  }
}

/** @internal */
export function formatFilter(filter: Filter): string {
  const title = filter.annotations?.title
  return Predicate.isString(title) ? title : "<filter>"
}

function formatFilters(filters: Filters): string {
  return filters.map((filterGroup) => filterGroup.filters.map(formatFilter).join(" & ")).join(" & ")
}

function formatEncoding(encoding: Encoding): string {
  const links = encoding.links
  const last = links[links.length - 1]
  const to = encodedAST(last.to)
  if (to.context) {
    let context = formatIsReadonly(to.context.modifier?.isReadonly)
    context += formatIsOptional(to.context.modifier?.isOptional)
    return ` <-> ${context}: ${format(to)}`
  } else {
    return ` <-> ${format(to)}`
  }
}

/** @internal */
export const format = memoize((ast: AST): string => {
  let out = formatAST(ast)
  if (ast.filters) {
    out += ` & ${formatFilters(ast.filters)}`
  }
  if (ast.encoding) {
    out += formatEncoding(ast.encoding)
  }
  return out
})
