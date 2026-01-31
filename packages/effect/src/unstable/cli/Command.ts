/**
 * @since 4.0.0
 */
import * as Console from "../../Console.ts"
import * as Effect from "../../Effect.ts"
import type * as FileSystem from "../../FileSystem.ts"
import { dual } from "../../Function.ts"
import type * as Layer from "../../Layer.ts"
import type * as Path from "../../Path.ts"
import type { Pipeable } from "../../Pipeable.ts"
import * as Predicate from "../../Predicate.ts"
import * as References from "../../References.ts"
import type * as ServiceMap from "../../ServiceMap.ts"
import type * as Terminal from "../../Terminal.ts"
import type { Simplify } from "../../Types.ts"
import type { ChildProcessSpawner } from "../process/ChildProcessSpawner.ts"
import * as CliError from "./CliError.ts"
import * as CliOutput from "./CliOutput.ts"
import { checkForDuplicateFlags, getHelpForCommandPath, makeCommand, toImpl, TypeId } from "./internal/command.ts"
import { generateDynamicCompletion, isCompletionRequest } from "./internal/completions/dynamic/core.ts"
import { handleCompletionRequest } from "./internal/completions/dynamic/handler.ts"
import { parseConfig } from "./internal/config.ts"
import * as Lexer from "./internal/lexer.ts"
import * as Parser from "./internal/parser.ts"
import type * as Param from "./Param.ts"
import * as Prompt from "./Prompt.ts"

/* ========================================================================== */
/* Public Types                                                               */
/* ========================================================================== */

/**
 * Represents a CLI command with its configuration, handler, and metadata.
 *
 * Commands are the core building blocks of CLI applications. They define:
 * - The command name and description
 * - Configuration including flags and arguments
 * - Handler function for execution
 * - Optional subcommands for hierarchical structures
 *
 * @example
 * ```ts
 * import { Console } from "effect"
 * import { Argument, Command, Flag } from "effect/unstable/cli"
 *
 * // Simple command with no configuration
 * const version: Command.Command<"version", {}, never, never> = Command.make(
 *   "version"
 * )
 *
 * // Command with flags and arguments
 * const deploy: Command.Command<
 *   "deploy",
 *   {
 *     readonly env: string
 *     readonly force: boolean
 *     readonly files: ReadonlyArray<string>
 *   },
 *   never,
 *   never
 * > = Command.make("deploy", {
 *   env: Flag.string("env"),
 *   force: Flag.boolean("force"),
 *   files: Argument.string("files").pipe(Argument.variadic())
 * })
 *
 * // Command with handler
 * const greet = Command.make("greet", {
 *   name: Flag.string("name")
 * }, (config) => Console.log(`Hello, ${config.name}!`))
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Command<Name extends string, Input, E = never, R = never> extends
  Pipeable,
  Effect.Yieldable<
    Command<Name, Input, E, R>,
    Input,
    never,
    CommandContext<Name>
  >
{
  readonly [TypeId]: typeof TypeId

  /**
   * The name of the command.
   */
  readonly name: Name

  /**
   * An optional description of the command.
   */
  readonly description: string | undefined

  /**
   * The subcommands available under this command.
   */
  readonly subcommands: ReadonlyArray<Command.Any>
}

/**
 * @since 4.0.0
 */
export declare namespace Command {
  /**
   * Configuration object for defining command flags, arguments, and nested structures.
   *
   * Command.Config allows you to specify:
   * - Individual flags and arguments using Param types
   * - Nested configuration objects for organization
   * - Arrays of parameters for repeated elements
   *
   * @example
   * ```ts
   * import { Argument, Flag } from "effect/unstable/cli"
   * import type * as CliCommand from "effect/unstable/cli/Command"
   *
   * // Simple flat configuration
   * const simpleConfig: CliCommand.Command.Config = {
   *   name: Flag.string("name"),
   *   age: Flag.integer("age"),
   *   file: Argument.string("file")
   * }
   *
   * // Nested configuration for organization
   * const nestedConfig: CliCommand.Command.Config = {
   *   user: {
   *     name: Flag.string("name"),
   *     email: Flag.string("email")
   *   },
   *   server: {
   *     host: Flag.string("host"),
   *     port: Flag.integer("port")
   *   }
   * }
   * ```
   *
   * @since 4.0.0
   * @category models
   */
  export interface Config {
    readonly [key: string]:
      | Param.Param<Param.ParamKind, any>
      | ReadonlyArray<Param.Param<Param.ParamKind, any> | Config>
      | Config
  }

