import * as z from "@zod/mini"
import { type } from "arktype"
import type { SchemaResult } from "effect"
import { Effect, Result, Schema, SchemaCheck, SchemaValidator } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '938.65 ± 0.18%' │ '917.00 ± 1.00'  │ '1084739 ± 0.01%'      │ '1090513 ± 1191'       │ 1065356  │
│ 1       │ 'Schema (bad)'   │ '1197.1 ± 1.26%' │ '1083.0 ± 41.00' │ '931034 ± 0.02%'       │ '923361 ± 36332'       │ 835336   │
│ 2       │ 'Valibot (good)' │ '45.43 ± 0.22%'  │ '42.00 ± 0.00'   │ '23288059 ± 0.01%'     │ '23809524 ± 1'         │ 22013414 │
│ 3       │ 'Valibot (bad)'  │ '68.58 ± 1.13%'  │ '83.00 ± 1.00'   │ '16876129 ± 0.02%'     │ '12048193 ± 143431'    │ 14581414 │
│ 4       │ 'Arktype (good)' │ '23.13 ± 0.04%'  │ '41.00 ± 1.00'   │ '32575924 ± 0.01%'     │ '24390244 ± 580720'    │ 43227833 │
│ 5       │ 'Arktype (bad)'  │ '1358.8 ± 3.70%' │ '1292.0 ± 41.00' │ '758913 ± 0.01%'       │ '773994 ± 23806'       │ 735933   │
│ 6       │ 'Zod (good)'     │ '43.29 ± 1.00%'  │ '42.00 ± 0.00'   │ '23702201 ± 0.00%'     │ '23809524 ± 0'         │ 23101004 │
│ 7       │ 'Zod (bad)'      │ '382.56 ± 1.77%' │ '375.00 ± 0.00'  │ '2650484 ± 0.01%'      │ '2666667 ± 0'          │ 2613979  │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.check(SchemaCheck.nonEmpty))

const valibot = v.pipe(v.string(), v.nonEmpty())

const arktype = type("string > 0")

const zod = z.string().check(z.minLength(1))

const good = "a"
const bad = ""

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
