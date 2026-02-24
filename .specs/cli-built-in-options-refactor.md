# CLI Built-in Options Refactor: Effect Services Approach

**Issue**: https://github.com/Effect-TS/effect-smol/issues/1441\
**Status**: Ready for implementation\
**Approach**: `ServiceMap.Reference`-based global flags

---

## Summary

Refactor CLI built-in options (`--help`, `--version`, `--completions`, `--log-level`) from hardcoded flags in the parser to Effect services using `ServiceMap.Reference`. This provides:

1. **Visibility** — built-in flags appear in help output's "GLOBAL FLAGS" section
2. **Extensibility** — users can register custom global flags
3. **Override capability** — users can replace or disable built-in flag behavior
4. **Composability** — flags compose via Effect's service system

---

## Design

### Two Kinds of Global Flag

Global flags have two fundamentally different runtime behaviors. The current
`runWith` already treats them differently:

- `--help`, `--version`, `--completions` exit early without running the
  command handler (`Command.ts:1093-1105`)
- `--log-level` wraps the command handler with modified context
  (`Command.ts:1119-1121`)

These map to a discriminated union:

```typescript
type GlobalFlag =
  | GlobalFlag.Action<A> // exit early, replace normal execution
  | GlobalFlag.Setting<A> // configure the command handler's environment
```

**Action** flags perform a side effect and exit. Think: `--help` prints help,
`--version` prints a version string, `--completions` prints a shell script.
The command handler never runs.

**Setting** flags parse a value and provide it as a service/layer to the
command handler's execution environment. Think: `--log-level` sets
`References.MinimumLogLevel`, a hypothetical `--config` loads a config file
and provides it as a service.

### Why Not Unify Them?

A single handler type with `Continue | Exit` result cannot express "continue
with modified context." The handler returns a result, but there is no mechanism
for that result to carry a `Layer` that wraps downstream execution. These are
different control flow patterns at the `runWith` level:

- **Action**: run handler → exit (never reach command handler)
- **Setting**: parse value → build layer → wrap command handler with layer

### Per-Flag References, Not a Flat Array

Each built-in flag gets its own `ServiceMap.Reference`. The parser reads each
reference individually. This preserves full type safety — no
`BuiltInOption<any>` arrays, no type erasure.

A separate `GlobalFlags` reference holds the _ordered list of references
themselves_ (not their values) so the parser knows which flags to extract and
in what order. This is the only collection, and it contains references (keys),
not option values.

---

## Core Types

**File**: `packages/effect/src/unstable/cli/GlobalFlag.ts` (new)

```typescript
import type * as Effect from "../../Effect.ts"
import type * as Layer from "../../Layer.ts"
import type * as CliOutput from "./CliOutput.ts"
import type * as Flag from "./Flag.ts"

// Context passed to action handlers
interface HandlerContext {
  readonly command: Command.Any
  readonly commandPath: ReadonlyArray<string>
  readonly version: string
}

// Action flag: side effect + exit (--help, --version, --completions)
interface Action<A> {
  readonly _tag: "Action"
  readonly flag: Flag.Flag<A>
  readonly run: (
    value: A,
    context: HandlerContext
  ) => Effect.Effect<void, never, CliOutput.Formatter>
}

// Setting flag: configure command handler's environment (--log-level, --config)
interface Setting<A> {
  readonly _tag: "Setting"
  readonly flag: Flag.Flag<A>
  readonly layer: (value: A) => Layer.Layer<never>
}

type GlobalFlag<A> = Action<A> | Setting<A>
```

**Key design decisions:**

- `Action.run` returns `Effect<void>` — no `BuiltInResult` union. If the
  action handler runs at all, execution ends afterward. Activation is
  determined by token presence in the input (see Execution Pipeline below).
- `Setting.layer` returns `Layer<never>` — the layer's provided services are
  opaque to the type system at the global flag level. They become available to
  command handlers through normal Effect dependency injection.
- Both variants carry `flag: Flag.Flag<A>`, which provides the name,
  description, aliases, and parsing logic. No redundant `description` field.

### Constructors

