import { Schema } from "effect"

const template = Schema.TemplateLiteral([Schema.String, ".", Schema.String])
const parser = Schema.TemplateLiteralParser(template.parts)
