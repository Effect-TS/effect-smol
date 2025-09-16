import { type } from "arktype"
import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema (good)'  │ '299.00 ± 0.24%' │ '292.00 ± 0.00'  │ '3430060 ± 0.01%'      │ '3424658 ± 0'          │ 3344434  │
│ 1       │ 'Schema (bad)'   │ '957.49 ± 5.67%' │ '500.00 ± 41.00' │ '1913611 ± 0.03%'      │ '2000000 ± 154982'     │ 1045401  │
│ 2       │ 'Valibot (good)' │ '53.67 ± 1.80%'  │ '42.00 ± 0.00'   │ '21460659 ± 0.01%'     │ '23809524 ± 1'         │ 18631259 │
│ 3       │ 'Valibot (bad)'  │ '105.56 ± 2.25%' │ '84.00 ± 1.00'   │ '10616905 ± 0.01%'     │ '11904762 ± 143431'    │ 9472864  │
│ 4       │ 'Arktype (good)' │ '24.96 ± 3.03%'  │ '41.00 ± 1.00'   │ '31023188 ± 0.01%'     │ '24390244 ± 580720'    │ 40068849 │
│ 5       │ 'Arktype (bad)'  │ '1616.3 ± 0.53%' │ '1542.0 ± 41.00' │ '638385 ± 0.02%'       │ '648508 ± 16796'       │ 618690   │
│ 6       │ 'Zod (good)'     │ '40.93 ± 3.62%'  │ '42.00 ± 0.00'   │ '23868179 ± 0.00%'     │ '23809524 ± 0'         │ 24433811 │
│ 7       │ 'Zod (bad)'      │ '5108.4 ± 1.98%' │ '4875.0 ± 83.00' │ '203278 ± 0.03%'       │ '205128 ± 3475'        │ 195758   │
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
