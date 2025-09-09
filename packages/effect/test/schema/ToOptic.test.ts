import { Option } from "effect/data"
import { Schema, ToOptic } from "effect/schema"
import { describe, it } from "vitest"
import { deepStrictEqual } from "../utils/assert.ts"

class D extends Schema.Class<D>("D")({
  a: Schema.Date
}) {}

describe("ToOptic", () => {
  it("Tuple", () => {
    const schema = Schema.Tuple([D])
    const optic = ToOptic.make(schema).key(0).key("a")
    const modify = optic.modify((date) => new Date(date.getTime() + 1))

    deepStrictEqual(
      modify([D.makeSync({ a: new Date(0) })]),
      [D.makeSync({ a: new Date(1) })]
    )
  })

  it("Struct", () => {
    const schema = Schema.Struct({
      d: D
    })
    const optic = ToOptic.make(schema).key("d").key("a")
    const modify = optic.modify((date) => new Date(date.getTime() + 1))

    deepStrictEqual(
      modify({ d: D.makeSync({ a: new Date(0) }) }),
      { d: D.makeSync({ a: new Date(1) }) }
    )
  })

  it("Option", () => {
    const schema = Schema.Option(D)
    const optic = ToOptic.make(schema).tag("Some").key("value").key("a")
    const modify = optic.modify((date) => new Date(date.getTime() + 1))

    deepStrictEqual(
      modify(Option.some(D.makeSync({ a: new Date(0) }))),
      Option.some(D.makeSync({ a: new Date(1) }))
    )
  })
})
