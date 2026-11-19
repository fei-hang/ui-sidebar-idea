/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * The file tree's per-Session intent: which directories are drawn open and
 * which file is current.
 *
 * It sits outside the panel body because this plugin's service drives the tree
 * on behalf of another package. The body keeps only its listing cache;
 * everything a second caller may change lives here.
 */
import { createSnapshotStore, type ObservableSnapshot } from '@deepseek-ai/dsh-client-store'

/** One Session's tree. */
export interface SessionTree {
  /** Directories drawn open, as tree keys. */
  readonly expanded: readonly string[]
  /** File marked current, or null when no file is being read. */
  readonly current: string | null
}

/** Every Session's tree, keyed by Session id. */
export interface FilesTreeState {
  readonly sessions: Readonly<Record<string, SessionTree>>
}

/** The tree state source plus the writes the body and the service apply. */
export interface FilesTreeStore {
  /** Snapshot source the panel body reads through its `useTree` selector hook. */
  readonly state: ObservableSnapshot<FilesTreeState>
  /**
   * Open or close one directory.
   * @param sessionId - the Session being drawn.
   * @param path - the directory's tree key.
   * @param open - whether the directory is drawn open.
   */
  readonly expand: (sessionId: string, path: string, open: boolean) => void
  /**
   * Open directories without closing the ones already open, so a caller that
   * reveals a nested path never disturbs the reader's own arrangement.
   * @param sessionId - the Session being drawn.
   * @param paths - directories to draw open, outermost first.
   */
  readonly reveal: (sessionId: string, paths: readonly string[]) => void
  /**
   * Mark one file current, or clear the mark.
   * @param sessionId - the Session being drawn.
   * @param path - the file's tree key, or null to clear.
   */
  readonly setCurrent: (sessionId: string, path: string | null) => void
}

/** A Session that has never drawn a tree. */
export const NO_TREE: SessionTree = { expanded: [], current: null }

/**
 * Create the tree store.
 * @returns the state source and its writes.
 */
export function createTreeStore(): FilesTreeStore {
  const store = createSnapshotStore<FilesTreeState>({ sessions: {} })
  const edit = (sessionId: string, mutate: (tree: SessionTree) => SessionTree | null): void => {
    const current = store.getSnapshot()
    const tree = current.sessions[sessionId] ?? NO_TREE
    const next = mutate(tree)
    if (next === null) return
    store.set({ sessions: { ...current.sessions, [sessionId]: next } })
  }
  return {
    state: {
      getSnapshot: () => store.getSnapshot(),
      subscribe: (listener: () => void) => store.subscribe(listener),
    },
    expand: (sessionId, path, open) => {
      edit(sessionId, (tree) => {
        if (tree.expanded.includes(path) === open) return null
        return {
          ...tree,
          expanded: open ? [...tree.expanded, path] : tree.expanded.filter(entry => entry !== path),
        }
      })
    },
    reveal: (sessionId, paths) => {
      edit(sessionId, (tree) => {
        const next = [...tree.expanded]
        for (const path of paths) if (!next.includes(path)) next.push(path)
        if (next.length === tree.expanded.length) return null
        return { ...tree, expanded: next }
      })
    },
    setCurrent: (sessionId, path) => {
      edit(sessionId, tree => tree.current === path ? null : { ...tree, current: path })
    },
  }
}
