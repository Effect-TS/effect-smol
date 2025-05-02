import * as z from "@zod/mini"

const Category = z.interface({
  name: z.string(),
  get subcategories() {
    return z.array(Category)
  }
})

type Category = z.infer<typeof Category>
// { name: string; subcategories: Category[] }
