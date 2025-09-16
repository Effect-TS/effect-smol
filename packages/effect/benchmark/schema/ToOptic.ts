import { Optic } from "effect/optic"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'        │ '908.61 ± 0.98%' │ '875.00 ± 0.00'  │ '1143927 ± 0.02%'      │ '1142857 ± 0'          │ 1100585  │
│ 1       │ 'optic get'      │ '31.94 ± 0.04%'  │ '42.00 ± 1.00'   │ '25696566 ± 0.00%'     │ '23809524 ± 580720'    │ 31306864 │
│ 2       │ 'direct get'     │ '22.89 ± 0.05%'  │ '41.00 ± 1.00'   │ '32922486 ± 0.01%'     │ '24390244 ± 580720'    │ 43692053 │
│ 3       │ 'iso replace'    │ '2713.1 ± 2.76%' │ '2500.0 ± 41.00' │ '392614 ± 0.03%'       │ '400000 ± 6609'        │ 368589   │
│ 4       │ 'direct replace' │ '871.77 ± 1.83%' │ '792.00 ± 1.00'  │ '1219388 ± 0.02%'      │ '1262626 ± 1596'       │ 1147087  │
└─────────┴──────────────────┴──────────────────┴──────────────────┴────────────────────────┴────────────────────────┴──────────┘
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
const user = User.makeSync({
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

const iso = ToOptic.makeIso(User).key("profile").key("address").key("street")
const optic = Optic.id<typeof User["Type"]>().key("profile").key("address").key("street")

bench
  .add("iso get", function() {
    iso.get(user)
  })
  .add("optic get", function() {
    optic.get(user)
  })
  .add("direct get", function() {
    // eslint-disable-next-line
    user.profile.address.street
  })
  .add("iso replace", function() {
    iso.replace("Updated", user)
  })
  .add("direct replace", function() {
    new User({
      ...user,
      profile: {
        ...user.profile,
        address: {
          ...user.profile.address,
          street: "Updated"
        }
      }
    })
  })

await bench.run()

console.table(bench.table())
