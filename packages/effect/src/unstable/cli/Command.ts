/**
 * @since 4.0.0
 */
import * as Console from "../../Console.ts"
import * as Predicate from "../../data/Predicate.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import type { Pipeable } from "../../interfaces/Pipeable.ts"
import type * as Layer from "../../Layer.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Path from "../../platform/Path.ts"
import type * as Terminal from "../../platform/Terminal.ts"
import * as References from "../../References.ts"
import type * as ServiceMap from "../../ServiceMap.ts"
import type { Simplify } from "../../types/Types.ts"
import * as CliError from "./CliError.ts"
import * as HelpFormatter from "./HelpFormatter.ts"
import {
  checkForDuplicateFlags,
  type CommandInternal,
  getHelpForCommandPath,
  makeCommand,
  toImpl,
  type TypeId
} from "./internal/command.ts"
import {
  generateDynamicCompletion,
  handleCompletionRequest,
  isCompletionRequest
} from "./internal/completions/index.ts"
import { parseConfig } from "./internal/config.ts"
import * as Lexer from "./internal/lexer.ts"
import * as Parser from "./internal/parser.ts"
import type * as Param from "./Param.ts"
import * as Prompt from "./Prompt.ts"

// Re-export toImpl for internal modules
export { toImpl } from "./internal/command.ts"

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
 * const version: Command.Command<"version", {}, never, never> = Command.make("version")
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
    ParentCommand<Name>
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
  readonly subcommands: ReadonlyArray<Command<any, any, any, any>>
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
   * import { Command, Flag, Argument } from "effect/unstable/cli"
   *
   * // Simple flat configuration
   * const simpleConfig: Command.Config = {
   *   name: Flag.string("name"),
   *   age: Flag.integer("age"),
   *   file: Argument.string("file")
   * }
   *
   * // Nested configuration for organization
   * const nestedConfig: Command.Config = {
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

  export namespace Config {
    /**
     * Infers the TypeScript type from a Command.Config structure.
     *
     * This type utility extracts the final configuration type that handlers will receive,
     * preserving the nested structure while converting Param types to their values.
     *
     * @example
     * ```ts
     * import { Command, Flag, Argument } from "effect/unstable/cli"
     *
     * const config = {
     *   name: Flag.string("name"),
     *   server: {
     *     host: Flag.string("host"),
     *     port: Flag.integer("port")
     *   }
     * } as const
     *
     * type Result = Command.Config.Infer<typeof config>
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
}

/**
 * The environment required by CLI commands, including file system and path operations.
 *
 * @since 4.0.0
 * @category utility types
 */
export type Environment = FileSystem.FileSystem | Path.Path | Terminal.Terminal

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
 * Service context for a specific command, providing access to command input through Effect's service system.
 *
 * @since 4.0.0
 * @category models
 */
export interface ParentCommand<Name extends string> {
  readonly _: unique symbol
  readonly name: Name
}

/**
 * Represents the raw input parsed from the command-line which is provided to
 * the `Command.parse` method.
 *
 * @since 4.0.0
 * @category models
 */
export interface RawInput {
  readonly flags: Record<string, ReadonlyArray<string>>
  readonly arguments: ReadonlyArray<string>
  readonly errors?: ReadonlyArray<CliError.CliError>
  readonly subcommand?: {
    readonly name: string
    readonly parsedInput: RawInput
  }
}

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
 * import { Command, Flag, Argument } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
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
 *   environment: Flag.string("env").pipe(Flag.withDescription("Target environment")),
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
 *   })
 * )
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
 * @since 4.0.0
 * @category constructors
 */
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
 * import { Command, Flag } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * // First define subcommands
 * const clone = Command.make("clone", {
 *   repository: Flag.string("repository")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Cloning ${config.repository}`)
 *   })
 * )
 *
 * const add = Command.make("add", {
 *   files: Flag.string("files")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Adding ${config.files}`)
 *   })
 * )
 *
 * // Create main command with subcommands and handler
 * const git = Command.make("git", {
 *   verbose: Flag.boolean("verbose")
 * }).pipe(
 *   Command.withSubcommands(clone, add),
 *   Command.withHandler((config) =>
 *     Effect.gen(function*() {
 *       // Now config has the subcommand field
 *       yield* Console.log(`Git verbose: ${config.verbose}`)
 *       if (config.subcommand) {
 *         yield* Console.log(`Executed subcommand: ${config.subcommand.name}`)
 *       }
 *     })
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
 * @example
 * ```ts
 * import { Command, Flag } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * const clone = Command.make("clone", {
 *   repository: Flag.string("repository")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Cloning ${config.repository}`)
 *   })
 * )
 *
 * const add = Command.make("add", {
 *   files: Flag.string("files")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Adding ${config.files}`)
 *   })
 * )
 *
 * // Data-last (pipeable)
 * const git = Command.make("git", {}, () => Effect.void).pipe(
 *   Command.withSubcommands([clone, add])
 * )
 *
 * // Data-first
 * const git2 = Command.withSubcommands(
 *   Command.make("git", {}, () => Effect.void),
 *   [clone, add]
 * )
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
    Input & { readonly subcommand: ExtractSubcommandInputs<Subcommands> | undefined },
    ExtractSubcommandErrors<Subcommands>,
    R | Exclude<ExtractSubcommandContext<Subcommands>, ParentCommand<Name>>
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
    Input & { readonly subcommand: ExtractSubcommandInputs<Subcommands> | undefined },
    ExtractSubcommandErrors<Subcommands>,
    R | Exclude<ExtractSubcommandContext<Subcommands>, ParentCommand<Name>>
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
  Input & { readonly subcommand: ExtractSubcommandInputs<Subcommands> | undefined },
  ExtractSubcommandErrors<Subcommands>,
  R | Exclude<ExtractSubcommandContext<Subcommands>, ParentCommand<Name>>
> => {
  checkForDuplicateFlags(self, subcommands)

  const selfImpl = toImpl(self)
  type NewInput = Input & { readonly subcommand: ExtractSubcommandInputs<Subcommands> | undefined }

  // Build a stable name → subcommand index to avoid repeated linear scans
  const subcommandIndex = new Map<string, CommandInternal<string, any, any, any>>()
  for (const s of subcommands) {
    subcommandIndex.set(s.name, toImpl(s))
  }

  const parse: (input: RawInput) => Effect.Effect<NewInput, CliError.CliError, Environment> = Effect.fnUntraced(
    function*(input: RawInput) {
      const parentResult = yield* selfImpl.parse(input)

      const subRef = input.subcommand
      if (!subRef) {
        return { ...parentResult, subcommand: undefined }
      }

      const sub = subcommandIndex.get(subRef.name)

      // Parser guarantees valid subcommand names, but guard defensively
      if (!sub) {
        return { ...parentResult, subcommand: undefined }
      }

      const subResult = yield* sub.parse(subRef.parsedInput)
      const subcommand = { name: sub.name, result: subResult } as ExtractSubcommandInputs<Subcommands>
      return { ...parentResult, subcommand }
    }
  )

  const handle = Effect.fnUntraced(function*(input: NewInput, commandPath: ReadonlyArray<string>) {
    const selected = input.subcommand
    if (selected !== undefined) {
      const child = subcommandIndex.get(selected.name)
      if (!child) {
        return yield* new CliError.ShowHelp({ commandPath })
      }
      return yield* child
        .handle(selected.result, [...commandPath, child.name])
        .pipe(Effect.provideService(selfImpl.service, input))
    }
    return yield* selfImpl.handle(input, commandPath)
  })

  return makeCommand({ ...selfImpl, subcommands, parse, handle } as any)
})

// Errors across a tuple (preferred), falling back to array element type
type ExtractSubcommandErrors<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never
  : T extends readonly [infer H, ...infer R] ? Error<H> | ExtractSubcommandErrors<R>
  : T extends ReadonlyArray<infer C> ? Error<C>
  : never

type ContextOf<C> = C extends Command<any, any, any, infer R> ? R : never

type ExtractSubcommandContext<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never
  : T extends readonly [infer H, ...infer R] ? ContextOf<H> | ExtractSubcommandContext<R>
  : T extends ReadonlyArray<infer C> ? ContextOf<C>
  : never

type InputOf<C> = C extends Command<infer N, infer I, any, any> ? { readonly name: N; readonly result: I } : never

type ExtractSubcommandInputs<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never
  : T extends readonly [infer H, ...infer R] ? InputOf<H> | ExtractSubcommandInputs<R>
  : T extends ReadonlyArray<infer C> ? InputOf<C>
  : never

/**
 * Sets the description for a command.
 *
 * Descriptions provide users with information about what the command does
 * when they view help documentation.
 *
 * @example
 * ```ts
 * import { Command, Flag } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * const deploy = Command.make("deploy", {
 *   environment: Flag.string("env")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Deploying to ${config.environment}`)
 *   })
 * ).pipe(
 *   Command.withDescription("Deploy the application to a specified environment")
 * )
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

/**
 * Provides the handler of a command with the services produced by a layer
 * that optionally depends on the command-line input to be created.
 *
 * @since 4.0.0
 * @category providing services
 */
export const provide: {
  <Input, LR, LE, LA>(
    layer: Layer.Layer<LA, LE, LR> | ((input: Input) => Layer.Layer<LA, LE, LR>)
  ): <const Name extends string, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E | LE, Exclude<R, LA> | LR>
  <const Name extends string, Input, E, R, LA, LE, LR>(
    self: Command<Name, Input, E, R>,
    layer: Layer.Layer<LA, LE, LR> | ((input: Input) => Layer.Layer<LA, LE, LR>)
  ): Command<Name, Input, E | LE, Exclude<R, LA> | LR>
} = dual(2, <const Name extends string, Input, E, R, LA, LE, LR>(
  self: Command<Name, Input, E, R>,
  layer: Layer.Layer<LA, LE, LR> | ((input: Input) => Layer.Layer<LA, LE, LR>)
) => {
  const selfImpl = toImpl(self)
  return makeCommand({
    ...selfImpl,
    handle: (input, commandPath) =>
      Effect.provide(
        selfImpl.handle(input, commandPath),
        typeof layer === "function" ? layer(input) : layer
      )
  })
})

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
) => {
  const selfImpl = toImpl(self)
  return makeCommand({
    ...selfImpl,
    handle: (input, commandPath) =>
      Effect.provideService(
        selfImpl.handle(input, commandPath),
        service,
        typeof implementation === "function"
          ? (implementation as any)(input)
          : implementation
      )
  })
})

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
) => {
  const selfImpl = toImpl(self)
  return makeCommand({
    ...selfImpl,
    handle: (input, commandPath) =>
      Effect.provideServiceEffect(
        selfImpl.handle(input, commandPath),
        service,
        typeof effect === "function" ? effect(input) : effect
      )
  })
})

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
) => {
  const selfImpl = toImpl(self)
  return makeCommand({
    ...selfImpl,
    handle: (input, commandPath) =>
      Effect.andThen(
        typeof effect === "function" ? effect(input) : effect,
        selfImpl.handle(input, commandPath)
      )
  })
})

/* ========================================================================== */
/* Execution                                                                  */
/* ========================================================================== */

const showHelp = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string>,
  error?: CliError.CliError
): Effect.Effect<void, never, Environment> =>
  Effect.gen(function*() {
    const helpRenderer = yield* HelpFormatter.HelpRenderer
    const helpDoc = getHelpForCommandPath(command, commandPath)
    yield* Console.log(helpRenderer.formatHelpDoc(helpDoc))
    if (error) {
      yield* Console.error(helpRenderer.formatError(error))
    }
  })

/**
 * Runs a command with the provided input arguments.
 *
 * @example
 * ```ts
 * import { Command, Flag } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * const greetCommand = Command.make("greet", {
 *   name: Flag.string("name")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Hello, ${config.name}!`)
 *   })
 * )
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
} = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  config: {
    readonly version: string
  }
) => {
  const input = process.argv.slice(2)
  return runWith(command, config)(input)
}

/**
 * Runs a command with explicitly provided arguments instead of using process.argv.
 *
 * This function is useful for testing CLI applications or when you want to
 * programmatically execute commands with specific arguments.
 *
 * @example
 * ```ts
 * import { Command, Flag, Argument } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * const greet = Command.make("greet", {
 *   name: Flag.string("name"),
 *   count: Flag.integer("count").pipe(Flag.withDefault(1))
 * }, (config) =>
 *   Effect.gen(function*() {
 *     for (let i = 0; i < config.count; i++) {
 *       yield* Console.log(`Hello, ${config.name}!`)
 *     }
 *   })
 * )
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
    function*(input: ReadonlyArray<string>) {
      const args = input
      // Check for dynamic completion request early (before normal parsing)
      if (isCompletionRequest(args)) {
        handleCompletionRequest(command)
        return
      }

      // Parse command arguments (built-ins are extracted automatically)
      const { tokens, trailingOperands } = Lexer.lex(args)
      const {
        completions,
        help,
        logLevel,
        remainder,
        version
      } = yield* Parser.extractBuiltInOptions(tokens)
      const parsedArgs = yield* Parser.parseArgs({ tokens: remainder, trailingOperands }, command)
      const helpRenderer = yield* HelpFormatter.HelpRenderer

      if (help) {
        const commandPath = [command.name, ...Parser.getCommandPath(parsedArgs)]
        const helpDoc = getHelpForCommandPath(command, commandPath)
        const helpText = helpRenderer.formatHelpDoc(helpDoc)
        yield* Console.log(helpText)
        return
      } else if (completions !== undefined) {
        const script = generateDynamicCompletion(command, command.name, completions)
        yield* Console.log(script)
        return
      } else if (version && command.subcommands.length === 0) {
        const versionText = helpRenderer.formatVersion(command.name, config.version)
        yield* Console.log(versionText)
        return
      }

      // If there are parsing errors and no help was requested, format and display the error
      if (parsedArgs.errors && parsedArgs.errors.length > 0) {
        const commandPath = [command.name, ...Parser.getCommandPath(parsedArgs)]
        yield* showHelp(command, commandPath, parsedArgs.errors[0])
        return
      }

      const parseResult = yield* Effect.result(commandImpl.parse(parsedArgs))
      if (parseResult._tag === "Failure") {
        const commandPath = [command.name, ...Parser.getCommandPath(parsedArgs)]
        yield* showHelp(command, commandPath, parseResult.failure)
        return
      }
      const parsed = parseResult.success

      // Create the execution program
      const program = commandImpl.handle(parsed, [command.name])

      // Apply log level if provided via built-ins
      const finalProgram = logLevel !== undefined
        ? Effect.provideService(program, References.MinimumLogLevel, logLevel)
        : program

      // Normalize non-CLI errors into CliError.UserError so downstream catchTags
      // can rely on CLI-tagged errors only.
      const normalized = finalProgram.pipe(
        Effect.catch((err) =>
          CliError.isCliError(err) ? Effect.fail(err) : Effect.fail(new CliError.UserError({ cause: err }))
        )
      )

      yield* normalized
    },
    Effect.catchTag("ShowHelp", (error: CliError.ShowHelp) => showHelp(command, error.commandPath)),
    // Preserve prior public behavior: surface original handler errors
    Effect.catchTag("UserError", (error: CliError.UserError) => Effect.fail(error.cause as E | CliError.CliError))
  )
}
