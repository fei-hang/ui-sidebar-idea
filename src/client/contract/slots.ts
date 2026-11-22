/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * Sidebar slot contract: the registrant-side props composition for the
 * layout-owned `sidebar` slot, plus the holes this shell declares. The shell
 * owns column geometry, the brand row, New Session, and global panel rows;
 * everything between the workspace section header and the list bottom is the
 * `sidebar.workspaces` registrant's (ui-workspace), and the foot is the
 * `sidebar.settings` registrant's (ui-settings), followed by optional footer
 * actions in `sidebar.footer.action`.
 */
import type { RefCallback } from 'react'
import type {
  InjectFace, PropsLocale, PropsRenderFactories, PropsRenderSlots, PropsRuntime, SlotHookFactory,
} from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { WorkspaceId } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { ShortcutCatalogEntry } from '@deepseek-ai/dsh-client-shortcuts/client'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ProductEventMap } from '@deepseek-ai/dsh-client-product-analytics/client'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotFactoryMap {
    /** Reuse a registered panel icon in navigation rows and menus. */
    'sidebar.panel.icon': {
      scope: 'root'
      props: SidebarPanelIconOwnerProps & { readonly id: string }
      children: { 'sidebar.panellist': { kind: 'list'; scope: 'root' } }
    }
  }
  interface SlotMap {
    /** Non-interactive notification inside the collapsed sidebar expand button. */
    'sidebar.toggle.badge': { kind: 'single'; scope: 'root'; owner: Record<never, never> }
    /**
     * Brand mark rendered in the expanded brand row and collapsed rail.
     * Declared by this package's `sidebar` entry; deployments may replace
     * the shell's fish fallback without replacing the surrounding controls.
     */
    'sidebar.brand.mark': { kind: 'single'; scope: 'root'; owner: SidebarBrandMarkOwnerProps }
    /**
     * Brand name rendered beside the expanded mark. Declared by this
     * package's `sidebar` entry; the shell supplies a generic text fallback.
     */
    'sidebar.brand.name': { kind: 'single'; scope: 'root'; owner: SidebarBrandNameOwnerProps }
    /**
     * Global panel icons. Each list id addresses the matching main panel;
     * the sidebar owns the button and resolves its label from list metadata.
     */
    'sidebar.panellist': { kind: 'list'; scope: 'root'; owner: SidebarPanelIconOwnerProps }
    /** Rows of the panel list's More menu; the sidebar shows More only while this list has registrations. */
    'sidebar.panellist.actions': { kind: 'list'; scope: 'root'; owner: SidebarPanelActionsOwnerProps }
    /**
     * The workspace/session browsing region: section header, search, the
     * grouped/flat session list, and every workspace dialog. Declared by this
     * package's 'sidebar' entry (declaring is claiming); ui-workspace
     * registers the browser. The section renders inside the sidebar viewport,
     * which is a size container one viewport tall and a scroll-state container,
     * and binds its own vertical scroller through `useSectionScroller`.
     */
    'sidebar.workspaces': {
      kind: 'single'
      scope: 'root'
      owner: SidebarSectionOwnerProps
      hookContext: SidebarSectionHookContext
      inject: SidebarSectionInjected
    }
    /**
     * The settings seat at the sidebar foot. Declared by this package's
     * 'sidebar' entry; ui-settings registers its trigger row + modal panel.
     * The sidebar passes only its column state — it holds no settings state.
     */
    'sidebar.settings': { kind: 'single'; scope: 'root'; owner: SidebarSettingsOwnerProps }
    /**
     * Optional actions beside Settings at the sidebar foot. Declared by this
     * package's 'sidebar' entry; each action receives only the column state.
     */
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: SidebarFooterActionOwnerProps }
    /**
     * Activity-rail buttons above the rail's flexible gap, ordered top-down.
     * Declared by this package's 'sidebar' entry. The rail owns the button
     * box, the pressed state, and the drag reorder; a registrant supplies the
     * glyph and the accessible name, and reports selection through `onSelect`.
     */
    'sidebar.button.top': { kind: 'list'; scope: 'root'; owner: SidebarButtonOwnerProps }
    /**
     * Activity-rail buttons below the rail's flexible gap, ordered bottom-up:
     * the first registration sits nearest the built-in panel button.
     */
    'sidebar.button.tail': { kind: 'list'; scope: 'root'; owner: SidebarButtonOwnerProps }
    /**
     * Panel bodies for activity-rail buttons. A registrant that wants a panel
     * registers its body here under the same list id it used for its button;
     * the shell owns the panel box and renders the selected id's body. Absent
     * bodies leave the box empty, which is how a button that only performs an
     * action (New Session, for example) declares itself.
     *
     * Session-scoped because the bodies address Session-owned data: the
     * workspace file tree lists directories through a Session's Remote, and a
     * root-scoped body would have no Session to name. The shell wraps the box
     * in its SessionProvider, so a body draws nothing until a Session exists.
     */
    'sidebar.button.panel': { kind: 'list'; scope: 'session-maybe'; owner: SidebarButtonPanelOwnerProps }
    /**
     * The Session-bound body of the bottom terminal panel, rendered inside
     * the `shell.bottom` seat's Session area. Declared by the terminal
     * panel's own registration so that panel receives `SessionProvider`:
     * `shell.bottom` carries no Session binding of its own, and this child
     * is what lets the terminal name the current Session.
     */
    'sidebar.terminal.panel': { kind: 'single'; scope: 'session-maybe'; owner: SidebarTerminalPanelOwnerProps }
  }
}

