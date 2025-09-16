import { type } from "arktype"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '165.71 ± 0.20%' │ '167.00 ± 1.00'  │ '6413351 ± 0.01%'      │ '5988024 ± 36072'      │ 6034570  │
│ 1       │ 'Schema (bad)'   │ '584.57 ± 4.18%' │ '375.00 ± 41.00' │ '2696407 ± 0.02%'      │ '2666667 ± 268585'     │ 1710651  │
│ 2       │ 'Valibot (good)' │ '52.21 ± 1.37%'  │ '42.00 ± 0.00'   │ '21701941 ± 0.01%'     │ '23809524 ± 1'         │ 19154375 │
│ 3       │ 'Valibot (bad)'  │ '103.36 ± 0.98%' │ '84.00 ± 1.00'   │ '10707246 ± 0.01%'     │ '11904762 ± 143431'    │ 9675197  │
│ 4       │ 'Arktype (good)' │ '23.19 ± 0.22%'  │ '41.00 ± 1.00'   │ '32588344 ± 0.01%'     │ '24390244 ± 580720'    │ 43122672 │
│ 5       │ 'Arktype (bad)'  │ '1616.4 ± 3.40%' │ '1542.0 ± 41.00' │ '642377 ± 0.01%'       │ '648508 ± 16796'       │ 618656   │
│ 6       │ 'Zod (good)'     │ '44.02 ± 14.73%' │ '42.00 ± 0.00'   │ '23620090 ± 0.00%'     │ '23809524 ± 0'         │ 22715974 │
│ 7       │ 'Zod (bad)'      │ '4966.3 ± 0.89%' │ '4875.0 ± 83.00' │ '204335 ± 0.02%'       │ '205128 ± 3475'        │ 201358   │
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

const zod = z.object({
  a: z.string()
})

const good = { a: "a" }
const bad = { a: 1 }

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
