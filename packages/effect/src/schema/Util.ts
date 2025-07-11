/**
 * @since 4.0.0
 */
import { identity } from "../Function.js"
import * as Predicate from "../Predicate.js"
import type * as Struct from "../Struct.js"
import type * as Annotations from "./Annotations.js"
import * as AST from "./AST.js"
import * as Schema from "./Schema.js"
import * as Transformation from "./Transformation.js"

/**
 * @since 4.0.0
 * @experimental
 */
export function getNativeClassSchema<C extends new(...args: any) => any, S extends Schema.Struct<Schema.Struct.Fields>>(
  constructor: C,
  options: {
    readonly encoding: S
    readonly annotations?: Annotations.Declaration<InstanceType<C>, readonly []>
  }
): Schema.decodeTo<Schema.instanceOf<InstanceType<C>>, S, never, never> {
  const transformation = Transformation.transform<InstanceType<C>, S["Type"]>({
    decode: (props) => new constructor(props),
    encode: identity
  })
  return Schema.instanceOf({
    constructor,
    annotations: {
      defaultJsonSerializer: () => Schema.link<InstanceType<C>>()(options.encoding, transformation),
      ...options.annotations
    }
  }).pipe(Schema.encodeTo(options.encoding, transformation))
}

/**
 * Recursively flatten any nested Schema.Union members into a single tuple of leaf schemas.
 */
type Flatten<Schemas> = Schemas extends readonly [infer Head, ...infer Tail]
  ? Head extends Schema.Union<infer Inner> ? [...Flatten<Inner>, ...Flatten<Tail>]
  : [Head, ...Flatten<Tail>]
  : []

type augmentUnion<
  Tag extends PropertyKey,
  Members extends ReadonlyArray<Schema.Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }>,
  Flattened extends ReadonlyArray<Schema.Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }> = Flatten<
    Members
  >
> = {
  readonly membersByTag: Struct.Simplify<{ [M in Flattened[number] as M["Type"][Tag]]: M }>
  readonly is: { [M in Flattened[number] as M["Type"][Tag]]: (u: unknown) => u is M["Type"] }
  readonly match: {
    <Output>(
      value: Members[number]["Type"],
      cases: { [M in Flattened[number] as M["Type"][Tag]]: (value: M["Type"]) => Output }
    ): Output
    <Output>(
      cases: { [M in Flattened[number] as M["Type"][Tag]]: (value: M["Type"]) => Output }
    ): (value: Members[number]["Type"]) => Output
  }
}

function getTag(tag: PropertyKey, ast: AST.AST): PropertyKey | undefined {
  if (AST.isTypeLiteral(ast)) {
    const ps = ast.propertySignatures.find((p) => p.name === tag)
    if (ps && AST.isLiteralType(ps.type) && Predicate.isPropertyKey(ps.type.literal)) {
      return ps.type.literal
    }
  }
}

/**
 * @since 4.0.0
 * @experimental
 */
export function augmentUnion<
  const Tag extends PropertyKey,
  const Members extends ReadonlyArray<Schema.Top & { readonly Type: { readonly [K in Tag]: PropertyKey } }>
>(
  tag: Tag,
  union: Schema.Union<Members>
): augmentUnion<Tag, Members> {
  const membersByTag: Record<PropertyKey, unknown> = {}
  const is: Record<PropertyKey, (u: unknown) => boolean> = {}
  function process(schema: any) {
    const ast = schema.ast
    if (AST.isUnionType(ast)) {
      schema.members.forEach(process)
    } else if (AST.isTypeLiteral(ast)) {
      const value = getTag(tag, ast)
      if (value) {
        membersByTag[value] = schema
        is[value] = (u: unknown) => Predicate.hasProperty(u, tag) && u[tag] === value
      }
    } else {
      throw new Error("No literal found")
    }
  }

  process(union)

  function match() {
    if (arguments.length === 1) {
      const cases = arguments[0]
      return function(value: any) {
        return cases[value[tag]](value)
      }
    }
    const value = arguments[0]
    const cases = arguments[1]
    return cases[value[tag]](value)
  }

  return { membersByTag, is, match } as any
}
