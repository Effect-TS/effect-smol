import { type } from "arktype"
import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '35.34 ± 1.14%'  │ '42.00 ± 0.00'   │ '24655182 ± 0.00%'     │ '23809524 ± 1'         │ 28297767 │
│ 1       │ 'Valibot' │ '52.41 ± 0.87%'  │ '42.00 ± 0.00'   │ '21407453 ± 0.01%'     │ '23809524 ± 2'         │ 19079851 │
│ 2       │ 'Arktype' │ '25.69 ± 0.07%'  │ '41.00 ± 1.00'   │ '29770737 ± 0.01%'     │ '24390244 ± 580720'    │ 38932101 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.trim)

const valibot = v.pipe(v.string(), v.trim())

const arktype = type("string").pipe((str) => str.trim())

const good = " a "

const decodeUnknownParserResult = SchemaParser.decodeUnknownParserResult(schema)

// console.log(decodeUnknownParserResult(good))
// console.log(v.safeParse(valibot, good))
// console.log(arktype(good))

bench
  .add("Schema", function() {
    decodeUnknownParserResult(good)
  })
  .add("Valibot", function() {
    v.safeParse(valibot, good)
  })
  .add("Arktype", function() {
    arktype(good)
  })

await bench.run()

console.table(bench.table())
