/**
 * The sidebar column itself: the seat table, panel aggregation, pin state, and
 * the leading controls.
 *
 * This module owns the `sidebar` seat and every child seat other packages
 * register into by flat key, so the workspace browser, panel icons, and the
 * settings dialog land here exactly as they would in the stock column. The
 * host profile must never enable both this plugin and `ui-sidebar`: declaring
 * the same seats twice fails at load.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// The global-resource `useRemoteAccess` Hook the seats read.
import type {} from '@deepseek-ai/dsh-api-remote-access/client'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the SlotRegistry service merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session root standard-props merge.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the analytics service merge (ctx.productAnalytics).
import type {} from '@deepseek-ai/dsh-client-product-analytics/client'
import type {
  SidebarButtonMetadata, SidebarPanelMetadata, SidebarRootInjected, SidebarSectionInjected,
} from '../contract/slots.ts'
import { createButtonOrder, orderRail, type ButtonRail } from '../status/button-order.ts'
import type { SidebarRailActions } from '../status/rail.ts'
import { createPanelPins } from '../status/panel-pins.ts'
import { SIDEBAR_BUTTON_ID } from '../buttons/rail/ActivityRail.tsx'
import { en, ja, es, fr, de, ru, pt, zh, type SidebarKey } from '../locales/shell.ts'
import { HeaderLeadingControls } from './HeaderLeadingControls.tsx'
import { SidebarRoot } from './SidebarRoot.tsx'
import { PanelIcon } from './PanelIcon.tsx'

/** The section occupant receives the scroller hook from each render's hookContext. */
const SIDEBAR_SECTION_INJECT: SidebarSectionInjected = {
  hooks: { sectionScroller: (_standard, { useSectionScroller }) => useSectionScroller },
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Sidebar controls and global panel copy. */
    sidebar: SidebarKey
  }
}

/** What the shell exposes to the rest of this plugin. */
export interface ShellHandle {
  /**
   * Show one rail item's body, revealing the column when it is collapsed.
   * @param id - rail id whose body shows; null returns the rail to the sidebar body.
   */
  select: SidebarRailActions['select']
}

/**
 * Register the sidebar column, its panel aggregation, and the leading controls.
 * @param ctx - client Cordis context.
 * @returns the handle other modules in this plugin call into.
 */