```typescript
const action = <A>(options: {
  readonly flag: Flag.Flag<A>
  readonly run: (
    value: A,
    context: HandlerContext
  ) => Effect.Effect<void, never, CliOutput.Formatter>
}): Action<A>

const setting = <A>(options: {
  readonly flag: Flag.Flag<A>
  readonly layer: (value: A) => Layer.Layer<never>
}): Setting<A>
```

---

## Service References

**File**: `packages/effect/src/unstable/cli/GlobalFlag.ts`

Each built-in flag is a `ServiceMap.Reference<GlobalFlag<A>>` with a concrete
`A`. Override or remove by providing a different value for the reference.

```typescript
export const Help: ServiceMap.Reference<GlobalFlag.Action<boolean>> = ServiceMap.Reference(
  "effect/cli/GlobalFlag/Help",
  {
    defaultValue: () =>
      GlobalFlag.action({
        flag: Flag.boolean("help").pipe(
          Flag.withAlias("h"),
          Flag.withDescription("Show help information")
        ),
        run: (_, { command, commandPath }) =>
          Effect.gen(function*() {
            const formatter = yield* CliOutput.Formatter
            yield* Console.log(
              formatter.formatHelpDoc(
                getHelpForCommandPath(command, commandPath)
              )
            )
          })
      })
  }
)

export const Version: ServiceMap.Reference<GlobalFlag.Action<boolean>> = ServiceMap.Reference(
  "effect/cli/GlobalFlag/Version",
  {
    defaultValue: () =>
      GlobalFlag.action({
        flag: Flag.boolean("version").pipe(
          Flag.withDescription("Show version information")
        ),
        run: (_, { command, version }) =>
          Effect.gen(function*() {
            const formatter = yield* CliOutput.Formatter
            yield* Console.log(formatter.formatVersion(command.name, version))
          })
      })
  }
)

export const Completions: ServiceMap.Reference<
  GlobalFlag.Action<Option.Option<"bash" | "zsh" | "fish">>
> = ServiceMap.Reference("effect/cli/GlobalFlag/Completions", {
  defaultValue: () =>
    GlobalFlag.action({
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
            Completions.generate(command.name, shell.value, descriptor)
          )
        })
    })
})

export const LogLevel: ServiceMap.Reference<
  GlobalFlag.Setting<Option.Option<LogLevel>>
> = ServiceMap.Reference("effect/cli/GlobalFlag/LogLevel", {
  defaultValue: () =>
    GlobalFlag.setting({
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
      ),
      layer: (value) =>
        Option.match(value, {
          onNone: () => Layer.empty,
          onSome: (level) => Layer.succeed(References.MinimumLogLevel, level)
        })
    })
})
```

### The Registry Reference

A single reference holds the ordered set of global flag references. The parser
iterates this set to know which flags to extract. Duplicate references are
prevented by identity — the set is backed by a `ReadonlySet` keyed on
reference identity, preserving insertion order.

```typescript
// Each entry is a ServiceMap.Reference<GlobalFlag<any>> — but the `any` is
// confined to the registry. Individual references remain fully typed.
export const Registry: ServiceMap.Reference<
  ReadonlySet<ServiceMap.Reference<GlobalFlag<any>>>
> = ServiceMap.Reference("effect/cli/GlobalFlag/Registry", {
  defaultValue: () => new Set([Help, Version, Completions, LogLevel])
})
```

The `any` here is acceptable because:

1. It only exists in the registry's element type, not in any public API signature
2. The parser resolves each reference individually, recovering full type safety
3. Users never interact with the registry directly — they use typed
   `set`/`remove`/`clear` functions

---

## Public API

**File**: `packages/effect/src/unstable/cli/GlobalFlag.ts`

All operations are `Effect → Effect` pipeable functions that modify the
`Registry` and individual references via `Effect.provideServiceEffect`.

```typescript
// Set a global flag (upsert: adds to registry if new, replaces value if exists)
const set: {
  <A>(
    ref: ServiceMap.Reference<GlobalFlag<A>>,
    flag: GlobalFlag<A>
  ): <B, E, R>(self: Effect.Effect<B, E, R>) => Effect.Effect<B, E, R>
}

// Remove a global flag by its reference
const remove: {
  <A>(
    ref: ServiceMap.Reference<GlobalFlag<A>>
  ): <B, E, R>(self: Effect.Effect<B, E, R>) => Effect.Effect<B, E, R>
}

// Remove all global flags (built-in and user-defined)
const clear: <B, E, R>(self: Effect.Effect<B, E, R>) => Effect.Effect<B, E, R>
```

