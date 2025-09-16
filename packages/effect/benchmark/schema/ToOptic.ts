import { Optic } from "effect/optic"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'        │ '1727.5 ± 0.97%' │ '1667.0 ± 1.00'  │ '593694 ± 0.01%'       │ '599880 ± 360'         │ 578881   │
│ 1       │ 'optic get'      │ '33.53 ± 0.06%'  │ '42.00 ± 0.00'   │ '25142527 ± 0.00%'     │ '23809524 ± 1'         │ 29820854 │
│ 2       │ 'direct get'     │ '24.33 ± 1.76%'  │ '41.00 ± 1.00'   │ '31592181 ± 0.01%'     │ '24390244 ± 580720'    │ 41106513 │
│ 3       │ 'iso replace'    │ '5430.1 ± 2.43%' │ '5000.0 ± 83.00' │ '196244 ± 0.05%'       │ '200000 ± 3376'        │ 184158   │
│ 4       │ 'direct replace' │ '1694.0 ± 0.47%' │ '1584.0 ± 41.00' │ '615118 ± 0.02%'       │ '631313 ± 15929'       │ 590322   │
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
