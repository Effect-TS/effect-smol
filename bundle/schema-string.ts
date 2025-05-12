import * as Schema from "#dist/effect/Schema"
import * as SchemaParser from "#dist/effect/SchemaParser"

const schema = Schema.String

console.log(SchemaParser.decodeUnknownSync(schema)("a"))