/** Geometry supplied to the sidebar brand-mark occupant. */
export interface SidebarBrandMarkOwnerProps {
  /** Requested square edge in pixels. */
  size: number
}

/** Empty owner share for the sidebar brand-name occupant. */
export interface SidebarBrandNameOwnerProps {
  /** Marker field: the occupant owns its own content and width. */
  children?: never
}

/** Icon presentation supplied by the global panel row. */
export interface SidebarPanelIconOwnerProps {
  /** Requested square edge in pixels. */
  size: number
  /** Whether this panel is selected in the main column. */
  active: boolean
}

/** Serializable metadata for one active global panel list registration. */
export interface SidebarPanelMetadata {
  /** List id and matching main panel key. */
  id: MainPanelId
  /** Ascending row order; ties retain registration order. */
  order: number
  /** Row title and accessible name: resolved label, or the id when omitted. */
  label: string
}

/** One customizable panel launcher listed in the More menu. */
export interface SidebarPanelActionEntry {
  /** Panel id. */
  readonly id: string
  /** Resolved panel label. */
  readonly label: string
  /** False while the launcher is unpinned from the sidebar. */
  readonly pinned: boolean
  /** Whether this panel is selected, independently of its pin state. */
  readonly active?: boolean
}

/** Owner share of the panel list's More menu rows. */
export interface SidebarPanelActionsOwnerProps {
  /** Customizable panels in registration order; Plugins is never listed. */
  readonly entries: readonly SidebarPanelActionEntry[]
  /**
   * Open a panel without changing its pin state.
   * @param id - Listed panel id.
   */
  readonly onOpen: (id: string) => void
  /**
   * Show (true) or unpin (false) a panel launcher.
   * @param id - Listed panel id.
   * @param pinned - Whether the launcher shows in the sidebar.
   */
  readonly onPinnedChange: (id: string, pinned: boolean) => void
  /** Close the More menu. */
  readonly onDismiss: () => void
}

/**
 * Owner share of the browser hole — the only facts crossing the shell/region
 * boundary. Business data and actions arrive through the region's own inject.
 */
export interface SidebarSectionOwnerProps {
  /** Shell fold-state output: wide renders the full browser, rail the icon column. */
  wide: boolean
  /** Ensure the sidebar is visible; safe to call while already expanded. */
  expandSidebar: () => void
}

/** Sidebar viewport capability handed to the `sidebar.workspaces` occupant. */
export interface SectionScroller {
  /**
   * Ref callback for the occupant's own vertical scroller. While bound, wheel scrolling over
   * the sidebar viewport moves the navigation away first and then continues into this element;
   * scrolling up returns this element to its top before the navigation reappears.
   */
  readonly bindScrollerRef: RefCallback<HTMLElement>
}

/**
 * Bind the occupant to the sidebar viewport it renders in.
 * @returns The same object on every call for one sidebar.
 */
export type UseSectionScroller = () => SectionScroller

/** Viewport capability supplied with each `sidebar.workspaces` render. */
export interface SidebarSectionHookContext {
  readonly useSectionScroller: UseSectionScroller
}

/** Slot-level Hook factory for the `sidebar.workspaces` occupant. */
export interface SidebarSectionInjected {
  hooks: { sectionScroller: SlotHookFactory<'sidebar.workspaces', UseSectionScroller> }
}

/**
 * Owner share of the sidebar settings seat: the column display state the
 * occupant's trigger row must render against (wide row vs rail icon).
 */
export interface SidebarSettingsOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/** Owner share of an action rendered beside Settings at the sidebar foot. */
export interface SidebarFooterActionOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/**
 * Owner share of one activity-rail button. The rail owns the button box, the
 * pressed state, the tooltip, and the drag reorder; the occupant supplies the
 * glyph and forwards clicks to `onSelect`.
 */
