/**
 * @since 4.0.0
 */

import * as Console from "../../Console.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import type { LogLevel as LogLevelType } from "../../LogLevel.ts"
import * as Option from "../../Option.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import * as CliOutput from "./CliOutput.ts"
import type * as Command from "./Command.ts"
import * as Flag from "./Flag.ts"

/* ========================================================================== */
/* Types                                                                      */
/* ========================================================================== */

/**
 * Context passed to action handlers.
 *
 * @since 4.0.0
 * @category models
 */
export interface HandlerContext {
  readonly command: Command.Command<any, unknown, unknown, unknown>
  readonly commandPath: ReadonlyArray<string>
  readonly version: string
}

/**
 * Action flag: side effect + exit (--help, --version, --completions).
 *
 * @since 4.0.0
 * @category models
 */
export interface Action<A> {
  readonly _tag: "Action"
  readonly flag: Flag.Flag<A>
  readonly run: (
    value: A,
    context: HandlerContext
  ) => Effect.Effect<void>
}

/**
 * Setting flag: configure command handler's environment (--log-level, --config).
 *
 * @since 4.0.0
 * @category models
 */
export interface Setting<A> extends ServiceMap.Service<never, A> {
  readonly _tag: "Setting"
  readonly flag: Flag.Flag<A>
}

/**
 * Global flag discriminated union.
 *
 * @since 4.0.0
 * @category models
 */
export type GlobalFlag<A> = Action<A> | Setting<A>

/* ========================================================================== */
/* Constructors                                                               */
/* ========================================================================== */

/**
 * Creates an Action flag that performs a side effect and exits.
 *
 * @since 4.0.0
 * @category constructors
 */
export const action = <A>(options: {
  readonly flag: Flag.Flag<A>
  readonly run: (
    value: A,
    context: HandlerContext
  ) => Effect.Effect<void>
}): Action<A> => ({
  _tag: "Action",
  flag: options.flag,
  run: options.run
})

/**
 * Creates a Setting flag that configures the command handler's environment.
 *
 * @since 4.0.0
 * @category constructors
 */
export const setting = <A>(options: {
  readonly flag: Flag.Flag<A>
}): Setting<A> => {
  settingIdCounter += 1
  const ref = ServiceMap.Service<never, A>(
    `effect/cli/GlobalFlag/Setting/${settingIdCounter}`
  )
  return Object.assign(ref, {
    _tag: "Setting" as const,
    flag: options.flag
  })
}

let settingIdCounter = 0

/* ========================================================================== */
/* Built-in Flag References                                                   */
/* ========================================================================== */

import * as CommandDescriptor from "./internal/completions/CommandDescriptor.ts"
import * as CompletionsInternal from "./internal/completions/Completions.ts"
import * as HelpInternal from "./internal/help.ts"

/**
 * The `--help` / `-h` global flag.
 * Shows help documentation for the command.
 *
 * @since 4.0.0
 * @category references
 */
export const Help: Action<boolean> = action({
  flag: Flag.boolean("help").pipe(
    Flag.withAlias("h"),
    Flag.withDescription("Show help information")
  ),
  run: (_, { command, commandPath }) =>
    Effect.gen(function*() {
      const formatter = yield* CliOutput.Formatter
      const helpDoc = yield* HelpInternal.getHelpForCommandPath(command, commandPath, Registry)
      yield* Console.log(formatter.formatHelpDoc(helpDoc))
    })
})

/**
 * The `--version` global flag.
 * Shows version information for the command.
 *
 * @since 4.0.0
 * @category references
 */
export const Version: Action<boolean> = action({
  flag: Flag.boolean("version").pipe(
    Flag.withDescription("Show version information")
  ),
  run: (_, { command, version }) =>
    Effect.gen(function*() {
      const formatter = yield* CliOutput.Formatter
      yield* Console.log(formatter.formatVersion(command.name, version))
    })
})

/**
 * The `--completions` global flag.
 * Prints shell completion script for the given shell.
 *
 * @since 4.0.0
 * @category references
 */
