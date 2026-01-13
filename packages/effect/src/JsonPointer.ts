/**
 * Utilities for working with JSON Pointer reference tokens.
 *
 * JSON Pointer (RFC 6901) defines a string syntax for identifying a specific value
 * within a JSON document. A JSON Pointer is a sequence of reference tokens separated
 * by forward slashes (`/`). Each reference token may need to be escaped when it contains
 * special characters.
 *
 * @since 4.0.0
 */

/**
 * Escapes a JSON Pointer reference token according to RFC 6901.
 *
 * This function encodes special characters in a reference token:
 * - `~` (tilde) is encoded as `~0`
 * - `/` (forward slash) is encoded as `~1`
 *
 * **Example** (Escaping special characters)
 *
 * ```ts
 * import { escapeToken } from "effect/JsonPointer"
 *
 * escapeToken("a/b") // "a~1b"
 * escapeToken("c~d") // "c~0d"
 * escapeToken("path/to~key") // "path~1to~0key"
 * ```
 *
 * @since 4.0.0
 */
export function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1")
}

/**
 * Unescapes a JSON Pointer reference token according to RFC 6901.
 *
 * This function decodes escaped characters in a reference token:
 * - `~1` is decoded as `/` (forward slash)
 * - `~0` is decoded as `~` (tilde)
 *
 * **Example** (Unescaping special characters)
 *
 * ```ts
 * import { unescapeToken } from "effect/JsonPointer"
 *
 * unescapeToken("a~1b") // "a/b"
 * unescapeToken("c~0d") // "c~d"
 * unescapeToken("path~1to~0key") // "path/to~key"
 * ```
 *
 * @since 4.0.0
 */
export function unescapeToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~")
}
