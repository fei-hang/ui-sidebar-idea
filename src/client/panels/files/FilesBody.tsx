/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * The workspace file tree, drawn behind the activity rail's folder button.
 *
 * The body owns no tree of its own: it lists directories through the Session's
 * workspace Remote and hands the flattened result to the shared
 * `sidebar.files.tree` factory, so the Idea shell and the right Sidebar draw
 * the same tree. Listing happens per directory as the reader opens it; a
 * directory that was never opened is never read.
 *
 * Which directories are open and which file is current live in the tree store
 * rather than here, because this package's service opens paths on behalf of
 * other packages and only the store can be reached from both sides.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RemoteFailure } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  InjectFace,
  PropsLocale,
  PropsRenderFactories,
  PropsRuntime,
  TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { FileTreeInput, LevelState, TreeEntry } from '@deepseek-ai/dsh-client-ui-sidebar-files/client'
import type { FilesPanelInjected } from './index.ts'
import { NO_TREE } from './tree-store.ts'
import { directoriesOf, entriesOf } from './tree.ts'
import css from './FilesBody.module.css'

/** The namespace this package's copy lives under. */
export const NS = 'sidebarFilesIdea'

/** Props the panel body receives from the seat. */
export type FilesBodyProps =
  & PropsRuntime<'sidebar.button.panel'>
  & PropsRenderFactories
  & PropsLocale<typeof NS>
  & InjectFace<FilesPanelInjected>

/**
 * Turn one Remote failure into a line of copy.
 * @param failure - the failure the listing carried.
 * @param t - this package's translator.
 * @returns the line to draw.
 */
function describeFailure(failure: RemoteFailure, t: TranslateNS<typeof NS>): string {
  switch (failure.code) {
    case 'workspace-file/not-found':
      return t('error.notFound')
    case 'workspace-file/outside-workspace':
      return t('error.outsideWorkspace')
    case 'workspace-file/not-directory':
      return t('error.notDirectory')
    default:
      return t('error.unavailable', { message: failure.message })
  }
}

/**
 * Draw the workspace file tree for one Session.
 * @param props - seat props: the Session, the listing face, and the tree factory.
 * @returns the panel body.
 */
export function FilesBody({
  sessionId, useSessions, useTree, t, list, open, expand, setCurrent, renderFactorySlot,
}: FilesBodyProps) {
  // The listing endpoint names the workspace root as a non-empty path, so the
  // tree is rooted at the Session's working directory rather than at ''.
  const root = useSessions(state => sessionId === undefined ? undefined : state.byId[sessionId]?.cwd)
  const intent = useTree(state => sessionId === undefined ? NO_TREE : state.sessions[sessionId] ?? NO_TREE)
  const [levels, setLevels] = useState<Readonly<Record<string, LevelState>>>({})
  // Directories a listing is already in flight for, so one open directory is
  // read once however many renders ask for it.
  const pending = useRef(new Set<string>())

  const load = useCallback((session: SessionId, path: string, signal?: AbortSignal): void => {
    if (pending.current.has(path)) return
    pending.current.add(path)
    setLevels(current => ({ ...current, [path]: { kind: 'loading' } }))
    void list(session, path, signal ?? new AbortController().signal).then((result) => {
      pending.current.delete(path)
      if (signal?.aborted === true) return
      setLevels(current => ({
        ...current,
        [path]: result.ok
          ? { kind: 'ready', level: result.value }
          : { kind: 'failed', failure: result.error },
      }))
    })
  }, [list])

  // A new Session reads its own workspace from scratch: no directory of the
  // previous Session may survive into this one's tree.
  useEffect(() => {
    pending.current.clear()
    setLevels({})
    if (sessionId === undefined || root === undefined) return
    const controller = new AbortController()
    load(sessionId, root, controller.signal)
    return () => { controller.abort() }
  }, [sessionId, root, load])

  // Open directories come from the store, so a directory this body never
  // opened itself — one a caller revealed through the service — is read here
  // on the same path as a click.
  useEffect(() => {
    if (sessionId === undefined || root === undefined) return
    for (const path of intent.expanded) {
      if (levels[path] === undefined) load(sessionId, path)
    }
  }, [sessionId, root, intent.expanded, levels, load])

  const toggle = useCallback((entry: TreeEntry, open: boolean): void => {
    if (sessionId === undefined) return
    expand(sessionId, entry.path, open)
  }, [sessionId, expand])

  const tree = useMemo<FileTreeInput>(() => ({
    root: root ?? '',
    entries: root === undefined ? [] : entriesOf(levels),
    expanded: intent.expanded,
    current: intent.current ?? undefined,
    directories: root === undefined ? {} : directoriesOf(root, levels, intent.expanded, failure => describeFailure(failure, t)),
    onToggle: toggle,
    onOpen: (entry: TreeEntry) => {
      if (sessionId === undefined || root === undefined) return
      setCurrent(sessionId, entry.path)
      open(sessionId, root, entry.path)
    },
  }), [root, levels, intent, toggle, sessionId, open, setCurrent, t])

  if (sessionId === undefined) {
    return <p className={css.note} data-files-idea-row="no-session">{t('panel.noSession')}</p>
  }
  if (root === undefined) {
    return <p className={css.note} data-files-idea-row="loading">{t('panel.loading')}</p>
  }
  const level = levels[root]
  if (level === undefined || level.kind === 'loading') {
    return <p className={css.note} data-files-idea-row="loading">{t('panel.loading')}</p>
  }
  if (level.kind === 'failed') {
    return <p className={css.note} data-files-idea-row="failed">{describeFailure(level.failure, t)}</p>
  }
  if (level.level.entries.length === 0) {
    return <p className={css.note} data-files-idea-row="empty">{t('panel.empty')}</p>
  }
  return (
    <div className={css.tree} data-files-idea-tree="">
      {renderFactorySlot('sidebar.files.tree', tree, { fallback: <p className={css.note}>{t('panel.empty')}</p> })}
    </div>
  )
}
