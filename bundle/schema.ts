import * as Schema from "#dist/Schema"

const schema = Schema.String

console.log(Schema.decodeUnknownEither(schema)("Hello, World!"))
