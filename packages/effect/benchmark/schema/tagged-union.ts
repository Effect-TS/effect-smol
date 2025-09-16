import { Array as RA } from "effect/collections"
import type { AST } from "effect/schema"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'Schema (good)' │ '492.49 ± 0.48%' │ '458.00 ± 1.00'  │ '2116578 ± 0.01%'      │ '2183406 ± 4757'       │ 2030480 │
│ 1       │ 'Schema (bad)'  │ '1135.7 ± 3.93%' │ '791.00 ± 41.00' │ '1280031 ± 0.02%'      │ '1264223 ± 69111'      │ 880517  │
└─────────┴─────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴─────────┘
*/

const bench = new Bench({ time: 1000 })

const n = 100
const members = RA.makeBy(n, (i) =>
  Schema.Struct({
    kind: Schema.Literal(i),
    a: Schema.String,
    b: Schema.Number,
    c: Schema.Boolean
  }))

const schema = Schema.Union(members)

const good = {
  kind: n - 1,
  a: "a",
  b: 1,
  c: true
}

const bad = {
  kind: n - 1,
  a: "a",
  b: 1,
  c: "c"
}

const decodeUnknownExit = ToParser.decodeUnknownExit(schema)
const options: AST.ParseOptions = { errors: "all" }

// console.log(decodeUnknownExit(good))
// console.log(decodeUnknownExit(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownExit(good, options)
  })
  .add("Schema (bad)", function() {
    decodeUnknownExit(bad, options)
  })

await bench.run()

console.table(bench.table())
