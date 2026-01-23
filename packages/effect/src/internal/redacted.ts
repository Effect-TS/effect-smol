import * as Redacted from "../Redacted.ts"

/** @internal */
export const redactedRegistry = new WeakMap<Redacted.Redacted<any>, any>()

/** @internal */
export const stringOrRedacted = (value: string | Redacted.Redacted): string =>
  typeof value === "string" ? value : Redacted.value(value)
