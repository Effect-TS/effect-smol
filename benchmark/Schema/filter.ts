import { type } from "arktype"
import { Schema, SchemaParser } from "effect"
import { Bench } from "tinybench"
import * as v from "valibot"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '24.31 ± 0.03%'  │ '41.00 ± 1.00'   │ '31165074 ± 0.01%'     │ '24390244 ± 580720'    │ 41141245 │
│ 1       │ 'Valibot (good)' │ '49.34 ± 0.38%'  │ '42.00 ± 0.00'   │ '22346217 ± 0.01%'     │ '23809524 ± 0'         │ 20268749 │
│ 2       │ 'Arktype (good)' │ '22.86 ± 0.03%'  │ '41.00 ± 1.00'   │ '32927879 ± 0.01%'     │ '24390244 ± 580720'    │ 43749222 │
│ 3       │ 'Schema (bad)'   │ '34.28 ± 6.26%'  │ '41.00 ± 1.00'   │ '25402551 ± 0.00%'     │ '24390244 ± 580720'    │ 29172493 │
│ 4       │ 'Valibot (bad)'  │ '71.94 ± 3.52%'  │ '83.00 ± 1.00'   │ '16166080 ± 0.02%'     │ '12048194 ± 143432'    │ 13901431 │
│ 5       │ 'Arktype (bad)'  │ '1343.7 ± 2.13%' │ '1292.0 ± 1.00'  │ '763882 ± 0.01%'       │ '773994 ± 600'         │ 744241   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.nonEmpty)

const valibot = v.pipe(v.string(), v.nonEmpty())

const arktype = type("string > 0")

const good = "a"
const bad = ""

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
