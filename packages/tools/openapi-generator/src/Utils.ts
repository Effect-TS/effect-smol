import * as String from "effect/String"
import * as UndefinedOr from "effect/UndefinedOr"

/**
 * Converts an OpenAPI name into the generator's camel-case form.
 *
 * Separators are removed, leading digits are ignored, and letters following a
 * separator or digit are upper-cased without otherwise changing letter casing.
 */
export const camelize = (self: string): string => {
  let str = ""
  let hadSymbol = false
  for (let i = 0; i < self.length; i++) {
    const charCode = self.charCodeAt(i)
    if (
      (charCode >= 65 && charCode <= 90) ||
      (charCode >= 97 && charCode <= 122)
    ) {
      str += hadSymbol ? self[i].toUpperCase() : self[i]
      hadSymbol = false
    } else if (charCode >= 48 && charCode <= 57) {
      if (str.length > 0) {
        str += self[i]
        hadSymbol = true
      }
    } else if (str.length > 0) {
      hadSymbol = true
    }
  }
  return str
}

/**
 * Converts an OpenAPI operation id into the exported operation identifier used
 * by generated TypeScript modules.
 */
export const identifier = (operationId: string) => String.capitalize(camelize(operationId))

/**
 * Extracts a trimmed, non-empty string from an unknown value.
 *
 * Returns `undefined` for non-string values and for strings containing only
 * whitespace.
 */
export const nonEmptyString = (a: unknown): string | undefined => {
  if (typeof a === "string") {
    const trimmed = String.trim(a)
    if (String.isNonEmpty(trimmed)) {
      return trimmed
    }
  }
}

/**
 * Renders an optional description as a JSDoc block for generated TypeScript.
 *
 * Returns an empty string when the description is absent and escapes any
 * closing comment marker so generated source remains syntactically valid.
 */
export const toComment = UndefinedOr.match({
  onUndefined: () => "",
  onDefined: (description: string) =>
    `/**
* ${description.replace(/\*\//g, " * /").split("\n").join("\n* ")}
*/\n`
})

/**
 * Appends every element from `source` into `destination` in order.
 *
 * This mutates `destination` directly, which avoids allocating an intermediate
 * array when generator code needs to merge collections.
 */
export const spreadElementsInto = <A>(source: Array<A>, destination: Array<A>): void => {
  for (let i = 0; i < source.length; i++) {
    destination.push(source[i])
  }
}
