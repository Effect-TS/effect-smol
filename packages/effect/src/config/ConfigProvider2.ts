/**
 * @since 4.0.0
 */

import * as Data from "../data/Data.ts"
import * as Effect from "../Effect.ts"

export type StringLeafJson =
  | string
  | { readonly [k: string]: StringLeafJson }
  | ReadonlyArray<StringLeafJson>

export type Path = ReadonlyArray<string | number>

export type Node =
  | { readonly _tag: "leaf"; readonly value: string }
  | { readonly _tag: "object"; readonly keys: ReadonlyArray<string> }
  | { readonly _tag: "array"; readonly length: number }

export function leaf(value: string): Node {
  return { _tag: "leaf", value }
}

export function object(keys: ReadonlyArray<string>): Node {
  return { _tag: "object", keys }
}

export function array(length: number): Node {
  return { _tag: "array", length }
}

export class GetError extends Data.TaggedError("GetError")<{
  readonly reason: string
}> {}

export interface ConfigProvider {
  readonly get: (path: Path) => Effect.Effect<Node | undefined, GetError>
}

export function fromStringLeafJson(root: StringLeafJson): ConfigProvider {
  return {
    get(path: Path): Effect.Effect<Node | undefined, GetError> {
      const resolved = resolvePath(root, path)
      return Effect.succeed(resolved === undefined ? undefined : describeNode(resolved))
    }
  }
}

function resolvePath(input: StringLeafJson, path: Path): StringLeafJson | undefined {
  let out: StringLeafJson = input

  for (const seg of path) {
    if (typeof out === "string") return undefined
    if (Array.isArray(out)) {
      if (typeof seg !== "number" || !Number.isInteger(seg) || seg < 0 || seg >= out.length) return undefined
    } else {
      if (typeof seg !== "string" || !Object.prototype.hasOwnProperty.call(out, seg)) return undefined
    }
    out = (out as any)[seg]
  }

  return out
}

function describeNode(value: StringLeafJson): Node {
  if (typeof value === "string") return leaf(value)
  if (Array.isArray(value)) return array(value.length)
  return object(Object.keys(value))
}

type InlineParsed =
  | { readonly _tag: "leaf"; readonly value: string }
  | { readonly _tag: "arrayInline"; readonly items: ReadonlyArray<string> }
  | { readonly _tag: "objectInline"; readonly entries: Record<string, string> }

export function makeInlineParser(options?: {
  readonly tokenSeparator?: string | undefined
  readonly keyValueSeparator?: string | undefined
}) {
  return (value: string): InlineParsed => {
    const tokenSeparator = options?.tokenSeparator ?? ","
    const keyValueSeparator = options?.keyValueSeparator ?? "="

    // split on commas to inspect tokens
    const raw = value.split(tokenSeparator)
    const tokens = raw.map((s) => s.trim())

    // Object inline if EVERY non-empty token contains exactly one '='
    const kvPairs = tokens
      .filter((t) => t.length > 0)
      .map((t) => {
        const first = t.indexOf(keyValueSeparator)
        const last = t.lastIndexOf(keyValueSeparator)
        // require a non-empty key (first > 0) and exactly one '=' (first === last)
        if (first > 0 && first === last) {
          const key = t.slice(0, first).trim()
          const val = t.slice(first + 1).trim() // may be empty -> ""
          return [key, val] as const
        }
        return null
      })

    const allAreKV = kvPairs.length > 0 && kvPairs.every((p) => p !== null)
    if (allAreKV) {
      const entries: Record<string, string> = {}
      for (const p of kvPairs as ReadonlyArray<readonly [string, string]>) {
        const [k, v] = p
        entries[k] = v
      }
      return { _tag: "objectInline", entries }
    }

    // Array inline if we saw at least one comma; keep empty items? (here: filter them out)
    if (raw.length > 1) {
      const items = tokens.filter((t) => t.length > 0)
      return { _tag: "arrayInline", items }
    }

    // Fallback: plain leaf
    return { _tag: "leaf", value }
  }
}

type Parser = {
  readonly splitKey: (key: string) => Array<string>
  readonly joinTokens: (tokens: ReadonlyArray<string>) => string
  readonly inlineParser: (value: string) => InlineParsed
}

export const defaultParser: Parser = {
  splitKey: (key) => key.replace(/\]/g, "").split(/(?:__|\[)/),
  joinTokens: (tokens) => tokens.length === 0 ? "" : tokens[0] + tokens.slice(1).map((t) => `[${t}]`).join(""),
  inlineParser: makeInlineParser()
}

