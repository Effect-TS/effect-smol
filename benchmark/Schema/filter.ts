import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '30.16 ± 0.06%'  │ '41.00 ± 1.00'   │ '26543512 ± 0.01%'     │ '24390244 ± 580720'    │ 33159531 │
│ 1       │ 'Valibot' │ '45.60 ± 0.25%'  │ '42.00 ± 0.00'   │ '23236135 ± 0.01%'     │ '23809524 ± 0'         │ 21927819 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.nonEmpty)

const valibot = v.pipe(v.string(), v.nonEmpty())

const good = "a"

const decodeUnknownSync = SchemaParser.decodeUnknownSync(schema)

// console.log(decodeUnknownSync(good))
// console.log(v.safeParse(valibot, good))

bench
  .add("Schema", function() {
    decodeUnknownSync(good)
  })
  .add("Valibot", function() {
    v.safeParse(valibot, good)
  })

await bench.run()

console.table(bench.table())
