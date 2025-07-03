import { type } from "arktype"
import { Schema, ToParser, Transformation } from "effect/schema"
import { Bench } from "tinybench"
import * as v from "valibot"
import { z } from "zod/v4-mini"

/*
┌─────────┬──────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name    │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'Schema'     │ '1055.8 ± 0.22%' │ '1041.0 ± 41.00' │ '970518 ± 0.01%'       │ '960615 ± 39385'       │ 947156   │
│ 1       │ 'Valibot'    │ '53.08 ± 0.19%'  │ '42.00 ± 0.00'   │ '21045910 ± 0.01%'     │ '23809524 ± 1'         │ 18840671 │
│ 2       │ 'Arktype'    │ '25.61 ± 0.55%'  │ '41.00 ± 1.00'   │ '29891384 ± 0.01%'     │ '24390244 ± 580720'    │ 39040049 │
│ 3       │ 'Zod (good)' │ '45.61 ± 3.89%'  │ '42.00 ± 0.00'   │ '23807934 ± 0.00%'     │ '23809524 ± 0'         │ 22307594 │
└─────────┴──────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

const schema = Schema.String.pipe(Schema.decodeTo(Schema.String, Transformation.trim()))

const valibot = v.pipe(v.string(), v.trim())

const arktype = type("string").pipe((str) => str.trim())

const zod = z.string().check(z.trim())

const good = " a "

const decodeUnknownParserResult = ToParser.decodeUnknownResult(schema)

// console.log(decodeUnknownParserResult(good))
// console.log(v.safeParse(valibot, good))
// console.log(arktype(good))
// console.log(zod.safeParse(good))

bench
  .add("Schema", function() {
    decodeUnknownParserResult(good)
  })
  .add("Valibot", function() {
    v.safeParse(valibot, good)
  })
  .add("Arktype", function() {
    arktype(good)
  })
  .add("Zod (good)", function() {
    zod.safeParse(good)
  })

await bench.run()

console.table(bench.table())
