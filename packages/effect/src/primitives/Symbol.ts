/**
 * @since 2.0.0
 */

import * as predicate from "../data/Predicate.ts"

/**
 * Tests if a value is a `symbol`.
 *
 * @example
 * ```ts
 * import * as assert from "node:assert"
 * import * as Predicate from "effect/data/Predicate"
 *
 * assert.deepStrictEqual(Predicate.isSymbol(Symbol.for("a")), true)
 * assert.deepStrictEqual(Predicate.isSymbol("a"), false)
 * ```
 *
 * @category guards
 * @since 2.0.0
 */
export const isSymbol: (u: unknown) => u is symbol = predicate.isSymbol
