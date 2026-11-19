/**
 * Browser half of the Idea sidebar plugin: the sidebar column and the rail
 * buttons that open their own panel bodies in its second column.
 *
 * The column owns the `sidebar` seat and its child seats, so other packages
 * register into `sidebar.*` by flat key exactly as they would with the stock
 * sidebar. Buttons live under `buttons/top` and `buttons/tail`, one folder per
 * button, and each button's panel body lives under `panels/`.
 *
 * Two services leave this package: `sidebarRail` reveals one rail item's body,
 * and `sidebarFiles` reveals a workspace path in the file tree. Both exist so a
 * package that knows a path can show it without owning the column.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { applyShell } from './shell/index.ts'
import { applyFiles } from './panels/files/index.ts'
import type { SidebarRailActions } from './rail/rail.ts'
import type { SidebarFilesActions } from './panels/files/actions.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Drive the activity rail from another package. */
    sidebarRail: SidebarRailActions
    /** Reveal a workspace path in the Idea sidebar's file tree. */
    sidebarFiles: SidebarFilesActions
  }
}

/**
 * Required services. `uiWorkspace` is deliberately absent: ui-workspace waits
 * for `layout`, which the frame plugin provides, so declaring the dependency
 * would deadlock both fibers. The injected actions read it lazily instead.
 * `layout` is required because the column drives the frame's sidebar track;
 * the frame never waits on this package, so the dependency stays acyclic.
 * `sessions` supplies the workspace root the file tree is keyed against, and
 * `sidebarRail` is this plugin's own service, read back by the files module.
 */
export const inject = [
  'slots', 'locale', 'shortcuts', 'layout',
  'remote', 'remote.workspaceFiles', 'sidebarRight', 'sessions',
]

/**
 * Register the column, its rail buttons, and both services.
 * @param ctx - client Cordis context.
 */
export function apply(ctx: ClientContext): void {
  const shell = applyShell(ctx)
  applyFiles(ctx, shell.select)
}

export type { SidebarRailActions, SidebarFilesActions }
