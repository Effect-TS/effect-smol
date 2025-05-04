import { Schema, SchemaTransformation } from "effect"

const From = Schema.String

const To = Schema.Number

const schema = From.pipe(
  Schema.decodeTo(To, SchemaTransformation.compose({ strict: false }))
)

/*
const sr = SchemaValidator.decodeUnknownSchemaResult(schema)(`{"b":""}`)
const res = SchemaResult.asEffect(sr).pipe(
  Effect.mapError((err) => SchemaFormatter.TreeFormatter.format(err))
)
Effect.runPromise(res).then(console.log, console.error)
*/
