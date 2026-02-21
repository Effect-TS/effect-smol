import { Schema, Struct } from "effect"

const picker = Struct.pick(["a"])
const omitter = Struct.omit(["b"])
const partial = Struct.map(Schema.optional)
const filtered = Schema.check(Schema.makeFilter((s: string) => s.length > 0))
