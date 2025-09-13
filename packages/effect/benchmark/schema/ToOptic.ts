import { Result } from "effect/data"
import { Optic2 as Optic } from "effect/optic"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'       │ '717.61 ± 0.42%' │ '667.00 ± 1.00'  │ '1452320 ± 0.02%'      │ '1499250 ± 2251'       │ 1393523  │
│ 1       │ 'optic get'     │ '32.74 ± 0.06%'  │ '42.00 ± 1.00'   │ '25346624 ± 0.00%'     │ '23809524 ± 580720'    │ 30542023 │
│ 2       │ 'direct get'    │ '23.92 ± 2.33%'  │ '41.00 ± 1.00'   │ '32019650 ± 0.01%'     │ '24390244 ± 580720'    │ 41803450 │
│ 3       │ 'Result get'    │ '92.12 ± 3.54%'  │ '83.00 ± 0.00'   │ '12348092 ± 0.01%'     │ '12048193 ± 0'         │ 10855703 │
│ 4       │ 'iso modify'    │ '5897.6 ± 0.78%' │ '5667.0 ± 83.00' │ '174523 ± 0.03%'       │ '176460 ± 2547'        │ 169561   │
│ 5       │ 'direct modify' │ '3303.8 ± 0.27%' │ '3167.0 ± 42.00' │ '311384 ± 0.02%'       │ '315756 ± 4244'        │ 302684   │
└─────────┴─────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
*/

const bench = new Bench()

// Define a class with nested properties
class User extends Schema.Class<User>("User")({
  id: Schema.Number,
  profile: Schema.Struct({
    name: Schema.String,
    email: Schema.String,
    address: Schema.Struct({
      street: Schema.String,
      city: Schema.String,
      country: Schema.String
    })
  })
}) {}

// Create a user instance
const user = new User({
  id: 1,
  profile: {
    name: "John Doe",
    email: "john@example.com",
    address: {
      street: "123 Main St",
      city: "New York",
      country: "USA"
    }
  }
})

const streetOptic = ToOptic.makeIso(User).key("profile").key("address").key("street")
const streetOptic2 = Optic.id<typeof User["Type"]>().key("profile").key("address").key("street")
const modify = streetOptic.modify((street) => street + " Updated")

bench
  .add("iso get", function() {
    streetOptic.get(user)
  })
  .add("optic get", function() {
    streetOptic2.get(user)
  })
  .add("direct get", function() {
    // eslint-disable-next-line
    user.profile.address.street
  })
  .add("Result get", function() {
    Result.succeed(user).pipe(
      Result.flatMap((user) => Result.succeed(user.profile)),
      Result.flatMap((profile) => Result.succeed(profile.address)),
      Result.flatMap((address) => Result.succeed(address.street))
    )
  })
  .add("iso modify", function() {
    modify(user)
  })
  .add("direct modify", function() {
    new User({
      ...user,
      profile: {
        ...user.profile,
        address: {
          ...user.profile.address,
          street: user.profile.address.street + " Updated"
        }
      }
    })
  })

await bench.run()

console.table(bench.table())
