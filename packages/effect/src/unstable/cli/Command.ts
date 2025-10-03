/**
 * @since 4.0.0
 */
import * as Console from "../../Console.ts"
import * as Option from "../../data/Option.ts"
import * as Effect from "../../Effect.ts"
import { dual } from "../../Function.ts"
import { type Pipeable, pipeArguments } from "../../interfaces/Pipeable.ts"
import { YieldableProto } from "../../internal/core.ts"
import type * as FileSystem from "../../platform/FileSystem.ts"
import type * as Path from "../../platform/Path.ts"
import * as References from "../../References.ts"
import * as ServiceMap from "../../ServiceMap.ts"
import type { Simplify } from "../../types/Types.ts"
import * as CliError from "./CliError.ts"
import type { ArgDoc, FlagDoc, HelpDoc, SubcommandDoc } from "./HelpDoc.ts"
import * as HelpFormatter from "./HelpFormatter.ts"
import { generateBashCompletions, generateFishCompletions, generateZshCompletions } from "./internal/completions.ts"
import {
  generateDynamicCompletion,
  handleCompletionRequest,
  isCompletionRequest
} from "./internal/completions/dynamic/index.ts"
import * as Lexer from "./internal/lexer.ts"
import * as Parser from "./internal/parser.ts"
import * as Param from "./Param.ts"
import * as Primitive from "./Primitive.ts"

/**
 * @example
 * ```ts
 * import { Command } from "effect/unstable/cli"
 *
 * // TypeId is used internally for Effect's brand system
 * console.log(Command.TypeId) // "~effect/cli/Command"
 * ```
 *
 * @since 4.0.0
 * @category symbols
 */
export const TypeId = "~effect/cli/Command"

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
 *     readonly files: ReadonlyArray<unknown>
 *   },
 *   never,
 *   never
 * > = Command.make(
 *   "deploy",
 *   {
 *     env: Flag.string("env"),
 *     force: Flag.boolean("force"),
 *     files: Argument.string("files").pipe(Argument.variadic)
 *   }
 * )
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
export interface Command<Name extends string, Input, E = never, R = never>
  extends Pipeable, Effect.Yieldable<Command<Name, Input, E, R>, Input, never, Context<Name>>
{
  readonly [TypeId]: typeof TypeId
  readonly _tag: "Command"
  readonly name: Name
  readonly description: string
  readonly subcommands: ReadonlyArray<Command<any, unknown, unknown, unknown>>
  // TODO: Do we need this and the parsedConfig?
  readonly config: CommandConfig
  // TODO: I hate this name.
  readonly parsedConfig: ParsedConfig
  readonly handler?: (input: Input) => Effect.Effect<void, E, R>
  readonly tag: ServiceMap.Key<Context<Name>, Input>

  /** @internal */
  readonly handle: (input: Input, commandPath: ReadonlyArray<string>) => Effect.Effect<void, E | CliError.CliError, R>

  /** @internal */
  readonly parse: (input: Parser.ParsedCommandInput) => Effect.Effect<Input, CliError.CliError, Environment>
}

/**
 * The environment required by CLI commands, including file system and path operations.
 *
 * This type represents the services that CLI commands may need access to,
 * particularly for file operations and path manipulations.
 *
 * @example
 * ```ts
 * import { Command } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 * import { FileSystem, Path } from "effect/platform"
 *
 * // Commands that need file system access require Environment
 * const readConfig = Command.make("read-config", {}, () =>
 *   Effect.gen(function*() {
 *     const fs = yield* FileSystem.FileSystem
 *     const path = yield* Path.Path
 *     const configPath = path.join(process.cwd(), "config.json")
 *     const content = yield* fs.readFileString(configPath)
 *     yield* Console.log(content)
 *   })
 * )
 *
 * // Environment is provided automatically by Command.run
 * ```
 *
 * @since 4.0.0
 * @category types
 */
export type Environment = FileSystem.FileSystem | Path.Path // | Terminal when available

