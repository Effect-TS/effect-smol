import { type } from "arktype"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '363.46 ± 0.06%' │ '334.00 ± 1.00'  │ '2811096 ± 0.01%'      │ '2994012 ± 8991'       │ 2751368  │
│ 1       │ 'Schema (bad)'   │ '800.00 ± 3.40%' │ '542.00 ± 41.00' │ '1765659 ± 0.02%'      │ '1845018 ± 129753'     │ 1250004  │
│ 2       │ 'Valibot (good)' │ '64.35 ± 1.45%'  │ '42.00 ± 1.00'   │ '18953391 ± 0.02%'     │ '23809524 ± 580720'    │ 15540377 │
│ 3       │ 'Valibot (bad)'  │ '131.46 ± 1.19%' │ '125.00 ± 0.00'  │ '7935263 ± 0.01%'      │ '8000000 ± 0'          │ 7606777  │
│ 4       │ 'Arktype (good)' │ '24.38 ± 0.10%'  │ '41.00 ± 1.00'   │ '31135215 ± 0.01%'     │ '24390244 ± 580720'    │ 41012434 │
│ 5       │ 'Arktype (bad)'  │ '1788.8 ± 0.54%' │ '1750.0 ± 41.00' │ '570277 ± 0.01%'       │ '571429 ± 13393'       │ 559035   │
│ 6       │ 'Zod (good)'     │ '51.21 ± 3.25%'  │ '42.00 ± 0.00'   │ '22036576 ± 0.01%'     │ '23809524 ± 0'         │ 19526125 │
│ 7       │ 'Zod (bad)'      │ '5142.4 ± 3.63%' │ '4875.0 ± 83.00' │ '202888 ± 0.03%'       │ '205128 ± 3434'        │ 194464   │
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
