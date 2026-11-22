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

/**
 * The composer face this module borrows without depending on it. The
 * conversation package owns the input machine and may load after this one, so
 * the shape is read through `ctx.get` at call time rather than imported.
 */
interface ComposerFace {
  readonly input: {
    requestDraftInitialization(
      binding: unknown,
      options: { readonly prompt?: string; readonly whenDraftExists?: 'replace' | 'append' | 'keep' },
    ): 'applied' | 'preserved' | 'blocked'
    for(actx: unknown): { focus(): void }
  }
}

/**
 * One tree key as a path relative to the workspace root, with forward slashes.
 * The tree spells its keys root-first, but a mention is read by the model
 * against the Session's working directory, so the root prefix has to go.
 * @param root - the Session's working directory.
 * @param key - the tree key, absolute or already relative.
 * @returns the path under the root.
 */
function relativeKeyOf(root: string, key: string): string {
  const base = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const path = key.replace(/\\/g, '/')
  if (base !== '' && path.startsWith(`${base}/`)) return path.slice(base.length + 1)
  return path.replace(/^\/+/, '')
}

/**
 * Put the caret at the end of the composer that just took focus.
 *
 * The composer's own focus restores the selection it last held, which is not
 * necessarily the end of the draft this plugin just appended to: the mention
 * turns into a reference entity a moment later, and the entity's insertion
 * leaves the restored caret in front of it. Collapsing the DOM selection onto
 * the end of the focused editable is what the editor syncs back into its own
 * state, so the next keystroke lands after the mention.
 */
function caretToEnd(): void {
  const root = document.activeElement
  if (!(root instanceof HTMLElement) || !root.hasAttribute('data-composer-input')) return
  const range = document.createRange()
  range.selectNodeContents(root)
  range.collapse(false)
  const selection = window.getSelection()
  if (selection === null) return
  selection.removeAllRanges()
  selection.addRange(range)
}

/**
 * Spell one path the way the composer's `@` grammar reads it: a bare token,
 * or a quoted one when the path carries whitespace. A directory keeps its
 * trailing slash so the grammar recognizes it as one.
 * @param path - the path relative to the workspace root.
 * @param directory - whether the path names a directory.
 * @returns the mention text, or undefined for a path the grammar cannot carry.
 */
function mentionOf(path: string, directory: boolean): string | undefined {
  const spelled = directory ? `${path.replace(/\/+$/, '')}/` : path
  if (spelled === '' || spelled === '/') return undefined
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(spelled)) return undefined
  return /\s/u.test(spelled) ? `@"${spelled}"` : `@${spelled}`
}

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
  /**
   * Add one file or directory to the Session's composer as an `@path` mention,
   * at the end of whatever is already drafted there.
   * @param sessionId - the Session whose composer takes the mention.
   * @param path - the entry's tree key, absolute or relative to the workspace root.
   * @param directory - whether the entry is a directory, which the grammar spells with a trailing slash.
   */
  reference: (sessionId: SessionId, path: string, directory: boolean) => void
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
  // The composer is addressed through the Session binding rather than through
  // the panel's own props: the menu that asks for a mention is not a composer
  // seat, and the draft it edits lives with the conversation package.
  const reference: FilesPanelInjected['reference'] = (sessionId, path, directory) => {
    const binding = ctx.sessions.binding(sessionId)
    const conversation = ctx.get('conversation') as ComposerFace | undefined
    if (binding === undefined || conversation === undefined) return
    const mention = mentionOf(relativeKeyOf(rootOf(sessionId) ?? '', path), directory)
    if (mention === undefined) return
    // The trailing space is what ends the mention. The composer paints an `@`
    // token up to the next whitespace, so a mention without one swallows
    // whatever the reader types next into the same token.
    const result = conversation.input.requestDraftInitialization(binding, {
      prompt: `${mention} `,
      whenDraftExists: 'append',
    })
    if (result === 'blocked') return
    // The mention is only useful once the reader can type after it, but the
    // menu that asked for it is still closing and would hand focus back to the
    // panel it opened over. Waiting one frame lets that restore finish first.
    requestAnimationFrame(() => {
      try {
        conversation.input.for(binding.ctx).focus()
      } catch {
        // A composer that is not mounted yet has nothing to focus; the draft is
        // still there when it mounts.
        return
      }
      // The `@` token becomes a reference entity one update later, and that
      // update can move the restored caret. Placing it on the next frame puts
      // it after the entity rather than inside it.
      requestAnimationFrame(caretToEnd)
    })
  }
  const injected = (): FilesPanelInjected => ({
    list,
    open,
    expand: tree.expand,
    setCurrent: tree.setCurrent,
    reference,
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