/**
 * Service context for a specific command, providing access to command input through Effect's service system.
 *
 * Context allows commands and subcommands to access their parsed configuration
 * through Effect's dependency injection system.
 *
 * @example
 * ```ts
 * import { Console, Effect } from "effect"
 * import { Command, Flag } from "effect/unstable/cli"
 *
 * const parentCommand = Command.make("parent", {
 *   verbose: Flag.boolean("verbose")
 * })
 *
 * const childCommand = Command.make("child", {}, () =>
 *   Effect.gen(function*() {
 *     // Access parent command's context within subcommand
 *     const parentConfig = yield* parentCommand
 *     if (parentConfig.verbose) {
 *       yield* Console.log("Verbose mode enabled from parent")
 *     }
 *   }))
 *
 * const app = parentCommand.pipe(
 *   Command.withSubcommands(childCommand)
 * )
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface Context<Name extends string> {
  readonly _: unique symbol
  readonly name: Name
}

/**
 * Configuration object for defining command flags, arguments, and nested structures.
 *
 * CommandConfig allows you to specify:
 * - Individual flags and arguments using Param types
 * - Nested configuration objects for organization
 * - Arrays of parameters for repeated elements
 *
 * @example
 * ```ts
 * import { Command, Flag, Argument } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * // Simple flat configuration
 * const simpleConfig = {
 *   name: Flag.string("name"),
 *   age: Flag.integer("age"),
 *   file: Argument.string("file")
 * }
 *
 * // Nested configuration for organization
 * const nestedConfig = {
 *   user: {
 *     name: Flag.string("name"),
 *     email: Flag.string("email")
 *   },
 *   server: {
 *     host: Flag.string("host"),
 *     port: Flag.integer("port")
 *   },
 *   files: Argument.string("files").pipe(Argument.variadic)
 * }
 *
 * // Use in command creation
 * const command = Command.make("deploy", nestedConfig, (config) =>
 *   Effect.gen(function*() {
 *     // config.user.name, config.server.host, etc. are all type-safe
 *     yield* Console.log(`Deploying for ${config.user.name} to ${config.server.host}:${config.server.port}`)
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface CommandConfig {
  readonly [key: string]:
    | Param.Param<any, Param.ParamKind>
    | ReadonlyArray<Param.Param<any, Param.ParamKind> | CommandConfig>
    | CommandConfig
}

/**
 * Infers the TypeScript type from a CommandConfig structure.
 *
 * This type utility extracts the final configuration type that handlers will receive,
 * preserving the nested structure while converting Param types to their values.
 *
 * @example
 * ```ts
 * import { Command, Flag, Argument } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * // Define a configuration structure
 * const config = {
 *   name: Flag.string("name"),
 *   server: {
 *     host: Flag.string("host"),
 *     port: Flag.integer("port")
 *   },
 *   files: Argument.string("files").pipe(Argument.variadic)
 * } as const
 *
 * // InferConfig extracts the final type
 * type ConfigType = Command.InferConfig<typeof config>
 * // Result: {
 * //   readonly name: string
 * //   readonly server: {
 * //     readonly host: string
 * //     readonly port: number
 * //   }
 * //   readonly files: ReadonlyArray<string>
 * // }
 *
 * const command = Command.make("deploy", config, (config: ConfigType) =>
 *   Effect.gen(function*() {
 *     // config is fully typed with the inferred structure
 *     yield* Console.log(`Deploying to ${config.server.host}:${config.server.port}`)
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export type InferConfig<A extends CommandConfig> = Simplify<
  { readonly [Key in keyof A]: InferConfigValue<A[Key]> }
>

/**
 * Helper type utility for recursively inferring types from CommandConfig values.
 *
 * This type handles the different kinds of values that can appear in a CommandConfig:
 * - Arrays of params/configs are recursively processed
 * - Param types are extracted to their value types
 * - Nested CommandConfig objects are recursively inferred
 *
 * @example
 * ```ts
 * import { Command, Flag, Argument } from "effect/unstable/cli"
 *
 * // Single param extraction
 * type StringFlag = Command.InferConfigValue<typeof Flag.string>
 * // Result: string
 *
 * // Array param extraction
 * type StringArgs = readonly string[]
 * // Result: ReadonlyArray<string>
 *
 * // Nested config extraction
 * type NestedConfig = Command.InferConfigValue<{
 *   host: typeof Flag.string
 *   port: typeof Flag.integer
 * }>
 * // Result: { readonly host: string; readonly port: number }
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export type InferConfigValue<A> = A extends ReadonlyArray<any> ? { readonly [Key in keyof A]: InferConfigValue<A[Key]> }
  : A extends Param.Param<infer _Value, infer _Kind> ? _Value
  : A extends CommandConfig ? InferConfig<A>
  : never

/**
 * Internal tree structure that represents the blueprint for reconstructing parsed configuration.
 *
 * ConfigTree is used internally during command parsing to maintain the structure
 * of nested configuration objects while allowing for flat parameter parsing.
 *
 * @example
 * ```ts
 * import { Command } from "effect/unstable/cli"
 *
 * // Internal structure for config like:
 * // { name: Flag.string("name"), db: { host: Flag.string("host") } }
 * //
 * // Becomes ConfigTree:
 * // {
 * //   name: { _tag: "Param", index: 0 },
 * //   db: {
 * //     _tag: "ParsedConfig",
 * //     tree: { host: { _tag: "Param", index: 1 } }
 * //   }
 * // }
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface ConfigTree {
  [key: string]: ConfigNode
}

/**
 * Individual node in the configuration tree, representing different types of configuration elements.
 *
 * ConfigNode can be:
 * - Param: References a specific parameter by index in the flat parsed array
 * - Array: Contains multiple child nodes for array parameters
 * - ParsedConfig: Contains a nested configuration tree
 *
 * @example
 * ```ts
 * import { Command } from "effect/unstable/cli"
 *
 * // Different node types:
 *
 * // Param node (references parsed value at index)
 * const paramNode: Command.ConfigNode = {
 *   _tag: "Param",
 *   index: 0
 * }
 *
 * // Array node (contains multiple child nodes)
 * const arrayNode: Command.ConfigNode = {
 *   _tag: "Array",
 *   children: [
 *     { _tag: "Param", index: 1 },
 *     { _tag: "Param", index: 2 }
 *   ]
 * }
 *
 * // ParsedConfig node (contains nested structure)
 * const configNode: Command.ConfigNode = {
 *   _tag: "ParsedConfig",
 *   tree: {
 *     host: { _tag: "Param", index: 3 },
 *     port: { _tag: "Param", index: 4 }
 *   }
 * }
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export type ConfigNode = {
  readonly _tag: "Param"
  readonly index: number
} | {
  readonly _tag: "Array"
  readonly children: ReadonlyArray<ConfigNode>
} | {
  readonly _tag: "ParsedConfig"
  readonly tree: ConfigTree
}

/**
 * Parsed and flattened configuration structure created from a CommandConfig.
 *
 * ParsedConfig separates parameters by type and maintains both the original
 * nested structure (via tree) and the flattened parameter list for parsing.
 *
 * @example
 * ```ts
 * import { Command, Flag, Argument } from "effect/unstable/cli"
 *
 * // Example of what parseConfig produces for:
 * const config = {
 *   name: Flag.string("name"),
 *   db: {
 *     host: Flag.string("host"),
 *     port: Flag.integer("port")
 *   },
 *   files: Argument.string("files").pipe(Argument.variadic)
 * }
 *
 * // Results in ParsedConfig structure with:
 * // - flags: All flags extracted and flattened
 * // - arguments: All arguments extracted and flattened
 * // - orderedParams: All params in declaration order
 * // - tree: Blueprint preserving original nested structure
 * //
 * // Tree structure example:
 * // {
 * //   name: { _tag: "Param", index: 0 },
 * //   db: {
 * //     _tag: "ParsedConfig",
 * //     tree: {
 * //       host: { _tag: "Param", index: 1 },
 * //       port: { _tag: "Param", index: 2 }
 * //     }
 * //   },
 * //   files: { _tag: "Param", index: 3 }
 * // }
 * ```
 *
 * @since 4.0.0
 * @category models
 */
