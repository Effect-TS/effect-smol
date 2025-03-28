import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────────────────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name                               │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼─────────────────────────────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'SchemaParser.decodeUnknownSync (good)' │ '303.09 ± 0.54%' │ '292.00 ± 0.00'  │ '3368027 ± 0.01%'      │ '3424658 ± 0'          │ 3299383 │
└─────────┴─────────────────────────────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴─────────┘
*/

const bench = new Bench({ time: 1000 })

const schema = Schema.Struct({
  a: Schema.String
})

const good = { a: "a" }

const decodeUnknownSync = SchemaParser.decodeUnknownSync(schema)

// console.log(decodeUnknownSync(good))

bench
  .add("SchemaParser.decodeUnknownSync (good)", function() {
    decodeUnknownSync(good)
  })

await bench.run()

console.table(bench.table())
