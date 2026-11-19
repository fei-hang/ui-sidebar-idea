/* Mirrors the stock file tree projection in @deepseek-ai/dsh-client-ui-sidebar-files; keep the two in step. */

/**
 * Conversions between the directory listings this body loads and the entries
 * the shared file-tree factory draws.
 */
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
import type {
  LevelState,
  TreeDirectoryState,
  TreeEntry,
  TreeEntryKind,
} from '@deepseek-ai/dsh-client-ui-sidebar-files/client'

/**
 * Join one child onto a directory path. The workspace root is the empty
 * string, so a top-level child is just its own name.
 * @param parent - the directory's path, or the empty root.
 * @param name - the child's name.
 * @returns the child's path.
 */
export function childPath(parent: string, name: string): string {
  const trimmed = parent.replace(/[/\\]+$/, '')
  return trimmed === '' ? name : `${trimmed}/${name}`
}

/**
 * Normalize the tree's root key.
 * @param root - the configured root.
 * @returns the root without trailing separators.
 */
export function treeRootOf(root: string): string {
  return root.replace(/[/\\]+$/, '')
}

/**
 * The directory one path hangs from.
 * @param root - the tree's root key.
 * @param path - the path to place.
 * @returns the containing directory, or the root for a top-level entry.
 */
export function parentOf(root: string, path: string): string {
  const cut = path.lastIndexOf('/')
  return cut <= root.length ? root : path.slice(0, cut)
}

/**
 * Flatten the loaded directories into tree entries.
 * @param levels - one listing per loaded directory.
 * @returns every child of every ready listing.
 */
export function entriesOf(levels: Readonly<Record<string, LevelState>>): readonly TreeEntry[] {
  return Object.entries(levels).flatMap(([path, level]) => {
    if (level.kind !== 'ready') return []
    return level.level.entries.map(entry => ({
      path: childPath(path, entry.name),
      name: entry.name,
      meta: { kind: entry.type as TreeEntryKind },
    }))
  })
}

/**
 * Report each expanded directory's loading, failure, or truncation state.
 * @param root - the tree's root key.
 * @param levels - one listing per loaded directory.
 * @param expanded - the directories the user has opened.
 * @param describe - renders one Remote failure as a line of text.
 * @returns per-directory state for the directories that are not plainly ready.
 */
export function directoriesOf(
  root: string,
  levels: Readonly<Record<string, LevelState>>,
  expanded: readonly string[],
  describe: (failure: RemoteFailure) => string,
): Readonly<Record<string, TreeDirectoryState>> {
  const states: Record<string, TreeDirectoryState> = {}
  for (const path of [treeRootOf(root), ...expanded]) {
    const level = levels[path]
    if (level === undefined) continue
    if (level.kind === 'loading') {
      states[path] = { loading: true }
      continue
    }
    if (level.kind === 'failed') {
      states[path] = { failure: describe(level.failure) }
      continue
    }
    if (level.failure !== undefined) {
      states[path] = { failure: describe(level.failure) }
      continue
    }
    if (level.level.truncated) states[path] = { truncated: true }
  }
  return states
}
