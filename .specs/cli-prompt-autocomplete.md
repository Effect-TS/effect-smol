# CLI Prompt AutoComplete

## Overview

Add a new `Prompt.autoComplete` constructor for the CLI prompts. The new prompt behaves like `Prompt.select` but lets the user filter choices by typing. Filtering is case-insensitive substring matching on choice titles, updates live as the user types, and keeps the existing select navigation patterns.

## Goals

- Provide a prompt that narrows choices by typed input.
- Keep select-style navigation (up/down/tab/enter) intact.
- Render the filter inline after the prompt message.
- Handle empty results with a clear, configurable placeholder line.
- Preserve disabled choice behavior (visible, but cannot submit).

## Non-goals

- No changes to `Prompt.select` or `Prompt.multiSelect` behavior.
- No fuzzy matching or custom matcher callbacks.
- No async/remote data sources or dynamic loading.
- No extra keyboard shortcuts beyond typing and backspace.

## API

Add a new constructor in `packages/effect/src/unstable/cli/Prompt.ts`:

```ts
export interface AutoCompleteOptions<A> extends SelectOptions<A> {
  readonly filterLabel?: string
  readonly filterPlaceholder?: string
  readonly emptyMessage?: string
}

export const autoComplete: <const A>(options: AutoCompleteOptions<A>) => Prompt<A>
```

Defaults:

- `filterLabel`: `"filter"`
- `filterPlaceholder`: `"type to filter"`
- `emptyMessage`: `"No matches"`
- `maxPerPage`: `10` (same as `Prompt.select`)

## Behavior

- Maintain state: `{ query: string, index: number, filtered: ReadonlyArray<number> }`.
- Filtering matches `choice.title.toLowerCase().includes(query.toLowerCase())`.
- When `query` changes:
  - recompute `filtered` indices
  - if no matches, keep `index = 0`
  - if current selection is not visible, jump to first visible index
- Arrow up/down and tab operate on the filtered list with wraparound.
- Enter submits the highlighted choice value (beep if disabled).
- Backspace removes the last character from `query` (beep if already empty).

## Rendering

- Prompt line matches select styling, with inline filter display:
  - `? <message> [filter: <query-or-placeholder>]`
- Choice list shows only filtered options, capped by `maxPerPage`.
- If there are no matches, render a single line with `emptyMessage` in the choice area.
- Submission frame mirrors select, appending the selected title after the prompt line.

## Edge Cases

- Empty `choices` array should render the prompt and the empty message line.
- If `choices` contains only disabled items, selection still moves but Enter beeps.
- A typed filter that leaves no matches should keep the prompt responsive and allow backspacing to recover.

## Tests

Add tests in `packages/effect/test/unstable/cli/` using `MockTerminal`:

- Filters list as the user types and updates selection.
- Backspace removes filter characters.
- No matches renders the empty message and Enter beeps.
- Disabled choices remain non-submittable.

## Docs

- Add JSDoc for `Prompt.autoComplete` with a short usage example in `packages/effect/src/unstable/cli/Prompt.ts`.
- Mention the new prompt in any CLI prompt docs if present.
