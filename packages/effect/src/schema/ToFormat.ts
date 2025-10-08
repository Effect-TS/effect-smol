/**
 * @since 4.0.0
 */
import type { Format } from "../data/Format.ts"
import * as Option from "../data/Option.ts"
import { memoize } from "../Function.ts"
import { format, formatPropertyKey } from "../interfaces/Inspectable.ts"
import * as Annotations from "./Annotations.ts"
import * as AST from "./AST.ts"
import type * as Schema from "./Schema.ts"
import * as ToParser from "./ToParser.ts"

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export type Override<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "Override"
    readonly override: (
      typeParameters: { readonly [K in keyof TypeParameters]: Format<TypeParameters[K]["Type"]> }
    ) => Format<T>
  }
}

/**
 * **Technical Note**
 *
 * This annotation cannot be added to `Annotations.Bottom` because it would make
 * the schema invariant.
 *
 * @since 4.0.0
 */
export function override<S extends Schema.Top>(override: () => Format<S["Type"]>) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate({ format: { _tag: "Override", override } })
  }
}

function getAnnotation(ast: AST.AST): Annotation.Override<any, ReadonlyArray<any>> | undefined {
  return Annotations.get(ast)?.["format"] as any
}

const defaultFormat = () => format

/**
 * @category Reducer
 * @since 4.0.0
 */
export const defaultReducerAlg: AST.ReducerAlg<Format<any>> = {
  onEnter: (ast, reduce) => {
    // ---------------------------------------------
    // handle annotations
    // ---------------------------------------------
    const annotation = getAnnotation(ast)
    if (annotation) {
      if (AST.isDeclaration(ast)) {
        return Option.some(annotation.override(ast.typeParameters.map(reduce)))
      }
      return Option.some(annotation.override([]))
    }
    return Option.none()
  },
  Declaration: defaultFormat,
  NullKeyword: defaultFormat,
  UndefinedKeyword: defaultFormat,
  VoidKeyword: () => () => "void",
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
      return format
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
        const keys = AST.getIndexSignatureKeys(t, ast.indexSignatures[i].parameter)
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
    return format(t)
  },
  Suspend: (ast, reduce) => {
    const get = AST.memoizeThunk(() => reduce(ast.thunk()))
    return (t) => get()(t)
  }
}

/**
 * @category Reducer
 * @since 4.0.0
 */
export function getReducer(alg: AST.ReducerAlg<Format<any>>) {
  const reducer = memoize(AST.getReducer<Format<any>>(alg))
  return <T>(schema: Schema.Schema<T>): Format<T> => {
    return reducer(schema.ast)
  }
}

/**
 * @since 4.0.0
 */
export const make = getReducer(defaultReducerAlg)
