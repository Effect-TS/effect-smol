import * as Optic from "#dist/effect/optic/Optic"

type S = { readonly a: number }
const optic = Optic.id<S>().key("a")

optic.getOptic({ a: 1 })
