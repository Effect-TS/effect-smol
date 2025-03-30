import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '40.31 ± 0.98%'  │ '42.00 ± 0.00'   │ '23934970 ± 0.00%'     │ '23809524 ± 0'         │ 24804798 │
│ 1       │ 'Valibot (good)' │ '51.75 ± 0.26%'  │ '42.00 ± 0.00'   │ '21543573 ± 0.01%'     │ '23809524 ± 1'         │ 19323704 │
│ 2       │ 'Schema (bad)'   │ '46.24 ± 0.42%'  │ '42.00 ± 0.00'   │ '23607441 ± 0.00%'     │ '23809524 ± 0'         │ 21627936 │
│ 3       │ 'Valibot (bad)'  │ '104.19 ± 3.11%' │ '84.00 ± 1.00'   │ '10582573 ± 0.01%'     │ '11904762 ± 143431'    │ 9598229  │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Struct({
  a: Schema.String
})

const valibot = v.object({
  a: v.string()
})

const good = { a: "a" }
const bad = { a: 1 }

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
