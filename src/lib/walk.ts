import type { TreeNode } from "./reconcile";

/** Client-safe tree walker (reconcile.ts pulls in the pg pool, so it can't be imported in the browser). */
export function walk(node: TreeNode, fn: (n: TreeNode, parent: TreeNode | null) => void, parent: TreeNode | null = null) {
  fn(node, parent);
  for (const c of node.children) walk(c, fn, node);
}