**`set` = upsert.** If the reference is already in the registry, `set`
replaces its value without adding a duplicate. If it's new, `set` adds it.
This collapses the old `add` and `override` into one operation — they were
identical except for intent.

**How `set` works internally:**

```typescript
const set = <A>(
  ref: ServiceMap.Reference<GlobalFlag<A>>,
  flag: GlobalFlag<A>
) =>
<B, E, R>(self: Effect.Effect<B, E, R>): Effect.Effect<B, E, R> =>
  Effect.provideServiceEffect(
    Effect.provideService(self, ref, flag),
    Registry,
    Effect.map(Registry, (current) => new Set([...current, ref]))
  )
```

Since the registry is a `Set`, `new Set([...current, ref])` is a no-op if
`ref` is already present (preserves original position) and appends if new.
`Effect.provideService(self, ref, flag)` provides the new flag value
regardless, which is what makes this an upsert — the registry membership
stays the same, but the resolved value changes.

**How `remove` works:**

```typescript
const remove = <A>(
  ref: ServiceMap.Reference<GlobalFlag<A>>
) =>
<B, E, R>(self: Effect.Effect<B, E, R>): Effect.Effect<B, E, R> =>
  Effect.provideServiceEffect(
    self,
    Registry,
    Effect.map(Registry, (current) => {
      const next = new Set(current)
      next.delete(ref)
      return next
    })
  )
```

Filters the reference out of the registry by identity. The flag's own
reference remains, but the parser won't look for it.

**How `clear` works:**

```typescript
const clear = <B, E, R>(
  self: Effect.Effect<B, E, R>
): Effect.Effect<B, E, R> => Effect.provideService(self, Registry, new Set())
```

Replaces the registry with an empty set. No global flags are extracted or
rendered in help.

---

## Execution Pipeline

**Current** (`runWith` at `Command.ts:1074-1140`):

```
lex → extractBuiltInOptions → parseArgs → if help/version/completions: exit
                                         → if errors: showHelp
                                         → parse → if logLevel: provideService → handle
```

**New:**

```
lex → resolveGlobalFlags → extractGlobalFlags → parseArgs
    → run active actions (first wins, exit)
    → if errors: showHelp
    → parse → compose context layers → handle
```

### Updated `runWith`

```typescript
export const runWith = <const Name extends string, Input, E, R>(
  command: Command<Name, Input, E, R>,
  config: { readonly version: string }
): (input: ReadonlyArray<string>) => Effect.Effect<...> => {
  const commandImpl = toImpl(command)
  return Effect.fnUntraced(function*(args: ReadonlyArray<string>) {
    const { tokens, trailingOperands } = Lexer.lex(args)

    // 1. Read registry and resolve each reference to its current value
    const refs = yield* GlobalFlag.Registry
    const flags: Array<GlobalFlag<any>> = []
    for (const ref of refs) {
      flags.push(yield* ref)
    }

    // 2. Extract global flag tokens
    const allFlagParams = flags.flatMap((f) =>
      Param.extractSingleParams(f.flag)
    )
    const registry = createFlagRegistry(allFlagParams.filter(Param.isFlagParam))
    const { flagMap, remainder } = consumeKnownFlags(tokens, registry)
    const emptyArgs: Param.ParsedArgs = { flags: flagMap, arguments: [] }

    // 3. Parse command arguments from remaining tokens
    const parsedArgs = yield* Parser.parseArgs(
      { tokens: remainder, trailingOperands },
      command
    )
    const commandPath = [command.name, ...Parser.getCommandPath(parsedArgs)]
    const handlerCtx: HandlerContext = { command, commandPath, version: config.version }

    // 4. Process action flags — first present action wins, then exit
    //    A flag is "present" if its tokens appeared in the input.
    //    consumeKnownFlags only populates flagMap entries for flags
    //    that were actually in the token stream, so we check presence
    //    rather than inspecting parsed values.
    for (const flag of flags) {
      if (flag._tag !== "Action") continue
      const name = Param.getFlagName(flag.flag)
      if (!flagMapHasEntries(flagMap, name)) continue
      const [, value] = yield* flag.flag.parse(emptyArgs)
      yield* flag.run(value, handlerCtx)
      return
    }

    // 5. Handle parsing errors
    if (parsedArgs.errors && parsedArgs.errors.length > 0) {
      return yield* showHelp(command, commandPath, parsedArgs.errors)
    }
    const parseResult = yield* Effect.result(commandImpl.parse(parsedArgs))
    if (parseResult._tag === "Failure") {
      return yield* showHelp(command, commandPath, [parseResult.failure])
    }

    // 6. Compose setting flag layers
    //    Setting flags always run — their layer() handles the "not passed"
    //    case (e.g., Option.None → Layer.empty for --log-level).
    let contextLayer = Layer.empty
    for (const flag of flags) {
      if (flag._tag !== "Setting") continue
      const [, value] = yield* flag.flag.parse(emptyArgs)
      contextLayer = Layer.merge(contextLayer, flag.layer(value))
    }

    // 7. Run command handler with composed context
    const program = commandImpl.handle(parseResult.success, [command.name])
    yield* Effect.provide(program, contextLayer)
  }, /* ...existing error handlers... */)
}
```

