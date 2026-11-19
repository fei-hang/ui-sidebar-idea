/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * Actions other packages use to reveal a workspace path in this plugin's tree.
 *
 * The tree, the activity-rail button, and the column belong to this package, so
 * a package that knows a path — a search result, a diagnostic, a link in a
 * conversation — asks here instead of reaching into the column.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** What to show once a file is open. */
export interface SidebarFileTarget {
  /**
   * 1-based line to scroll into view. The line travels as a navigation
   * parameter rather than as part of the address, so opening the same file at
   * two lines reveals one tab and moves it.
   */
  readonly line?: number
}

/** Paths this plugin can reveal, and the Session they belong to. */
export interface SidebarFilesActions {
  /**
   * Reveal one directory: open it and every directory above it, show the tree
   * in the sidebar column, and expand the column when it is collapsed.
   * @param sessionId - the Session whose workspace the path belongs to.
   * @param path - the directory, absolute or relative to that workspace root.
   */
  openDirectory(sessionId: SessionId, path: string): void
  /**
   * Reveal one file: mark it current in the tree, open its directory chain, and
   * open the file in the Session's right Sidebar.
   * @param sessionId - the Session whose workspace the path belongs to.
   * @param path - the file, absolute or relative to that workspace root.
   * @param target - the line to land on, when the caller knows one.
   */
  openFile(sessionId: SessionId, path: string, target?: SidebarFileTarget): void
}
