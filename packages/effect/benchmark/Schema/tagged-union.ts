import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬───────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns)  │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────┼──────────────────┼───────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'Schema (good)' │ '6924.4 ± 0.94%' │ '6667.0 ± 125.00' │ '150324 ± 0.03%'       │ '149993 ± 2760'        │ 144417  │
│ 1       │ 'Schema (bad)'  │ '6901.7 ± 0.87%' │ '6667.0 ± 125.00' │ '150192 ± 0.03%'       │ '149993 ± 2760'        │ 144892  │
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

const decodeUnknownResult = ToParser.decodeUnknownResult(schema)

// console.log(decodeUnknownResult(good))
// console.log(decodeUnknownResult(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownResult(good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownResult(bad)
  })

await bench.run()

console.table(bench.table())
