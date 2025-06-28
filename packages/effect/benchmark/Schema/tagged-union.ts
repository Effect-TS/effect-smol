import { Effect, Result } from "effect"
import type { SchemaResult } from "effect/schema"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬───────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns)  │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────┼──────────────────┼───────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'Schema (good)' │ '7397.4 ± 1.09%' │ '7041.0 ± 124.00' │ '141079 ± 0.03%'       │ '142025 ± 2477'        │ 135184  │
│ 1       │ 'Schema (bad)'  │ '7319.1 ± 0.90%' │ '7042.0 ± 124.00' │ '141166 ± 0.02%'       │ '142005 ± 2457'        │ 136629  │
└─────────┴─────────────────┴──────────────────┴───────────────────┴────────────────────────┴────────────────────────┴─────────┘
*/

const bench = new Bench()

function generateUnionMembers(n: number) {
  return Array.from({ length: n }, (_, i) =>
    Schema.Struct({
      _tag: Schema.Literal(String(i)),
      value: Schema.String
    }))
}

const schema = Schema.Union(generateUnionMembers(100))

const good = { _tag: "100", value: "100" }
const bad = { _tag: "100", value: 100 }

const decodeUnknownParserResult = ToParser.decodeUnknownSchemaResult(schema)

const runSyncExit = <A>(sr: SchemaResult.SchemaResult<A, never>) => {
  if (Result.isResult(sr)) {
    return sr
  }
  return Effect.runSyncExit(sr)
}

// console.log(runSyncExit(decodeUnknownParserResult(good)))
// console.log(runSyncExit(decodeUnknownParserResult(bad)))

bench
  .add("Schema (good)", function() {
    runSyncExit(decodeUnknownParserResult(good))
  })
  .add("Schema (bad)", function() {
    runSyncExit(decodeUnknownParserResult(bad))
  })

await bench.run()

console.table(bench.table())
