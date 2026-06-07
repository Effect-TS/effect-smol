import { Bdd } from "@effect/bdd"
import { Effect, Schema } from "effect"
import * as Arr from "effect/Array"

type Events = ReadonlyArray<string>

const text = Bdd.capture("text", Schema.String)
const table = Bdd.table(Schema.Unknown)
const docString = Bdd.docString(Schema.String)

const append = (state: Events, event: string): Events => Arr.append(state, event)

export const minimal = Bdd.feature("Minimal", { initial: [] as Events }).pipe(
  Bdd.given`the minimalism`((_captures, state) => Effect.succeed(append(state, "minimalism")))
)

export const background = Bdd.feature("Background", { initial: [] as Events }).pipe(
  Bdd.given`the minimalism inside a background`((_captures, state) => Effect.succeed(append(state, "background"))),
  Bdd.given`the minimalism`((_captures, state) => Effect.succeed(append(state, "minimalism")))
)

export const minimalScenarioOutline = Bdd.feature("Minimal Scenario Outline", { initial: [] as Events }).pipe(
  Bdd.given`the ${text}`(({ text }, state) => Effect.succeed(append(state, text))),
  Bdd.given`a ${text}`(({ text }, state) => Effect.succeed(append(state, text)))
)

export const someRules = Bdd.feature("Some rules", { initial: [] as Events }).pipe(
  Bdd.given`fb`((_captures, state) => Effect.succeed(append(state, "feature background"))),
  Bdd.given`ab`((_captures, state) => Effect.succeed(append(state, "rule background"))),
  Bdd.given`a`((_captures, state) => Effect.succeed(append(state, "example a"))),
  Bdd.given`b`((_captures, state) => Effect.succeed(append(state, "example b")))
)

export const descriptions = Bdd.feature("Descriptions everywhere", { initial: [] as Events }).pipe(
  Bdd.given`the minimalism`((_captures, state) => Effect.succeed(append(state, "minimalism")))
)

export const dataTables = Bdd.feature("DataTables", { initial: [] as Events }).pipe(
  Bdd.given`a ${text}`(table, ({ text }, _table, state) => Effect.succeed(append(state, text)))
)

export const docStrings = Bdd.feature("DocString variations", { initial: [] as Events }).pipe(
  Bdd.given`a ${text}`(docString, ({ text }, _docString, state) => Effect.succeed(append(state, text)))
)