export interface ParsedConfig {
  readonly flags: ReadonlyArray<Param.Param<any, Param.ParamKind>>
  readonly arguments: ReadonlyArray<Param.Param<any, Param.ParamKind>>
  /** Params in the exact order they were declared. */
  readonly orderedParams: ReadonlyArray<Param.Param<any, Param.ParamKind>>
  readonly tree: ConfigTree
}

const Proto = {
  ...YieldableProto,
  pipe() {
    return pipeArguments(this, arguments)
  },
  asEffect(this: Command<any, any, any, any>) {
    return this.tag.asEffect()
  }
}

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
 *
 * // Command with complex file operations
 * const backup = Command.make("backup", {
 *   source: Argument.string("source"),
 *   destination: Flag.string("dest").pipe(Flag.withDescription("Backup destination")),
 *   compress: Flag.boolean("compress").pipe(Flag.withDefault(false))
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Backing up ${config.source} to ${config.destination}`)
 *     if (config.compress) {
 *       yield* Console.log("Compression enabled")
 *     }
 *     // File operations would go here
 *   })
 * )
 * ```
 *
 * @since 4.0.0
 * @category constructors
 */
export const make: {
  <Name extends string>(name: Name): Command<Name, {}, never, never>

  <Name extends string, const Config extends CommandConfig>(
    name: Name,
    config: Config
  ): Command<Name, InferConfig<Config>, never, never>

  <Name extends string, const Config extends CommandConfig, R, E>(
    name: Name,
    config: Config,
    handler: (config: InferConfig<Config>) => Effect.Effect<void, E, R>
  ): Command<Name, InferConfig<Config>, E, R>
} = ((
  name: string,
  config?: CommandConfig,
  handler?: (config: unknown) => Effect.Effect<void, unknown, unknown>
) => {
  const actualConfig = config ?? ({} as CommandConfig)
  return makeCommand(name, actualConfig, "", [], handler)
}) as any

/**
 * Adds or replaces the handler for a command.
 *
 * @example
 * ```ts
 * import { Command, Flag } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 * import { Option } from "effect/data"
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
 *       if (Option.isSome(config.subcommand)) {
 *         yield* Console.log(`Executed subcommand: ${config.subcommand.value.name}`)
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
): Command<Name, A, E, R> => {
  return makeCommand<Name, A, E, R>(self.name, self.config, self.description, self.subcommands, handler)
})

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
 * const git = Command.make("git", {}, () => Effect.void).pipe(
 *   Command.withSubcommands(clone, add)
 * )
 * ```
 *
 * @since 4.0.0
 * @category combinators
 */
export const withSubcommands = <const Subcommands extends ReadonlyArray<Command<any, any, any, any>>>(
  ...subcommands: Subcommands
) =>
<Name extends string, Input, E, R>(
  self: Command<Name, Input, E, R>
): Command<
  Name,
  Input & { readonly subcommand: Option.Option<ExtractSubcommandInputs<Subcommands>> },
  ExtractSubcommandErrors<Subcommands>,
  R | Exclude<ExtractSubcommandContext<Subcommands>, Context<Name>>
> => {
  checkForDuplicateFlags(self, subcommands)

  type NewInput = Input & { readonly subcommand: Option.Option<ExtractSubcommandInputs<Subcommands>> }

  // Build a stable name → subcommand index to avoid repeated linear scans
  const subcommandIndex = new Map<string, Command<any, any, any, any>>()
  for (const s of subcommands) subcommandIndex.set(s.name, s)

  const parse = Effect.fnUntraced(function*(input: Parser.ParsedCommandInput) {
    const parentResult = yield* self.parse(input)

    const subRef = input.subcommand
    if (!subRef) {
      return { ...parentResult, subcommand: Option.none() } as NewInput
    }

    const sub = subcommandIndex.get(subRef.name)
    // Parser guarantees valid subcommand names, but guard defensively
    if (!sub) {
      return {
        ...parentResult,
        subcommand: Option.none()
      } as NewInput
    }

    const subResult = yield* sub.parse(subRef.parsedInput)
    const value = { name: sub.name, result: subResult } as ExtractSubcommandInputs<Subcommands>
    return { ...parentResult, subcommand: Option.some(value) } as NewInput
  })

  const handle = Effect.fnUntraced(function*(input: NewInput, commandPath: ReadonlyArray<string>) {
    if (Option.isSome(input.subcommand)) {
      const selected = input.subcommand.value
      const child = subcommandIndex.get(selected.name)
      if (!child) {
        return yield* new CliError.ShowHelp({ commandPath })
      }
      yield* child
        .handle(selected.result, [...commandPath, child.name])
        .pipe(Effect.provideService(self.tag, input))
      return
    }

    if (self.handler) {
      yield* self.handler(input as any)
      return
    }

    return yield* new CliError.ShowHelp({ commandPath })
  })

  return makeOverride<
    Name,
    NewInput,
    ExtractSubcommandErrors<Subcommands>,
    R | Exclude<ExtractSubcommandContext<Subcommands>, Context<Name>>
  >(self, {
    subcommands,
    // Maintain the same handler reference; type-widen for the derived input
    handler: (self.handler as unknown as ((input: NewInput) => Effect.Effect<void, any, any>)) ?? undefined,
    parse,
    handle
  })
}

// Helper to get E from a single Command
type ErrorOf<C> = C extends Command<any, any, infer E, any> ? E : never

// Errors across a tuple (preferred), falling back to array element type
type ExtractSubcommandErrors<T extends ReadonlyArray<unknown>> = T extends readonly [] ? never
  : T extends readonly [infer H, ...infer R] ? ErrorOf<H> | ExtractSubcommandErrors<R>
  : T extends ReadonlyArray<infer C> ? ErrorOf<C>
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
  (description: string): <Name extends string, Input, E, R>(
    self: Command<Name, Input, E, R>
  ) => Command<Name, Input, E, R>
  <Name extends string, Input, E, R>(
    self: Command<Name, Input, E, R>,
    description: string
  ): Command<Name, Input, E, R>
} = dual(2, <Name extends string, Input, E, R>(
  self: Command<Name, Input, E, R>,
  description: string
): Command<Name, Input, E, R> => {
  return makeCommand<Name, Input, E, R>(self.name, self.config, description, self.subcommands, self.handler)
})

/**
 * Generates a HelpDoc structure from a Command.
 *
 * This structured data can be formatted for display using HelpFormatter.
 * getHelpDoc extracts all relevant information from a command including its
 * description, usage pattern, flags, arguments, and subcommands to create
 * comprehensive help documentation.
 *
 * @example
 * ```ts
 * import { Command, Flag, Argument, HelpFormatter } from "effect/unstable/cli"
 * import { Effect, Console } from "effect"
 *
 * // Create a complex command
 * const deploy = Command.make("deploy", {
 *   environment: Flag.string("env").pipe(Flag.withDescription("Target environment")),
 *   force: Flag.boolean("force").pipe(Flag.withDescription("Force deployment")),
 *   files: Argument.string("files").pipe(Argument.variadic, Argument.withDescription("Files to deploy"))
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Deploying to ${config.environment}`)
 *   })
 * ).pipe(
 *   Command.withDescription("Deploy application to specified environment")
 * )
 *
 * // Generate help documentation
 * const helpDoc = Command.getHelpDoc(deploy)
 * // Result contains:
 * // {
 * //   description: "Deploy application to specified environment",
 * //   usage: "deploy [flags] <files...>",
 * //   flags: [
 * //     { name: "env", aliases: ["--env"], type: "string", description: "Target environment", required: true },
 * //     { name: "force", aliases: ["--force"], type: "boolean", description: "Force deployment", required: false }
 * //   ],
 * //   args: [
 * //     { name: "files", type: "string", description: "Files to deploy", required: true, variadic: true }
 * //   ]
 * // }
 *
 * // Format and display help
 * const program = Effect.gen(function*() {
 *   const helpRenderer = yield* HelpFormatter.HelpRenderer
 *   const helpText = helpRenderer.formatHelpDoc(helpDoc)
 *   yield* Console.log(helpText)
 * })
 *
 * // For subcommand help with command path
 * const git = Command.make("git", {
 *   verbose: Flag.boolean("verbose")
 * }).pipe(
 *   Command.withSubcommands(deploy)
 * )
 * const subcommandHelp = Command.getHelpDoc(deploy, ["git", "deploy"])
 * // Usage will show: "git deploy [flags] <files...>"
 * ```
 *
 * @since 4.0.0
 * @category help
 */
export const getHelpDoc = <Name extends string, Input>(
  command: Command<Name, Input, unknown, unknown>,
  commandPath?: ReadonlyArray<string>
): HelpDoc => {
  const args: Array<ArgDoc> = []
  const flags: Array<FlagDoc> = []

  // Extract positional arguments
  for (const arg of command.parsedConfig.arguments) {
    const singles = Param.extractSingleParams(arg)
    const metadata = Param.getParamMetadata(arg)

    for (const single of singles) {
      args.push({
        name: single.name,
        type: single.typeName ?? Primitive.getTypeName(single.primitiveType),
        description: Option.getOrElse(single.description, () => ""),
        required: !metadata.isOptional,
        variadic: metadata.isVariadic
      })
    }
  }

  // Build usage string with positional arguments
  let usage: string
  if (commandPath && commandPath.length > 0) {
    // Use the full command path if provided
    usage = commandPath.join(" ")
  } else {
    // Fall back to just the command name
    usage = command.name
  }

  if (command.subcommands.length > 0) {
    usage += " <subcommand>"
  }
  usage += " [flags]"

  // Add positional arguments to usage
  for (const arg of args) {
    const argName = arg.variadic ? `<${arg.name}...>` : `<${arg.name}>`
    usage += ` ${arg.required ? argName : `[${argName}]`}`
  }

  // Extract flags from options
  for (const option of command.parsedConfig.flags) {
    const singles = Param.extractSingleParams(option)
    for (const single of singles) {
      const formattedAliases = single.aliases.map((alias) => alias.length === 1 ? `-${alias}` : `--${alias}`)

      flags.push({
        name: single.name,
        aliases: formattedAliases,
        type: single.typeName ?? Primitive.getTypeName(single.primitiveType),
        description: Option.getOrElse(single.description, () => ""),
        required: single.primitiveType._tag !== "Boolean"
      })
    }
  }

  // Extract subcommand info
  const subcommandDocs: Array<SubcommandDoc> = command.subcommands.map((sub) => ({
    name: sub.name,
    description: sub.description
  }))

  return {
    description: command.description,
    usage,
    flags,
    ...(args.length > 0 && { args }),
    ...(subcommandDocs.length > 0 && { subcommands: subcommandDocs })
  }
}

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
  return runWithArgs(command, config)(input)
}

