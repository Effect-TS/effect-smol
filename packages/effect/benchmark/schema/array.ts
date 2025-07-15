import { type } from "arktype"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '1152.3 ± 1.26%' │ '1084.0 ± 41.00' │ '898972 ± 0.01%'       │ '922509 ± 33620'       │ 867865   │
│ 1       │ 'Schema (bad)'   │ '1407.4 ± 1.89%' │ '1209.0 ± 41.00' │ '804654 ± 0.02%'       │ '827130 ± 27130'       │ 710506   │
│ 2       │ 'Valibot (good)' │ '44.90 ± 0.21%'  │ '42.00 ± 0.00'   │ '23376144 ± 0.00%'     │ '23809524 ± 1'         │ 22271474 │
│ 3       │ 'Valibot (bad)'  │ '66.77 ± 0.88%'  │ '83.00 ± 1.00'   │ '17080193 ± 0.02%'     │ '12048193 ± 143431'    │ 14976045 │
│ 4       │ 'Arktype (good)' │ '23.72 ± 0.91%'  │ '41.00 ± 1.00'   │ '32026789 ± 0.01%'     │ '24390244 ± 580720'    │ 42151064 │
│ 5       │ 'Arktype (bad)'  │ '1342.9 ± 0.34%' │ '1333.0 ± 41.00' │ '756216 ± 0.01%'       │ '750188 ± 22915'       │ 744665   │
│ 6       │ 'Zod (good)'     │ '43.57 ± 0.31%'  │ '42.00 ± 0.00'   │ '23797614 ± 0.00%'     │ '23809524 ± 0'         │ 22953099 │
│ 7       │ 'Zod (bad)'      │ '4781.5 ± 1.92%' │ '4500.0 ± 42.00' │ '220503 ± 0.02%'       │ '222222 ± 2094'        │ 209138   │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.Array(Schema.String)

const valibot = v.array(v.string())

const arktype = type("string[]")

const zod = z.array(z.string())

const good = ["a", "b"]
const bad = ["a", 1]

const decodeUnknownResult = ToParser.decodeUnknownResult(schema)

// console.log(decodeUnknownResult(good))
// console.log(decodeUnknownResult(bad))
// console.log(v.safeParse(valibot, good))
// console.log(v.safeParse(valibot, bad))
// console.log(arktype(good))
// console.log(arktype(bad))
// console.log(zod.safeParse(good))
// console.log(zod.safeParse(bad))

bench
  .add("Schema (good)", function() {
    decodeUnknownResult(good)
  })
  .add("Schema (bad)", function() {
    decodeUnknownResult(bad)
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
