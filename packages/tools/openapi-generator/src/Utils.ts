import * as String from "effect/String"
import * as UndefinedOr from "effect/UndefinedOr"

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

export const identifier = (operationId: string) => String.capitalize(camelize(operationId))

/**
 * Sanitizes a schema reference name to be a valid JavaScript identifier.
 * This is specifically for component schema names (not operation IDs).
 *
 * Preserves the original casing while removing invalid characters.
 *
 * @example
 * sanitizeSchemaName("Conversation-2") // "Conversation2"
 * sanitizeSchemaName("Error-2") // "Error2"
 * sanitizeSchemaName("MySchema") // "MySchema" (unchanged)
 */
export const sanitizeSchemaName = (name: string): string => {
  // Use existing camelize to handle hyphens and special chars
  // But preserve original capitalization by checking if first char was uppercase
  const firstCharWasUpper = name.length > 0 && name[0] === name[0].toUpperCase()
  const sanitized = camelize(name)

  // Ensure first character matches original casing
  if (sanitized.length === 0) return sanitized
  return firstCharWasUpper
    ? sanitized[0].toUpperCase() + sanitized.slice(1)
    : sanitized[0].toLowerCase() + sanitized.slice(1)
}

export function nonEmptyString(a: unknown): string | undefined {
  if (typeof a === "string") {
    const trimmed = String.trim(a)
    if (String.isNonEmpty(trimmed)) {
      return trimmed
    }
  }
}

export const toComment = UndefinedOr.match({
  onUndefined: () => "",
  onDefined: (description: string) =>
    `/**
* ${description.replace(/\*\//g, " * /").split("\n").join("\n* ")}
*/\n`
})

export const spreadElementsInto = <A>(source: Array<A>, destination: Array<A>): void => {
  for (let i = 0; i < source.length; i++) {
    destination.push(source[i])
  }
}