/**
 * Runs a command with explicitly provided arguments instead of using process.argv.
 *
 * This function is useful for testing CLI applications or when you want to
 * programmatically execute commands with specific arguments. It provides the
 * same functionality as `run` but with explicit control over the input arguments.
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
 *   const runCommand = Command.runWithArgs(greet, { version: "1.0.0" })
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
 *
 * // Use with different environments
 * const deploy = Command.make("deploy", {
 *   env: Flag.string("env"),
 *   config: Argument.string("config")
 * }, (config) =>
 *   Effect.gen(function*() {
 *     yield* Console.log(`Deploying to ${config.env} with config ${config.config}`)
 *   })
 * )
 *
 * const deployProgram = Effect.gen(function*() {
 *   const runDeploy = Command.runWithArgs(deploy, { version: "2.0.0" })
 *
 *   // Programmatically run with different configurations
 *   yield* runDeploy(["--env", "staging", "staging.json"])
 *   yield* runDeploy(["--env", "production", "prod.json"])
 * })
 * ```
 *
 * @since 4.0.0
 * @category command execution
 */
export const runWithArgs = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  config: {
    readonly version: string
  }
): (input: ReadonlyArray<string>) => Effect.Effect<void, E | CliError.CliError, R | Environment> =>
(input: ReadonlyArray<string>) =>
  Effect.gen(function*() {
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
      dynamicCompletions,
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
    } else if (Option.isSome(completions)) {
      const shell = completions.value
      const script = shell === "bash"
        ? generateBashCompletions(command, command.name)
        : shell === "fish"
        ? generateFishCompletions(command, command.name)
        : generateZshCompletions(command, command.name)
      yield* Console.log(script)
      return
    } else if (Option.isSome(dynamicCompletions)) {
      const shell = dynamicCompletions.value
      const script = generateDynamicCompletion(command, command.name, shell)
      yield* Console.log(script)
      return
    } else if (version && command.subcommands.length === 0) {
      const versionText = helpRenderer.formatVersion(command.name, config.version)
      yield* Console.log(versionText)
      return
    }

    // If there are parsing errors and no help was requested, format and display the error
    if (parsedArgs.errors && parsedArgs.errors.length > 0) {
      const error = parsedArgs.errors[0]
      const helpRenderer = yield* HelpFormatter.HelpRenderer
      const commandPath = [command.name, ...Parser.getCommandPath(parsedArgs)]
      const helpDoc = getHelpForCommandPath(command, commandPath)

      // Show the full help first (to stdout with normal colors)
      const helpText = helpRenderer.formatHelpDoc(helpDoc)
      yield* Console.log(helpText)

      // Then show the error in a clearly marked ERROR section (to stderr)
      yield* Console.error(helpRenderer.formatError(error))

      return
    }

    const parseResult = yield* Effect.result(command.parse(parsedArgs))
    if (parseResult._tag === "Failure") {
      const error = parseResult.failure
      const helpRenderer = yield* HelpFormatter.HelpRenderer
      const commandPath = [command.name, ...Parser.getCommandPath(parsedArgs)]
      const helpDoc = getHelpForCommandPath(command, commandPath)

      // Show the full help first (to stdout with normal colors)
      const helpText = helpRenderer.formatHelpDoc(helpDoc)
      yield* Console.log(helpText)

      // Then show the error in a clearly marked ERROR section (to stderr)
      yield* Console.error(helpRenderer.formatError(error))

      return
    }
    const parsed = parseResult.success

    // Create the execution program
    const program = command.handle(parsed, [command.name])

    // Apply log level if provided via built-ins
    const finalProgram = Option.isSome(logLevel)
      ? Effect.provideService(program, References.MinimumLogLevel, logLevel.value)
      : program

    // Normalize non-CLI errors into CliError.UserError so downstream catchTags
    // can rely on CLI-tagged errors only.
    const normalized = finalProgram.pipe(
      Effect.catch((err) =>
        CliError.isCliError(err) ? Effect.fail(err) : Effect.fail(new CliError.UserError({ cause: err }))
      )
    )

    yield* normalized
  }).pipe(
    Effect.catchTags({
      ShowHelp: (error: CliError.ShowHelp) =>
        Effect.gen(function*() {
          const helpDoc = getHelpForCommandPath(command, error.commandPath)
          const helpRenderer = yield* HelpFormatter.HelpRenderer
          const helpText = helpRenderer.formatHelpDoc(helpDoc)
          yield* Console.log(helpText)
        })
    }),
    // Preserve prior public behavior: surface original handler errors
    Effect.catchTag("UserError", (error: CliError.UserError) => Effect.fail(error.cause as any))
  )

