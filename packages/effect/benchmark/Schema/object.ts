import * as z from "@zod/mini"
import { type } from "arktype"
import type { SchemaResult } from "effect"
import { Effect, Result, Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '2514.4 ± 1.02%' │ '2333.0 ± 84.00' │ '424431 ± 0.03%'       │ '428633 ± 15812'       │ 397714   │
│ 1       │ 'Schema (bad)'   │ '3100.7 ± 3.14%' │ '2542.0 ± 84.00' │ '391208 ± 0.03%'       │ '393391 ± 13444'       │ 322509   │
│ 2       │ 'Valibot (good)' │ '50.83 ± 1.17%'  │ '42.00 ± 0.00'   │ '21923042 ± 0.01%'     │ '23809524 ± 1'         │ 19674135 │
│ 3       │ 'Valibot (bad)'  │ '105.41 ± 2.38%' │ '84.00 ± 1.00'   │ '10444415 ± 0.01%'     │ '11904762 ± 143431'    │ 9487092  │
│ 4       │ 'Arktype (good)' │ '22.96 ± 0.03%'  │ '41.00 ± 1.00'   │ '32807779 ± 0.01%'     │ '24390244 ± 580720'    │ 43551457 │
│ 5       │ 'Arktype (bad)'  │ '1577.8 ± 2.60%' │ '1541.0 ± 41.00' │ '651259 ± 0.01%'       │ '648929 ± 17217'       │ 633803   │
│ 6       │ 'Zod (good)'     │ '39.63 ± 3.84%'  │ '42.00 ± 0.00'   │ '23991113 ± 0.00%'     │ '23809524 ± 0'         │ 25233443 │
│ 7       │ 'Zod (bad)'      │ '376.58 ± 0.53%' │ '375.00 ± 0.00'  │ '2777803 ± 0.01%'      │ '2666667 ± 0'          │ 2655511  │
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

const decodeUnknownParserResult = SchemaParser.decodeUnknownSchemaResult(schema)

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
