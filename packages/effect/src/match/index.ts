/**
 * @since 4.0.0
 */

/**
 * The `effect/match` module provides a type-safe pattern matching system for
 * TypeScript. Inspired by functional programming, it simplifies conditional
 * logic by replacing verbose if/else or switch statements with a structured and
 * expressive API.
 *
 * This module supports matching against types, values, and discriminated unions
 * while enforcing exhaustiveness checking to ensure all cases are handled.
 *
 * Although pattern matching is not yet a native JavaScript feature,
 * `effect/match` offers a reliable implementation that is available today.
 *
 * **How Pattern Matching Works**
 *
 * Pattern matching follows a structured process:
 *
 * - **Creating a matcher**: Define a `Matcher` that operates on either a
 *   specific `Match.type` or `Match.value`.
 *
 * - **Defining patterns**: Use combinators such as `Match.when`, `Match.not`,
 *   and `Match.tag` to specify matching conditions.
 *
 * - **Completing the match**: Apply a finalizer such as `Match.exhaustive`,
 *   `Match.orElse`, or `Match.option` to determine how unmatched cases should
 *   be handled.
 *
 * @since 4.0.0
 */
export * as Match from "./Match.ts"
