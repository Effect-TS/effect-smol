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
│ 0       │ 'Schema (good)'  │ '44.30 ± 1.61%'  │ '42.00 ± 0.00'   │ '23569801 ± 0.00%'     │ '23809524 ± 1'         │ 22574125 │
│ 1       │ 'Schema (bad)'   │ '52.85 ± 1.03%'  │ '42.00 ± 0.00'   │ '22262587 ± 0.01%'     │ '23809524 ± 1'         │ 18920743 │
│ 2       │ 'Valibot (good)' │ '62.33 ± 0.38%'  │ '42.00 ± 1.00'   │ '19132167 ± 0.02%'     │ '23809524 ± 580720'    │ 16044565 │
│ 3       │ 'Valibot (bad)'  │ '127.35 ± 1.22%' │ '125.00 ± 0.00'  │ '8199295 ± 0.01%'      │ '8000000 ± 0'          │ 7852446  │
│ 4       │ 'Arktype (good)' │ '23.53 ± 0.03%'  │ '41.00 ± 1.00'   │ '32060738 ± 0.01%'     │ '24390244 ± 580720'    │ 42493053 │
│ 5       │ 'Arktype (bad)'  │ '1821.7 ± 2.61%' │ '1791.0 ± 41.00' │ '561038 ± 0.01%'       │ '558347 ± 13081'       │ 548935   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
with Effect:
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '3592.9 ± 4.10%' │ '3000.0 ± 42.00' │ '325860 ± 0.03%'       │ '333333 ± 4733'        │ 278329   │
│ 1       │ 'Schema (bad)'   │ '3704.1 ± 1.30%' │ '3292.0 ± 83.00' │ '299164 ± 0.03%'       │ '303767 ± 7470'        │ 269974   │
│ 2       │ 'Valibot (good)' │ '61.87 ± 2.32%'  │ '42.00 ± 1.00'   │ '19598801 ± 0.01%'     │ '23809523 ± 580720'    │ 16163965 │
│ 3       │ 'Valibot (bad)'  │ '121.44 ± 0.69%' │ '125.00 ± 0.00'  │ '8725164 ± 0.01%'      │ '8000000 ± 0'          │ 8234515  │
│ 4       │ 'Arktype (good)' │ '23.64 ± 0.04%'  │ '41.00 ± 1.00'   │ '31955410 ± 0.01%'     │ '24390244 ± 580720'    │ 42296939 │
│ 5       │ 'Arktype (bad)'  │ '1830.4 ± 2.54%' │ '1792.0 ± 41.00' │ '555610 ± 0.01%'       │ '558036 ± 12482'       │ 546335   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Array(Schema.String)

const valibot = v.array(v.string())

const arktype = type("string[]")

const good = ["a", "b"]
const bad = ["a", 1]

const decodeUnknownParserResult = SchemaParser.decodeUnknownSchemaParserResult(schema)

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