  /**
   * Utilities for working with command configurations.
   *
   * @since 4.0.0
   * @category models
   */
  export namespace Config {
    /**
     * Infers the TypeScript type from a Command.Config structure.
     *
     * This type utility extracts the final configuration type that handlers will receive,
     * preserving the nested structure while converting Param types to their values.
     *
     * @example
     * ```ts
     * import { Flag } from "effect/unstable/cli"
     * import type * as CliCommand from "effect/unstable/cli/Command"
     *
     * const config = {
     *   name: Flag.string("name"),
     *   server: {
     *     host: Flag.string("host"),
     *     port: Flag.integer("port")
     *   }
     * } as const
     *
     * type Result = CliCommand.Command.Config.Infer<typeof config>
     * // {
     * //   readonly name: string
     * //   readonly server: {
     * //     readonly host: string
     * //     readonly port: number
     * //   }
     * // }
     * ```
     *
     * @since 4.0.0
     * @category models
     */
    export type Infer<A extends Config> = Simplify<
      { readonly [Key in keyof A]: InferValue<A[Key]> }
    >

    /**
     * Helper type utility for recursively inferring types from Config values.
     *
     * @since 4.0.0
     * @category models
     */
    export type InferValue<A> = A extends ReadonlyArray<any> ? { readonly [Key in keyof A]: InferValue<A[Key]> }
      : A extends Param.Param<infer _Kind, infer _Value> ? _Value
      : A extends Config ? Infer<A>
      : never
  }

  /**
   * Represents any Command regardless of its type parameters.
   *
   * @since 4.0.0
   * @category models
   */
  export type Any = Command<string, unknown, unknown, unknown>
}

/**
 * The environment required by CLI commands, including file system and path operations.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Environment = FileSystem.FileSystem | Path.Path | Terminal.Terminal | ChildProcessSpawner

/**
 * A utility type to extract the error type from a `Command`.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Error<C> = C extends Command<
  infer _Name,
  infer _Input,
  infer _Error,
  infer _Requirements
> ? _Error :
  never

/**
 * Service context for a specific command, enabling subcommands to access their parent's parsed configuration.
 *
 * When a subcommand handler needs access to flags or arguments from a parent command,
 * it can yield the parent command directly to retrieve its config. This is powered by
 * Effect's service system - each command automatically creates a service that provides
 * its parsed input to child commands.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * const parent = Command.make("app", {
 *   verbose: Flag.boolean("verbose"),
 *   config: Flag.string("config")
 * })
 *
 * const child = Command.make("deploy", {
 *   target: Flag.string("target")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     // Access parent's config by yielding the parent command
 *     const parentConfig = yield* parent
 *     yield* Console.log(`Verbose: ${parentConfig.verbose}`)
 *     yield* Console.log(`Config: ${parentConfig.config}`)
 *     yield* Console.log(`Target: ${config.target}`)
 *   }))
 *
 * const app = parent.pipe(Command.withSubcommands([child]))
 * // Usage: app --verbose --config prod.json deploy --target staging
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface CommandContext<Name extends string> {
  readonly _: unique symbol
  readonly name: Name
}

/**
 * Represents the parsed tokens from command-line input before validation.
 *
 * @since 4.0.0
 * @category models
 */
export interface ParsedTokens {
  readonly flags: Record<string, ReadonlyArray<string>>
  readonly arguments: ReadonlyArray<string>
  readonly errors?: ReadonlyArray<CliError.CliError>
  readonly subcommand?: {
    readonly name: string
    readonly parsedInput: ParsedTokens
  }
}

/**
 * @since 4.0.0
 * @category Guards
 */
export const isCommand = (u: unknown): u is Command.Any => Predicate.hasProperty(u, TypeId)

