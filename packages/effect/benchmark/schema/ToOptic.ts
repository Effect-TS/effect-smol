import { Optic } from "effect/optic"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'        │ '678.89 ± 0.67%' │ '667.00 ± 1.00'  │ '1506021 ± 0.01%'      │ '1499250 ± 2251'       │ 1472998  │
│ 1       │ 'optic get'      │ '33.07 ± 0.04%'  │ '42.00 ± 0.00'   │ '25288617 ± 0.00%'     │ '23809524 ± 1'         │ 30242260 │
│ 2       │ 'direct get'     │ '22.87 ± 0.04%'  │ '41.00 ± 1.00'   │ '32921874 ± 0.01%'     │ '24390244 ± 580720'    │ 43729228 │
│ 3       │ 'iso replace'    │ '5278.8 ± 3.68%' │ '4958.0 ± 83.00' │ '200082 ± 0.03%'       │ '201694 ± 3360'        │ 189438   │
│ 4       │ 'direct replace' │ '3320.8 ± 0.37%' │ '3166.0 ± 41.00' │ '312689 ± 0.02%'       │ '315856 ± 4144'        │ 301129   │
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
