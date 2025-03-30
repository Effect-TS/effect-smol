import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '35.35 ± 0.10%'  │ '42.00 ± 0.00'   │ '24635203 ± 0.00%'     │ '23809524 ± 0'         │ 28292176 │
│ 1       │ 'Valibot' │ '55.11 ± 0.25%'  │ '42.00 ± 1.00'   │ '20527938 ± 0.01%'     │ '23809524 ± 580719'    │ 18146183 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.trim)

const valibot = v.pipe(v.string(), v.trim())

const good = " a "

const decodeUnknownParserResult = SchemaParser.decodeUnknownParserResult(schema)

// console.log(decodeUnknownParserResult(good))
// console.log(v.safeParse(valibot, good))

bench
  .add("Schema", function() {
    decodeUnknownParserResult(good)
  })
  .add("Valibot", function() {
    v.safeParse(valibot, good)
  })

await bench.run()

console.table(bench.table())
