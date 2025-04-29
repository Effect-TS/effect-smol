/* eslint-disable no-console */

import { Effect, Schema, SchemaAST, SchemaFilter, SchemaFormatter, SchemaResult, SchemaValidator } from "effect"

const schema = Schema.Number.pipe(Schema.check(SchemaFilter.int32))

console.log(SchemaAST.format(schema.ast))

// console.dir(Schema.encodedCodec(schema).ast, { depth: null })

// export const flipped = Schema.flip(schema)

export const reveal = Schema.revealCodec(schema)

// console.dir(schema.ast, { depth: null })
// console.dir(flipped.ast, { depth: null })

const sr = SchemaValidator.encodeUnknownSchemaResult(schema)(1)
const res = SchemaResult.asEffect(sr).pipe(
  Effect.mapError((err) => SchemaFormatter.TreeFormatter.format(err))
)
Effect.runPromise(res).then(console.log, console.error)
