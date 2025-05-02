/* eslint-disable no-console */

import { Effect, Schema, SchemaFormatter, SchemaResult, SchemaValidator } from "effect"

export class A extends Schema.Opaque<A>()(Schema.URL) {}

export type Type = typeof A["Type"]
export type Encoded = typeof A["Encoded"]

// console.dir(schema.ast, { depth: null })

// console.dir(Schema.encodedCodec(schema).ast, { depth: null })

// export const flipped = Schema.flip(schema)

const schema = A

export const reveal = Schema.revealCodec(schema)

// console.dir(schema.ast, { depth: null })
// console.dir(flipped.ast, { depth: null })

const sr = SchemaValidator.decodeUnknownSchemaResult(schema)({ a: "a" })
const res = SchemaResult.asEffect(sr).pipe(
  Effect.mapError((err) => SchemaFormatter.TreeFormatter.format(err))
)
Effect.runPromise(res).then(console.log, console.error)
