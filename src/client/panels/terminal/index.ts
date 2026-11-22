/**
 * The rail's terminal button and the bottom panel it opens.
 *
 * The button sits in the rail's tail row, so it is one of the buttons that hang
 * upward from the bottom of the strip. Unlike a top-row button it does not take
 * over the sidebar's second column: it opens `shell.bottom`, the frame's
 * bottom seat, which pushes the columns up by the panel's height.
 *
 * The panel declares one child seat of its own, `sidebar.terminal.panel`,
 * scoped to the current Session. `shell.bottom` carries no Session binding, so
 * that child is how the terminal learns which Session it belongs to.
 *
 * Each tab is its own terminal: the tab's occurrence key and content id are
 * derived from the tab id, so two tabs in one Session hold two Host processes
 * and a reload rebinds each of them to the shell it was showing.
 *
 * The controller keeps a Host-side "window hold" alive only for terminal
 * occurrences the layout reports as open. That list belongs to the page rather
 * than to this plugin, and the right sidebar's own terminal tabs rewrite it
 * wholesale, which releases this plugin's hold. A released hold ends the Host
 * terminal, so the view cannot be refreshed back to life: this module watches
 * for that failure and opens a fresh terminal in its place.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { createSnapshotStore, type ObservableSnapshot, type SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// The seats this module registers into and the services it reads.
import type {} from '../../contract/slots.ts'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import type {
  ClientTerminals, TerminalView,
} from '@deepseek-ai/dsh-api-terminal-controller/client'
import type { TerminalShell } from '@deepseek-ai/dsh-api-terminal-controller/types'
import type { ShortcutCommandId } from '@deepseek-ai/dsh-client-shortcuts/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { de, en, es, fr, ja, pt, ru, zh, type SidebarTerminalIdeaKey } from '../../locales/terminal.ts'
import { TerminalButton } from '../../buttons/tail/terminal/TerminalButton.tsx'
import { shellNameOf } from './terminal-shell.ts'
import { TerminalBody } from './TerminalBody.tsx'
import { TerminalPanel } from './TerminalPanel.tsx'
import { TerminalSettingsSection } from './TerminalSettingsSection.tsx'
import { createTerminalPanel } from './terminal-state.ts'

/** The rail button's id, which also names the panel body it opens. */
const BUTTON_ID = 'terminal'
/**
 * Base of every terminal's occurrence key and content identity. One occurrence
 * per tab, so the tab id is appended to both: the key names this plugin's own
 * slot in that Session's terminal table, and the content id is what the Host
 * uses to rebind the same shell after a reload.
 */
const TERMINAL_KEY = 'idea-bottom-terminal'
const TERMINAL_CONTENT = 'dsh-client-ui-sidebar-idea/terminal'
/** How many times one view may be replaced before the panel settles on its error. */
const MAX_RECOVERIES = 3
/**
 * The keyboard command that reveals the panel. It is this plugin's own id: the
 * stock right sidebar terminal owns `terminal.new`, and a command id is claimed
 * by exactly one package, so reusing that one would either collide on
 * registration or hand the gesture to whichever package registered first.
 */
const OPEN_COMMAND = 'sidebarTerminalIdea.terminal' as ShortcutCommandId

/** Copy for the terminal button, the panel, and the emulator's states. */
export const NS = 'sidebarTerminalIdea'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy for the terminal rail button and the bottom panel. */
    sidebarTerminalIdea: SidebarTerminalIdeaKey
  }
}

/** What this module exposes to the rest of the plugin. */
export interface SidebarTerminalActions {
  /** Open the bottom terminal panel when closed, close it when open. */
  toggle(): void
}

/** One tab's terminal occurrence: the two identities the controller is keyed by. */
interface Occurrence {
  /** Terminal table key for this tab. */
  readonly tabId: string
  /** Content identity used to rebind the same shell after a reload. */
  readonly contentId: string
}

/**
 * The right sidebar's open tabs, as this panel reads them. Its declared type
 * carries a private inventory class, so only the observable surface is named.
 */
type ClientOpenTabs = ObservableSnapshot<readonly {
  readonly sessionId: SessionId
  readonly tabId: string
  readonly kind: string
  readonly contentId: string
}[]>

/** One held terminal: an occurrence plus the Session whose table it lives in. */
interface Held extends Occurrence {
  /** Session owning the terminal. */
  readonly sessionId: SessionId
}

