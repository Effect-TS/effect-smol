import * as Brand from "#dist/effect/data/Brand"
import * as Schema from "#dist/effect/schema/Schema"

type Positive = number & Brand.Brand<"Positive">
const Positive = Brand.check<Positive>(Schema.isGreaterThan(0))
