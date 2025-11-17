import * as Inspectable from "../interfaces/Inspectable.ts"

/** @internal */
export function errorWithPath(message: string, path: ReadonlyArray<PropertyKey>) {
  if (path.length > 0) {
    message += `\n  at ${Inspectable.formatPath(path)}`
  }
  return new Error(message)
}
