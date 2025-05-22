import * as Schema from "#dist/effect/Schema"

const schema = Schema.String

console.log(Schema.decodeUnknownSync(schema)("a"))
