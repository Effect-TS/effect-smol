import * as Schema from "#dist/effect/Schema"
import * as SchemaValidator from "#dist/effect/SchemaValidator"

const schema = Schema.String

console.log(SchemaValidator.decodeUnknownSync(schema)("a"))
