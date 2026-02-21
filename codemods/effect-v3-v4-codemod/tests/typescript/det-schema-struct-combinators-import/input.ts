import { Schema } from "effect"

const picker = Schema.pick("a")
const omitter = Schema.omit("b")
const partial = Schema.partial
const filtered = Schema.filter((s: string) => s.length > 0)
