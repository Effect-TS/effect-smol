import { Result } from "effect/data"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'       │ '3703.6 ± 0.25%' │ '3500.0 ± 42.00' │ '280410 ± 0.04%'       │ '285714 ± 3470'        │ 270008   │
│ 1       │ 'direct get'    │ '23.46 ± 0.17%'  │ '41.00 ± 1.00'   │ '32241285 ± 0.01%'     │ '24390244 ± 580720'    │ 42617517 │
│ 2       │ 'Result get'    │ '95.51 ± 1.29%'  │ '83.00 ± 0.00'   │ '11789036 ± 0.01%'     │ '12048192 ± 1'         │ 10470212 │
│ 3       │ 'iso modify'    │ '22615 ± 1.23%'  │ '21125 ± 208.00' │ '46168 ± 0.11%'        │ '47337 ± 464'          │ 44220    │
│ 4       │ 'direct modify' │ '3373.8 ± 0.32%' │ '3166.0 ± 41.00' │ '309896 ± 0.04%'       │ '315856 ± 4144'        │ 296405   │
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

const userOptic = ToOptic.makeIso(User)
const streetOptic = userOptic.key("profile").key("address").key("street")
const modify = streetOptic.modify((street) => street + " Updated")

bench
  .add("iso get", function() {
    streetOptic.get(user)
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
