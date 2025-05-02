import { Effect, Schema, SchemaFilter, SchemaFormatter, SchemaResult, SchemaValidator } from "effect"

class Person extends Schema.Opaque<Person>()(
  Schema.Struct({
    name: Schema.String
  })
) {}

/*
const S: Schema.Struct<{
    readonly name: Schema.String;
}>
*/
const S = Person.annotate({ title: "Person" })

const sr = SchemaValidator.decodeUnknownSchemaResult(Person)({ name: "" })
const res = SchemaResult.asEffect(sr).pipe(
  Effect.mapError((err) => SchemaFormatter.TreeFormatter.format(err))
)
Effect.runPromise(res).then(console.log, console.error)
/*
Person & <filter>
└─ <filter>
   └─ Invalid value {"name":""}
*/
