import { Schema } from "effect"

const parser = Schema.TemplateLiteralParser([Schema.String, ".", Schema.String])
