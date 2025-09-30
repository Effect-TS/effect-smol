/**
 * @since 4.0.0
 */

import { Effect, Scope, ServiceMap } from "../index.ts"
import type { Dequeue } from "../Queue.ts"
import type { PlatformError } from "./index.ts"
import type * as Option from "../data/Option.ts"
import * as Data from "../data/Data.ts"

/**
 * A `Terminal` represents a command-line interface which can read input from a
 * user and display messages to a user.
 *
 * @since 4.0.0
 * @category models
 */
export interface Terminal {
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
  readonly display: (text: string) => Effect.Effect<void, PlatformError.PlatformError>
}

/**
 * @since 4.0.0
 * @category model
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
 * @category model
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
 * @category model
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
