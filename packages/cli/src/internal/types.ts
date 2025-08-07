/**
 * Shared internal types for CLI parsing.
 * @since 4.0.0
 * @internal
 */

/**
 * Map of flag names to their provided string values.
 * Multiple occurrences of a flag produce multiple values.
 */
export type Flags = Record<string, ReadonlyArray<string>>

/**
 * Input context passed to `Param.parse` implementations.
 * - `flags`: already-collected flag values by canonical flag name
 * - `arguments`: remaining positional arguments to be consumed
 */
export interface ParamParseArgs {
  readonly flags: Flags
  readonly arguments: ReadonlyArray<string>
}
