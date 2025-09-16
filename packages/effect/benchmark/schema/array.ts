import { type } from "arktype"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '198.70 ± 0.30%' │ '167.00 ± 1.00'  │ '5372974 ± 0.01%'      │ '5988024 ± 36072'      │ 5032620  │
│ 1       │ 'Schema (bad)'   │ '661.88 ± 5.60%' │ '417.00 ± 42.00' │ '2414210 ± 0.02%'      │ '2398082 ± 219432'     │ 1522019  │
│ 2       │ 'Valibot (good)' │ '62.78 ± 1.65%'  │ '42.00 ± 1.00'   │ '19431204 ± 0.02%'     │ '23809524 ± 580720'    │ 15927982 │
│ 3       │ 'Valibot (bad)'  │ '126.41 ± 0.49%' │ '125.00 ± 0.00'  │ '8400286 ± 0.01%'      │ '8000000 ± 0'          │ 7910760  │
│ 4       │ 'Arktype (good)' │ '24.44 ± 0.21%'  │ '41.00 ± 1.00'   │ '31076164 ± 0.01%'     │ '24390244 ± 580720'    │ 40911754 │
│ 5       │ 'Arktype (bad)'  │ '1830.2 ± 0.42%' │ '1750.0 ± 41.00' │ '562878 ± 0.01%'       │ '571429 ± 13081'       │ 546384   │
│ 6       │ 'Zod (good)'     │ '53.70 ± 5.41%'  │ '42.00 ± 0.00'   │ '22422041 ± 0.01%'     │ '23809524 ± 0'         │ 18623554 │
│ 7       │ 'Zod (bad)'      │ '5079.7 ± 2.11%' │ '4917.0 ± 83.00' │ '202030 ± 0.02%'       │ '203376 ± 3376'        │ 196861   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Array(Schema.String)

const valibot = v.array(v.string())

const arktype = type("string[]")

const zod = z.array(z.string())

const good = ["a", "b"]
const bad = ["a", 1]

const decodeUnknownExit = ToParser.decodeUnknownExit(schema)

// console.log(decodeUnknownExit(good))
// console.log(decodeUnknownExit(bad))
// console.log(v.safeParse(valibot, good))
// console.log(v.safeParse(valibot, bad))
// console.log(arktype(good))
// console.log(arktype(bad))
// console.log(zod.safeParse(good))
// console.log(zod.safeParse(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownExit(good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownExit(bad)
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
  .add("Zod (good)", function() {
    zod.safeParse(good)
  })
  .add("Zod (bad)", function() {
    zod.safeParse(bad)
  })

await bench.run()

console.table(bench.table())
