import { type } from "arktype"
import { Effect, Result } from "effect"
import type { SchemaResult } from "effect/schema"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '3126.2 ± 0.65%' │ '2958.0 ± 42.00' │ '336401 ± 0.02%'       │ '338066 ± 4869'        │ 319880   │
│ 1       │ 'Schema (bad)'   │ '3688.8 ± 3.96%' │ '3208.0 ± 83.00' │ '309502 ± 0.03%'       │ '311721 ± 7954'        │ 271089   │
│ 2       │ 'Valibot (good)' │ '65.36 ± 0.81%'  │ '42.00 ± 1.00'   │ '18373652 ± 0.02%'     │ '23809523 ± 580721'    │ 15300304 │
│ 3       │ 'Valibot (bad)'  │ '126.07 ± 1.86%' │ '125.00 ± 0.00'  │ '8421581 ± 0.01%'      │ '8000000 ± 0'          │ 7932082  │
│ 4       │ 'Arktype (good)' │ '23.56 ± 0.03%'  │ '41.00 ± 1.00'   │ '32041805 ± 0.01%'     │ '24390244 ± 580720'    │ 42436703 │
│ 5       │ 'Arktype (bad)'  │ '1767.3 ± 2.46%' │ '1750.0 ± 41.00' │ '574788 ± 0.01%'       │ '571429 ± 13709'       │ 565832   │
│ 6       │ 'Zod (good)'     │ '60.85 ± 0.33%'  │ '42.00 ± 1.00'   │ '19213146 ± 0.01%'     │ '23809524 ± 580720'    │ 16433165 │
│ 7       │ 'Zod (bad)'      │ '414.48 ± 1.55%' │ '416.00 ± 1.00'  │ '2459962 ± 0.01%'      │ '2403846 ± 5765'       │ 2412662  │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Array(Schema.String)

const valibot = v.array(v.string())

const arktype = type("string[]")

const zod = z.array(z.string())

const good = ["a", "b"]
const bad = ["a", 1]

const decodeUnknownParserResult = ToParser.decodeUnknownSchemaResult(schema)

const runSyncExit = <A>(sr: SchemaResult.SchemaResult<A, never>) => {
  if (Result.isResult(sr)) {
    return sr
  }
  return Effect.runSyncExit(sr)
}

// console.log(runSyncExit(decodeUnknownParserResult(good)))
// console.log(runSyncExit(decodeUnknownParserResult(bad)))
// console.log(v.safeParse(valibot, good))
// console.log(v.safeParse(valibot, bad))
// console.log(arktype(good))
// console.log(arktype(bad))
// console.log(zod.safeParse(good))
// console.log(zod.safeParse(bad))

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
  .add("Zod (good)", function() {
    zod.safeParse(good)
  })
  .add("Zod (bad)", function() {
    zod.safeParse(bad)
  })

await bench.run()

console.table(bench.table())
