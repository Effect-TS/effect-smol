import type { Edit } from "codemod:ast-grep";
export type RootNode = any;
export type TransformPass = (rootNode: RootNode) => Array<Edit>;
