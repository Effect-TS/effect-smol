/**
 * @since 4.0.0
 */
import * as Equal from "./Equal.js"
import * as Equivalence from "./Equivalence.js"
import { memoizeThunk } from "./internal/schema/util.js"
import type * as Schema from "./Schema.js"
import * as SchemaAST from "./SchemaAST.js"
import * as SchemaToParser from "./SchemaToParser.js"

/**
 * @since 4.0.0
 */
export declare namespace Annotation {
  /**
   * @since 4.0.0
   */
  export type Override<T> = {
    readonly type: "override"
    readonly override: () => Equivalence.Equivalence<T>
  }

  /**
   * @since 4.0.0
   */
  export type Declaration<T, TypeParameters extends ReadonlyArray<Schema.Top>> = {
    readonly type: "declaration"
    readonly declaration: (
      typeParameters: { readonly [K in keyof TypeParameters]: Equivalence.Equivalence<TypeParameters[K]["Type"]> }
    ) => Equivalence.Equivalence<T>
  }
}

/**
 * @since 4.0.0
 */
export function make<T>(schema: Schema.Schema<T>): Equivalence.Equivalence<T> {
  return go(schema.ast)
}

/**
 * @since 4.0.0
 */
export function getAnnotation(
  ast: SchemaAST.AST
): Annotation.Declaration<any, ReadonlyArray<any>> | Annotation.Override<any> | undefined {
  return ast.annotations?.equivalence as any
}

function go(ast: SchemaAST.AST): Equivalence.Equivalence<any> {
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
        // ---------------------------------------------
        // handle property signatures
        // ---------------------------------------------
        for (let i = 0; i < propertySignatures.length; i++) {
          const ps = ast.propertySignatures[i]
          const name = ps.name
          const aHas = Object.prototype.hasOwnProperty.call(a, name)
          const bHas = Object.prototype.hasOwnProperty.call(b, name)
          if (ps.type.context?.isOptional) {
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
          const aKeys = SchemaAST.getIndexSignatureKeys(a, is)
          const bKeys = SchemaAST.getIndexSignatureKeys(b, is)
          if (aKeys.length !== bKeys.length) {
            return false
          }
          for (let j = 0; j < aKeys.length; j++) {
            const key = aKeys[j]
            if (
              !Object.prototype.hasOwnProperty.call(b, key) || !indexSignatures[i](a[key], b[key])
            ) {
              return false
            }
          }
        }
        return true
      })
    }
    case "UnionType":
      return Equivalence.make((a, b) => {
        const candidates = SchemaAST.getCandidates(a, ast.types)
        const types = candidates.map(SchemaToParser.refinement)
        for (let i = 0; i < candidates.length; i++) {
          const is = types[i]
          if (is(a) && is(b)) {
            return go(candidates[i])(a, b)
          }
        }
        return false
      })
    case "Suspend": {
      const get = memoizeThunk(() => go(ast.thunk()))
      return Equivalence.make((a, b) => get()(a, b))
    }
  }
}
