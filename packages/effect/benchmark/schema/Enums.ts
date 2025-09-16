import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'valid'   │ '75.06 ± 0.79%'  │ '83.00 ± 1.00'   │ '14894430 ± 0.02%'     │ '12048193 ± 143431'    │ 13323362 │
│ 1       │ 'invalid' │ '229.27 ± 4.05%' │ '166.00 ± 41.00' │ '6660351 ± 0.02%'      │ '6024096 ± 1216404'    │ 4361644  │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

enum Enum {
  A = "a",
  B = "b"
}

const schema = Schema.Enums(Enum)

const valid = "b"
const invalid = "c"

const decodeUnknownExit = ToParser.decodeUnknownExit(schema)

// console.log(decodeUnknownExit(valid))
// console.log(decodeUnknownExit(invalid))

bench
  .add("valid", function() {
    decodeUnknownExit(valid)
  })
  .add("invalid", function() {
    decodeUnknownExit(invalid)
  })

await bench.run()

console.table(bench.table())