/* ========================================================================== */
/* Constructors                                                               */
/* ========================================================================== */

/**
 * Creates a Command from a name, optional config, optional handler function, and optional description.
 *
 * The make function is the primary constructor for CLI commands. It provides multiple overloads
 * to support different patterns of command creation, from simple commands with no configuration
 * to complex commands with nested configurations and error handling.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 * import { Argument, Command, Flag } from "effect/unstable/cli"
 *
 * // Simple command with no configuration
 * const version = Command.make("version")
 *
 * // Command with simple flags
 * const greet = Command.make("greet", {
 *   name: Flag.string("name"),
 *   count: Flag.integer("count").pipe(Flag.withDefault(1))
 * })
 *
 * // Command with nested configuration
 * const deploy = Command.make("deploy", {
 *   environment: Flag.string("env").pipe(
 *     Flag.withDescription("Target environment")
 *   ),
 *   server: {
 *     host: Flag.string("host").pipe(Flag.withDefault("localhost")),
 *     port: Flag.integer("port").pipe(Flag.withDefault(3000))
 *   },
 *   files: Argument.string("files").pipe(Argument.variadic),
 *   force: Flag.boolean("force").pipe(Flag.withDescription("Force deployment"))
 * })
 *
 * // Command with handler
 * const deployWithHandler = Command.make("deploy", {
 *   environment: Flag.string("env"),
 *   force: Flag.boolean("force")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Starting deployment to ${config.environment}`)
 *
 *     if (!config.force && config.environment === "production") {
 *       return yield* Effect.fail("Production deployments require --force flag")
 *     }
 *
 *     yield* Console.log("Deployment completed successfully")
 *   }))
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make: {
  <Name extends string>(name: Name): Command<Name, {}, never, never>

  <Name extends string, const Config extends Command.Config>(
    name: Name,
    config: Config
  ): Command<Name, Command.Config.Infer<Config>, never, never>

  <Name extends string, const Config extends Command.Config, R, E>(
    name: Name,
    config: Config,
    handler: (config: Command.Config.Infer<Config>) => Effect.Effect<void, E, R>
  ): Command<Name, Command.Config.Infer<Config>, E, R>
} = ((
  name: string,
  config?: Command.Config,
  handler?: (config: unknown) => Effect.Effect<void, unknown, unknown>
) => {
  const parsedConfig = parseConfig(config ?? {})
  return makeCommand({
    name,
    config: parsedConfig,
    ...(Predicate.isNotUndefined(handler) ? { handle: handler } : {})
  })
}) as any

/**
 * Creates a command that prompts the user for input using an interactive prompt.
 *
 * This is useful for commands that need to gather information interactively,
 * such as wizards or setup flows. The prompt runs before the handler and its
 * result is passed to the handler function.
 *
 * @example
 * ```ts
 * import { Console } from "effect"
 * import { Command, Prompt } from "effect/unstable/cli"
 *
 * const setup = Command.prompt(
 *   "setup",
 *   Prompt.text({ message: "Enter your name:" }),
 *   (name) => Console.log(`Hello, ${name}!`)
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
// TODO: Input type is `A` but parse returns `{}`. The actual `A` comes from
// running the prompt inside the handler. This is a semantic mismatch that
// would break if subcommands tried to access parent config.
export const prompt = <Name extends string, A, E, R>(
  name: Name,
  promptDef: Prompt.Prompt<A>,
  handler: (value: A) => Effect.Effect<void, E, R>
): Command<Name, A, E | Terminal.QuitError, R> => {
  const parsedConfig = parseConfig({})
  return makeCommand({
    name,
    config: parsedConfig,
    handle: () => Effect.flatMap(Prompt.run(promptDef), (value) => handler(value))
  })
}

/* ========================================================================== */
/* Combinators                                                                */
/* ========================================================================== */