/**
 * Create a ConfigProvider that reads values from environment variables.
 *
 * The default delimiter for hierarchical config is `"__"`.
 *
 * **Why `"__"` is the better default**
 *
 * - **Avoids accidental splitting of common keys**. With `"_"`, names like
 *   `NODE_ENV`, `DATABASE_URL`, `JWT_SECRET` get split into multiple tokens and
 *   turn into containers unless callers remember to query as `["NODE","ENV"]`,
 *   etc. With `"__"`, those remain single tokens.
 * - **Clearer intent**. A double underscore is rarely used "accidentally”
 *   inside an env name, so when you see it, it almost certainly means "nest
 *   here”.
 *
 * @example
 * ```ts
 * import { fromEnv } from "effect/ConfigProvider"
 *
 * const provider = fromEnv({
 *   environment: {
 *     // leaf
 *     "leaf": "value1",
 *
 *     // object { key1: "value2", key2: { key3: "value3" } }
 *     "object__key1": "value2",
 *     "object__key2__key3": "value3",
 *
 *     // array [ "value4", { key4: "value5" }, ["value6"] ]
 *     "array__0": "value4",
 *     "array__1__key4": "value5",
 *     "array__2__0": "value6"
 *   }
 * })
 * ```
 */
export function fromEnv(options?: {
  readonly parser?: Parser | undefined
  readonly environment?: Record<string, string> | undefined
}): ConfigProvider {
  // Merge env sources (Node / Deno / Vite-like) unless an explicit env is passed.
  const env = options?.environment ?? {
    ...globalThis?.process?.env,
    ...(import.meta as any)?.env
  }

  const parser = options?.parser ?? defaultParser

  return {
    get(path: Path): Effect.Effect<Node | undefined, GetError> {
      if (!env) return Effect.succeed(undefined)

      const prefix = path.map(String)
      const prefixLen = prefix.length

      let exactValue: string | undefined
      const childTokens = new Set<string>()

      for (const fullKey of Object.keys(env)) {
        const val = env[fullKey]
        if (typeof val !== "string") continue

        const tokens = parser.splitKey(fullKey)

        // prefix match
        let matches = true
        for (let i = 0; i < prefixLen; i++) {
          if (tokens[i] !== prefix[i]) {
            matches = false
            break
          }
        }
        if (!matches) continue

        if (tokens.length === prefixLen) {
          exactValue = val
        } else {
          childTokens.add(tokens[prefixLen])
        }
      }

      // 1) No structural children -> inspect exact value via leafParser
      if (childTokens.size === 0) {
        if (exactValue === undefined) {
          // Child lookup of an inline container (parent fallback)
          if (prefixLen > 0) {
            const parentKey = prefix.slice(0, -1)
            const childToken = prefix[prefixLen - 1]!
            const parentExact = env[parser.joinTokens(parentKey)]
            if (typeof parentExact === "string") {
              const parsed = parser.inlineParser(parentExact)
              if (parsed._tag === "arrayInline") {
                const idx = Number(childToken)
                if (Number.isInteger(idx) && idx >= 0 && idx < parsed.items.length) {
                  return Effect.succeed(leaf(parsed.items[idx]))
                }
              } else if (parsed._tag === "objectInline") {
                if (
                  typeof childToken === "string" &&
                  Object.prototype.hasOwnProperty.call(parsed.entries, childToken)
                ) {
                  return Effect.succeed(leaf(parsed.entries[childToken]))
                }
              }
            }
          }
          return Effect.succeed(undefined)
        }

        // Exact value present at the prefix
        const parsed = parser.inlineParser(exactValue)
        switch (parsed._tag) {
          case "leaf":
            return Effect.succeed(leaf(parsed.value))
          case "arrayInline":
            return Effect.succeed(array(parsed.items.length))
          case "objectInline":
            return Effect.succeed(object(Object.keys(parsed.entries)))
        }
      }

      // 2) Structural children exist -> infer array vs object
      let allNumeric = true
      let maxIndex = -1
      for (const t of childTokens) {
        const n = Number(t)
        if (!Number.isInteger(n) || n < 0 || String(n) !== t) {
          allNumeric = false
          break
        }
        if (n > maxIndex) maxIndex = n
      }

      if (allNumeric) return Effect.succeed(array(maxIndex + 1))
      return Effect.succeed(object(Array.from(childTokens)))
    }
  }
}
