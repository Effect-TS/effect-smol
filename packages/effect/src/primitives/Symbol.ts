/**
 * @since 2.0.0
 */

import * as equivalence from "../data/Equivalence.ts"
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

/**
 * An equivalence relation for symbols using strict equality.
 *
 * This equivalence uses the `===` operator to compare symbol values. Each symbol
 * is unique, except for symbols created with `Symbol.for()` which share the same key.
 *
 * @example
 * ```ts
 * import * as S from "effect/data/Symbol"
 *
 * const sym1 = Symbol("test")
 * const sym2 = Symbol("test")
 * const sym3 = Symbol.for("global")
 * const sym4 = Symbol.for("global")
 *
 * console.log(S.Equivalence(sym1, sym1)) // true (same reference)
 * console.log(S.Equivalence(sym1, sym2)) // false (different symbols)
 * console.log(S.Equivalence(sym3, sym4)) // true (same global symbol)
 * ```
 *
 * @category instances
 * @since 2.0.0
 */
export const Equivalence: equivalence.Equivalence<symbol> = equivalence.symbol