/**
 * Adds or replaces the handler for a command.
 *
 * @example
 * ```ts
 * import { Console } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * // Command without initial handler
 * const greet = Command.make("greet", {
 *   name: Flag.string("name")
 * })
 *
 * // Add handler later
 * const greetWithHandler = greet.pipe(
 *   Command.withHandler((config: { readonly name: string }) =>
 *     Console.log(`Hello, ${config.name}!`)
 *   )
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withHandler: {
  <A, R, E>(
    handler: (value: A) => Effect.Effect<void, E, R>
  ): <Name extends string, XR, XE>(
    self: Command<Name, A, XE, XR>
  ) => Command<Name, A, E, R>
  <Name extends string, A, XR, XE, R, E>(
    self: Command<Name, A, XE, XR>,
    handler: (value: A) => Effect.Effect<void, E, R>
  ): Command<Name, A, E, R>
} = dual(2, <Name extends string, A, XR, XE, R, E>(
  self: Command<Name, A, XE, XR>,
  handler: (value: A) => Effect.Effect<void, E, R>
): Command<Name, A, E, R> => makeCommand({ ...toImpl(self), handle: handler }))

/**
 * Adds subcommands to a command, creating a hierarchical command structure.
 *
 * Subcommands can access their parent's parsed configuration by yielding the parent
 * command within their handler. This enables patterns like global flags that affect
 * all subcommands.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * // Parent command with global flags
 * const git = Command.make("git", {
 *   verbose: Flag.boolean("verbose")
 * })
 *
 * // Subcommand that accesses parent config
 * const clone = Command.make("clone", {
 *   repository: Flag.string("repo")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     const parent = yield* git // Access parent's parsed config
 *     if (parent.verbose) {
 *       yield* Console.log("Verbose mode enabled")
 *     }
 *     yield* Console.log(`Cloning ${config.repository}`)
 *   }))
 *
 * const app = git.pipe(Command.withSubcommands([clone]))
 * // Usage: git --verbose clone --repo github.com/foo/bar
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withSubcommands: {
  <const Subcommands extends ReadonlyArray<Command<any, any, any, any>>>(
    subcommands: Subcommands
  ): <Name extends string, Input, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<
    Name,
    Input,
    E | ExtractSubcommandErrors<Subcommands>,
    R | Exclude<ExtractSubcommandContext<Subcommands>, CommandContext<Name>>
  >
  <
    Name extends string,
    Input,
    E,
    R,
    const Subcommands extends ReadonlyArray<Command<any, any, any, any>>
  >(
    self: Command<Name, Input, E, R>,
    subcommands: Subcommands
  ): Command<
    Name,
    Input,
    E | ExtractSubcommandErrors<Subcommands>,
    R | Exclude<ExtractSubcommandContext<Subcommands>, CommandContext<Name>>
  >
} = dual(2, <
  Name extends string,
  Input,
  E,
  R,
  const Subcommands extends ReadonlyArray<Command<any, any, any, any>>
>(
  self: Command<Name, Input, E, R>,
  subcommands: Subcommands
): Command<
  Name,
  Input,
  E | ExtractSubcommandErrors<Subcommands>,
  R | Exclude<ExtractSubcommandContext<Subcommands>, CommandContext<Name>>
> => {
  checkForDuplicateFlags(self, subcommands)

  const impl = toImpl(self)
  const byName = new Map(subcommands.map((s) => [s.name, toImpl(s)] as const))

  // Internal type for routing - not exposed in public type
  type SubcommandInfo = { readonly name: string; readonly result: unknown }
  type InternalInput = Input & { readonly _subcommand?: SubcommandInfo }

  const parse = Effect.fnUntraced(function*(raw: ParsedTokens) {
    const parent = yield* impl.parse(raw)

    if (!raw.subcommand) {
      return parent
    }

    const sub = byName.get(raw.subcommand.name)
    if (!sub) {
      return parent
    }

    const result = yield* sub.parse(raw.subcommand.parsedInput)
    // Attach subcommand info internally for routing
    return Object.assign({}, parent, { _subcommand: { name: sub.name, result } }) as InternalInput
  })

  const handle = Effect.fnUntraced(function*(input: Input, path: ReadonlyArray<string>) {
    const internal = input as InternalInput
    if (internal._subcommand) {
      const child = byName.get(internal._subcommand.name)
      if (!child) {
        return yield* new CliError.ShowHelp({ commandPath: path })
      }
      return yield* child
        .handle(internal._subcommand.result, [...path, child.name])
        .pipe(Effect.provideService(impl.service, input))
    }
    return yield* impl.handle(input, path)
  })

  return makeCommand({
    name: impl.name,
    config: impl.config,
    description: impl.description,
    service: impl.service,
    subcommands,
    parse,
    handle
  })
})

// Type extractors for subcommand arrays - T[number] gives union of all elements
type ExtractSubcommandErrors<T extends ReadonlyArray<Command<any, any, any, any>>> = Error<T[number]>
type ExtractSubcommandContext<T extends ReadonlyArray<Command<any, any, any, any>>> = T[number] extends
  Command<any, any, any, infer R> ? R : never

/**
 * Sets the description for a command.
 *
 * Descriptions provide users with information about what the command does
 * when they view help documentation.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * const deploy = Command.make("deploy", {
 *   environment: Flag.string("env")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Deploying to ${config.environment}`)
 *   })).pipe(
 *     Command.withDescription("Deploy the application to a specified environment")
 *   )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withDescription: {
  (description: string): <const Name extends string, Input, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E, R>
  <const Name extends string, Input, E, R>(
    self: Command<Name, Input, E, R>,
    description: string
  ): Command<Name, Input, E, R>
} = dual(2, <const Name extends string, Input, E, R>(
  self: Command<Name, Input, E, R>,
  description: string
) => makeCommand({ ...toImpl(self), description }))

/* ========================================================================== */
/* Providing Services                                                         */
/* ========================================================================== */

