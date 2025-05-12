import * as Schema from "#dist/effect/Schema"
import * as SchemaCheck from "#dist/effect/SchemaCheck"
import * as SchemaParser from "#dist/effect/SchemaParser"

const schema = Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))

console.log(SchemaParser.decodeUnknownSync(schema)("a"))
