// poc.ts

// 1) Our schema interface, parameterized on the output type T
type Schema<T> = {
  parse(input: unknown): T
}

// 2) A helper type to extract T from Schema<T>
type Infer<S> = S extends Schema<infer T> ? T : never

// 3) A simple string schema
function string(): Schema<string> {
  return {
    parse(input) {
      if (typeof input !== "string") {
        throw new Error(`Expected string, got ${typeof input}`)
      }
      return input
    }
  }
}

// 4) A schema for arrays of some other schema
function array<S extends Schema<any>>(item: S): Schema<Array<Infer<S>>> {
  return {
    parse(input) {
      if (!Array.isArray(input)) {
        throw new Error(`Expected array, got ${typeof input}`)
      }
      return input.map((i) => item.parse(i)) as Array<Infer<S>>
    }
  }
}

type Identity<T> = T

// 5) A schema for plain objects with known keys
// function object<P extends Record<string, Schema<any>>>(
//   props: P
// ): Schema<Identity<{ [K in keyof P]: Infer<P[K]> }>> {
//   return {
//     parse(input) {
//       if (input === null || typeof input !== "object") {
//         throw new Error(`Expected object, got ${typeof input}`)
//       }
//       const out: any = {}
//       for (const key in props) {
//         out[key] = props[key].parse((input as any)[key])
//       }
//       return out as { [K in keyof P]: Infer<P[K]> }
//     }
//   }
// }

function object<P extends Record<string, Schema<any>>>(
  props: P
): Schema<string> {
  return {
    parse(input) {
      if (input === null || typeof input !== "object") {
        throw new Error(`Expected object, got ${typeof input}`)
      }
      const out: any = {}
      for (const key in props) {
        out[key] = props[key].parse((input as any)[key])
      }
      return out as { [K in keyof P]: Infer<P[K]> }
    }
  }
}

const Category = object({
  name: string(),
  get subcategories() {
    return array(Category)
  }
})
