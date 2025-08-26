import * as Brand from "#dist/effect/data/Brand"
import * as Check from "#dist/effect/schema/Check"

type Positive = number & Brand.Brand<"Positive">
const Positive = Brand.check<Positive>(Check.positive())