Action flags only fire when the user actually passed the flag. No value
inspection, no heuristic. The parser's `flagMap` is the source of truth.

Setting flags always run their `layer()` function, which is expected to
handle the "not passed" case gracefully (e.g., `--log-level` uses
`Flag.optional` so the value is `Option.None` when absent, and
`layer(Option.None)` returns `Layer.empty`).

---

## Help Generation Changes

### Updated `HelpDoc`

**File**: `packages/effect/src/unstable/cli/HelpDoc.ts`

```typescript
export interface HelpDoc {
  readonly description: string
  readonly usage: string
  readonly flags: ReadonlyArray<FlagDoc>
  readonly globalFlags?: ReadonlyArray<FlagDoc> // NEW
  readonly annotations: ServiceMap.ServiceMap<never>
  readonly args?: ReadonlyArray<ArgDoc>
  readonly subcommands?: ReadonlyArray<SubcommandGroupDoc>
  readonly examples?: ReadonlyArray<ExampleDoc>
}
```

### Updated `getHelpForCommandPath`

Currently pure/synchronous. Must become effectful to read global flag
references:

```typescript
const getHelpForCommandPath = (
  command: Command.Any,
  path: ReadonlyArray<string>
): Effect.Effect<HelpDoc, never, never> =>
  Effect.gen(function*() {
    const refs = yield* GlobalFlag.Registry
    const globalFlagDocs: Array<FlagDoc> = []
    for (const ref of refs) {
      const flag = yield* ref
      const metadata = Param.getParamMetadata(flag.flag)
      globalFlagDocs.push({
        name: metadata.name,
        aliases: metadata.aliases,
        type: metadata.type,
        description: metadata.description,
        required: false
      })
    }

    const baseDoc = buildHelpDoc(command, path) // existing pure function
    return { ...baseDoc, globalFlags: globalFlagDocs }
  })
```

This means `getHelpForCommandPath` changes from pure to effectful. Call
sites in `runWith` and `showHelp` already run in Effect context, so this is
straightforward.

### Updated Formatter

**File**: `packages/effect/src/unstable/cli/CliOutput.ts`

Add a "GLOBAL FLAGS" section in `formatHelpDocImpl`, rendered identically to
the FLAGS section but under its own heading. Rendered after FLAGS, before
SUBCOMMANDS.

```
DESCRIPTION
  Deploy your application

USAGE
  myapp deploy [flags]

FLAGS
  --output string    Output format

GLOBAL FLAGS
  --help, -h                         Show help information
  --version                          Show version information
  --completions [bash|zsh|fish]      Print shell completion script
  --log-level [all|trace|...]        Sets the minimum log level
```

---

## Usage Examples

### Default behavior (no changes required)

```typescript
const app = Command.make("myapp", { output: Flag.string("output") })
Command.run(app, { version: "1.0.0" })
// --help now shows GLOBAL FLAGS section automatically
```

### Add a custom action flag

