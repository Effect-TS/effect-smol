import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '24.59 ± 0.07%'  │ '41.00 ± 1.00'   │ '30901736 ± 0.01%'     │ '24390244 ± 580720'    │ 40663377 │
│ 1       │ 'Valibot (good)' │ '59.49 ± 5.14%'  │ '42.00 ± 0.00'   │ '23097426 ± 0.01%'     │ '23809524 ± 0'         │ 16810408 │
│ 2       │ 'Schema (bad)'   │ '29.12 ± 1.75%'  │ '41.00 ± 1.00'   │ '27525758 ± 0.01%'     │ '24390244 ± 580720'    │ 34336095 │
│ 3       │ 'Valibot (bad)'  │ '66.73 ± 0.15%'  │ '83.00 ± 1.00'   │ '17053766 ± 0.02%'     │ '12048193 ± 143431'    │ 14985794 │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.nonEmpty)

const valibot = v.pipe(v.string(), v.nonEmpty())

const good = "a"
const bad = ""

const decodeUnknownParserResult = SchemaParser.decodeUnknownParserResult(schema)

// console.log(decodeUnknownParserResult(good))
// console.log(v.safeParse(valibot, good))
// console.log(decodeUnknownParserResult(bad))
// console.log(v.safeParse(valibot, bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownParserResult(good)
  })
  .add("Valibot (good)", function() {
    v.safeParse(valibot, good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownParserResult(bad)
  })
  .add("Valibot (bad)", function() {
    v.safeParse(valibot, bad)
  })

await bench.run()

console.table(bench.table())
