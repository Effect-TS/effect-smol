/* eslint-disable no-console */
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
│ 0       │ 'Schema (good)'  │ '2369.7 ± 1.84%' │ '2167.0 ± 42.00' │ '454183 ± 0.02%'       │ '461467 ± 9121'        │ 421986   │
│ 1       │ 'Schema (bad)'   │ '3036.0 ± 5.72%' │ '2416.0 ± 83.00' │ '408895 ± 0.04%'       │ '413907 ± 14542'       │ 329377   │
│ 2       │ 'Valibot (good)' │ '52.03 ± 1.41%'  │ '42.00 ± 0.00'   │ '21734890 ± 0.01%'     │ '23809524 ± 1'         │ 19219915 │
│ 3       │ 'Valibot (bad)'  │ '105.46 ± 4.39%' │ '84.00 ± 1.00'   │ '10665901 ± 0.01%'     │ '11904762 ± 143431'    │ 9482431  │
│ 4       │ 'Arktype (good)' │ '23.08 ± 0.06%'  │ '41.00 ± 1.00'   │ '32668835 ± 0.01%'     │ '24390244 ± 580720'    │ 43327692 │
│ 5       │ 'Arktype (bad)'  │ '1639.8 ± 2.80%' │ '1583.0 ± 41.00' │ '628434 ± 0.01%'       │ '631712 ± 16327'       │ 609847   │
│ 6       │ 'Zod (good)'     │ '41.14 ± 4.09%'  │ '42.00 ± 0.00'   │ '23864051 ± 0.00%'     │ '23809524 ± 0'         │ 24306374 │
│ 7       │ 'Zod (bad)'      │ '378.47 ± 2.76%' │ '375.00 ± 0.00'  │ '2765359 ± 0.01%'      │ '2666667 ± 0'          │ 2642200  │
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