// =============================================================================
// Command Config
// =============================================================================

/**
 * Transforms a nested command configuration into a flat structure for parsing.
 *
 * This function walks through the entire config tree and:
 * 1. Extracts all Params into a single flat array (for command-line parsing)
 * 2. Creates a "blueprint" tree that remembers the original structure
 * 3. Assigns each Param an index to link parsed values back to their position
 *
 * The separation allows us to:
 * - Parse all options using existing flat parsing logic
 * - Reconstruct the original nested structure afterward
 *
 * @example
 * Input: { name: Param.string("name"), db: { host: Param.string("host") } }
 * Output: {
 *   options: [Param.string("name"), Param.string("host")],
 *   tree: { name: {_tag: "Param", index: 0}, db: {_tag: "ParsedConfig", tree: {host: {_tag: "Param", index: 1}}} }
 * }
 */
const parseConfig = (config: CommandConfig): ParsedConfig => {
  const orderedParams: Array<Param.Any> = []
  const flags: Array<Param.AnyFlag> = []
  const args: Array<Param.AnyArgument> = []

  // Recursively walk the config structure, building the blueprint tree
  function parse(config: CommandConfig) {
    const tree: ConfigTree = {}
    for (const key in config) {
      tree[key] = parseValue(config[key])
    }
    return tree
  }

  // Process each value in the config, extracting Params and preserving structure
  function parseValue(
    value:
      | Param.Any
      | ReadonlyArray<Param.Any | CommandConfig>
      | CommandConfig
  ): ConfigNode {
    if (Array.isArray(value)) {
      // Array of options/configs - preserve array structure
      return {
        _tag: "Array",
        children: (value as Array<any>).map((value) => parseValue(value))
      }
    } else if (Param.isParam(value)) {
      // Found a Param - add to appropriate array based on kind and record its index
      const index = orderedParams.length
      orderedParams.push(value)

      if (value.kind === "argument") {
        args.push(value as Param.AnyArgument)
      } else {
        flags.push(value as Param.AnyFlag)
      }

      return {
        _tag: "Param",
        index
      }
    } else {
      // Nested config object - recursively process
      return {
        _tag: "ParsedConfig",
        tree: parse(value as any)
      }
    }
  }

  return {
    flags,
    arguments: args,
    orderedParams,
    tree: parse(config)
  }
}

