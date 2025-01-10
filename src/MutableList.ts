/**
 * @since 4.0.0
 */

/**
 * @since 4.0.0
 * @category models
 */
export interface MutableList<A> {
  head: MutableList.Bucket<A> | undefined
  tail: MutableList.Bucket<A> | undefined
  length: number
}

/**
 * @since 4.0.0
 * @category models
 */
export declare namespace MutableList {
  /**
   * @since 4.0.0
   * @category models
   */
  export interface Bucket<A> {
    readonly array: Array<A>
    mutable: boolean
    offset: number
    length: number
    next: Bucket<A> | undefined
  }
}

/**
 * @since 4.0.0
 * @category constructors
 */
export const make = <A>(): MutableList<A> => ({
  head: undefined,
  tail: undefined,
  length: 0
})

const emptyBucket = (): MutableList.Bucket<never> => ({
  array: [],
  mutable: true,
  offset: 0,
  length: 0,
  next: undefined
})

/**
 * @since 4.0.0
 * @category appending
 */
export const append = <A>(self: MutableList<A>, message: A) => {
  if (!self.tail) {
    self.head = self.tail = emptyBucket()
  } else if (!self.tail.mutable) {
    self.tail.next = emptyBucket()
    self.tail = self.tail.next
  }
  self.tail!.array.push(message)
  self.tail!.length++
  self.length++
}

/**
 * @since 4.0.0
 * @category appending
 */
export const appendAll = <A>(self: MutableList<A>, messages: Iterable<A>) => {
  const array = Array.isArray(messages) ? messages : Array.from(messages)
  const chunk: MutableList.Bucket<A> = {
    array,
    mutable: !Array.isArray(messages),
    offset: 0,
    length: array.length,
    next: undefined
  }
  if (self.head) {
    self.tail = self.tail!.next = chunk
  } else {
    self.head = self.tail = chunk
  }
  self.length += array.length
  return array.length
}

/**
 * @since 4.0.0
 * @category taking
 */
export const clear = <A>(self: MutableList<A>) => {
  self.head = self.tail = undefined
  self.length = 0
}

/**
 * @since 4.0.0
 * @category taking
 */
export const takeN = <A>(self: MutableList<A>, n: number) => {
  n = Math.min(n, self.length)
  if (n === self.length && self.head && self.head === self.tail && self.head.offset === 0) {
    const array = self.head.array
    clear(self)
    return array
  }
  const array = new Array<A>(n)
  let index = 0
  let chunk: MutableList.Bucket<A> | undefined = self.head
  while (chunk) {
    while (chunk.offset < chunk.length) {
      array[index++] = chunk.array[chunk.offset]
      if (chunk.mutable) chunk.array[chunk.offset] = undefined as any
      chunk.offset++
      if (index === n) {
        self.length -= n
        if (self.length === 0) clear(self)
        return array
      }
    }
    chunk = chunk.next
  }
  clear(self)
  return array
}

/**
 * @since 4.0.0
 * @category taking
 */
export const takeAll = <A>(self: MutableList<A>) => takeN(self, self.length)

/**
 * @since 4.0.0
 * @category taking
 */
export const take = <A>(self: MutableList<A>) => {
  if (!self.head) return undefined
  const message = self.head.array[self.head.offset]
  if (self.head.mutable) self.head.array[self.head.offset] = undefined as any
  self.head.offset++
  self.length--
  if (self.head.offset === self.head.length) {
    if (self.head.next) {
      self.head = self.head.next
    } else {
      clear(self)
    }
  }
  return message
}
