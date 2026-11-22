/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * Actions other packages use to drive the activity rail.
 *
 * The rail's selection and its per-user button order belong to this plugin's
 * store, which no other package can reach. A package that owns something the
 * rail can reveal — the workspace file tree, for one — needs exactly this much
 * surface and no more, so it lives here beside the store that answers it.
 */
export interface SidebarRailActions {
  /**
   * Show one rail item's body, revealing the column when it is collapsed.
   * @param id - Rail id whose panel body shows; null returns the rail to the
   * sidebar body.
   */
  select(id: string | null): void
}