```typescript
const DocsFlag = ServiceMap.Reference(
  "myapp/GlobalFlag/Docs",
  {
    defaultValue: () =>
      GlobalFlag.action({
        flag: Flag.boolean("docs").pipe(
          Flag.withDescription("Output markdown documentation and exit")
        ),
        run: (_, { command, commandPath }) =>
          Effect.gen(function*() {
            yield* Console.log(renderMarkdownDocs(command, commandPath))
          })
      })
  }
)

const program = Command.run(app, { version: "1.0.0" }).pipe(
  GlobalFlag.set(DocsFlag, DocsFlag.defaultValue())
)
```

### Add a custom setting flag

```typescript
class AppConfig extends ServiceMap.Service<AppConfig, {
  readonly projectRef: string
  readonly apiUrl: string
}>()("myapp/Config") {}

const ConfigFlag = ServiceMap.Reference(
  "myapp/GlobalFlag/Config",
  {
    defaultValue: () =>
      GlobalFlag.setting({
        flag: Flag.text("config").pipe(
          Flag.withDescription("Path to config file"),
          Flag.optional
        ),
        layer: (value) =>
          Option.match(value, {
            onNone: () => AppConfig.defaultLayer,
            onSome: (path) => AppConfig.layerFromFile(path)
          })
      })
  }
)

// Command handler accesses config through normal Effect DI
const deploy = Command.make("deploy").pipe(
  Command.withHandler(
    Effect.gen(function*() {
      const config = yield* AppConfig
      yield* deployTo(config.projectRef)
    })
  )
)

const program = Command.run(app, { version: "1.0.0" }).pipe(
  GlobalFlag.set(ConfigFlag, ConfigFlag.defaultValue())
)
```

### Override built-in help

```typescript
const program = Command.run(app, { version: "1.0.0" }).pipe(
  GlobalFlag.set(
    GlobalFlag.Help,
    GlobalFlag.action({
      flag: Flag.boolean("help").pipe(Flag.withAlias("h")),
      run: (_, { command, commandPath }) => Console.log(myCustomMarkdownRenderer(command, commandPath))
    })
  )
)
```

### Remove a built-in flag

```typescript
const program = Command.run(app, { version: "1.0.0" }).pipe(
  GlobalFlag.remove(GlobalFlag.Version)
)
```

### Clear all global flags

```typescript
const program = Command.run(app, { version: "1.0.0" }).pipe(
  GlobalFlag.clear
)
```

---

## Testing Strategy

Test file: `packages/effect/test/unstable/cli/GlobalFlag.test.ts`

Uses `@effect/vitest` with `it.effect()`, `assert` (not `expect` from vitest),
`TestConsole.logLines`/`errorLines`, `CliOutput.defaultFormatter({ colors: false })`,
inline snapshots for help output. Follows patterns from `Command.test.ts`,
`Help.test.ts`, `LogLevel.test.ts`.

### Test fixtures

Shared test layer mirrors `Command.test.ts`:

```
TestLayer = mergeAll(ConsoleLayer, FileSystemLayer, PathLayer, TerminalLayer,
  CliOutputLayer, SpawnerLayer)
```

Simple commands for testing:

- `simpleCmd`: `Command.make("app")` with a handler that records invocation
- `cmdWithFlags`: `Command.make("app", { output: Flag.string("output") })`
- `cmdWithSubs`: parent + child subcommands

### Test groups

**1. Default behavior (backward compat)**
Existing CLI works without any `GlobalFlag.*` calls. These are regression tests.

- `--help` prints help and exits (verify output via `TestConsole.logLines`)
- `--version` prints version and exits
- `--completions bash` prints bash completions and exits
- `--log-level debug` sets minimum log level (reuse pattern from `LogLevel.test.ts`)
- No flags → handler runs normally
- Subcommand `--help` shows subcommand help

**2. Help output includes GLOBAL FLAGS section**

- Root `--help` output contains "GLOBAL FLAGS" heading
- GLOBAL FLAGS lists `--help, -h`, `--version`, `--completions`, `--log-level`
- Snapshot test for exact formatting
- GLOBAL FLAGS appears after FLAGS, before SUBCOMMANDS

**3. `GlobalFlag.set` — add custom action flag**

- Define a `DocsFlag` action reference, `set` it, invoke `--docs`
- Verify action handler runs (output captured via `TestConsole`)
- Verify `--help` shows `--docs` in GLOBAL FLAGS section
- Verify command handler does NOT run when action flag fires

