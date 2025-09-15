import { Optic } from "effect/optic"
import { Schema, ToOptic } from "effect/schema"
import { Bench } from "tinybench"

/*
┌─────────┬──────────────────┬──────────────────┬──────────────────┬────────────────────────┬────────────────────────┬──────────┐
│ (index) │ Task name        │ Latency avg (ns) │ Latency med (ns) │ Throughput avg (ops/s) │ Throughput med (ops/s) │ Samples  │
├─────────┼──────────────────┼──────────────────┼──────────────────┼────────────────────────┼────────────────────────┼──────────┤
│ 0       │ 'iso get'        │ '45.15 ± 0.26%'  │ '42.00 ± 0.00'   │ '23173765 ± 0.01%'     │ '23809524 ± 1'         │ 22149826 │
│ 1       │ 'optic get'      │ '32.73 ± 0.04%'  │ '42.00 ± 0.00'   │ '25377799 ± 0.00%'     │ '23809524 ± 2'         │ 30552665 │
│ 2       │ 'direct get'     │ '23.27 ± 0.12%'  │ '41.00 ± 1.00'   │ '32433269 ± 0.01%'     │ '24390244 ± 580720'    │ 42974308 │
│ 3       │ 'iso replace'    │ '4573.0 ± 2.62%' │ '4291.0 ± 43.00' │ '229014 ± 0.04%'       │ '233046 ± 2312'        │ 218675   │
│ 4       │ 'direct replace' │ '3352.4 ± 0.32%' │ '3166.0 ± 41.00' │ '310849 ± 0.03%'       │ '315856 ± 4144'        │ 298292   │
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
