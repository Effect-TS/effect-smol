/**
 * @since 4.0.0
 */

import * as Predicate from "../data/Predicate.ts"
import * as Optic from "../optic/Optic.ts"
import * as AST from "./AST.ts"
import * as Schema from "./Schema.ts"

/**
 * @since 4.0.0
 */
export function make<S extends Schema.Top>(schema: S): Optic.Iso<S["Type"], S["~iso"]> {
  const serializer = Schema.make<Schema.typeCodec<S>>(goOptic(Schema.typeCodec(schema).ast))
  return Optic.makeIso(Schema.encodeSync(serializer), Schema.decodeSync(serializer))
}

function getOpticAnnotation(ast: AST.AST): Function | undefined {
  const optic = ast.annotations?.optic
  if (Predicate.isFunction(optic)) return optic
}

const goOptic = AST.memoize((ast: AST.AST): AST.AST => {
  switch (ast._tag) {
    case "Declaration": {
      const optic = getOpticAnnotation(ast)
      if (optic) {
        const link = optic(ast.typeParameters.map((tp) => Schema.make(goOptic(tp))))
        const to = goOptic(link.to)
        return AST.replaceEncoding(ast, to === link.to ? [link] : [new AST.Link(to, link.transformation)])
      }
      return ast
    }
    case "TupleType":
    case "TypeLiteral":
      return ast.go(goOptic)
    default:
      return ast
  }
})