export function applyShell(ctx: ClientContext): ShellHandle {
  ctx.effect(() => ctx.locale.register('sidebar', { zh, en, ja, es, fr, de, ru, pt }), 'sidebar-idea: dictionaries')
  const panels = createSnapshotStore<readonly SidebarPanelMetadata[]>([])
  const syncPanels = (): void => {
    const next = ctx.slots.entriesOfSlot('sidebar.panellist').map(({ options }) => {
      // The list registration requires an id; StoredEntry erases the slot kind.
      const id = options.id as MainPanelId
      return { id, order: options.order ?? 0, label: resolveSlotLabel(options.label) ?? id }
    }).sort((a, b) => a.order - b.order)
    const previous = panels.getSnapshot()
    if (previous.length === next.length && previous.every((panel, index) => {
      const candidate = next[index] as SidebarPanelMetadata
      return panel.id === candidate.id && panel.order === candidate.order && panel.label === candidate.label
    })) return
    panels.set(next)
  }
  ctx.effect(() => ctx.slots.subscribe('sidebar.panellist', syncPanels), 'sidebar-idea: panel entries')
  ctx.effect(() => ctx.locale.subscribe(syncPanels), 'sidebar-idea: panel labels')
  const panelPins = createPanelPins()
  const buttonOrder = createButtonOrder()
  const topButtons = createSnapshotStore<readonly SidebarButtonMetadata[]>([])
  const tailButtons = createSnapshotStore<readonly SidebarButtonMetadata[]>([])
  // The strip's own toggle is not a slot registration, but it is one more row
  // in the head group: projecting it here is what makes it draggable alongside
  // the registrants instead of being nailed above them.
  const sidebarButtonLabel = (): string => ctx.locale.bind('sidebar')('rail.panel')
  const syncButtons = (): void => {
    const project = (seat: 'sidebar.button.top' | 'sidebar.button.tail', target: typeof topButtons): void => {
      // Registration order is the default arrangement: list entries already
      // arrive sorted by (priority, order), so the stored drag order only has
      // to reorder the ids that are still registered.
      const entries = ctx.slots.entriesOfSlot(seat).flatMap(({ options }) => {
        const id = options.id
        return id === undefined ? [] : [{ id, label: resolveSlotLabel(options.label) ?? id }]
      })
      const registered = seat === 'sidebar.button.top'
        ? [{ id: SIDEBAR_BUTTON_ID, label: sidebarButtonLabel() }, ...entries]
        : entries
      const byId = new Map(registered.map(entry => [entry.id, entry]))
      const stored = buttonOrder.order.getSnapshot()[seat === 'sidebar.button.top' ? 'top' : 'tail']
      const next = orderRail(registered.map(({ id }) => id), stored).flatMap(id => {
        const entry = byId.get(id)
        return entry === undefined ? [] : [entry]
      })
      const previous = target.getSnapshot()
      if (previous.length === next.length && previous.every((entry, index) => {
        const candidate = next[index] as SidebarButtonMetadata
        return entry.id === candidate.id && entry.label === candidate.label
      })) return
      target.set(next.map((entry, index) => ({ id: entry.id, order: index, label: entry.label })))
    }
    project('sidebar.button.top', topButtons)
    project('sidebar.button.tail', tailButtons)
  }
  ctx.effect(() => ctx.slots.subscribe('sidebar.button.top', syncButtons), 'sidebar-idea: rail head entries')
  ctx.effect(() => ctx.slots.subscribe('sidebar.button.tail', syncButtons), 'sidebar-idea: rail tail entries')
  ctx.effect(() => ctx.locale.subscribe(syncButtons), 'sidebar-idea: rail labels')
  ctx.effect(() => buttonOrder.order.subscribe(syncButtons), 'sidebar-idea: rail order')
  const entryActions = {
    getSnapshot: () => ctx.slots.entriesOfSlot('sidebar.panellist.actions').length > 0,
    subscribe: (listener: () => void) => ctx.slots.subscribe('sidebar.panellist.actions', listener),
  }
  // The column reports its own collapse state; the rail service reveals the
  // column before showing a body, and the frame's snapshot is not readable from
  // here without depending on a plugin that waits on this one.
  let collapsed = false

  const injectProps = (): SidebarRootInjected => ({
    // The shell's New Session button rides the Workspace UI's shared action
    // (current Session Workspace, then recent Workspace). ui-workspace waits
    // for `layout`, so it is absent during apply and present on click.
    startSession: (workspaceId) => { ctx.get('uiWorkspace')?.startSession(workspaceId) },
    toggleSidebar: () => { ctx.layout.toggleSidebar() },
    selectPanel: (id) => { ctx.layout.selectPanel(id) },
    setPinned: panelPins.setPinned,
    selectButton: (id) => { buttonOrder.select(id) },
    reportCollapsed: (next) => { collapsed = next },
    moveButton: (rail: ButtonRail, id, beforeId) => {
      // The store only remembers ids the user already dragged; adopt the row
      // order on screen first, or a drag against a partial list is a no-op.
      const shown = (rail === 'top' ? topButtons : tailButtons).getSnapshot()
      buttonOrder.seed(rail, shown.map(entry => entry.id))
      buttonOrder.move(rail, id, beforeId)
    },
    trackEntryClick: (attributes) => { ctx.get('productAnalytics')?.track('sidebar_menu_click', attributes) },
    hooks: {
      panels,
      shortcuts: ctx.shortcuts.catalog,
      entryPins: panelPins.unpinned,
      entryActions,
      topButtons,
      tailButtons,
      selectedButton: buttonOrder.selected,
    },
  })
  ctx.slots.inject('sidebar', function* () {
    yield ctx.slots.registerFactory({
      name: 'sidebar.panel.icon', scope: 'root',
      children: { 'sidebar.panellist': { kind: 'list', scope: 'root' } },
    }, PanelIcon)
    yield ctx.slots.register({
      name: 'sidebar',
      locale: 'sidebar',
      children: {
        'sidebar.brand.mark': { kind: 'single', scope: 'root' },
        'sidebar.brand.name': { kind: 'single', scope: 'root' },
        'sidebar.toggle.badge': { kind: 'single', scope: 'root' },
        'sidebar.panellist.actions': { kind: 'list', scope: 'root' },
        'sidebar.workspaces': { kind: 'single', scope: 'root', inject: SIDEBAR_SECTION_INJECT },
        'sidebar.settings': { kind: 'single', scope: 'root' },
        'sidebar.footer.action': { kind: 'list', scope: 'root' },
        'sidebar.button.top': { kind: 'list', scope: 'root' },
        'sidebar.button.tail': { kind: 'list', scope: 'root' },
        'sidebar.button.panel': { kind: 'list', scope: 'session-maybe' },
      },
      inject: injectProps,
    }, SidebarRoot)
  })
  // macOS desktop hides the collapsed sidebar entirely, so the open/New
  // Session controls move into the frame's window-chrome seat beside the
  // traffic lights; the occupant reuses the shell's injected actions, and
  // the AppFrame mounts the seat only while the column is fully hidden.
  ctx.slots.inject('shell.leading', () => ctx.slots.register({
    name: 'shell.leading',
    locale: 'sidebar',
    inject: injectProps,
  }, HeaderLeadingControls))
  syncPanels()
  syncButtons()
  // Reveal, then select: a caller that asks for a body wants to see it, and
  // the column's own toggle is the only way to widen a collapsed track.
  const select: SidebarRailActions['select'] = (id) => {
    if (id !== null && collapsed) ctx.layout.toggleSidebar()
    buttonOrder.select(id)
  }
  ctx.effect(() => ctx.reflect.provide('sidebarRail', { select } satisfies SidebarRailActions), 'sidebar-idea: rail service')
  return { select }
}

export type { SidebarKey }