// Internal helper: transforms a command's handler while preserving other properties
const mapHandler = <Name extends string, Input, E, R, E2, R2>(
  self: Command<Name, Input, E, R>,
  f: (handler: Effect.Effect<void, E | CliError.CliError, R | Environment>, input: Input) => Effect.Effect<void, E2, R2>
) => {
  const impl = toImpl(self)
  return makeCommand({ ...impl, handle: (input, path) => f(impl.handle(input, path), input) })
}

/**
 * Provides the handler of a command with the services produced by a layer
 * that optionally depends on the command-line input to be created.
 *
 * @example
 * ```ts
 * import { Effect, FileSystem, PlatformError } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * const deploy = Command.make("deploy", {
 *   env: Flag.string("env")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     const fs = yield* FileSystem.FileSystem
 *     // Use fs...
 *   })).pipe(
 *     // Provide FileSystem based on the --env flag
 *     Command.provide((config) =>
 *       config.env === "local"
 *         ? FileSystem.layerNoop({})
 *         : FileSystem.layerNoop({
 *           access: () =>
 *             Effect.fail(
 *               PlatformError.badArgument({
 *                 module: "FileSystem",
 *                 method: "access"
 *               })
 *             )
 *         })
 *     )
 *   )
 * ```
 *
 * @since 4.0.0
 * @category providing services
 */
export const provide: {
  <Input, LR, LE, LA>(
    layer: Layer.Layer<LA, LE, LR> | ((input: Input) => Layer.Layer<LA, LE, LR>),
    options?: {
      readonly local?: boolean | undefined
    } | undefined
  ): <const Name extends string, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E | LE, Exclude<R, LA> | LR>
  <const Name extends string, Input, E, R, LA, LE, LR>(
    self: Command<Name, Input, E, R>,
    layer: Layer.Layer<LA, LE, LR> | ((input: Input) => Layer.Layer<LA, LE, LR>),
    options?: {
      readonly local?: boolean | undefined
    } | undefined
  ): Command<Name, Input, E | LE, Exclude<R, LA> | LR>
} = dual((args) => isCommand(args[0]), <const Name extends string, Input, E, R, LA, LE, LR>(
  self: Command<Name, Input, E, R>,
  layer: Layer.Layer<LA, LE, LR> | ((input: Input) => Layer.Layer<LA, LE, LR>),
  options?: { readonly local?: boolean | undefined } | undefined
) =>
  mapHandler(
    self,
    (handler, input) => Effect.provide(handler, typeof layer === "function" ? layer(input) : layer, options)
  ))

