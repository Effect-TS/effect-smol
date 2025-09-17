import { Array as RA } from "effect/collections"
import type { AST } from "effect/schema"
import { Schema } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'Schema (good)' │ '495.61 ± 0.87%' │ '458.00 ± 1.00'  │ '2116025 ± 0.01%'      │ '2183406 ± 4757'       │ 2017736 │
│ 1       │ 'Schema (bad)'  │ '628.82 ± 2.10%' │ '584.00 ± 1.00'  │ '1663268 ± 0.01%'      │ '1712329 ± 2937'       │ 1590283 │
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

const decodeUnknownExit = Schema.decodeUnknownExit(schema)
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
