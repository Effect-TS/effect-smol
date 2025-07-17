import { Array as RA } from "effect/collections"
import type { AST } from "effect/schema"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'Schema (good)' │ '4129.5 ± 1.28%' │ '3750.0 ± 83.00' │ '262533 ± 0.03%'       │ '266667 ± 5774'        │ 242163  │
│ 1       │ 'Schema (bad)'  │ '5066.4 ± 2.05%' │ '4250.0 ± 84.00' │ '232554 ± 0.03%'       │ '235294 ± 4687'        │ 197443  │
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

const decodeUnknownResult = ToParser.decodeUnknownResult(schema)
const options: AST.ParseOptions = { errors: "all" }

// console.log(decodeUnknownResult(good))
// console.log(decodeUnknownResult(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownResult(good, options)
  })
  .add("Schema (bad)", function() {
    decodeUnknownResult(bad, options)
  })

await bench.run()

console.table(bench.table())
