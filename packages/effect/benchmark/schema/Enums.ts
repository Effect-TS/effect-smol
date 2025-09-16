import { Schema, ToParser } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬───────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬─────────┐
│ (index) │ Task name │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples │
├─────────┼───────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼─────────┤
│ 0       │ 'valid'   │ '275.91 ± 0.29%' │ '250.00 ± 0.00'  │ '3830163 ± 0.01%'      │ '4000000 ± 0'          │ 3624358 │
│ 1       │ 'invalid' │ '424.56 ± 2.77%' │ '292.00 ± 1.00'  │ '3323879 ± 0.02%'      │ '3424658 ± 11769'      │ 2355371 │
└─────────┴───────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴─────────┘
*/

const bench = new Bench()

enum Enum {
  A = "a",
  B = "b"
}

const schema = Schema.Enums(Enum)

const valid = "b"
const invalid = "c"

const decodeUnknownResult = ToParser.decodeUnknownResult(schema)

// console.log(decodeUnknownResult(valid))
// console.log(decodeUnknownResult(invalid))

bench
  .add("valid", function() {
    decodeUnknownResult(valid)
  })
  .add("invalid", function() {
    decodeUnknownResult(invalid)
  })

await bench.run()

console.table(bench.table())