/**
 * Derive one tab's terminal occurrence.
 * @param tab - the panel tab's id.
 * @returns the occurrence key and content identity for that tab.
 */
function occurrenceOf(tab: string): Occurrence {
  return { tabId: `${TERMINAL_KEY}.${tab}`, contentId: `${TERMINAL_CONTENT}/${tab}` }
}

/**
 * Register the terminal button, the bottom panel, and the Session-bound body.
 * @param ctx - client Cordis context; `webTerminals` must be available.
 * @returns the panel's toggle, for a package that wants to open it.
 */
export function applyTerminal(ctx: ClientContext): SidebarTerminalActions {
  const t = ctx.locale.bind(NS)
  const panel = createTerminalPanel()
  /** The open flag as the rail button's selector hook sees it. */
  const openFlag: ObservableSnapshot<boolean> = {
    getSnapshot: () => panel.state.getSnapshot().open,
    subscribe: (listener) => panel.state.subscribe(listener),
  }
  /** Shells the Host reported for the current Session, as the Settings table offers them. */
  const discovered: SnapshotStore<readonly TerminalShell[]> = createSnapshotStore<readonly TerminalShell[]>([])
  const shellsFlag: ObservableSnapshot<readonly TerminalShell[]> = {
    getSnapshot: () => discovered.getSnapshot(),
    subscribe: (listener) => discovered.subscribe(listener),
  }
  /** The view the panel is drawing; replaced whenever a terminal has to be reopened. */
  const current: SnapshotStore<TerminalView | undefined> = createSnapshotStore<TerminalView | undefined>(undefined)
  /** The Session the panel last resolved; every other Session's terminals are released. */
  let session: SessionId | undefined
  /** One state subscription per live terminal view, released when that view is replaced. */
  const keepers = new Map<TerminalView, () => void>()
  /** Live views, keyed by Session and tab. */
  const views = new Map<string, TerminalView>()
  /** The occurrence each live view is held under, keyed the same way. */
  const claimed = new Map<string, { readonly sessionId: SessionId; readonly tab: string } & Occurrence>()
  /** The claim last handed to the controller, used to skip redundant writes. */
  let claimKey = ''
  /** Discovery for the shell list, cancelled when the Session changes. */
  let discovering: AbortController | undefined

  /**
   * The terminal service, read lazily: the package-level `inject` list must not
   * name it, or a profile without the terminal controller would lose the whole
   * sidebar instead of just the bottom panel.
   * @returns the controller, or undefined when the profile does not run one.
   */
  const terminals = (): ClientTerminals | undefined => {
    try {
      return ctx.get('webTerminals')
    } catch {
      return undefined
    }
  }
  /**
   * The Session the main view is showing, which is the one Settings seeds from.
   *
   * Settings is a root-scoped seat, so it has no Session of its own; the Session
   * area in the frame is what names the one on screen.
   * @returns that Session, or undefined while no Session is open.
   */
  const visibleSession = (): SessionId | undefined => {
    try {
      const state = ctx.sessions.list.getSnapshot()
      return Object.values(state.byId).find(entry => (entry.retainedBy.mainView ?? 0) > 0)?.id
    } catch {
      return undefined
    }
  }
  /**
   * The right sidebar's tab list, read lazily for the same reason as the
   * terminal controller: a profile without that service still gets the panel.
   * @returns the observable tab list, or undefined when the service is absent.
   */
  const openTabsOf = (): ClientOpenTabs | undefined => {
    try {
      return ctx.sidebarRight.openTabs
    } catch {
      return undefined
    }
  }
  /**
   * The terminal occurrences the right sidebar holds open.
   *
   * The controller keeps one window-wide list of held terminals, and the right
   * sidebar rewrites that list from its own tabs alone. Reading its list here is
   * what lets this panel add its claims to that one instead of replacing it.
   * @returns the right sidebar's terminal tabs, or nothing without the service.
   */
  const rightTabs = (): readonly Held[] => {
    const tabs = openTabsOf()
    if (tabs === undefined) return []
    return tabs.getSnapshot()
      .filter(tab => tab.kind === 'terminal')
      .map(tab => ({ sessionId: tab.sessionId, tabId: tab.tabId, contentId: tab.contentId }))
  }
  /**
   * Tell the controller which terminal occurrences this window keeps alive.
   *
   * The list is shared with every other package that owns terminal tabs and each
   * write replaces it, so this writes the union of both: the right sidebar's tabs
   * and this panel's claims. Writing only its own claims would release the other
   * panel's Host terminals, which cannot be revived — the view would settle on
   * "terminal unavailable" instead.
   * @param force - write the union again even when it has not changed; the other
   * panel writes its own list whenever its tabs change, and this has to follow.
   * @returns nothing; the controller reconciles its Host-side holds.
   */
  const syncHolds = (force = false): void => {
    const controller = terminals()
    if (controller === undefined) return
    const tabs: Held[] = [
      ...rightTabs(),
      ...[...claimed.values()].map((claim) => ({
        sessionId: claim.sessionId,
        tabId: claim.tabId,
        contentId: claim.contentId,
      })),
    ]
    const key = tabs.map(tab => `${tab.sessionId}\u0000${tab.tabId}`).sort().join(',')
    if (!force && key === claimKey) return
    claimKey = key
    controller.retainTabs(tabs)
  }
  /**
   * Drop one view's watcher.
   * @param view - the terminal being replaced or released.
   */
  const forget = (view: TerminalView): void => {
    keepers.get(view)?.()
    keepers.delete(view)
  }
  /**
   * Close one tab's Host terminal and forget its view.
   * @param key - Session and tab, as `claimKeyOf` builds it.
   */
  const release = (key: string): void => {
    const claim = claimed.get(key)
    const view = views.get(key)
    if (view !== undefined) forget(view)
    views.delete(key)
    claimed.delete(key)
    if (claim !== undefined) terminals()?.close(claim.sessionId, claim.tabId, claim.contentId)
    if (view !== undefined && current.getSnapshot() === view) current.set(undefined)
    syncHolds(true)
  }
  /**
   * Watch a terminal for a lost Host process and open a replacement for it.
   *
   * `missingTerminal` is the one failure the view cannot retry: the terminal it
   * is bound to is gone, and the binding has to be dropped before a new one can
   * be allocated. Any other failure keeps its terminal, so a refresh is enough.
   * @param view - the terminal to watch.
   * @param key - Session and tab the view belongs to.
   * @param sessionId - the Session that terminal belongs to.
   */
  const watch = (view: TerminalView, key: string, sessionId: SessionId): void => {
    if (keepers.has(view)) return
    let phase = view.state.getSnapshot().phase
    let recoveries = 0
    const unsubscribe = view.state.subscribe(() => {
      const snapshot = view.state.getSnapshot()
      if (snapshot.phase === phase) return
      phase = snapshot.phase
      if (snapshot.phase === 'connected') {
        recoveries = 0
        return
      }
      // A full Session is not a broken terminal: refreshing cannot free a slot,
      // so the cap is left to the user, who is the one who can close a tab.
      if (snapshot.issue === 'terminalLimit') return
      if (snapshot.phase !== 'failed' || recoveries >= MAX_RECOVERIES) return
      // A view whose Session the panel has moved away from stays failed: the
      // panel shows one Session's terminals, and reopening this one in its place
      // would pull the panel back to a Session the user left.
      if (sessionId !== session) return
      recoveries += 1
      if (snapshot.issue === 'missingTerminal') reopen(key, sessionId)
      else {
        syncHolds()
        void view.refresh()
      }
    })
    keepers.set(view, unsubscribe)
  }
  /**
   * Open a fresh terminal in place of one whose Host process is gone.
   *
   * A released hold ends the terminal itself, so the replacement cannot reuse
   * the identity: closing the occurrence drops the binding, and the next
   * `view` call allocates a new terminal for the same content id.
   * @param key - Session and tab whose terminal has to be reopened.
   * @param sessionId - the Session that terminal belongs to.
   */
  const reopen = (key: string, sessionId: SessionId): void => {
    const controller = terminals()
    const claim = claimed.get(key)
    if (controller === undefined || claim === undefined) return
    const previous = views.get(key)
    if (previous !== undefined) forget(previous)
    views.delete(key)
    controller.close(sessionId, claim.tabId, claim.contentId)
    syncHolds(true)
    const view = controller.view(sessionId, claim.tabId, claim.contentId)
    syncHolds(true)
    views.set(key, view)
    watch(view, key, sessionId)
    if (previous === undefined || current.getSnapshot() === previous) current.set(view)
  }
  /**
   * Key one Session's tab.
   * @param sessionId - the Session the tab belongs to.
   * @param tab - the panel tab's id.
   * @returns a key that is unique across Sessions and tabs.
   */
  const claimKeyOf = (sessionId: SessionId, tab: string): string => `${sessionId}\u0000${tab}`
  /**
   * Drop every terminal that does not belong to the Session now on screen.
   *
   * Tabs are shared by every Session, so switching Sessions would otherwise
   * leave the previous one's shells running with nothing on screen holding them.
   * @param keep - the Session whose terminals stay.
   */
  const releaseOthers = (keep: SessionId): void => {
    for (const [key, claim] of [...claimed]) {
      if (claim.sessionId !== keep) release(key)
    }
  }
  /**
   * Drop the terminals of tabs the panel no longer holds.
   * @param sessionId - the Session whose tabs to reconcile.
   */
  const reconcileTabs = (sessionId: SessionId | undefined): void => {
    if (sessionId === undefined) return
    const open = new Set(panel.state.getSnapshot().tabs.map(tab => tab.id))
    for (const [key, claim] of [...claimed]) {
      if (claim.sessionId === sessionId && !open.has(claim.tab)) release(key)
    }
  }
  /**
   * The current Session's terminal for one tab, created on first use.
   * @param sessionId - the Session the panel's Session area resolved.
   * @param tab - the panel tab to draw.
   * @param shellPath - shell to launch for a new terminal; ignored once it exists.
   * @returns that tab's terminal view, or undefined without the controller.
   */
  const ensure = (sessionId: SessionId, tab: string, shellPath = ''): TerminalView | undefined => {
    if (session !== sessionId) {
      session = sessionId
      releaseOthers(sessionId)
      current.set(undefined)
      discoverShells(sessionId)
    }
    const key = claimKeyOf(sessionId, tab)
    const existing = views.get(key)
    if (existing !== undefined) {
      if (current.getSnapshot() !== existing) current.set(existing)
      return existing
    }
    const controller = terminals()
    if (controller === undefined) return undefined
    const occurrence = occurrenceOf(tab)
    // The claim has to be in place before the view exists: `view` opens its own
    // hold and then reconciles, which drops any hold no tab claims.
    claimed.set(key, { sessionId, tab, ...occurrence })
    syncHolds(true)
    const view = controller.view(sessionId, occurrence.tabId, occurrence.contentId, undefined, shellPath === '' ? undefined : shellPath)
    syncHolds(true)
    views.set(key, view)
    watch(view, key, sessionId)
    current.set(view)
    return view
  }
  /**
   * Ask the Host which shells it can launch, and seed the settings table from
   * them the first time. A shell the Host did not report cannot be started, so
   * the table never offers one.
   * @param sessionId - the Session whose execution environment to ask.
   */
  function discoverShells(sessionId: SessionId): void {
    const controller = terminals()
    if (controller === undefined) return
    discovering?.abort()
    const abort = new AbortController()
    discovering = abort
    void controller.launchShells(sessionId, abort.signal).then((result) => {
      if (abort.signal.aborted) return
      discovered.set(result.shells)
      panel.seedProfiles(result.shells.map(shell => ({
        id: '',
        name: shell.name === '' ? shellNameOf(shell.path) : shell.name,
        shellPath: shell.path,
      })))
    }).catch(() => {
      // A profile whose Host cannot list shells still has the default shell.
    })
  }

  ctx.effect(
    () => ctx.locale.register(NS, { zh, en, ja, es, fr, de, ru, pt }),
    'sidebar-terminal-idea: dictionaries',
  )

  ctx.effect(() => {
    const unsubscribe = panel.state.subscribe(() => {
      syncHolds()
      reconcileTabs(session)
    })
    syncHolds()
    return () => {
      unsubscribe()
      discovering?.abort()
      for (const stop of keepers.values()) stop()
      keepers.clear()
      views.clear()
      claimed.clear()
      claimKey = ''
      // Only this panel's claims go; the right sidebar's terminals stay held.
      terminals()?.retainTabs(rightTabs())
    }
  }, 'sidebar-terminal-idea: window holds')

  // The right sidebar writes the shared hold list from its own tabs alone, which
  // drops this panel's holds and ends its Host terminals. Putting the union back
  // has to happen after that write, so it is queued: a microtask runs once every
  // subscriber of the same change has finished.
  ctx.effect(() => {
    let queued = false
    const restore = (): void => {
      if (queued) return
      queued = true
      queueMicrotask(() => {
        queued = false
        syncHolds(true)
      })
    }
    const tabs = openTabsOf()
    if (tabs === undefined) return () => {}
    const unsubscribe = tabs.subscribe(restore)
    return () => {
      unsubscribe()
    }
  }, 'sidebar-terminal-idea: shared holds')

  ctx.effect(
    () => ctx.slots.inject('sidebar.button.tail', () => ctx.slots.register({
      name: 'sidebar.button.tail',
      id: BUTTON_ID,
      order: 10,
      label: () => t('button.label'),
      locale: NS,
      inject: () => ({ toggle: panel.toggle, hooks: { open: openFlag } }),
    }, TerminalButton)),
    'sidebar-terminal-idea: rail button',
  )

  ctx.effect(
    () => ctx.slots.inject('shell.bottom', () => ctx.slots.register({
      name: 'shell.bottom',
      locale: NS,
      inject: () => ({ panel, closeTab: panel.closeTab }),
      children: { 'sidebar.terminal.panel': { kind: 'single', scope: 'session-maybe' } },
    }, TerminalPanel)),
    'sidebar-terminal-idea: bottom panel',
  )

  ctx.effect(
    () => ctx.slots.inject('sidebar.terminal.panel', () => ctx.slots.register({
      name: 'sidebar.terminal.panel',
      locale: NS,
      inject: (sessionId) => ({
        sessionId,
        panel,
        ensure,
        discover: (id: SessionId) => { if (discovered.getSnapshot().length === 0) discoverShells(id) },
        hooks: { panel: panel.state, terminal: current },
      }),
    }, TerminalBody)),
    'sidebar-terminal-idea: terminal body',
  )

  // The shell table belongs to Settings, not to the panel: the panel is the tab
  // strip and the screen, and a command line's location is chosen once rather
  // than per tab.
  ctx.effect(
    () => ctx.slots.inject('settings.section', () => ctx.slots.register({
      name: 'settings.section',
      id: 'terminal',
      order: 60,
      label: () => t('settings.nav'),
      locale: NS,
      inject: () => {
        const sessionId = visibleSession()
        return {
          sessionId,
          panel,
          discover: (id: SessionId) => { if (discovered.getSnapshot().length === 0) discoverShells(id) },
          hooks: { panel: panel.state, shells: shellsFlag },
        }
      },
    }, TerminalSettingsSection)),
    'sidebar-terminal-idea: settings page',
  )

  // The panel is the frame's bottom seat, not a sidebar body, so no rail
  // handler ever reaches it: the keyboard command is how it opens. A closed
  // panel is revealed with the tabs it kept; an open one grows a tab, which is
  // what pressing the key again should do.
  //
  // The gesture is the stock right sidebar terminal's: that package claims
  // `terminal.new` and the registry refuses two commands on one default, so a
  // load that still mounts it fails this registration. The failure is swallowed
  // here — losing the key is survivable, losing the column is not — and the
  // bundle's patch layer disables that package so the key is this panel's.
  ctx.effect(() => {
    const reveal = (): void => {
      if (panel.state.getSnapshot().open) panel.openDefaultTab()
      else panel.open()
    }
    try {
      return ctx.shortcuts.register({
        id: OPEN_COMMAND,
        label: () => t('shortcut.open'),
        aliases: ['terminal', 'shell', 'panel'],
        defaults: {
          'desktop:macos': { code: 'Backquote', modifiers: ['control'] },
          'desktop:windows': { code: 'Backquote', modifiers: ['control'] },
          'desktop:linux': { code: 'Backquote', modifiers: ['control'] },
          'web:macos': { code: 'Backquote', modifiers: ['control'] },
          'web:windows': { code: 'Backquote', modifiers: ['control'] },
        },
        regions: ['page', 'editable', 'terminal'],
        modals: [],
        resolve: () => ({ status: 'handled', run: reveal }),
      })
    } catch {
      return () => {}
    }
  }, 'sidebar-terminal-idea: shortcut')

  return { toggle: panel.toggle }
}