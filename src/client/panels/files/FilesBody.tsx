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
import {
  useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ComponentType, type MouseEvent,
} from 'react'
import { Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
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
import { FolderIcon } from '../../buttons/top/files/FolderIcon.tsx'
import { NO_TREE } from './tree-store.ts'
import { directoriesOf, entriesOf } from './tree.ts'
import css from './FilesBody.module.css'

/** The namespace this package's copy lives under. */
export const NS = 'sidebarFilesIdea'

/** A point in client (viewport) coordinates, as a pointer reports it. */
interface PointerAnchor {
  readonly x: number
  readonly y: number
}

/** What a right-click landed on, when it landed on a tree entry rather than on empty space. */
interface MenuTarget {
  /** The entry's tree key, which is its path under the workspace root. */
  readonly path: string
  /** Whether the entry is a directory, which a mention spells with a trailing slash. */
  readonly directory: boolean
}

/** One open context menu: where it opened, and the row it opened over (if any). */
interface ContextMenuState {
  readonly at: PointerAnchor
  readonly target: MenuTarget | null
}

/**
 * Read the row a right-click landed on.
 *
 * The tree marks each entry's `<li>` with `data-files-path` and
 * `data-files-entry`. Anything else — the panel's own padding, a loading line,
 * the workspace-root row this body draws — has no target, and the menu then
 * offers only the panel-wide action.
 * @param from - the element under the pointer.
 * @returns the entry to reference, or null when the click missed every entry.
 */
function targetOf(from: Element | null): MenuTarget | null {
  if (from === null) return null
  const row = from.closest('[data-files-path]')
  const path = row?.getAttribute('data-files-path')
  if (row === null || path === undefined || path === null || path === '') return null
  return { path, directory: row.getAttribute('data-files-entry') === 'directory' }
}

/**
 * The host's `Menu` anchors a pointer-opened menu with `anchorPoint`, the
 * replacement for the retired `getAnchorRect`. The primitives build this
 * package compiles against predates that prop, so the widened alias below adds
 * it to the prop type; the component itself is the same runtime export.
 */
const PointMenu = Menu as ComponentType<
  ComponentProps<typeof Menu> & { readonly anchorPoint?: PointerAnchor | undefined }
>

/**
 * The name a directory is known by: its last segment, so the workspace root
 * reads as a folder name rather than as a full absolute path.
 * @param path - the directory path, with either separator.
 * @returns its last segment, or the path itself when it has none.
 */
function baseNameOf(path: string): string {
  const segments = path.split(/[/\\]+/).filter(segment => segment !== '')
  return segments.at(-1) ?? path
}

/**
 * Chevron for the workspace-root row, drawn inline from the Lucide
 * `chevron-right` outline so the panel carries no icon dependency.
 * @param props - the glyph size.
 * @returns the chevron, which turns through CSS when the row is open.
 */
function ChevronIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

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
  sessionId, useSessions, useTree, t, list, open, expand, setCurrent, reference, renderFactorySlot,
}: FilesBodyProps) {
  // The listing endpoint names the workspace root as a non-empty path, so the
  // tree is rooted at the Session's working directory rather than at ''.
  const root = useSessions(state => sessionId === undefined ? undefined : state.byId[sessionId]?.cwd)
  const intent = useTree(state => sessionId === undefined ? NO_TREE : state.sessions[sessionId] ?? NO_TREE)
  const [levels, setLevels] = useState<Readonly<Record<string, LevelState>>>({})
  // Directories a listing is already in flight for, so one open directory is
  // read once however many renders ask for it.
  const pending = useRef(new Set<string>())
  // The right-click menu: the point it was opened at and the row under it, or
  // null while it is down. The point is state rather than a ref so a second
  // right-click elsewhere moves an open menu instead of leaving it where the
  // first one opened.
  const [menu, setMenu] = useState<ContextMenuState | null>(null)
  // Whether the workspace root row is open. The tree always lists the root's
  // children, so the row is this body's own: closing it hides the level rather
  // than asking the tree to draw a level it cannot collapse.
  const [rootOpen, setRootOpen] = useState(true)
  // Focus goes back to the panel box rather than to the pointer's original
  // target: the node under the cursor may be gone by the time the menu closes,
  // and the menu treats a return target that left the document as a reason to
  // close itself. The box is also the element a keyboard can actually use here.
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback((
    session: SessionId,
    path: string,
    signal?: AbortSignal,
    quiet = false,
  ): void => {
    if (pending.current.has(path)) return
    pending.current.add(path)
    // A refresh re-reads directories that are already drawn: keeping their
    // last listing until the new one lands stops the tree from blinking back
    // to its loading line on every right-click.
    if (!quiet) setLevels(current => ({ ...current, [path]: { kind: 'loading' } }))
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

  // Re-read every directory the tree is showing, not only the root: a file
  // added inside an open folder has to appear without collapsing the tree the
  // reader arranged. Reads go through load, so a directory already in flight is
  // not asked twice.
  const refresh = useCallback((): void => {
    if (sessionId === undefined || root === undefined) return
    for (const path of [root, ...intent.expanded]) load(sessionId, path, undefined, true)
  }, [sessionId, root, intent.expanded, load])

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

  const level = root === undefined ? undefined : levels[root]
  const listing = level === undefined || level.kind === 'loading'
    ? <p className={css.note} data-files-idea-row="loading">{t('panel.loading')}</p>
    : level.kind === 'failed'
      ? <p className={css.note} data-files-idea-row="failed">{describeFailure(level.failure, t)}</p>
      : level.level.entries.length === 0
        ? <p className={css.note} data-files-idea-row="empty">{t('panel.empty')}</p>
        : (
          <div className={css.tree} data-files-idea-tree="">
            {renderFactorySlot('sidebar.files.tree', tree, { fallback: <p className={css.note}>{t('panel.empty')}</p> })}
          </div>
        )
  // The workspace root gets a row of its own: the tree always lists the root's
  // children and never draws the root itself, so a panel that opens straight
  // onto a list of children gives the reader no idea what they are looking at.
  // The row is this body's, and collapsing it hides the level rather than
  // asking the tree to draw something it cannot collapse.
  const body = sessionId === undefined
    ? <p className={css.note} data-files-idea-row="no-session">{t('panel.noSession')}</p>
    : root === undefined
      ? <p className={css.note} data-files-idea-row="loading">{t('panel.loading')}</p>
      : (
        <>
          <button
            type="button"
            className={css.rootRow}
            data-files-idea-root=""
            aria-expanded={rootOpen}
            title={root}
            onClick={() => { setRootOpen(open => !open) }}
          >
            <span className={rootOpen ? `${css.chevron} ${css.chevronOpen}` : css.chevron}>
              <ChevronIcon />
            </span>
            <span className={css.folder}>
              <FolderIcon size={15} />
            </span>
            <span className={css.rootName}>{baseNameOf(root)}</span>
          </button>
          {rootOpen ? <div className={css.nested}>{listing}</div> : null}
        </>
      )

  // Right-click anywhere in the panel — empty space included — reads the
  // workspace again. Over a row it also offers to put that path in the
  // composer, which is the one thing a click on the row cannot do. The menu is
  // placed at the pointer rather than under an anchor, so it opens where the
  // reader aimed instead of at a corner of the panel.
  const items: MenuEntry[] = menu?.target == null
    ? [{ id: 'refresh', label: t('menu.refresh') }]
    : [
      { id: 'reference', label: t('menu.reference') },
      { type: 'separator', id: 'reference-separator' },
      { id: 'refresh', label: t('menu.refresh') },
    ]
  const onContextMenu = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (sessionId === undefined || root === undefined) return
    setMenu({
      at: { x: event.clientX, y: event.clientY },
      target: targetOf(event.target instanceof Element ? event.target : null),
    })
  }

  return (
    <div
      ref={panelRef}
      className={css.panel}
      data-files-idea-panel=""
      tabIndex={-1}
      onContextMenu={onContextMenu}
    >
      {body}
      <PointMenu
        open={menu !== null}
        anchor={null}
        items={items}
        anchorPoint={menu?.at}
        onSelect={(id) => {
          const target = menu?.target ?? null
          setMenu(null)
          if (id === 'refresh') refresh()
          else if (id === 'reference' && sessionId !== undefined && target !== null) {
            reference(sessionId, target.path, target.directory)
          }
        }}
        onClose={() => { setMenu(null) }}
        returnFocus={() => panelRef.current}
        align="start"
        side="bottom"
        portal
        contextual
        autoFocus
      />
    </div>
  )
}