/**
 * Reconstructs the original nested structure using parsed values and the blueprint tree.
 *
 * This is the inverse operation of parseConfig:
 * 1. Takes the flat array of parsed option values
 * 2. Uses the blueprint tree to determine where each value belongs
 * 3. Rebuilds the original nested object structure
 *
 * The blueprint tree acts as a "map" showing how to reassemble the flat data
 * back into the user's expected nested configuration shape.
 *
 * @param tree - The blueprint tree created by parseConfig
 * @param results - Flat array of parsed values (in the same order as the options array)
 * @returns The reconstructed nested configuration object
 *
 * @example
 * Input tree: { name: {_tag: "Param", index: 0}, db: {_tag: "ParsedConfig", tree: {host: {_tag: "Param", index: 1}}} }
 * Input results: ["myapp", "localhost"]
 * Output: { name: "myapp", db: { host: "localhost" } }
 */
const reconstructConfigTree = (
  tree: ConfigTree,
  results: ReadonlyArray<any>
): Record<string, any> => {
  const output: Record<string, any> = {}

  // Walk through each key in the blueprint tree
  for (const key in tree) {
    output[key] = nodeValue(tree[key])
  }

  return output

  // Convert a blueprint node back to its corresponding value
  function nodeValue(node: ConfigNode): any {
    if (node._tag === "Param") {
      // Param reference - look up the parsed value by index
      return results[node.index]
    } else if (node._tag === "Array") {
      // Array structure - recursively process each child
      return node.children.map((node) => nodeValue(node))
    } else {
      // Nested object - recursively reconstruct the subtree
      return reconstructConfigTree(node.tree, results)
    }
  }
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Core constructor for all Command instances.
 * @internal
 */
const makeCommand = <Name extends string, Input, E, R>(
  name: Name,
  config: CommandConfig,
  description: string,
  subcommands: ReadonlyArray<Command<any, unknown, unknown, unknown>>,
  handler?: ((input: Input) => Effect.Effect<void, E, R>) | undefined
): Command<Name, Input, E, R> => {
  const parsedConfig = parseConfig(config)
  const tag = ServiceMap.Key<Context<Name>, Input>(`${TypeId}/${name}`)

  const parse = Effect.fnUntraced(function*(input: Parser.ParsedCommandInput) {
    const parsedArgs: Param.ParsedArgs = { flags: input.flags, arguments: input.arguments }
    const values = yield* parseParams(parsedArgs, parsedConfig.orderedParams)
    return reconstructConfigTree(parsedConfig.tree, values) as Input
  })

  const handle = (
    input: Input,
    commandPath: ReadonlyArray<string>
  ): Effect.Effect<void, CliError.CliError | E, R> =>
    handler !== undefined
      ? handler(input)
      : new CliError.ShowHelp({ commandPath }).asEffect()

  return Object.assign(Object.create(Proto), {
    _tag: "Command",
    tag,
    name,
    config,
    description,
    subcommands,
    parsedConfig,
    handler,
    handle,
    parse
  })
}

/** @internal */
const makeOverride = <Name extends string, NewInput, E, R>(
  base: Command<Name, any, any, any>,
  overrides: {
    readonly subcommands?: ReadonlyArray<Command<any, unknown, unknown, unknown>> | undefined
    readonly handler?: ((input: NewInput) => Effect.Effect<void, E, R>) | undefined
    readonly parse: (input: Parser.ParsedCommandInput) => Effect.Effect<NewInput, CliError.CliError, Environment>
    readonly handle: (
      input: NewInput,
      commandPath: ReadonlyArray<string>
    ) => Effect.Effect<void, E | CliError.CliError, R>
  }
): Command<Name, NewInput, E, R> =>
  Object.assign(Object.create(Proto), {
    ...base,
    tag: ServiceMap.Key<Context<Name>, NewInput>(`${TypeId}/${base.name}`),
    subcommands: overrides.subcommands ?? base.subcommands,
    handler: overrides.handler ?? base.handler,
    handle: overrides.handle,
    parse: overrides.parse
  })

/**
 * Parses param values from parsed command arguments into their typed
 * representations.
 *
 * @internal
 */
const parseParams: (parsedArgs: Param.ParsedArgs, params: ReadonlyArray<Param.Any>) => Effect.Effect<
  ReadonlyArray<unknown>,
  CliError.CliError,
  Environment
> = Effect.fnUntraced(function*(parsedArgs, params) {
  const results: Array<unknown> = []
  let currentArguments = parsedArgs.arguments

  for (const option of params) {
    const [remainingArguments, parsed] = yield* option.parse({
      flags: parsedArgs.flags,
      arguments: currentArguments
    })
    results.push(parsed)
    currentArguments = remainingArguments
  }

  return results
})

/**
 * Checks for duplicate flag names between parent and child commands.
 *
 * @internal
 */
const checkForDuplicateFlags = <Name extends string, Input>(
  parent: Command<Name, Input, unknown, unknown>,
  subcommands: ReadonlyArray<Command<any, unknown, unknown, unknown>>
): void => {
  const parentOptionNames = new Set<string>()

  const extractNames = (options: ReadonlyArray<Param.Any>): void => {
    for (const option of options) {
      const singles = Param.extractSingleParams(option)
      for (const single of singles) {
        parentOptionNames.add(single.name)
      }
    }
  }

  extractNames(parent.parsedConfig.flags)

  for (const subcommand of subcommands) {
    for (const option of subcommand.parsedConfig.flags) {
      const singles = Param.extractSingleParams(option)
      for (const single of singles) {
        if (parentOptionNames.has(single.name)) {
          throw new CliError.DuplicateOption({
            option: single.name,
            parentCommand: parent.name,
            childCommand: subcommand.name
          })
        }
      }
    }
  }
}

/**
 * Helper function to get help documentation for a specific command path.
 * Navigates through the command hierarchy to find the right command.
 *
 * @internal
 */
const getHelpForCommandPath = <Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  commandPath: ReadonlyArray<string>
): HelpDoc => {
  let currentCommand: Command<string, unknown, unknown, unknown> = command as any

  // Navigate through the command path to find the target command
  for (let i = 1; i < commandPath.length; i++) {
    const subcommandName = commandPath[i]
    const subcommand = currentCommand.subcommands.find((sub) => sub.name === subcommandName)
    if (subcommand) {
      currentCommand = subcommand
    }
  }

  return getHelpDoc(currentCommand, commandPath)
}
