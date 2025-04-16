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
│ 0       │ 'Schema (good)'  │ '24.48 ± 0.12%'  │ '41.00 ± 1.00'   │ '31022271 ± 0.01%'     │ '24390244 ± 580720'    │ 40854867 │
│ 1       │ 'Schema (bad)'   │ '30.42 ± 5.50%'  │ '41.00 ± 1.00'   │ '27006737 ± 0.01%'     │ '24390244 ± 580720'    │ 33459398 │
│ 2       │ 'Valibot (good)' │ '44.94 ± 0.33%'  │ '42.00 ± 0.00'   │ '23482214 ± 0.00%'     │ '23809524 ± 0'         │ 22251593 │
│ 3       │ 'Valibot (bad)'  │ '67.34 ± 0.13%'  │ '83.00 ± 1.00'   │ '16830858 ± 0.02%'     │ '12048193 ± 143431'    │ 14849551 │
│ 4       │ 'Arktype (good)' │ '22.90 ± 0.03%'  │ '41.00 ± 1.00'   │ '32875810 ± 0.01%'     │ '24390249 ± 580725'    │ 43663260 │
│ 5       │ 'Arktype (bad)'  │ '1957.5 ± 4.50%' │ '1333.0 ± 41.00' │ '743356 ± 0.02%'       │ '750188 ± 22915'       │ 511825   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
with Effect:
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '959.22 ± 0.24%' │ '917.00 ± 41.00' │ '1074488 ± 0.01%'      │ '1090513 ± 46671'      │ 1042514  │
│ 1       │ 'Schema (bad)'   │ '1248.3 ± 1.37%' │ '1083.0 ± 42.00' │ '921631 ± 0.02%'       │ '923361 ± 36332'       │ 801086   │
│ 2       │ 'Valibot (good)' │ '47.10 ± 0.21%'  │ '42.00 ± 0.00'   │ '22837245 ± 0.01%'     │ '23809524 ± 1'         │ 21232290 │
│ 3       │ 'Valibot (bad)'  │ '68.43 ± 0.20%'  │ '83.00 ± 1.00'   │ '16816216 ± 0.02%'     │ '12048193 ± 143431'    │ 14614390 │
│ 4       │ 'Arktype (good)' │ '23.07 ± 0.20%'  │ '41.00 ± 1.00'   │ '32737770 ± 0.01%'     │ '24390244 ± 580720'    │ 43347391 │
│ 5       │ 'Arktype (bad)'  │ '1361.5 ± 4.34%' │ '1292.0 ± 41.00' │ '762303 ± 0.01%'       │ '773994 ± 23806'       │ 734487   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.nonEmpty())

const valibot = v.pipe(v.string(), v.nonEmpty())

const arktype = type("string > 0")

const good = "a"
const bad = ""

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
