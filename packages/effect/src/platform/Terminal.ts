/**
 * @since 4.0.0
 */

import * as Effect from "../Effect.ts"
import * as Scope from "../Scope.ts"
import type { Dequeue } from "../Queue.ts"
import type { PlatformError } from "./PlatformError.ts"
import type * as Option from "../data/Option.ts"
import * as Data from "../data/Data.ts"
import * as ServiceMap from "../ServiceMap.ts"

const TypeId = "~effect/platform/Terminal"

/**
 * A `Terminal` represents a command-line interface which can read input from a
 * user and display messages to a user.
 *
 * @since 4.0.0
 * @category models
 */
export interface Terminal {
  readonly [TypeId]: typeof TypeId

  /**
   * The number of columns available on the platform's terminal interface.
   */
  readonly columns: Effect.Effect<number>
  /**
   * Reads input events from the default standard input.
   */
  readonly readInput: Effect.Effect<Dequeue<UserInput>, never, Scope.Scope>
  /**
   * Reads a single line from the default standard input.
   */
  readonly readLine: Effect.Effect<string, QuitError>
  /**
   * Displays text to the default standard output.
   */
  readonly display: (text: string) => Effect.Effect<void, PlatformError>
}

/**
 * @since 4.0.0
 * @category models
 */
export interface Key {
  /**
   * The name of the key being pressed.
   */
  readonly name: string
  /**
   * If set to `true`, then the user is also holding down the `Ctrl` key.
   */
  readonly ctrl: boolean
  /**
   * If set to `true`, then the user is also holding down the `Meta` key.
   */
  readonly meta: boolean
  /**
   * If set to `true`, then the user is also holding down the `Shift` key.
   */
  readonly shift: boolean
}

/**
 * @since 4.0.0
 * @category models
 */
export interface UserInput {
  /**
   * The character read from the user (if any).
   */
  readonly input: Option.Option<string>
  /**
   * The key that the user pressed.
   */
  readonly key: Key
}

/**
 * A `QuitError` represents an error that occurs when a user attempts to
 * quit out of a `Terminal` prompt for input (usually by entering `ctrl`+`c`).
 *
 * @since 4.0.0
 * @category models
 */
export class QuitError extends Data.TaggedError("QuitError")<{}> { }

/**
 * @since 4.0.0
 * @category refinements
 */
export const isQuitError = (u: unknown): u is QuitError =>
  typeof u === "object" && u != null && "_tag" in u && u._tag === "QuitError"

/**
 * @since 4.0.0
 * @category tag
 */
export const Terminal: ServiceMap.Key<Terminal, Terminal> = ServiceMap.Key("effect/platform/Terminal")

/**
 * Creates a Terminal implementation
 *
 * @since 4.0.0
 * @category constructor
 */
export const make = (
  impl: Omit<Terminal, typeof TypeId>
): Terminal => Terminal.of({ ...impl, [TypeId]: TypeId })
