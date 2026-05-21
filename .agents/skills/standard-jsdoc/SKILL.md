---
name: standard-jsdoc
description: Write, insert, or update Effect public API JSDoc so it satisfies the standard-jsdoc oxlint rule. Use when adding or fixing JSDoc comments, resolving standard-jsdoc diagnostics, preparing docs for JSON extraction, or reviewing public API documentation.
---

Use this skill to write well-formed JSDoc for Effect public APIs.

## Workflow

When updating public API JSDoc:

1. Inspect the declaration, implementation, nearby tests, and nearby JSDoc before editing.
2. Decide whether the task is a single API fix or a module refinement pass.
3. Rewrite comments into the required documentation shape while preserving correct facts and examples.
4. Run the `@see` audit.
5. Run the `**Gotchas**` audit.
6. Run the narrowest relevant validation.

## Required documentation shape

Use a normal multiline JSDoc comment in TypeScript source:

```ts
/**
 * Short description as one paragraph.
 *
 * **When to use**
 *
 * Optional practical usage guidance.
 *
 * **Details**
 *
 * Optional details for complex APIs, options, overloads, or behavior.
 *
 * **Gotchas**
 *
 * Optional edge cases, footguns, or surprising behavior.
 *
 * **Example** (Short title)
 *
 * Optional prose explaining the example.
 *
 * ```ts
 * const result = example()
 * ```
 *
 * @category constructors
 * @since 1.0.0
 */
```

## Writing rules

- Use sober, practical prose.
- Write all public JSDoc prose in English.
- Do not use jargon when a plain word works.
- Do not be clever.
- Do not add filler sections.
- The short description is required and must be exactly one paragraph.
- Optional sections must appear in this order:
  1. `**When to use**`
  2. `**Details**`
  3. `**Gotchas**`
- Include an optional section only when it has useful, non-empty content.
- `**When to use**` is important when the API has close alternatives, trade-offs, or `@see` tags. If `@see` tags are present, inspect the referenced APIs and add `**When to use**` when it helps readers choose between them.
- Add `@see` only for APIs that are similar to the documented API but intended for different situations or usage patterns. Do not add `@see` for loosely related helpers, dependencies, implementation details, or general background links.
- If an API has close alternatives and no `@see` tags, inspect the alternatives before deciding whether `@see` would help readers choose the right API.
- Before deciding whether to include `**Gotchas**`, inspect the implementation and nearby tests for edge cases, footguns, preconditions, surprising behavior, or important failure modes. Add `**Gotchas**` only when you find a real gotcha worth documenting.
- If a `Details` section explains behavior that changes how the API must be used safely or correctly, treat it as a `**Gotchas**` candidate and make an explicit keep-or-move decision.
- Use exactly one blank line between the short description, sections, examples, and tags.
- Do not use Markdown headings such as `# Heading` or ad hoc bold headings such as `**Notes**`; only the standard headings are allowed.
- Examples must use `**Example** (Title)`, optional prose, and exactly one non-empty `ts` code fence.
- Example titles must be unique after trimming and lowercasing.
- Prefer examples with stable, deterministic output. Avoid assertions or
  `console.log` comments that depend on stack traces, object inspection,
  `Error` formatting, concurrency order, timing, randomness, or
  environment-specific formatting. Examples may assume Node.js console
  formatting. Direct `Set` / `Map` output is acceptable when insertion order is
  deterministic and the expected output uses Node's format; otherwise
  demonstrate a stable property instead.
- Do not use `@example`.
- Do not put TypeScript code fences outside `**Example** (Title)` sections.
- Inline `{@link Symbol}` targets must resolve to TypeScript symbols; do not link to URLs with `{@link}`.
- Avoid overlinking in prose. Use `{@link Symbol}` only when navigation to
  that symbol helps the reader choose or understand the API. For the API being
  documented, the module's central type, nearby obvious names, or repeated
  mentions, prefer plain code formatting such as `Cause`, `Effect`, or
  `Context`.
- Do not document module-level comments; module JSDoc is ignored by this rule.
- `@internal` means the item is ignored; do not rewrite it as public docs.
- Default exports are ignored by this rule and do not need JSDoc.
- Do not add unsupported constructs such as enums or empty exports in checked files.