export const Completions: Action<Option.Option<"bash" | "zsh" | "fish">> = action({
  flag: Flag.choice("completions", ["bash", "zsh", "fish", "sh"] as const)
    .pipe(
      Flag.optional,
      Flag.map((v) => Option.map(v, (s) => s === "sh" ? "bash" : s)),
      Flag.withDescription("Print shell completion script")
    ),
  run: (shell, { command }) =>
    Effect.gen(function*() {
      if (Option.isNone(shell)) return
      const descriptor = CommandDescriptor.fromCommand(command)
      yield* Console.log(
        CompletionsInternal.generate(command.name, shell.value, descriptor)
      )
    })
})

/**
 * The `--log-level` global flag.
 * Sets the minimum log level for the command.
 *
 * @since 4.0.0
 * @category references
 */
export const LogLevel: Setting<Option.Option<LogLevelType>> = setting({
  flag: Flag.choiceWithValue(
    "log-level",
    [
      ["all", "All"],
      ["trace", "Trace"],
      ["debug", "Debug"],
      ["info", "Info"],
      ["warn", "Warn"],
      ["warning", "Warn"],
      ["error", "Error"],
      ["fatal", "Fatal"],
      ["none", "None"]
    ] as const
  ).pipe(
    Flag.optional,
    Flag.withDescription("Sets the minimum log level")
  )
})

/* ========================================================================== */
/* Registry                                                                   */
/* ========================================================================== */

/**
 * The ordered set of global flag references.
 * The parser iterates this set to know which flags to extract.
 *
 * @since 4.0.0
 * @category references
 */
export const Registry: ServiceMap.Reference<
  Set<GlobalFlag<any>>
> = ServiceMap.Reference("effect/cli/GlobalFlag/Registry", {
  defaultValue: () =>
    new Set<GlobalFlag<any>>([
      Help,
      Version,
      Completions,
      LogLevel
    ])
})

/* ========================================================================== */
/* Public API                                                                 */
/* ========================================================================== */

/**
 * Adds a global flag to the registry.
 *
 * @since 4.0.0
 * @category modifiers
 */
export const add: {
  <A>(
    flag: GlobalFlag<A>
  ): <B, E, R>(
    self: Effect.Effect<B, E, R>
  ) => Effect.Effect<B, E, R>
  <B, E, R, A>(
    self: Effect.Effect<B, E, R>,
    flag: GlobalFlag<A>
  ): Effect.Effect<B, E, R>
} = dual(
  2,
  Effect.fnUntraced(function*<B, E, R, A>(
    self: Effect.Effect<B, E, R>,
    flag: GlobalFlag<A>
  ) {
    const currentRegistry = yield* Registry
    const nextRegistry = new Set([...currentRegistry, flag])
    return yield* Effect.provideService(self, Registry, nextRegistry)
  })
)

/**
 * Removes a global flag by its reference.
 *
 * @since 4.0.0
 * @category modifiers
 */
export const remove: {
  <A>(
    flag: GlobalFlag<A>
  ): <B, E, R>(
    self: Effect.Effect<B, E, R>
  ) => Effect.Effect<B, E, R>
  <B, E, R, A>(
    self: Effect.Effect<B, E, R>,
    flag: GlobalFlag<A>
  ): Effect.Effect<B, E, R>
} = dual(
  2,
  Effect.fnUntraced(function*<B, E, R, A>(
    self: Effect.Effect<B, E, R>,
    flag: GlobalFlag<A>
  ) {
    const currentRegistry = yield* Registry
    const nextRegistry = new Set(currentRegistry)
    nextRegistry.delete(flag)
    return yield* Effect.provideService(self, Registry, nextRegistry)
  })
)

/**
 * Removes all global flags (built-in and user-defined).
 *
 * @since 4.0.0
 * @category modifiers
 */
export const clear = <B, E, R>(self: Effect.Effect<B, E, R>): Effect.Effect<B, E, R> =>
  Effect.provideService(self, Registry, new Set())
