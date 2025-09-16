import { Optic } from "effect/optic"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'        │ '3637.5 ± 0.26%' │ '3458.0 ± 42.00' │ '285021 ± 0.03%'       │ '289184 ± 3470'        │ 274914   │
│ 1       │ 'optic get'      │ '32.33 ± 0.07%'  │ '42.00 ± 1.00'   │ '25522045 ± 0.00%'     │ '23809524 ± 580720'    │ 30926611 │
│ 2       │ 'direct get'     │ '23.28 ± 0.15%'  │ '41.00 ± 1.00'   │ '32424445 ± 0.01%'     │ '24390244 ± 580720'    │ 42946861 │
│ 3       │ 'iso replace'    │ '11313 ± 4.84%'  │ '10458 ± 125.00' │ '94161 ± 0.06%'        │ '95621 ± 1138'         │ 88398    │
│ 4       │ 'direct replace' │ '3353.7 ± 0.34%' │ '3125.0 ± 42.00' │ '312302 ± 0.03%'       │ '320000 ± 4244'        │ 298180   │
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