## Tag rules

When multiple tags are present, keep them in this order:

1. `@deprecated`
2. `@default`
3. `@see`
4. `@category`
5. `@since`

Root declarations:

- Require `@category`.
- Require `@since` with stable semver like `1.2.3`.
- May use `@deprecated` with a non-empty message.
- May use repeated non-empty `@see` tags, but only for similar APIs with different usage patterns.
- Must not use `@default`.

Namespaces and declarations inside namespaces:

- Require `@since` with stable semver like `1.2.3`.
- May use optional `@category`.
- May use `@deprecated` with a non-empty message.
- May use repeated non-empty `@see` tags, but only for similar APIs with different usage patterns.
- Must not use `@default`.

Members:

- JSDoc is optional.
- When member JSDoc is present, it must follow the same short description, section, example, spacing, and tag-order rules.
- May use optional `@since` with stable semver like `1.2.3`.
- May use `@default` with a non-empty value.
- May use `@deprecated` with a non-empty message.
- May use repeated non-empty `@see` tags, but only for similar APIs with different usage patterns.
- Must not use `@category`.

## Updating existing JSDoc

When fixing or updating existing docs:

1. Preserve correct facts and examples.
2. Rewrite the layout into the standard template.
3. Move usage guidance into `**When to use**`; when `@see` tags are present, inspect the referenced APIs and explain selection guidance if useful.
4. Move option, overload, and behavior details into `**Details**`.
5. Move caveats into `**Gotchas**`; if no caveat is already documented, inspect the implementation and nearby tests before deciding whether a `**Gotchas**` section is warranted.
6. Convert `@example` tags and loose `ts` fences into `**Example** (Title)` sections.
7. Preserve valid `@see`, `@deprecated`, `@default`, `@category`, and `@since` tags.
8. Remove `@see` tags that do not point to similar APIs with meaningfully different usage patterns.
9. Replace redundant inline `{@link ...}` tags with plain code formatting when
   the link target is already obvious from the current declaration or module.
10. Remove sections that would be empty.

## Module refinement

When asked to refine an existing module:

1. First scan the module for local documentation patterns, repeated API families, and category conventions.
2. Keep the change focused on documentation quality unless the user also asked for rule or source changes.
3. Prefer improving existing comments over rewriting every comment into a new voice.
4. Preserve examples unless they are wrong, stale, nondeterministic, or fail
   the required documentation shape.
5. Apply the `@see` and `**Gotchas**` audits across the module before finishing.

## See audit

When refining an existing public API module, always do a dedicated `@see` pass:

1. Inspect existing `@see` tags and referenced APIs before keeping, changing, or removing them.
2. Look for close alternatives in the same module or API family when the documented API is one of several ways to do similar work.
3. Keep or add `@see` only when the linked API is a real alternative a reader may choose instead of the documented API.
4. Do not use `@see` for implementation dependencies, broad concepts, result types, helper APIs used only inside examples, or APIs that are merely compatible.
5. When `@see` tags are kept or added, include `**When to use**` guidance if the difference between the APIs is not obvious from the short description.

## Gotchas audit

When refining an existing public API module, always do a dedicated `**Gotchas**` pass:

1. Scan existing prose for caveat language: warnings, exceptions, limitations, preconditions, special cases, or behavior that is easy to misuse.
2. Inspect the implementation and nearby tests for behavior that is not obvious from the type signature or short description.
3. Move real caveats from `**Details**` into `**Gotchas**` when they describe edge cases, footguns, preconditions, surprising behavior, or important failure modes.
4. Add `**Gotchas**` only when the caveat is concrete and useful to a reader choosing or using the API.
5. If no gotchas are added during a refinement pass, state that a gotchas audit was performed and why no caveats were worth documenting.

## Validation

Run the narrowest validation that matches the change:

- For JSDoc or example changes in a package with generated docs, run `pnpm docgen` from that package directory.
- Run `pnpm lint` because the linter includes the custom rule that checks public API JSDoc.
- Do not run broad validation for prose-only skill edits.
