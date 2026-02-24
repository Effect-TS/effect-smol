/**
 * @title ServiceMap.Service
 *
 * How to define and use a service using `ServiceMap.Service` in Effect.
 */

import { Effect, ServiceMap } from "effect"

export class Test extends ServiceMap.Service<Test>()("myapp/namespace/Test", {
  make: Effect.gen(function*() {
    return {}
  })
}) {}
