import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '43.16 ± 0.54%'  │ '42.00 ± 0.00'   │ '23674261 ± 0.00%'     │ '23809524 ± 0'         │ 23168188 │
│ 1       │ 'Valibot' │ '51.63 ± 0.23%'  │ '42.00 ± 0.00'   │ '21486486 ± 0.01%'     │ '23809524 ± 1'         │ 19368163 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.trim)

const valibot = v.pipe(v.string(), v.trim())

const good = " a "

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
