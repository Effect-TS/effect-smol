import * as Schema from "#dist/effect/Schema"
import * as SchemaCheck from "#dist/effect/SchemaCheck"

const schema = Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))

console.log(Schema.decodeUnknownSync(schema)("a"))
