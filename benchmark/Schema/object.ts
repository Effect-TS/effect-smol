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
│ 0       │ 'Schema (good)'  │ '2225.1 ± 0.74%' │ '2042.0 ± 83.00' │ '479053 ± 0.02%'       │ '489716 ± 19128'       │ 449424   │
│ 1       │ 'Schema (bad)'   │ '2674.1 ± 4.71%' │ '2250.0 ± 84.00' │ '441489 ± 0.03%'       │ '444444 ± 17023'       │ 374162   │
│ 2       │ 'Valibot (good)' │ '50.79 ± 0.21%'  │ '42.00 ± 0.00'   │ '21860361 ± 0.01%'     │ '23809524 ± 1'         │ 19687296 │
│ 3       │ 'Valibot (bad)'  │ '104.13 ± 4.37%' │ '84.00 ± 1.00'   │ '10734090 ± 0.01%'     │ '11904762 ± 143431'    │ 9603054  │
│ 4       │ 'Arktype (good)' │ '22.89 ± 0.16%'  │ '41.00 ± 1.00'   │ '32933518 ± 0.01%'     │ '24390244 ± 580720'    │ 43691362 │
│ 5       │ 'Arktype (bad)'  │ '1677.2 ± 2.49%' │ '1625.0 ± 41.00' │ '609453 ± 0.01%'       │ '615385 ± 15145'       │ 596242   │
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
