import { type } from "arktype"
import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '41.25 ± 1.94%'  │ '42.00 ± 0.00'   │ '23832102 ± 0.00%'     │ '23809524 ± 1'         │ 24240733 │
│ 1       │ 'Valibot (good)' │ '50.33 ± 0.31%'  │ '42.00 ± 0.00'   │ '21978191 ± 0.01%'     │ '23809524 ± 1'         │ 19868540 │
│ 2       │ 'Arktype (good)' │ '23.20 ± 1.57%'  │ '41.00 ± 1.00'   │ '32602235 ± 0.01%'     │ '24390244 ± 580720'    │ 43094226 │
│ 3       │ 'Schema (bad)'   │ '46.32 ± 2.23%'  │ '42.00 ± 0.00'   │ '23604555 ± 0.00%'     │ '23809524 ± 0'         │ 21589575 │
│ 4       │ 'Valibot (bad)'  │ '102.92 ± 0.33%' │ '84.00 ± 1.00'   │ '10594850 ± 0.01%'     │ '11904762 ± 143431'    │ 9715966  │
│ 5       │ 'Arktype (bad)'  │ '1806.4 ± 1.54%' │ '1625.0 ± 42.00' │ '603504 ± 0.02%'       │ '615385 ± 15505'       │ 553599   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Struct({
  a: Schema.String
})

const valibot = v.object({
  a: v.string()
})

const arktype = type({
  a: "string"
})

const good = { a: "a" }
const bad = { a: 1 }

const decodeUnknownParserResult = SchemaParser.decodeUnknownParserResult(schema)

// console.log(decodeUnknownParserResult(good))
// console.log(v.safeParse(valibot, good))
// console.log(decodeUnknownParserResult(bad))
// console.log(v.safeParse(valibot, bad))
// console.log(arktype(good))
// console.log(arktype(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownParserResult(good)
  })
  .add("Valibot (good)", function() {
    v.safeParse(valibot, good)
  })
  .add("Arktype (good)", function() {
    arktype(good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownParserResult(bad)
  })
  .add("Valibot (bad)", function() {
    v.safeParse(valibot, bad)
  })
  .add("Arktype (bad)", function() {
    arktype(bad)
  })

await bench.run()

console.table(bench.table())