export interface SidebarButtonOwnerProps {
  /** Requested square edge of the glyph in pixels. */
  readonly size: number
  /** Whether this button is the selected rail item. */
  readonly active: boolean
  /** Select this button: reveal the sidebar column and show its panel body. */
  readonly onSelect: () => void
}

/**
 * Owner share of a panel body shown beside the activity rail. The shell owns
 * the panel box, its width, and which id renders; the occupant owns everything
 * inside the box.
 */
export interface SidebarButtonPanelOwnerProps {
  /** Whether this body belongs to the selected rail item. */
  readonly active: boolean
}

/**
 * Owner share of the bottom terminal panel's Session body. The panel box owns
 * whether it is on screen; the body needs that fact to hand the keyboard to the
 * focused tab's emulator, which cannot tell on its own whether the zero-height
 * box it lives in is open or merely closed.
 */
export interface SidebarTerminalPanelOwnerProps {
  /** Whether the panel is expanded on screen (false while it is a zero-height box). */
  readonly visible: boolean
}

/** One activity-rail registration projected from its slot entry. */
export interface SidebarButtonMetadata {
  /** List id; also the id that addresses the matching `sidebar.button.panel` body. */
  readonly id: string
  /** Registration order used until the user drags the button elsewhere. */
  readonly order: number
  /** Accessible name and tooltip text. */
  readonly label: string
}

/**
 * Registrant-private injected share (arrives via the register inject
 * factory). The renderer binds the panel metadata source to usePanels.
 */
export type SidebarRootInjected = {
  /**
   * Start a New Session: with a workspace, reuse-or-create its blank session
   * and open it; without one, inherit the current Session Workspace, then the
   * recent Workspace, or clear into the New Session pure view when none exist.
   */
  startSession: (workspaceId?: WorkspaceId) => void
  /** Toggle the sidebar column through the layout service. */
  toggleSidebar: () => void
  /** Select the global panel addressed by a sidebar row. */
  selectPanel: (id: MainPanelId) => void
  /**
   * Show or unpin one panel launcher; Plugins is ignored.
   * @param id - Panel id.
   * @param pinned - Whether the launcher shows in the sidebar.
   */
  setPinned: (id: string, pinned: boolean) => void
  /** Record activation of an official navigation control without changing navigation. */
  trackEntryClick: (attributes: ProductEventMap['sidebar_menu_click']) => void
  /**
   * Select one activity-rail item, or return the rail to the sidebar body.
   * @param id - Rail id whose panel body shows; null shows the sidebar itself.
   */
  selectButton: (id: string | null) => void
  /**
   * Report whether the column currently shows only its rail.
   * @param collapsed - whether the column is collapsed.
   */
  reportCollapsed: (collapsed: boolean) => void
  /**
   * Move a rail button to another position on its own rail.
   * @param rail - Rail being reordered.
   * @param id - Id being moved.
   * @param beforeId - Id the moved button now sits before; null appends.
   */
  moveButton: (rail: 'top' | 'tail', id: string, beforeId: string | null) => void
  /** Private reactive sources bound to framework selector hooks. */
  hooks: {
    panels: ObservableSnapshot<readonly SidebarPanelMetadata[]>
    shortcuts: ObservableSnapshot<readonly ShortcutCatalogEntry[]>
    /** Ids of unpinned panel launchers held in memory until plugin reload. */
    entryPins: ObservableSnapshot<readonly string[]>
    /** Whether `sidebar.panellist.actions` has registrations. */
    entryActions: ObservableSnapshot<boolean>
    /** Rail buttons above the flexible gap, in user order. */
    topButtons: ObservableSnapshot<readonly SidebarButtonMetadata[]>
    /** Rail buttons below the flexible gap, in user order. */
    tailButtons: ObservableSnapshot<readonly SidebarButtonMetadata[]>
    /** Selected rail item, or null while the rail shows the panel list. */
    selectedButton: ObservableSnapshot<string | null>
  }
}

/**
 * Full component props: layout owner state/actions plus the declared holes'
 * render shares, this package's injected callbacks, and the standard locale
 * seat. Panel metadata arrives through an injected observable.
 */
export type SidebarRootComponentProps =
  PropsRuntime<'sidebar'>
  & PropsRenderSlots<
    | 'sidebar.brand.mark'
    | 'sidebar.brand.name'
    | 'sidebar.toggle.badge'
    | 'sidebar.panellist.actions'
    | 'sidebar.workspaces'
    | 'sidebar.settings'
    | 'sidebar.footer.action'
    | 'sidebar.button.top'
    | 'sidebar.button.tail'
    | 'sidebar.button.panel'
  >
  & PropsRenderFactories & InjectFace<SidebarRootInjected> & PropsLocale<'sidebar'>
