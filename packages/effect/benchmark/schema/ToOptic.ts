import { Result } from "effect/data"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'       │ '3944.1 ± 2.78%' │ '3500.0 ± 42.00' │ '279457 ± 0.04%'       │ '285714 ± 3470'        │ 253542   │
│ 1       │ 'direct get'    │ '23.13 ± 0.05%'  │ '41.00 ± 1.00'   │ '32607494 ± 0.01%'     │ '24390244 ± 580721'    │ 43239548 │
│ 2       │ 'Result get'    │ '95.95 ± 3.87%'  │ '83.00 ± 0.00'   │ '11957354 ± 0.01%'     │ '12048192 ± 1'         │ 10422146 │
│ 3       │ 'iso modify'    │ '23642 ± 2.08%'  │ '22417 ± 250.00' │ '43941 ± 0.08%'        │ '44609 ± 503'          │ 42298    │
│ 4       │ 'direct modify' │ '3324.7 ± 0.27%' │ '3167.0 ± 42.00' │ '309689 ± 0.02%'       │ '315756 ± 4244'        │ 300780   │
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