/**
 * Provides the handler of a command with the implementation of a service that
 * optionally depends on the command-line input to be constructed.
 *
 * @since 4.0.0
 * @category providing services
 */
export const provideSync: {
  <I, S, Input>(
    service: ServiceMap.Service<I, S>,
    implementation: S | ((input: Input) => S)
  ): <const Name extends string, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E, Exclude<R, I>>
  <const Name extends string, Input, E, R, I, S>(
    self: Command<Name, Input, E, R>,
    service: ServiceMap.Service<I, S>,
    implementation: S | ((input: Input) => S)
  ): Command<Name, Input, E, Exclude<R, I>>
} = dual(3, <const Name extends string, Input, E, R, I, S>(
  self: Command<Name, Input, E, R>,
  service: ServiceMap.Service<I, S>,
  implementation: S | ((input: Input) => S)
) =>
  mapHandler(self, (handler, input) =>
    Effect.provideService(
      handler,
      service,
      typeof implementation === "function" ? (implementation as (input: Input) => S)(input) : implementation
    )))

/**
 * Provides the handler of a command with the service produced by an effect
 * that optionally depends on the command-line input to be created.
 *
 * @since 4.0.0
 * @category providing services
 */
export const provideEffect: {
  <I, S, Input, R2, E2>(
    service: ServiceMap.Service<I, S>,
    effect: Effect.Effect<S, E2, R2> | ((input: Input) => Effect.Effect<S, E2, R2>)
  ): <const Name extends string, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E | E2, Exclude<R, I> | R2>
  <const Name extends string, Input, E, R, I, S, R2, E2>(
    self: Command<Name, Input, E, R>,
    service: ServiceMap.Service<I, S>,
    effect: Effect.Effect<S, E2, R2> | ((input: Input) => Effect.Effect<S, E2, R2>)
  ): Command<Name, Input, E | E2, Exclude<R, I> | R2>
} = dual(3, <const Name extends string, Input, E, R, I, S, R2, E2>(
  self: Command<Name, Input, E, R>,
  service: ServiceMap.Service<I, S>,
  effect: Effect.Effect<S, E2, R2> | ((input: Input) => Effect.Effect<S, E2, R2>)
) =>
  mapHandler(
    self,
    (handler, input) =>
      Effect.provideServiceEffect(handler, service, typeof effect === "function" ? effect(input) : effect)
  ))

/**
 * Allows for execution of an effect, which optionally depends on command-line
 * input to be created, prior to executing the handler of a command.
 *
 * @since 4.0.0
 * @category providing services
 */
export const provideEffectDiscard: {
  <_, Input, E2, R2>(
    effect: Effect.Effect<_, E2, R2> | ((input: Input) => Effect.Effect<_, E2, R2>)
  ): <const Name extends string, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E | E2, R | R2>
  <const Name extends string, Input, E, R, _, E2, R2>(
    self: Command<Name, Input, E, R>,
    effect: Effect.Effect<_, E2, R2> | ((input: Input) => Effect.Effect<_, E2, R2>)
  ): Command<Name, Input, E | E2, R | R2>
} = dual(2, <const Name extends string, Input, E, R, _, E2, R2>(
  self: Command<Name, Input, E, R>,
  effect: Effect.Effect<_, E2, R2> | ((input: Input) => Effect.Effect<_, E2, R2>)
) =>
  mapHandler(self, (handler, input) => Effect.andThen(typeof effect === "function" ? effect(input) : effect, handler)))

/* ========================================================================== */
/* Execution                                                                  */
/* ========================================================================== */

const showHelp = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string>,
  errors?: ReadonlyArray<CliError.CliError>
): Effect.Effect<void, never, Environment> =>
  Effect.gen(function*() {
    const formatter = yield* CliOutput.Formatter
    const helpDoc = getHelpForCommandPath(command, commandPath)
    yield* Console.log(formatter.formatHelpDoc(helpDoc))
    if (errors && errors.length > 0) {
      yield* Console.error(formatter.formatErrors(errors))
    }
  })

/**
 * Runs a command with the provided input arguments.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * const greetCommand = Command.make("greet", {
 *   name: Flag.string("name")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Hello, ${config.name}!`)
 *   }))
 *
 * // Automatically gets args from process.argv
 * const program = Command.run(greetCommand, {
 *   version: "1.0.0"
 * })
 * ```
 *
 * @since 4.0.0
 * @category command execution
 */
