/* eslint-disable no-console */
import { type } from "arktype"
import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '47.04 ± 1.52%'  │ '42.00 ± 0.00'   │ '22722722 ± 0.01%'     │ '23809524 ± 1'         │ 21258493 │
│ 1       │ 'Schema (bad)'   │ '53.10 ± 0.68%'  │ '42.00 ± 0.00'   │ '21750641 ± 0.01%'     │ '23809524 ± 1'         │ 18831301 │
│ 2       │ 'Valibot (good)' │ '50.66 ± 0.39%'  │ '42.00 ± 0.00'   │ '21878436 ± 0.01%'     │ '23809524 ± 0'         │ 19740238 │
│ 3       │ 'Valibot (bad)'  │ '100.80 ± 0.53%' │ '84.00 ± 1.00'   │ '10806230 ± 0.01%'     │ '11904762 ± 143431'    │ 9921326  │
│ 4       │ 'Arktype (good)' │ '22.80 ± 0.03%'  │ '41.00 ± 1.00'   │ '33011511 ± 0.01%'     │ '24390244 ± 580720'    │ 43855201 │
│ 5       │ 'Arktype (bad)'  │ '1618.4 ± 2.36%' │ '1583.0 ± 41.00' │ '630811 ± 0.01%'       │ '631712 ± 16327'       │ 617884   │
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
// console.log(decodeUnknownParserResult(bad))
// console.log(v.safeParse(valibot, good))
// console.log(v.safeParse(valibot, bad))
// console.log(arktype(good))
// console.log(arktype(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownParserResult(good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownParserResult(bad)
  })
  .add("Valibot (good)", function() {
    v.safeParse(valibot, good)
  })
  .add("Valibot (bad)", function() {
    v.safeParse(valibot, bad)
  })
  .add("Arktype (good)", function() {
    arktype(good)
  })
  .add("Arktype (bad)", function() {
    arktype(bad)
  })

await bench.run()

console.table(bench.table())
