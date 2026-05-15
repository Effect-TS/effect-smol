/**
 * @since 2.0.0
 */

import * as predicate from "./Predicate.ts"

/**
 * Tests if a value is a `symbol`.
 *
 * **Example** (Checking for symbols)
 *
 * ```ts
 * import { isSymbol } from "effect/Symbol"
 *
 * console.log(isSymbol(Symbol.for("a"))) // true
 * console.log(isSymbol("a")) // false
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isSymbol: (u: unknown) => u is symbol = predicate.isSymbol
