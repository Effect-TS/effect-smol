/**
 * @since 4.0.0
 */
import { formatPropertyKey, formatUnknown, memoizeThunk } from "./internal/schema/util.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaToParser from "./SchemaToParser.js"

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
    readonly type: "override"
    readonly override: () => Pretty<T>
  }

  /**
   * @since 4.0.0
   */
  export type Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly type: "declaration"
    readonly declaration: (
      typeParameters: { readonly [K in keyof TypeParameters]: Pretty<TypeParameters[K]["Type"]> }
    ) => Pretty<T>
  }
}

/**
 * @since 4.0.0
 */
export function make<T>(schema: Schema.Schema<T>): Pretty<T> {
  return go(schema.ast)
}

/**
 * @since 4.0.0
 */
export function override<S extends Schema.Top>(override: () => Pretty<S["Type"]>) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate({ pretty: { type: "override", override } })
  }
}

/**
 * @since 4.0.0
 */
export function getAnnotation(
  ast: SchemaAST.AST
): Annotation.Declaration<any, ReadonlyArray<any>> | Annotation.Override<any> | undefined {
  return ast.annotations?.pretty as any
}

const go = SchemaAST.memoize((ast: SchemaAST.AST): Pretty<any> => {
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  const annotation = getAnnotation(ast)
  if (annotation) {
    switch (annotation.type) {
      case "declaration": {
        const typeParameters = (SchemaAST.isDeclaration(ast) ? ast.typeParameters : []).map(go)
        return annotation.declaration(typeParameters)
      }
      case "override":
        return annotation.override()
    }
  }
  switch (ast._tag) {
    case "NeverKeyword":
      throw new Error("cannot generate Pretty, no annotation found for never", { cause: ast })
    case "VoidKeyword":
      return () => "void(0)"
    case "Declaration":
    case "NullKeyword":
    case "UndefinedKeyword":
    case "UnknownKeyword":
    case "AnyKeyword":
    case "StringKeyword":
    case "NumberKeyword":
    case "BooleanKeyword":
    case "BigIntKeyword":
    case "SymbolKeyword":
    case "LiteralType":
    case "UniqueSymbol":
    case "ObjectKeyword":
    case "Enums":
    case "TemplateLiteral":
      return formatUnknown
    case "TupleType": {
      const elements = ast.elements.map(go)
      const rest = ast.rest.map(go)
      return (t) => {
        const out: Array<string> = []
        let i = 0
        // ---------------------------------------------
        // handle elements
        // ---------------------------------------------
        for (; i < elements.length; i++) {
          if (t.length < i + 1) {
            if (ast.elements[i].context?.isOptional) {
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
      }
    }
    case "TypeLiteral": {
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return formatUnknown
      }
      const propertySignatures = ast.propertySignatures.map((ps) => go(ps.type))
      const indexSignatures = ast.indexSignatures.map((is) => go(is.type))
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
          if (ps.type.context?.isOptional && !Object.hasOwn(t, name)) {
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
          const keys = SchemaAST.getIndexSignatureKeys(t, ast.indexSignatures[i])
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
    }
    case "UnionType":
      return (t) => {
        const candidates = SchemaAST.getCandidates(t, ast.types)
        const types = candidates.map(SchemaToParser.refinement)
        for (let i = 0; i < candidates.length; i++) {
          const is = types[i]
          if (is(t)) {
            return go(candidates[i])(t)
          }
        }
        return formatUnknown(t)
      }
    case "Suspend": {
      const get = memoizeThunk(() => go(ast.thunk()))
      return (t) => get()(t)
    }
  }
})
