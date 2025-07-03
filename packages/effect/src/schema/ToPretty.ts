/**
 * @since 4.0.0
 */
import { formatPropertyKey, formatUnknown, memoizeThunk } from "../internal/schema/util.js"
import * as Option from "../Option.js"
import * as AST from "./AST.js"
import type * as Schema from "./Schema.js"
import * as ToParser from "./ToParser.js"

/**
 * @category model
 * @since 3.10.0
 */
export interface Pretty<T> {
  (t: T): string
}

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export type Override<T> = {
    readonly _tag: "override"
    readonly override: () => Pretty<T>
  }

  /**
   * @since 4.0.0
   */
  export type Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "declaration"
    readonly declaration: (
      typeParameters: { readonly [K in keyof TypeParameters]: Pretty<TypeParameters[K]["Type"]> }
    ) => Pretty<T>
  }
}

/**
 * @since 4.0.0
 */
export function override<S extends Schema.Top>(override: () => Pretty<S["Type"]>) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate({ pretty: { _tag: "override", override } })
  }
}

/**
 * @since 4.0.0
 */
export function getAnnotation(
  ast: AST.AST
): Annotation.Declaration<any, ReadonlyArray<any>> | Annotation.Override<any> | undefined {
  return ast.annotations?.pretty as any
}

const defaultFormat = () => formatUnknown

/**
 * @category Reducer
 * @since 4.0.0
 */
export const defaultReducerAlg: AST.ReducerAlg<Pretty<any>> = {
  onEnter: (ast, reduce) => {
    const annotation = getAnnotation(ast)
    if (annotation) {
      switch (annotation._tag) {
        case "declaration": {
          const typeParameters = (AST.isDeclaration(ast) ? ast.typeParameters : []).map(reduce)
          return Option.some(annotation.declaration(typeParameters))
        }
        case "override":
          return Option.some(annotation.override())
      }
    }
    return Option.none()
  },
  Declaration: defaultFormat,
  NullKeyword: defaultFormat,
  UndefinedKeyword: defaultFormat,
  VoidKeyword: () => () => "void(0)",
  NeverKeyword: (ast) => {
    throw new Error("cannot generate Pretty, no annotation found for never", { cause: ast })
  },
  UnknownKeyword: defaultFormat,
  AnyKeyword: defaultFormat,
  StringKeyword: defaultFormat,
  NumberKeyword: defaultFormat,
  BooleanKeyword: defaultFormat,
  BigIntKeyword: defaultFormat,
  SymbolKeyword: defaultFormat,
  UniqueSymbol: defaultFormat,
  ObjectKeyword: defaultFormat,
  Enums: defaultFormat,
  LiteralType: defaultFormat,
  TemplateLiteral: defaultFormat,
  TupleType: (ast, reduce) => (t) => {
    const elements = ast.elements.map(reduce)
    const rest = ast.rest.map(reduce)
    const out: Array<string> = []
    let i = 0
    // ---------------------------------------------
    // handle elements
    // ---------------------------------------------
    for (; i < elements.length; i++) {
      if (t.length < i + 1) {
        if (AST.isOptional(ast.elements[i])) {
          continue
        }
      } else {
        out.push(elements[i](t[i]))
      }
    }
    // ---------------------------------------------
    // handle rest element
    // ---------------------------------------------
    if (rest.length > 0) {
      const [head, ...tail] = rest
      for (; i < t.length - tail.length; i++) {
        out.push(head(t[i]))
      }
      // ---------------------------------------------
      // handle post rest elements
      // ---------------------------------------------
      for (let j = 0; j < tail.length; j++) {
        i += j
        out.push(tail[j](t[i]))
      }
    }

    return "[" + out.join(", ") + "]"
  },
  TypeLiteral: (ast, reduce) => {
    const propertySignatures = ast.propertySignatures.map((ps) => reduce(ps.type))
    const indexSignatures = ast.indexSignatures.map((is) => reduce(is.type))
    if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
      return formatUnknown
    }
    return (t) => {
      const out: Array<string> = []
      const visited = new Set<PropertyKey>()
      // ---------------------------------------------
      // handle property signatures
      // ---------------------------------------------
      for (let i = 0; i < propertySignatures.length; i++) {
        const ps = ast.propertySignatures[i]
        const name = ps.name
        visited.add(name)
        if (AST.isOptional(ps.type) && !Object.hasOwn(t, name)) {
          continue
        }
        out.push(
          `${formatPropertyKey(name)}: ${propertySignatures[i](t[name])}`
        )
      }
      // ---------------------------------------------
      // handle index signatures
      // ---------------------------------------------
      for (let i = 0; i < indexSignatures.length; i++) {
        const keys = AST.getIndexSignatureKeys(t, ast.indexSignatures[i])
        for (const key of keys) {
          if (visited.has(key)) {
            continue
          }
          visited.add(key)
          out.push(`${formatPropertyKey(key)}: ${indexSignatures[i](t[key])}`)
        }
      }

      return out.length > 0 ? "{ " + out.join(", ") + " }" : "{}"
    }
  },
  UnionType: (_, reduce, getCandidates) => (t) => {
    const candidates = getCandidates(t)
    const refinements = candidates.map(ToParser.refinement)
    for (let i = 0; i < candidates.length; i++) {
      const is = refinements[i]
      if (is(t)) {
        return reduce(candidates[i])(t)
      }
    }
    return formatUnknown(t)
  },
  Suspend: (ast, reduce) => {
    const get = memoizeThunk(() => reduce(ast.thunk()))
    return (t) => get()(t)
  }
}

/**
 * @category Reducer
 * @since 4.0.0
 */
export function getReducer(alg: AST.ReducerAlg<Pretty<any>>) {
  const reducer = AST.memoize(AST.getReducer<Pretty<any>>(alg))
  return <T>(schema: Schema.Schema<T>): Pretty<T> => {
    return reducer(schema.ast)
  }
}

/**
 * @since 4.0.0
 */
export const make = getReducer(defaultReducerAlg)