**4. `GlobalFlag.set` — add custom setting flag**

- Define a `ConfigFlag` setting reference with a service layer
- `set` it, invoke `--config path/to/file`
- Verify command handler receives the provided service
- Verify `--help` shows `--config` in GLOBAL FLAGS section
- When `--config` is not passed, verify `Layer.empty` (handler still runs)

**5. `GlobalFlag.set` — override built-in**

- Override `GlobalFlag.Help` with custom action, invoke `--help`
- Verify custom help output (not default formatter)
- Verify `--help` still in GLOBAL FLAGS (same reference, different value)

**6. `GlobalFlag.set` — upsert (no duplicates)**

- `set` same reference twice with different values
- Verify only one entry in GLOBAL FLAGS section
- Verify second value wins (most recently provided service)

**7. `GlobalFlag.remove`**

- `remove(GlobalFlag.Version)`, invoke `--version`
- Verify `--version` is treated as unrecognized (parse error)
- Verify `--version` not in GLOBAL FLAGS section
- Other built-ins still work (`--help` still functions)

**8. `GlobalFlag.clear`**

- `clear`, invoke `--help`
- Verify no GLOBAL FLAGS section in output
- `--help` itself doesn't trigger built-in action (treated as unrecognized)
- Command handler runs with `--help` as unrecognized flag → parse error

**9. Multiple setting flags compose**

- Add two setting flags, each providing a different service
- Verify command handler can access both services
- Verify layers merge (not clobber)

**10. Action flag precedence: first present wins**

- Register two custom action flags
- Pass both in argv
- Verify only the first (by registry order) executes
- The second action's handler never runs

**11. Setting flags with subcommands**

- `--log-level info child` → setting applies to child handler
- Custom setting flag applies to child handler

**12. Error cases**

- Invalid value for `--log-level invalid` → `InvalidValue` error (regression)
- Invalid value for custom choice flag → appropriate error

---

## Ordered Task List

### Task 1: Create `GlobalFlag.ts` — types + constructors

**File**: `packages/effect/src/unstable/cli/GlobalFlag.ts` (new)

1. Define `HandlerContext` interface
2. Define `Action<A>` and `Setting<A>` interfaces with `_tag` discriminant
3. Define `GlobalFlag<A> = Action<A> | Setting<A>` union type
4. Implement `action()` constructor
5. Implement `setting()` constructor
6. Export type namespace `GlobalFlag { Action, Setting, HandlerContext }`

**Verify**: `pnpm check` passes (types only, no runtime consumers yet)

### Task 2: Built-in flag references + Registry

**File**: `packages/effect/src/unstable/cli/GlobalFlag.ts`

1. Define `Help` reference (`ServiceMap.Reference<Action<boolean>>`)
   - Reuse flag definition from `builtInFlags.ts:helpFlag`
   - `run` calls `getHelpForCommandPath` + `formatter.formatHelpDoc` + `Console.log`
2. Define `Version` reference (`ServiceMap.Reference<Action<boolean>>`)
   - `run` calls `formatter.formatVersion` + `Console.log`
   - Add `version` field to `HandlerContext` to solve open question #1
3. Define `Completions` reference
4. Define `LogLevel` reference (`ServiceMap.Reference<Setting<Option<LogLevel>>>`)
   - `layer` returns `Layer.succeed(References.MinimumLogLevel, level)` or `Layer.empty`
5. Define `Registry` reference (default: `new Set([Help, Version, Completions, LogLevel])`)

**Verify**: `pnpm check`

### Task 3: Public API functions

**File**: `packages/effect/src/unstable/cli/GlobalFlag.ts`

1. Implement `set` — `Effect.provideService` for the ref + `Effect.provideServiceEffect`
   for Registry (add ref to set)
2. Implement `remove` — `Effect.provideServiceEffect` for Registry (delete ref from set)
3. Implement `clear` — `Effect.provideService(Registry, new Set())`

**Verify**: `pnpm check`

### Task 4: Update `HelpDoc` + `CliOutput`

**File**: `packages/effect/src/unstable/cli/HelpDoc.ts`

1. Add `globalFlags?: ReadonlyArray<FlagDoc>` to `HelpDoc` interface
2. Update JSDoc example

