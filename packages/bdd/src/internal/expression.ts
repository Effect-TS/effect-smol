import * as Option from "effect/Option"
import * as Schema from "effect/Schema"

/** @internal */
export interface Capture<Name extends string, A> {
  readonly _tag: "Capture"
  readonly name: Name
  readonly schema: Schema.Schema<A>
}

/** @internal */
export interface Matcher<A> {
  readonly source: string
  readonly match: (text: string) => Option.Option<A>
}

/** @internal */
export const makeCapture = <const Name extends string, A>(
  name: Name,
  schema: Schema.Schema<A>
): Capture<Name, A> => ({
  _tag: "Capture",
  name,
  schema
})

/** @internal */
export const makeMatcher = <A>(
  strings: TemplateStringsArray,
  captures: ReadonlyArray<Capture<string, unknown>>
): Matcher<A> => {
  const names: Array<string> = []
  const usedCaptures: Array<Capture<string, unknown>> = []
  let source = ""
  let pattern = "^"

  for (let i = 0; i < strings.length; i++) {
    const literal = strings[i] ?? ""
    pattern += escapeRegExp(literal)
    source += literal

    const capture = captures[i]
    if (capture !== undefined) {
      pattern += "(.+?)"
      names.push(capture.name)
      usedCaptures.push(capture)
      source += `{${capture.name}}`
    }
  }
  pattern += "$"
  const regex = new globalThis.RegExp(pattern)
  const decoders = usedCaptures.map((capture) => Schema.decodeUnknownOption((capture.schema ?? Schema.String) as any))

  return {
    source,
    match(text) {
      const match = regex.exec(text)
      if (match === null) {
        return Option.none()
      }
      const out: Record<string, unknown> = {}
      for (let i = 0; i < names.length; i++) {
        const decoded = decoders[i](match[i + 1])
        if (Option.isNone(decoded)) {
          return Option.none()
        }
        out[names[i]] = decoded.value
      }
      return Option.some(out as A)
    }
  }
}

const escapeRegExp = (string: string): string => string.replace(/[/\\^$*+?.()|[\]{}]/g, "\\$&")
