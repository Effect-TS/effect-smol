/* eslint-disable no-console */
import * as z from "@zod/mini"
import { type } from "arktype"
import type { SchemaResult } from "effect"
import { Effect, Result, Schema, SchemaTransformation, SchemaValidator } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name    │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'     │ '1131.8 ± 0.74%' │ '1083.0 ± 1.00'  │ '919650 ± 0.01%'       │ '923361 ± 852'         │ 883560   │
│ 1       │ 'Valibot'    │ '54.62 ± 1.90%'  │ '42.00 ± 0.00'   │ '21181190 ± 0.01%'     │ '23809524 ± 1'         │ 18307250 │
│ 2       │ 'Arktype'    │ '25.47 ± 0.12%'  │ '41.00 ± 1.00'   │ '30017556 ± 0.01%'     │ '24390244 ± 580720'    │ 39255062 │
│ 3       │ 'Zod (good)' │ '48.68 ± 2.73%'  │ '42.00 ± 0.00'   │ '23034534 ± 0.01%'     │ '23809524 ± 0'         │ 20542024 │
└─────────┴──────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, SchemaTransformation.trim))

const valibot = v.pipe(v.string(), v.trim())

const arktype = type("string").pipe((str) => str.trim())

const zod = z.string().check(z.trim())

const good = " a "

const decodeUnknownParserResult = SchemaValidator.decodeUnknownSchemaResult(schema)

const runSyncExit = <A>(sr: SchemaResult.SchemaResult<A, never>) => {
  if (Result.isResult(sr)) {
    return sr
  }
  return Effect.runSyncExit(sr)
}

// console.log(runSyncExit(decodeUnknownParserResult(good)))
// console.log(v.safeParse(valibot, good))
// console.log(arktype(good))
// console.log(zod.safeParse(good))

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
  .add("Zod (good)", function() {
    zod.safeParse(good)
  })

await bench.run()

console.table(bench.table())
