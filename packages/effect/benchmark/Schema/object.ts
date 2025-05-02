import * as z from "@zod/mini"
import { type } from "arktype"
import type { SchemaResult } from "effect"
import { Effect, Result, Schema, SchemaValidator } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '2598.5 ± 1.12%' │ '2375.0 ± 42.00' │ '413508 ± 0.02%'       │ '421053 ± 7580'        │ 384834   │
│ 1       │ 'Schema (bad)'   │ '2901.7 ± 1.56%' │ '2542.0 ± 42.00' │ '389847 ± 0.03%'       │ '393391 ± 6609'        │ 344628   │
│ 2       │ 'Valibot (good)' │ '51.44 ± 0.57%'  │ '42.00 ± 0.00'   │ '21722163 ± 0.01%'     │ '23809524 ± 1'         │ 19439822 │
│ 3       │ 'Valibot (bad)'  │ '112.20 ± 2.12%' │ '125.00 ± 0.00'  │ '9793064 ± 0.01%'      │ '8000000 ± 0'          │ 8912788  │
│ 4       │ 'Arktype (good)' │ '23.07 ± 0.03%'  │ '41.00 ± 1.00'   │ '32675341 ± 0.01%'     │ '24390244 ± 580720'    │ 43347819 │
│ 5       │ 'Arktype (bad)'  │ '1590.0 ± 0.19%' │ '1583.0 ± 41.00' │ '636649 ± 0.01%'       │ '631712 ± 16327'       │ 628932   │
│ 6       │ 'Zod (good)'     │ '39.20 ± 0.05%'  │ '42.00 ± 0.00'   │ '23924011 ± 0.00%'     │ '23809524 ± 0'         │ 25510897 │
│ 7       │ 'Zod (bad)'      │ '382.91 ± 0.46%' │ '375.00 ± 0.00'  │ '2732046 ± 0.01%'      │ '2666667 ± 0'          │ 2611614  │
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

const zod = z.object({
  a: z.string()
})

const good = { a: "a" }
const bad = { a: 1 }

const decodeUnknownParserResult = SchemaValidator.decodeUnknownSchemaResult(schema)

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
