**Status: DRAFT**

## Overview

Port `withFallbackPrompt` from effect 3 into the new CLI API. The feature adds
fallback prompts for missing flags and positional arguments so that command
parsing can request values interactively when they are not supplied on the
command line.

Scope covers:

- `Flag.withFallbackPrompt` (public)
- `Argument.withFallbackPrompt` (public)
- shared internal implementation in `Param`

## Goals

- Add a prompt-backed fallback for missing flags and arguments.
- Keep help output unchanged (no extra prompt annotations).
- Preserve existing parsing behavior for non-missing errors.
- Keep the API ergonomic with dual signatures like other CLI combinators.

## Non-goals

- No changes to help/usage rendering.
- No new prompt primitives or changes to Prompt behavior.
- No configuration fallback (handled elsewhere).

## API Additions

### Flag

```ts
export const withFallbackPrompt: {
  <B>(prompt: Prompt.Prompt<B>): <A>(self: Flag<A>) => Flag<A | B>
  <A, B>(self: Flag<A>, prompt: Prompt.Prompt<B>): Flag<A | B>
}
```

### Argument

```ts
export const withFallbackPrompt: {
  <B>(prompt: Prompt.Prompt<B>): <A>(self: Argument<A>) => Argument<A | B>
  <A, B>(self: Argument<A>, prompt: Prompt.Prompt<B>): Argument<A | B>
}
```

### Param (internal)

```ts
export type Environment = FileSystem.FileSystem | Path.Path | Terminal.Terminal

export const withFallbackPrompt: {
  <B>(prompt: Prompt.Prompt<B>): <Kind extends ParamKind, A>(self: Param<Kind, A>) => Param<Kind, A | B>
  <Kind extends ParamKind, A, B>(self: Param<Kind, A>, prompt: Prompt.Prompt<B>): Param<Kind, A | B>
}
```

## Detailed Behavior

- The fallback prompt runs only when parsing fails with:
  - `CliError.MissingOption` (flags)
  - `CliError.MissingArgument` (positional arguments)
- Other parsing errors (invalid value, unrecognized option, etc.) propagate.
- Prompt values do not consume any leftover arguments; they only supply the
  missing value.
- Boolean flags that are absent still default to `false` and do not trigger the
  fallback prompt (consistent with existing parsing rules).
- Prompt cancellation (`Terminal.QuitError`) is treated as a missing value and
  returns the original missing error to the caller. (Prompt failures are limited
  to `Terminal.QuitError`.)

## Default Precedence

When `withFallbackPrompt` is applied after `withDefault`, the prompt will have
no effect because the default will always supply a value first.

Implications:

- `Flag.string("name").pipe(Flag.withDefault("guest"), Flag.withFallbackPrompt(prompt))`
  will always use `"guest"` and never prompt.

## Implementation Design

### Param model updates

- Add `Param.Environment` (FileSystem | Path | Terminal) and update `Parse`,
  `mapEffect`, and helper signatures to use it, so parsing can run prompts.

### Parsing logic

- Implement `Param.withFallbackPrompt` as a `MapEffect` param with a custom
  `parse` that:
  1. Attempts to parse the underlying param.
  2. On `MissingOption`/`MissingArgument`, runs `Prompt.run` for the fallback.
  3. If the prompt succeeds, return `[args.arguments, value]`.
  4. If the prompt fails (including `Terminal.QuitError`), return the original
     missing error.

### Public wrappers

- Add `Flag.withFallbackPrompt` and `Argument.withFallbackPrompt` as thin
  wrappers over `Param.withFallbackPrompt` using `dual`.
- Add JSDoc and examples mirroring other combinators.

### No help output changes

- Keep `CliOutput`/`HelpDoc` rendering untouched. Documentation lives in JSDoc
  only.

## Testing Plan

Add tests under `packages/effect/test/unstable/cli` (new `Flag.test.ts` or
extend existing suites) using `MockTerminal`.

Required coverage:

- `Flag.withFallbackPrompt` prompts when the flag is missing.
- `Flag.withFallbackPrompt` does not prompt when the flag is provided.
- `Argument.withFallbackPrompt` prompts when the argument is missing.
- `withFallbackPrompt` does not run on invalid values (non-missing errors).
- Boolean flags still default to `false` and never prompt.
- Prompt-provided values do not consume extra arguments.
- Prompt cancellation (send Ctrl+C via `MockTerminal.inputKey`) results in the
  original `MissingOption`/`MissingArgument` error.

## Validation

- `pnpm lint-fix`
- `pnpm test <new test file>`
- `pnpm check`
- `pnpm build`
- `pnpm docgen`
