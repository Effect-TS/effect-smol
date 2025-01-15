/**
 * @since 4.0.0
 */

/**
 * @since 4.0.0
 * @category models
 */
export interface MutableList<in out A> {
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
    next: Bucket<A> | undefined
  }
}

/**
 * @since 4.0.0
 * @category Symbols
 */
export const Empty: unique symbol = Symbol.for("effect/MutableList/Empty")

/**
 * @since 4.0.0
 * @category Symbols
 */
export type Empty = typeof Empty

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
  next: undefined
})

/**
 * @since 4.0.0
 * @category appending
 */
export const append = <A>(self: MutableList<A>, message: A): void => {
  if (!self.tail) {
    self.head = self.tail = emptyBucket()
  } else if (!self.tail.mutable) {
    self.tail.next = emptyBucket()
    self.tail = self.tail.next
  }
  self.tail!.array.push(message)
  self.length++
}

/**
 * @since 4.0.0
 * @category appending
 */
export const prepend = <A>(self: MutableList<A>, message: A): void => {
  self.head = {
    array: [message],
    mutable: true,
    offset: 0,
    next: self.head
  }
  self.length++
}

/**
 * @since 4.0.0
 * @category appending
 */
export const prependAll = <A>(self: MutableList<A>, messages: Iterable<A>): void => {
  self.head = {
    array: Array.isArray(messages) ? messages : Array.from(messages),
    mutable: !Array.isArray(messages),
    offset: 0,
    next: self.head
  }
  self.length += self.head.array.length
}

/**
 * @since 4.0.0
 * @category appending
 */
export const appendAll = <A>(self: MutableList<A>, messages: Iterable<A>): number => {
  const array = Array.isArray(messages) ? messages : Array.from(messages)
  const chunk: MutableList.Bucket<A> = {
    array,
    mutable: !Array.isArray(messages),
    offset: 0,
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
export const clear = <A>(self: MutableList<A>): void => {
  self.head = self.tail = undefined
  self.length = 0
}

/**
 * @since 4.0.0
 * @category taking
 */
export const takeN = <A>(self: MutableList<A>, n: number): Array<A> => {
  n = Math.min(n, self.length)
  if (n === self.length && self.head?.offset === 0 && !self.head.next) {
    const array = self.head.array
    clear(self)
    return array
  }
  const array = new Array<A>(n)
  let index = 0
  let chunk: MutableList.Bucket<A> | undefined = self.head
  while (chunk) {
    while (chunk.offset < chunk.array.length) {
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
export const takeAll = <A>(self: MutableList<A>): Array<A> => takeN(self, self.length)

/**
 * @since 4.0.0
 * @category taking
 */
export const take = <A>(self: MutableList<A>): Empty | A => {
  if (!self.head) return Empty
  const message = self.head.array[self.head.offset]
  if (self.head.mutable) self.head.array[self.head.offset] = undefined as any
  self.head.offset++
  self.length--
  if (self.head.offset === self.head.array.length) {
    if (self.head.next) {
      self.head = self.head.next
    } else {
      clear(self)
    }
  }
  return message
}