**File**: `packages/effect/src/unstable/cli/CliOutput.ts`

1. Add "GLOBAL FLAGS" section in `formatHelpDocImpl`, after FLAGS, before SUBCOMMANDS
2. Reuse same flag row rendering logic as FLAGS section

**Verify**: `pnpm check`

### Task 5: Update help generation

**File**: `packages/effect/src/unstable/cli/internal/command.ts`

1. Make `getHelpForCommandPath` return `Effect.Effect<HelpDoc>` (was pure `HelpDoc`)
2. Inside, read `GlobalFlag.Registry`, iterate refs, build `globalFlags` array
3. Spread `globalFlags` onto the `HelpDoc` returned by `buildHelpDoc`

**File**: `packages/effect/src/unstable/cli/Command.ts`

1. Update all call sites of `getHelpForCommandPath` to yield* (it's now effectful)
2. Update `showHelp` to yield* `getHelpForCommandPath`

**Verify**: `pnpm check`

### Task 6: Update `runWith` + delete `builtInFlags.ts`

**File**: `packages/effect/src/unstable/cli/Command.ts`

1. Replace `extractBuiltInOptions` call with new pipeline:
   - Read `GlobalFlag.Registry`, resolve each reference
   - Build flag registry from all global flags' `Flag` definitions
   - Call `consumeKnownFlags` (keep this utility)
   - Process action flags (first present wins, exit)
   - Process setting flags (compose layers)
   - Run command handler with composed layer
2. Thread `version` from config into `HandlerContext`

**File**: `packages/effect/src/unstable/cli/internal/parser.ts`

1. Remove `extractBuiltInOptions` function
2. Remove `builtInFlagParams` and `builtInFlagRegistry` constants
3. Remove import of `builtInFlags.ts`
4. Export `consumeKnownFlags`, `createFlagRegistry`, `createEmptyFlagMap`
   (needed by `runWith`)

**File**: `packages/effect/src/unstable/cli/internal/builtInFlags.ts`

1. Delete this file

**Verify**: `pnpm check`, existing tests still pass (`pnpm test Command.test.ts`,
`pnpm test Help.test.ts`, `pnpm test LogLevel.test.ts`)

### Task 7: Exports + codegen

**File**: `packages/effect/src/unstable/cli/index.ts`

1. Add `GlobalFlag` export (barrel file auto-generated, but may need manual entry
   if not picked up by codegen)

Run `pnpm codegen` to regenerate barrel files.

**Verify**: `pnpm check`, `pnpm build`

### Task 8: Write tests

**File**: `packages/effect/test/unstable/cli/GlobalFlag.test.ts` (new)

Implement all test groups from Testing Strategy above.

**Verify**: `pnpm test GlobalFlag.test.ts` — all pass

### Task 9: Update existing test snapshots

Help output now includes GLOBAL FLAGS section. Existing snapshot tests in
`Help.test.ts` will fail. Update inline snapshots.

**Verify**: `pnpm test Help.test.ts`, `pnpm test Command.test.ts`,
`pnpm test LogLevel.test.ts`, `pnpm test Errors.test.ts`

### Task 10: Final validation

1. `pnpm lint-fix`
2. `pnpm check` (if fails, `pnpm clean && pnpm check`)
3. `pnpm build`
4. `pnpm docgen`
5. Full test suite: `pnpm test`

---

## Migration Notes

**Breaking changes**: None. Existing `Command.run()` calls work unchanged.
The `builtInFlags.ts` internal module is deleted, but it was never public API.

**Type safety**: No `any` in public API signatures. The only `any` is
confined to `Registry`'s element type (`Reference<GlobalFlag<any>>`), which
is internal to the registry — users interact through fully-typed individual
references.

---

## Open Questions

1. ~~`Version.run` needs the version string from `Command.run`'s config.~~
   **Resolved**: Add `version` to `HandlerContext`. `runWith` threads
   `config.version` into the context. `Version.run` reads it from there.
2. Ordering guarantee: the plan says "first present action wins." Should we
   document that built-in actions (help, version, completions) are checked
   in registry order, and user-added actions come after?
   **Decision**: Yes, document it. Default registry order is
   `[Help, Version, Completions, LogLevel]`. `set` appends new refs to end.
   This matches user expectations (built-ins first).
