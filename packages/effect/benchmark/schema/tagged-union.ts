import { Array as RA } from "effect/collections"
import type { AST } from "effect/schema"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'Schema (good)' │ '1089.1 ± 1.20%' │ '1000.0 ± 0.00'  │ '971160 ± 0.01%'       │ '1000000 ± 0'          │ 918215  │
│ 1       │ 'Schema (bad)'  │ '1771.6 ± 2.52%' │ '1417.0 ± 42.00' │ '698251 ± 0.02%'       │ '705716 ± 21556'       │ 564446  │
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
