/**
 * @since 4.0.0
 */
import * as Equivalence from "../data/Equivalence.ts"
import * as Predicate from "../data/Predicate.ts"
import { memoize } from "../Function.ts"
import * as Equal from "../interfaces/Equal.ts"
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
  export type Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly _tag: "Declaration"
    readonly declaration: (
      typeParameters: { readonly [K in keyof TypeParameters]: Equivalence.Equivalence<TypeParameters[K]["Type"]> }
    ) => Equivalence.Equivalence<T>
  }

  /**
   * @since 4.0.0
   */
  export type Override<T> = {
    readonly _tag: "Override"
    readonly override: () => Equivalence.Equivalence<T>
  }
}

/**
 * @since 4.0.0
 */
export function make<T>(schema: Schema.Schema<T>): Equivalence.Equivalence<T> {
  return go(schema.ast)
}

/**
 * **Technical Note**
 *
 * This annotation cannot be added to the standard annotations because it would
 * make the schema invariant.
 *
 * @since 4.0.0
 */
export function override<S extends Schema.Top>(override: () => Equivalence.Equivalence<S["Type"]>) {
  return (self: S): S["~rebuild.out"] => {
    return self.annotate({ equivalence: { _tag: "Override", override } })
  }
}

function getAnnotation(
  ast: AST.AST
): Annotation.Declaration<any, ReadonlyArray<any>> | Annotation.Override<any> | undefined {
  return Annotations.get(ast)?.["equivalence"] as any
}

const go = memoize((ast: AST.AST): Equivalence.Equivalence<any> => {
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  const annotation = getAnnotation(ast)
  if (annotation) {
    switch (annotation._tag) {
      case "Declaration": {
        if (AST.isDeclaration(ast)) {
          return annotation.declaration(ast.typeParameters.map(go))
        }
        throw new Error("Declaration annotation found on non-declaration AST")
      }
      case "Override":
        return annotation.override()
    }
  }
  switch (ast._tag) {
    case "NeverKeyword":
      throw new Error("cannot generate Equivalence, no annotation found for never", { cause: ast })
    case "Declaration":
    case "NullKeyword":
    case "UndefinedKeyword":
    case "VoidKeyword":
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
      return Equal.equals
    case "TupleType": {
      const elements = ast.elements.map(go)
      const rest = ast.rest.map(go)
      return Equivalence.make((a, b) => {
        if (!Array.isArray(a) || !Array.isArray(b)) {
          return false
        }
        const len = a.length
        if (len !== b.length) {
          return false
        }
        // ---------------------------------------------
        // handle elements
        // ---------------------------------------------
        let i = 0
        for (; i < Math.min(len, ast.elements.length); i++) {
          if (!elements[i](a[i], b[i])) {
            return false
          }
        }
        // ---------------------------------------------
        // handle rest element
        // ---------------------------------------------
        if (rest.length > 0) {
          const [head, ...tail] = rest
          for (; i < len - tail.length; i++) {
            if (!head(a[i], b[i])) {
              return false
            }
          }
          // ---------------------------------------------
          // handle post rest elements
          // ---------------------------------------------
          for (let j = 0; j < tail.length; j++) {
            i += j
            if (!tail[j](a[i], b[i])) {
              return false
            }
          }
        }
        return true
      })
    }
    case "TypeLiteral": {
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return Equal.equals
      }
      const propertySignatures = ast.propertySignatures.map((ps) => go(ps.type))
      const indexSignatures = ast.indexSignatures.map((is) => go(is.type))
      return Equivalence.make((a, b) => {
        if (!Predicate.isRecord(a) || !Predicate.isRecord(b)) {
          return false
        }
        // ---------------------------------------------
        // handle property signatures
        // ---------------------------------------------
        for (let i = 0; i < propertySignatures.length; i++) {
          const ps = ast.propertySignatures[i]
          const name = ps.name
          const aHas = Object.hasOwn(a, name)
          const bHas = Object.hasOwn(b, name)
          if (AST.isOptional(ps.type)) {
            if (aHas !== bHas) {
              return false
            }
          }
          if (aHas && bHas && !propertySignatures[i](a[name], b[name])) {
            return false
          }
        }
        // ---------------------------------------------
        // handle index signatures
        // ---------------------------------------------
        for (let i = 0; i < indexSignatures.length; i++) {
          const is = ast.indexSignatures[i]
          const aKeys = AST.getIndexSignatureKeys(a, is)
          const bKeys = AST.getIndexSignatureKeys(b, is)

          if (aKeys.length !== bKeys.length) return false

          for (let j = 0; j < aKeys.length; j++) {
            const key = aKeys[j]
            if (!Object.hasOwn(b, key) || !indexSignatures[i](a[key], b[key])) {
              return false
            }
          }
        }
        return true
      })
    }
    case "UnionType":
      return Equivalence.make((a, b) => {
        const candidates = AST.getCandidates(a, ast.types)
        const types = candidates.map(ToParser.refinement)
        for (let i = 0; i < candidates.length; i++) {
          const is = types[i]
          if (is(a) && is(b)) {
            return go(candidates[i])(a, b)
          }
        }
        return false
      })
    case "Suspend": {
      const get = AST.memoizeThunk(() => go(ast.thunk()))
      return Equivalence.make((a, b) => get()(a, b))
    }
  }
})
