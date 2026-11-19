/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * Path arithmetic for callers that name a workspace path rather than a tree key.
 *
 * The tree draws rows by key: the path its parent level was listed under, joined
 * with `/` and the entry name. The root level is listed under the Session's
 * working directory exactly as that directory is spelled, so a key starts with
 * the root's own separators and only the segments below it use `/`. A package
 * that reveals a path knows only what a Session Remote takes — absolute, or
 * relative to the same root — so the service converts once here instead of
 * asking every caller to know the tree's spelling.
 */
import { treeRootOf } from './tree.ts'

/** Whether one normalized path names a place rather than a position under the root. */
function isAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:\//.test(path) || path.startsWith('/')
}

/**
 * Express one workspace path as a tree key.
 * @param root - the Session's working directory, or '' when unknown.
 * @param path - the path a caller named, absolute or relative to the root.
 * @returns the key the tree uses for that path, '' for the root itself.
 */
export function treeKeyOf(root: string, path: string): string {
  const trimmed = treeRootOf(root)
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '')
  if (trimmed === '') return normalized.replace(/^\/+/, '')
  const base = trimmed.replace(/\\/g, '/')
  if (normalized === base) return ''
  if (normalized.startsWith(`${base}/`)) return `${trimmed}/${normalized.slice(base.length + 1)}`
  // A path outside the root has no key in this tree; keep it as written so the
  // listing reports the Remote failure under the row a caller asked to open.
  if (isAbsolutePath(normalized)) return normalized
  return `${trimmed}/${normalized.replace(/^\/+/, '')}`
}

/**
 * Every directory above one tree key, outermost first. Revealing a nested key
 * opens this chain and nothing else; a key directly under the root has none.
 * @param root - the Session's working directory, or '' when unknown.
 * @param key - the tree key to reach.
 * @returns the directory keys to open.
 */
export function ancestorsOf(root: string, key: string): readonly string[] {
  const trimmed = treeRootOf(root)
  const chain: string[] = []
  let cut = key.lastIndexOf('/')
  while (cut > trimmed.length) {
    const parent = key.slice(0, cut)
    chain.unshift(parent)
    cut = parent.lastIndexOf('/')
  }
  return chain
}
