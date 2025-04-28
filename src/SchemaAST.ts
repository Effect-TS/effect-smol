/**
 * @since 4.0.0
 */

import * as Arr from "./Array.js"
import { formatPropertyKey, formatUnknown, memoizeThunk } from "./internal/schema/util.js"
import * as Predicate from "./Predicate.js"
import type * as SchemaFilter from "./SchemaFilter.js"
import type * as SchemaMiddleware from "./SchemaMiddleware.js"
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
  // | EnumDeclaration
  // | TemplateLiteralType
  | TupleType
  | TypeLiteral
  | UnionType
  | Suspend

/**
 * @category model
 * @since 4.0.0
 */
export type Transformation = SchemaTransformation.Transformation<any, any, unknown, unknown>

/**
 * @category model
 * @since 4.0.0
 */
export class Link {
  constructor(
    readonly transformation: Transformation,
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
export class Middleware<E, R1, T, R2> {
  readonly _tag = "Middleware"
  constructor(
    readonly decode: SchemaMiddleware.Middleware<E, R1, T, R2>,
    readonly encode: SchemaMiddleware.Middleware<T, R2, E, R1>
  ) {}
  flip(): Middleware<T, R2, E, R1> {
    return new Middleware(this.encode, this.decode)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export type Modifier = SchemaFilter.Filter<unknown, unknown> | Middleware<any, any, any, any>

/**
 * @category model
 * @since 4.0.0
 */
export type Modifiers = readonly [Modifier, ...ReadonlyArray<Modifier>]

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
export abstract class Extensions implements Annotated {
  constructor(
    readonly annotations: Annotations | undefined,
    readonly modifiers: Modifiers | undefined,
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
    ) => (u: unknown, self: Declaration, options: ParseOptions) => SchemaResult.SchemaResult<any, unknown>,
    readonly ctor: Ctor | undefined,
    annotations: Annotations | undefined,
    modifiers: Modifiers | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class NullKeyword extends Extensions {
  readonly _tag = "NullKeyword"
}

/**
 * @since 4.0.0
 */
export const nullKeyword = new NullKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class UndefinedKeyword extends Extensions {
  readonly _tag = "UndefinedKeyword"
}

/**
 * @since 4.0.0
 */
export const undefinedKeyword = new UndefinedKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class VoidKeyword extends Extensions {
  readonly _tag = "VoidKeyword"
}

/**
 * @since 4.0.0
 */
export const voidKeyword = new VoidKeyword(undefined, undefined, undefined, undefined)

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
export class AnyKeyword extends Extensions {
  readonly _tag = "AnyKeyword"
}

/**
 * @since 4.0.0
 */
export const anyKeyword = new AnyKeyword(undefined, undefined, undefined, undefined)

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
export class ObjectKeyword extends Extensions {
  readonly _tag = "ObjectKeyword"
}

/**
 * @since 4.0.0
 */
export const objectKeyword = new ObjectKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export type LiteralValue = string | number | boolean | bigint

/**
 * @category model
 * @since 4.0.0
 */
export class UniqueSymbol extends Extensions {
  readonly _tag = "UniqueSymbol"
  constructor(
    readonly symbol: symbol,
    annotations: Annotations | undefined,
    modifiers: Modifiers | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class LiteralType extends Extensions {
  readonly _tag = "LiteralType"
  constructor(
    readonly literal: LiteralValue,
    annotations: Annotations | undefined,
    modifiers: Modifiers | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
export class BooleanKeyword extends Extensions {
  readonly _tag = "BooleanKeyword"
}

/**
 * @since 4.0.0
 */
export const booleanKeyword = new BooleanKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class SymbolKeyword extends Extensions {
  readonly _tag = "SymbolKeyword"
}

/**
 * @since 4.0.0
 */
export const symbolKeyword = new SymbolKeyword(undefined, undefined, undefined, undefined)

/**
 * @category model
 * @since 4.0.0
 */
export class BigIntKeyword extends Extensions {
  readonly _tag = "BigIntKeyword"
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
    readonly decode: Combine<PropertyKey, unknown> | undefined,
    readonly encode: Combine<PropertyKey, unknown> | undefined
  ) {}
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
    modifiers: Modifiers | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
    modifiers: Modifiers | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
    // TODO: check for duplicate property signatures
    // TODO: check for duplicate index signatures
  }
}

/**
 * @category model
 * @since 4.0.0
 */
export class UnionType extends Extensions {
  readonly _tag = "UnionType"
  constructor(
    readonly types: ReadonlyArray<AST>,
    annotations: Annotations | undefined,
    modifiers: Modifiers | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
    modifiers: Modifiers | undefined,
    encoding: Encoding | undefined,
    context: Context | undefined
  ) {
    super(annotations, modifiers, encoding, context)
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
export function replaceModifiers<A extends AST>(ast: A, modifiers: Modifiers | undefined): A {
  if (ast.modifiers === modifiers) {
    return ast
  }
  return modifyOwnPropertyDescriptors(ast, (d) => {
    d.modifiers.value = modifiers
  })
}

/** @internal */
export function appendModifiers<A extends AST>(ast: A, modifiers: Modifiers): A {
  if (ast.modifiers) {
    return replaceModifiers(ast, [...ast.modifiers, ...modifiers])
  } else {
    return replaceModifiers(ast, modifiers)
  }
}

/** @internal */
export function appendEncodedModifiers<A extends AST>(ast: A, modifiers: Modifiers): A {
  if (ast.encoding) {
    const links = ast.encoding.links
    const last = links[links.length - 1]
    return replaceEncoding(
      ast,
      new Encoding(
        Arr.append(
          links.slice(0, links.length - 1),
          new Link(last.transformation, appendEncodedModifiers(last.to, modifiers))
        )
      )
    )
  } else {
    return appendModifiers(ast, modifiers)
  }
}

function appendTransformation<A extends AST>(
  from: AST,
  transformation: Transformation,
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
export function memoize<O>(f: (ast: AST) => O): (ast: AST) => O {
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
export const typeAST = memoize((ast: AST): AST => {
  if (ast.encoding) {
    return typeAST(replaceEncoding(ast, undefined))
  }
  switch (ast._tag) {
    case "Declaration": {
      const tps = mapOrSame(ast.typeParameters, (tp) => typeAST(tp))
      return tps === ast.typeParameters ?
        ast :
        new Declaration(tps, ast.parser, ast.ctor, ast.annotations, ast.modifiers, undefined, ast.context)
    }
    case "TupleType": {
      const elements = mapOrSame(ast.elements, (e) => typeAST(e))
      const rest = mapOrSame(ast.rest, (e) => typeAST(e))
      return elements === ast.elements && rest === ast.rest ?
        ast :
        new TupleType(ast.isReadonly, elements, rest, ast.annotations, ast.modifiers, undefined, ast.context)
    }
    case "TypeLiteral": {
      const pss = mapOrSame(ast.propertySignatures, (ps) => {
        const type = typeAST(ps.type)
        return type === ps.type ?
          ps :
          new PropertySignature(ps.name, type)
      })
      const iss = mapOrSame(ast.indexSignatures, (is) => {
        const parameter = typeAST(is.parameter)
        const type = typeAST(is.type)
        return parameter === is.parameter && type === is.type && is.merge === undefined ?
          is :
          new IndexSignature(parameter, type, undefined)
      })
      return pss === ast.propertySignatures && iss === ast.indexSignatures ?
        ast :
        new TypeLiteral(pss, iss, ast.annotations, ast.modifiers, undefined, ast.context)
    }
    case "UnionType": {
      const types = mapOrSame(ast.types, typeAST)
      return types === ast.types ?
        ast :
        new UnionType(types, ast.annotations, ast.modifiers, undefined, ast.context)
    }
    case "Suspend":
      return new Suspend(() => typeAST(ast.thunk()), ast.annotations, ast.modifiers, undefined, ast.context)
    case "LiteralType":
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "NullKeyword":
    case "UndefinedKeyword":
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
    case "SymbolKeyword":
    case "BigIntKeyword":
    case "UniqueSymbol":
    case "VoidKeyword":
    case "ObjectKeyword":
      return ast
  }
  ast satisfies never // TODO: remove this
})

/**
 * @since 4.0.0
 */
export const encodedAST = memoize((ast: AST): AST => {
  return typeAST(flip(ast))
})

function flipModifier(m: Modifier): Modifier {
  switch (m._tag) {
    case "Filter":
      return m
    case "Middleware":
      return m.flip()
  }
}

function flipModifiers(ast: AST): Modifiers | undefined {
  return ast.modifiers ?
    mapOrSame(ast.modifiers, flipModifier) :
    undefined
}

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
      const modifiers = flipModifiers(ast)
      return typeParameters === ast.typeParameters && modifiers === ast.modifiers ?
        ast :
        new Declaration(typeParameters, ast.parser, ast.ctor, ast.annotations, modifiers, undefined, ast.context)
    }
    case "LiteralType":
    case "NeverKeyword":
    case "AnyKeyword":
    case "UnknownKeyword":
    case "NullKeyword":
    case "UndefinedKeyword":
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
    case "SymbolKeyword":
    case "BigIntKeyword":
    case "UniqueSymbol":
    case "VoidKeyword":
    case "ObjectKeyword": {
      const modifiers = flipModifiers(ast)
      return modifiers === ast.modifiers ?
        ast :
        replaceModifiers(ast, modifiers)
    }
    case "TupleType": {
      const elements = mapOrSame(ast.elements, (ast) => flip(ast))
      const rest = mapOrSame(ast.rest, flip)
      const modifiers = flipModifiers(ast)
      return elements === ast.elements && rest === ast.rest && modifiers === ast.modifiers ?
        ast :
        new TupleType(ast.isReadonly, elements, rest, ast.annotations, modifiers, undefined, ast.context)
    }
    case "TypeLiteral": {
      const propertySignatures = mapOrSame(ast.propertySignatures, (ps) => {
        const type = flip(ps.type)
        return type === ps.type ? ps : new PropertySignature(ps.name, type)
      })
      const indexSignatures = mapOrSame(ast.indexSignatures, (is) => {
        const parameter = flip(is.parameter)
        const type = flip(is.type)
        const merge = is.merge?.flip()
        return parameter === is.parameter && type === is.type && merge === is.merge
          ? is
          : new IndexSignature(parameter, type, merge)
      })
      const modifiers = flipModifiers(ast)
      return propertySignatures === ast.propertySignatures && indexSignatures === ast.indexSignatures &&
          modifiers === ast.modifiers ?
        ast :
        new TypeLiteral(
          propertySignatures,
          indexSignatures,
          ast.annotations,
          modifiers,
          undefined,
          ast.context
        )
    }
    case "UnionType": {
      const types = mapOrSame(ast.types, flip)
      const modifiers = flipModifiers(ast)
      return types === ast.types && modifiers === ast.modifiers ?
        ast :
        new UnionType(types, ast.annotations, modifiers, undefined, ast.context)
    }
    case "Suspend": {
      return new Suspend(
        () => flip(ast.thunk()),
        ast.annotations,
        flipModifiers(ast),
        undefined,
        ast.context
      )
    }
  }
  ast satisfies never // TODO: remove this
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

function formatAST(ast: AST): string {
  switch (ast._tag) {
    case "Declaration": {
      const identifier = ast.ctor?.identifier
      if (Predicate.isString(identifier)) {
        return identifier
      }
      const constructorTitle = ast.annotations?.constructorTitle
      if (Predicate.isString(constructorTitle)) {
        const tps = ast.typeParameters.map(format)
        return `${constructorTitle}${tps.length > 0 ? `<${tps.join(", ")}>` : ""}`
      }
      const title = ast.annotations?.title
      if (Predicate.isString(title)) {
        return title
      }
      return "<Declaration>"
    }
    case "LiteralType":
      return formatUnknown(ast.literal)
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
        return ast.types.map(format).join(" | ")
      }
    }
    case "Suspend":
      return "Suspend"
  }
  ast satisfies never // TODO: remove this
}

/** @internal */
export function formatFilter(filter: SchemaFilter.Filter<any, any>): string {
  const title = filter.annotations?.title
  if (Predicate.isString(title)) {
    return title
  }
  return "<filter>"
}

/** @internal */
export function formatMiddleware(middleware: SchemaMiddleware.Middleware<any, any, any, any>): string {
  const title = middleware.annotations?.title
  if (Predicate.isString(title)) {
    return title
  }
  return "<middleware>"
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
  const links = encoding.links
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
  if (ast.modifiers) {
    for (const m of ast.modifiers) {
      if (m._tag === "Filter") {
        out += ` & ${formatFilter(m)}`
      }
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
