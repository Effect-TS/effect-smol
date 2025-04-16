/* eslint-disable no-console */
import { type } from "arktype"
import type { SchemaParserResult } from "effect"
import { Effect, Result, Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
with Result:
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '37.82 ± 2.02%'  │ '42.00 ± 0.00'   │ '24188850 ± 0.00%'     │ '23809524 ± 1'         │ 26442607 │
│ 1       │ 'Valibot' │ '54.91 ± 1.71%'  │ '42.00 ± 0.00'   │ '21278373 ± 0.01%'     │ '23809524 ± 1'         │ 18212279 │
│ 2       │ 'Arktype' │ '25.55 ± 0.04%'  │ '41.00 ± 1.00'   │ '29884094 ± 0.01%'     │ '24390244 ± 580720'    │ 39131923 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
with Effect:
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '1105.9 ± 1.06%' │ '1083.0 ± 41.00' │ '929548 ± 0.01%'       │ '923361 ± 36332'       │ 904258   │
│ 1       │ 'Valibot' │ '51.98 ± 0.43%'  │ '42.00 ± 0.00'   │ '21423995 ± 0.01%'     │ '23809524 ± 1'         │ 19239850 │
│ 2       │ 'Arktype' │ '25.63 ± 0.04%'  │ '41.00 ± 1.00'   │ '29851262 ± 0.01%'     │ '24390244 ± 580720'    │ 39021304 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.decode(Schema.trim))

const valibot = v.pipe(v.string(), v.trim())

const arktype = type("string").pipe((str) => str.trim())

const good = " a "

const decodeUnknownParserResult = SchemaParser.decodeUnknownSchemaParserResult(schema)

const runSyncExit = <A>(spr: SchemaParserResult.SchemaParserResult<A, never>) => {
  if (Result.isResult(spr)) {
    return spr
  }
  return Effect.runSyncExit(spr)
}

// console.log(runSyncExit(decodeUnknownParserResult(good)))
// console.log(v.safeParse(valibot, good))
// console.log(arktype(good))

bench
  .add("Schema", function() {
    runSyncExit(decodeUnknownParserResult(good))
  })
  .add("Valibot", function() {
    v.safeParse(valibot, good)
  })
  .add("Arktype", function() {
    arktype(good)
  })

await bench.run()

console.table(bench.table())