export const run: {
  <Name extends string, Input, E, R>(
    command: Command<Name, Input, E, R>,
    config: {
      readonly version: string
    }
  ): Effect.Effect<void, E | CliError.CliError, R | Environment>
  (config: {
    readonly version: string
  }): <Name extends string, Input, E, R>(
    command: Command<Name, Input, E, R>
  ) => Effect.Effect<void, E | CliError.CliError, R | Environment>
} = dual(2, <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  config: {
    readonly version: string
  }
) => {
  // TODO: process.argv is a Node.js global. For browser/edge runtime support,
  // consider accepting an optional args parameter or using a platform service.
  const input = process.argv.slice(2)
  return runWith(command, config)(input)
})

/**
 * Runs a command with explicitly provided arguments instead of using process.argv.
 *
 * This function is useful for testing CLI applications or when you want to
 * programmatically execute commands with specific arguments.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * const greet = Command.make("greet", {
 *   name: Flag.string("name"),
 *   count: Flag.integer("count").pipe(Flag.withDefault(1))
 * }, (config) =>
 *   Effect.gen(function*() {
 *     for (let i = 0; i < config.count; i++) {
 *       yield* Console.log(`Hello, ${config.name}!`)
 *     }
 *   }))
 *
 * // Test with specific arguments
 * const testProgram = Effect.gen(function*() {
 *   const runCommand = Command.runWith(greet, { version: "1.0.0" })
 *
 *   // Test normal execution
 *   yield* runCommand(["--name", "Alice", "--count", "2"])
 *
 *   // Test help display
 *   yield* runCommand(["--help"])
 *
 *   // Test version display
 *   yield* runCommand(["--version"])
 * })
 * ```
 *
 * @since 4.0.0
 * @category command execution
 */
export const runWith = <const Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  config: {
    readonly version: string
  }
): (input: ReadonlyArray<string>) => Effect.Effect<void, E | CliError.CliError, R | Environment> => {
  const commandImpl = toImpl(command)
  return Effect.fnUntraced(
    function*(args: ReadonlyArray<string>) {
      // Check for dynamic completion request early (before normal parsing)
      if (isCompletionRequest(args)) {
        handleCompletionRequest(command)
        return
      }

      // Lex and extract built-in flags
      const { tokens, trailingOperands } = Lexer.lex(args)
      const { completions, help, logLevel, remainder, version } = yield* Parser.extractBuiltInOptions(tokens)
      const parsedArgs = yield* Parser.parseArgs({ tokens: remainder, trailingOperands }, command)
      const commandPath = [command.name, ...Parser.getCommandPath(parsedArgs)] as const
      const formatter = yield* CliOutput.Formatter

      // Handle built-in flags (early exits)
      if (help) {
        yield* Console.log(formatter.formatHelpDoc(getHelpForCommandPath(command, commandPath)))
        return
      }
      if (completions !== undefined) {
        yield* Console.log(generateDynamicCompletion(command.name, completions))
        return
      }
      if (version) {
        yield* Console.log(formatter.formatVersion(command.name, config.version))
        return
      }

      // Handle parsing errors
      if (parsedArgs.errors && parsedArgs.errors.length > 0) {
        return yield* showHelp(command, commandPath, parsedArgs.errors)
      }
      const parseResult = yield* Effect.result(commandImpl.parse(parsedArgs))
      if (parseResult._tag === "Failure") {
        return yield* showHelp(command, commandPath, [parseResult.failure])
      }
      const parsed = parseResult.success

      // Create and run the execution program
      const program = commandImpl.handle(parsed, [command.name])
      const withLogLevel = logLevel !== undefined
        ? Effect.provideService(program, References.MinimumLogLevel, logLevel)
        : program

      yield* withLogLevel
    },
    Effect.catch((error) =>
      CliError.isCliError(error) && error._tag === "ShowHelp"
        ? showHelp(command, error.commandPath)
        : Effect.fail(error)
    )
  )
}
