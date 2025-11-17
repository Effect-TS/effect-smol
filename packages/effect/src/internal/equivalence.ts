import * as Equivalence from "../data/Equivalence.ts"
import * as Predicate from "../data/Predicate.ts"
import { memoize } from "../Function.ts"
import * as Equal from "../interfaces/Equal.ts"
import * as Annotations from "../schema/Annotations.ts"
import * as AST from "../schema/AST.ts"
import * as Parser from "../schema/Parser.ts"
import { errorWithPath } from "./errors.ts"

/** @internal */
export const memoized = memoize((ast: AST.AST): Equivalence.Equivalence<any> => {
  return go(ast, [])
})

function go(ast: AST.AST, path: ReadonlyArray<PropertyKey>): Equivalence.Equivalence<any> {
  // ---------------------------------------------
  // handle annotations
  // ---------------------------------------------
  const annotation = Annotations.resolve(ast)?.["equivalence"] as
    | Annotations.Equivalence.Override<any, ReadonlyArray<any>>
    | undefined
  if (annotation) {
    return annotation(AST.isDeclaration(ast) ? ast.typeParameters.map((tp) => go(tp, path)) : [])
  }
  switch (ast._tag) {
    case "Never":
      throw errorWithPath(`Unsupported AST ${ast._tag}`, path)
    case "Declaration":
    case "Null":
    case "Undefined":
    case "Void":
    case "Unknown":
    case "Any":
    case "String":
    case "Number":
    case "Boolean":
    case "BigInt":
    case "Symbol":
    case "Literal":
    case "UniqueSymbol":
    case "ObjectKeyword":
    case "Enum":
    case "TemplateLiteral":
      return Equal.equals
    case "Arrays": {
      const elements = ast.elements.map((e, i) => go(e, [...path, i]))
      const len = ast.elements.length
      const rest = ast.rest.map((r, i) => go(r, [...path, len + i]))
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
    case "Objects": {
      if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
        return Equal.equals
      }
      const propertySignatures = ast.propertySignatures.map((ps) => go(ps.type, [...path, ps.name]))
      const indexSignatures = ast.indexSignatures.map((is) => go(is.type, path))
      return Equivalence.make((a, b) => {
        if (!Predicate.isObject(a) || !Predicate.isObject(b)) {
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
          const aKeys = AST.getIndexSignatureKeys(a, is.parameter)
          const bKeys = AST.getIndexSignatureKeys(b, is.parameter)

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
    case "Union":
      return Equivalence.make((a, b) => {
        const candidates = AST.getCandidates(a, ast.types)
        const types = candidates.map(Parser.refinement)
        for (let i = 0; i < candidates.length; i++) {
          const is = types[i]
          if (is(a) && is(b)) {
            return go(candidates[i], path)(a, b)
          }
        }
        return false
      })
    case "Suspend": {
      const get = AST.memoizeThunk(() => go(ast.thunk(), path))
      return Equivalence.make((a, b) => get()(a, b))
    }
  }
}
