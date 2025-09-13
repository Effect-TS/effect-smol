import { Result } from "effect/data"
import { Optic2 as Optic } from "effect/optic"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬─────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name       │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼─────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'       │ '3670.7 ± 0.26%' │ '3458.0 ± 42.00' │ '283173 ± 0.04%'       │ '289184 ± 3470'        │ 272431   │
│ 1       │ 'optic get'     │ '33.23 ± 0.25%'  │ '42.00 ± 1.00'   │ '25114284 ± 0.00%'     │ '23809524 ± 580720'    │ 30091933 │
│ 2       │ 'direct get'    │ '23.34 ± 0.09%'  │ '41.00 ± 1.00'   │ '32336253 ± 0.01%'     │ '24390244 ± 580720'    │ 42845570 │
│ 3       │ 'Result get'    │ '97.02 ± 4.07%'  │ '83.00 ± 0.00'   │ '11928772 ± 0.01%'     │ '12048193 ± 0'         │ 10306960 │
│ 4       │ 'iso modify'    │ '14876 ± 0.84%'  │ '14084 ± 208.00' │ '69786 ± 0.07%'        │ '71003 ± 1033'         │ 67223    │
│ 5       │ 'direct modify' │ '3352.0 ± 0.32%' │ '3167.0 ± 42.00' │ '309763 ± 0.03%'       │ '315756 ± 4244'        │ 298333   │
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
