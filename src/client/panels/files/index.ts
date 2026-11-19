/**
 * The activity rail's folder button and the workspace file tree it opens.
 *
 * The tree itself is not drawn here. This module lists directories through the
 * Session's workspace Remote and renders the shared `sidebar.files.tree`
 * factory, so the Idea shell and the right Sidebar show the same tree from the
 * same code. Only the seat — one rail button and one panel body — belongs to
 * this module.
 *
 * The tree's open directories and current file live in a store rather than in
 * the panel body, because this module also answers a service: another package
 * that knows a path can ask for it without owning the column.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { RemoteResult } from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { DirLevel } from '@deepseek-ai/dsh-client-ui-sidebar-files/client'
// Type-only: the seat declarations these registrations name live in this
// plugin's contract, and the locale seat, renderer bindings, Session list, and
// rail service in their packages.
import type {} from '../../contract/slots.ts'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-files/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
// The `file` entry of `SidebarRightResourceParamsMap`, which types `{ params: { line } }`.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/client'
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// The `workspaceFiles` Remote namespace and its error codes, which only the
// namespace owner's declarations add to `ClientRemote`.
import type {} from '@deepseek-ai/dsh-api-workspace-files/client'
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path'
import type { SidebarFilesActions } from './actions.ts'
import { FilesBody, NS } from './FilesBody.tsx'
import { FilesButton } from '../../buttons/top/files/FilesButton.tsx'
import { de, en, es, fr, ja, pt, ru, zh, type SidebarFilesIdeaKey } from '../../locales/files.ts'
import { ancestorsOf, treeKeyOf } from './paths.ts'
import { createTreeStore } from './tree-store.ts'

/** The rail button's id, which also names the panel body it opens. */
const BUTTON_ID = 'files'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy for the folder button and the tree it opens. */
    sidebarFilesIdea: SidebarFilesIdeaKey
  }
}

/**
 * The business face the panel body receives: list one directory, open one file
 * in the Session's right Sidebar, and read or write the tree's own state.
 */
export interface FilesPanelInjected {
  /**
   * List one workspace directory.
   * @param sessionId - the Session whose workspace root the path resolves against.
   * @param path - the directory, relative to the workspace root or absolute.
   * @param signal - ends the listing when the reader leaves the directory.
   * @returns the listing, or the Remote failure that replaced it.
   */
  list: (sessionId: SessionId, path: string, signal: AbortSignal) => Promise<RemoteResult<DirLevel>>
  /**
   * Open one file from the tree in the Session's right Sidebar.
   * @param sessionId - the Session the file is read in.
   * @param cwd - that Session's workspace root, when known.
   * @param path - the file's path, relative to the workspace root.
   * @param line - the 1-based line to scroll into view, when the caller knows one.
   */
  open: (sessionId: SessionId, cwd: string | undefined, path: string, line?: number) => void
  /**
   * Open or close one directory in the tree.
   * @param sessionId - the Session being drawn.
   * @param path - the directory's tree key.
   * @param open - whether the directory is drawn open.
   */
  expand: (sessionId: SessionId, path: string, open: boolean) => void
  /**
   * Mark one file current in the tree, or clear the mark.
   * @param sessionId - the Session being drawn.
   * @param path - the file's tree key, or null to clear.
   */
  setCurrent: (sessionId: SessionId, path: string | null) => void
  /** Tree state bound to the body's selector hook. */
  hooks: {
    tree: ReturnType<typeof createTreeStore>['state']
  }
}

/**
 * Register the folder button, the panel body it opens, and the service other
 * packages call to reveal a path.
 * @param ctx - client root context carrying Slots, copy, and the workspace Remote.
 * @param selectRail - the shell's rail selector, used to reveal the column.
 */
export function applyFiles(ctx: ClientContext, selectRail: (id: string | null) => void): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(
    () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
    'sidebar-files-idea: dictionaries',
  )
  const tree = createTreeStore()
  const list: FilesPanelInjected['list'] = async (sessionId, path, signal) => {
    const result = await ctx.remote.workspaceFiles.list(sessionId, path, signal)
    if (!result.ok) return result
    return { ok: true, value: { entries: result.value.entries, truncated: result.value.truncated } }
  }
  // A line travels as a navigation parameter, not as part of the address: the
  // file is one piece of content whether it is opened at its top or at line
  // 400, so the same tab is revealed and told where to land.
  const open: FilesPanelInjected['open'] = (sessionId, cwd, path, line) => {
    const address = fileAddressFor(sessionId, cwd, path)
    if (line === undefined) ctx.sidebarRight.openResourceIn(sessionId, address)
    else ctx.sidebarRight.openResourceIn(sessionId, address, { params: { line } })
  }
  const injected = (): FilesPanelInjected => ({
    list,
    open,
    expand: tree.expand,
    setCurrent: tree.setCurrent,
    hooks: { tree: tree.state },
  })
  ctx.effect(
    () => ctx.slots.inject('sidebar.button.top', () => ctx.slots.register({
      name: 'sidebar.button.top',
      id: BUTTON_ID,
      order: 10,
      label: () => t('button.label'),
      locale: NS,
    }, FilesButton)),
    'sidebar-files-idea: rail button',
  )
  ctx.effect(
    () => ctx.slots.inject('sidebar.button.panel', () => ctx.slots.register({
      name: 'sidebar.button.panel',
      id: BUTTON_ID,
      locale: NS,
      inject: injected,
    }, FilesBody)),
    'sidebar-files-idea: tree panel',
  )
  // The Session's own workspace root: the tree draws keys relative to it, and
  // the listing endpoint takes it back as an absolute path.
  const rootOf = (sessionId: SessionId): string | undefined => ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
  // Reveal, never toggle: a caller asking for a path wants to see it, so the
  // rail service opens the column when it is collapsed. A directory is itself
  // opened; a file only opens the chain above it, since the tree lists
  // directories and marks one file current. Without a workspace root the tree
  // has no key to draw, so the column opens on the Session's own root instead.
  const reveal = (sessionId: SessionId, path: string, kind: 'directory' | 'file'): void => {
    const root = rootOf(sessionId)
    if (root !== undefined) {
      const key = treeKeyOf(root, path)
      const chain = kind === 'directory' ? [...ancestorsOf(root, key), key] : ancestorsOf(root, key)
      tree.reveal(sessionId, chain.filter(entry => entry !== ''))
      if (kind === 'file') tree.setCurrent(sessionId, key)
    }
    selectRail(BUTTON_ID)
  }
  ctx.effect(() => ctx.reflect.provide('sidebarFiles', {
    openDirectory: (sessionId, path) => { reveal(sessionId, path, 'directory') },
    openFile: (sessionId, path, target) => {
      reveal(sessionId, path, 'file')
      open(sessionId, rootOf(sessionId), path, target?.line)
    },
  } satisfies SidebarFilesActions), 'sidebar-files-idea: reveal service')
}

export type { SidebarFilesIdeaKey }
