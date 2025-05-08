import * as Schema from "#dist/effect/Schema"
import * as SchemaCheck from "#dist/effect/SchemaCheck"
import * as SchemaValidator from "#dist/effect/SchemaValidator"

const schema = Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))

console.log(SchemaValidator.decodeUnknownSync(schema)("a"))
