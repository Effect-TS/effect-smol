import type { Pipeable } from "../../interfaces/Pipeable.ts"
import { pipeArguments } from "../../interfaces/Pipeable.ts"
import type * as AST from "../../schema/AST.ts"

/** @internal */
export function memoizeThunk<A>(f: () => A): () => A {
  let done = false
  let a: A
  return () => {
    if (done) {
      return a
    }
    a = f()
    done = true
    return a
  }
}

// TODO: replace with v3 implementation
/** @internal */
export const PipeableClass: new() => Pipeable = class {
  pipe() {
    return pipeArguments(this, arguments)
  }
}
/** @internal */
export const defaultParseOptions: AST.ParseOptions = {}
