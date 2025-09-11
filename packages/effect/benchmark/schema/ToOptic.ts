import { Result } from "effect/data"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'       │ '3850.8 ± 0.27%' │ '3542.0 ± 42.00' │ '273616 ± 0.05%'       │ '282326 ± 3388'        │ 259684   │
│ 1       │ 'direct get'    │ '23.33 ± 0.05%'  │ '41.00 ± 1.00'   │ '32350392 ± 0.01%'     │ '24390244 ± 580720'    │ 42856477 │
│ 2       │ 'Result get'    │ '91.92 ± 0.48%'  │ '83.00 ± 0.00'   │ '12032115 ± 0.01%'     │ '12048192 ± 1'         │ 10879099 │
│ 3       │ 'iso modify'    │ '22287 ± 1.43%'  │ '21333 ± 209.00' │ '46334 ± 0.07%'        │ '46876 ± 462'          │ 44870    │
│ 4       │ 'direct modify' │ '3317.4 ± 0.33%' │ '3167.0 ± 42.00' │ '310860 ± 0.02%'       │ '315756 ± 4244'        │ 301439   │
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
