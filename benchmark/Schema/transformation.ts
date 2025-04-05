import { type } from "arktype"
import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'  │ '37.82 ± 2.02%'  │ '42.00 ± 0.00'   │ '24188850 ± 0.00%'     │ '23809524 ± 1'         │ 26442607 │
│ 1       │ 'Valibot' │ '54.91 ± 1.71%'  │ '42.00 ± 0.00'   │ '21278373 ± 0.01%'     │ '23809524 ± 1'         │ 18212279 │
│ 2       │ 'Arktype' │ '25.55 ± 0.04%'  │ '41.00 ± 1.00'   │ '29884094 ± 0.01%'     │ '24390244 ± 580720'    │ 39131923 │
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
