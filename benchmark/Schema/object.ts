/* eslint-disable no-console */
import { type } from "arktype"
import type { SchemaParserResult } from "effect"
import { Effect, Result, Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
with Result:
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '47.04 ± 1.52%'  │ '42.00 ± 0.00'   │ '22722722 ± 0.01%'     │ '23809524 ± 1'         │ 21258493 │
│ 1       │ 'Schema (bad)'   │ '53.10 ± 0.68%'  │ '42.00 ± 0.00'   │ '21750641 ± 0.01%'     │ '23809524 ± 1'         │ 18831301 │
│ 2       │ 'Valibot (good)' │ '50.66 ± 0.39%'  │ '42.00 ± 0.00'   │ '21878436 ± 0.01%'     │ '23809524 ± 0'         │ 19740238 │
│ 3       │ 'Valibot (bad)'  │ '100.80 ± 0.53%' │ '84.00 ± 1.00'   │ '10806230 ± 0.01%'     │ '11904762 ± 143431'    │ 9921326  │
│ 4       │ 'Arktype (good)' │ '22.80 ± 0.03%'  │ '41.00 ± 1.00'   │ '33011511 ± 0.01%'     │ '24390244 ± 580720'    │ 43855201 │
│ 5       │ 'Arktype (bad)'  │ '1618.4 ± 2.36%' │ '1583.0 ± 41.00' │ '630811 ± 0.01%'       │ '631712 ± 16327'       │ 617884   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
with Effect:
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '2421.3 ± 1.35%' │ '2167.0 ± 42.00' │ '455516 ± 0.03%'       │ '461467 ± 9121'        │ 413008   │
│ 1       │ 'Schema (bad)'   │ '3068.6 ± 2.54%' │ '2583.0 ± 83.00' │ '381816 ± 0.03%'       │ '387147 ± 12194'       │ 325883   │
│ 2       │ 'Valibot (good)' │ '50.69 ± 1.40%'  │ '42.00 ± 0.00'   │ '22064317 ± 0.01%'     │ '23809524 ± 1'         │ 19728363 │
│ 3       │ 'Valibot (bad)'  │ '103.10 ± 3.88%' │ '84.00 ± 1.00'   │ '10787634 ± 0.01%'     │ '11904762 ± 143431'    │ 9698944  │
│ 4       │ 'Arktype (good)' │ '22.82 ± 0.04%'  │ '41.00 ± 1.00'   │ '33000105 ± 0.01%'     │ '24390244 ± 580720'    │ 43827041 │
│ 5       │ 'Arktype (bad)'  │ '1665.1 ± 2.63%' │ '1625.0 ± 41.00' │ '614407 ± 0.01%'       │ '615385 ± 15145'       │ 600562   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Struct({
  a: Schema.String
})

const valibot = v.object({
  a: v.string()
})

const arktype = type({
  a: "string"
})

const good = { a: "a" }
const bad = { a: 1 }

const decodeUnknownParserResult = SchemaParser.decodeUnknownParserResult(schema)

const runSyncExit = <A>(spr: SchemaParserResult.SchemaParserResult<A, never>) => {
  if (Result.isResult(spr)) {
    return spr
  }
  return Effect.runSyncExit(spr)
}

// console.log(runSyncExit(decodeUnknownParserResult(good)))
// console.log(runSyncExit(decodeUnknownParserResult(bad)))
// console.log(v.safeParse(valibot, good))
// console.log(v.safeParse(valibot, bad))
// console.log(arktype(good))
// console.log(arktype(bad))

bench
  .add("Schema (good)", function() {
    runSyncExit(decodeUnknownParserResult(good))
  })
  .add("Schema (bad)", function() {
    runSyncExit(decodeUnknownParserResult(bad))
  })
  .add("Valibot (good)", function() {
    v.safeParse(valibot, good)
  })
  .add("Valibot (bad)", function() {
    v.safeParse(valibot, bad)
  })
  .add("Arktype (good)", function() {
    arktype(good)
  })
  .add("Arktype (bad)", function() {
    arktype(bad)
  })

await bench.run()

console.table(bench.table())
