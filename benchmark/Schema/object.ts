/* eslint-disable no-console */
import { type } from "arktype"
import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '42.13 ± 2.09%'  │ '42.00 ± 0.00'   │ '23862207 ± 0.00%'     │ '23809524 ± 1'         │ 23734061 │
│ 1       │ 'Schema (bad)'   │ '46.71 ± 0.69%'  │ '42.00 ± 0.00'   │ '23536679 ± 0.00%'     │ '23809524 ± 0'         │ 21409776 │
│ 2       │ 'Valibot (good)' │ '50.91 ± 0.55%'  │ '42.00 ± 0.00'   │ '21813682 ± 0.01%'     │ '23809524 ± 2'         │ 19642295 │
│ 3       │ 'Valibot (bad)'  │ '102.79 ± 0.60%' │ '84.00 ± 1.00'   │ '10607006 ± 0.01%'     │ '11904762 ± 143431'    │ 9728958  │
│ 4       │ 'Arktype (good)' │ '23.27 ± 1.45%'  │ '41.00 ± 1.00'   │ '32480608 ± 0.01%'     │ '24390244 ± 580720'    │ 42965089 │
│ 5       │ 'Arktype (bad)'  │ '1646.8 ± 2.34%' │ '1584.0 ± 41.00' │ '621300 ± 0.01%'       │ '631313 ± 15929'       │ 607244   │
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
