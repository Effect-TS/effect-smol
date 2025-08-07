import { Array } from "effect/collections"
import type { Simplify } from "effect/types/Types"
import type { Param } from "./param.ts"
import { isParam } from "./param.ts"

export interface CommandConfig {
  readonly [key: string]:
    | Param<any>
    | ReadonlyArray<Param<any> | CommandConfig>
    | CommandConfig
}

export type InferConfig<A extends CommandConfig> = Simplify<
  { readonly [Key in keyof A]: InferConfigValue<A[Key]> }
>

type InferConfigValue<A> = A extends ReadonlyArray<infer _> ? { readonly [Key in keyof A]: InferConfigValue<A[Key]> }
  : A extends Param<infer Value> ? Value
  : A extends CommandConfig ? InferConfig<A>
  : never

export interface ConfigTree {
  [key: string]: ConfigNode
}

export type ConfigNode = {
  readonly _tag: "Param"
  readonly index: number
} | {
  readonly _tag: "Array"
  readonly children: ReadonlyArray<ConfigNode>
} | {
  readonly _tag: "ParsedConfig"
  readonly tree: ConfigTree
}

export interface ParsedConfig {
  readonly flags: ReadonlyArray<Param<any>>
  readonly arguments: ReadonlyArray<Param<any>>
  /** Params in the exact order they were declared. */
  readonly paramOrder: ReadonlyArray<Param<any>>
  readonly tree: ConfigTree
}

/**
 * Transforms a nested command configuration into a flat structure for parsing.
 *
 * This function walks through the entire config tree and:
 * 1. Extracts all Params into a single flat array (for command-line parsing)
 * 2. Creates a "blueprint" tree that remembers the original structure
 * 3. Assigns each Param an index to link parsed values back to their position
 *
 * The separation allows us to:
 * - Parse all options using existing flat parsing logic
 * - Reconstruct the original nested structure afterward
 *
 * @example
 * Input: { name: Param.string("name"), db: { host: Param.string("host") } }
 * Output: {
 *   options: [Param.string("name"), Param.string("host")],
 *   tree: { name: {_tag: "Param", index: 0}, db: {_tag: "ParsedConfig", tree: {host: {_tag: "Param", index: 1}}} }
 * }
 */
export const parseConfig = (config: CommandConfig): ParsedConfig => {
  const flags: Array<Param<any>> = []
  const args: Array<Param<any>> = []
  const paramOrder: Array<Param<any>> = []

  // Recursively walk the config structure, building the blueprint tree
  function parse(config: CommandConfig) {
    const tree: ConfigTree = {}
    for (const key in config) {
      tree[key] = parseValue(config[key])
    }
    return tree
  }

  // Process each value in the config, extracting Params and preserving structure
  function parseValue(
    value:
      | Param<any>
      | ReadonlyArray<Param<any> | CommandConfig>
      | CommandConfig
  ): ConfigNode {
    if (Array.isArray(value)) {
      // Array of options/configs - preserve array structure
      return {
        _tag: "Array",
        children: Array.map(value as Array<any>, parseValue)
      }
    } else if (isParam(value)) {
      // Found a Param - add to appropriate array based on kind and record its index
      const index = paramOrder.length
      paramOrder.push(value)

      if (value.kind === "argument") {
        args.push(value)
      } else {
        flags.push(value)
      }

      return {
        _tag: "Param",
        index
      }
    } else {
      // Nested config object - recursively process
      return {
        _tag: "ParsedConfig",
        tree: parse(value as any)
      }
    }
  }

  return {
    flags,
    arguments: args,
    paramOrder,
    tree: parse(config)
  }
}

/**
 * Reconstructs the original nested structure using parsed values and the blueprint tree.
 *
 * This is the inverse operation of parseConfig:
 * 1. Takes the flat array of parsed option values
 * 2. Uses the blueprint tree to determine where each value belongs
 * 3. Rebuilds the original nested object structure
 *
 * The blueprint tree acts as a "map" showing how to reassemble the flat data
 * back into the user's expected nested configuration shape.
 *
 * @param tree - The blueprint tree created by parseConfig
 * @param results - Flat array of parsed values (in the same order as the options array)
 * @returns The reconstructed nested configuration object
 *
 * @example
 * Input tree: { name: {_tag: "Param", index: 0}, db: {_tag: "ParsedConfig", tree: {host: {_tag: "Param", index: 1}}} }
 * Input results: ["myapp", "localhost"]
 * Output: { name: "myapp", db: { host: "localhost" } }
 */
export const reconstructConfigTree = (
  tree: ConfigTree,
  results: ReadonlyArray<any>
): Record<string, any> => {
  const output: Record<string, any> = {}

  // Walk through each key in the blueprint tree
  for (const key in tree) {
    output[key] = nodeValue(tree[key])
  }

  return output

  // Convert a blueprint node back to its corresponding value
  function nodeValue(node: ConfigNode): any {
    if (node._tag === "Param") {
      // Param reference - look up the parsed value by index
      return results[node.index]
    } else if (node._tag === "Array") {
      // Array structure - recursively process each child
      return Array.map(node.children, nodeValue)
    } else {
      // Nested object - recursively reconstruct the subtree
      return reconstructConfigTree(node.tree, results)
    }
  }
}
