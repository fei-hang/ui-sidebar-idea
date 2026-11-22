/**
 * The bottom terminal panel's own state: whether it is open, how tall it is,
 * which terminal tabs it holds, and the shell list those tabs are opened from.
 *
 * It lives outside the components because three separate seats read it: the
 * rail button reads the open flag, the tab bar writes the tab list, and the
 * Session-bound body reads the active tab. The shell list is the one part that
 * outlives the page, so it is the one part written to storage.
 */
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'

/** Shortest and tallest panel heights, in pixels. */
const MIN_HEIGHT = 120
const MAX_HEIGHT = 720
/** Height a freshly opened panel starts at. */
const DEFAULT_HEIGHT = 280
/** Where the shell list is remembered between page loads. */
const PROFILES_KEY = 'dsh.sidebarTerminal.profiles.v1'
/** Where the shell a new tab starts with is remembered between page loads. */
const DEFAULT_KEY = 'dsh.sidebarTerminal.defaultShell.v1'

/**
 * One launchable shell: a name and where its executable lives.
 *
 * The executable is a path the user sets, seeded from the Host's discovery.
 * Nothing else about the terminal is per-profile — it opens where the Host puts
 * it — so the location is the whole of what a row configures.
 */
export interface TerminalProfile {
  /** Stable identity; empty on a profile that is still being created. */
  readonly id: string
  /** Name shown in the tab bar and in the Settings table. */
  readonly name: string
  /** Executable to launch; empty means the Host's default shell. */
  readonly shellPath: string
}

/** One terminal tab: an occurrence key plus the shell it was opened with. */
export interface TerminalTab {
  /** Occurrence key, unique per tab; also the terminal's content identity. */
  readonly id: string
  /** Profile the tab was opened from; empty for the Host's default shell. */
  readonly profileId: string
}

/** What the panel, its tab bar, and its rail button all read. */
export interface TerminalPanelState {
  /** Whether the panel is showing; a closed panel reserves no page height. */
  readonly open: boolean
  /** Panel height in pixels, owned by the drag handle at its top edge. */
  readonly height: number
  /** Open terminal tabs, in tab-bar order. */
  readonly tabs: readonly TerminalTab[]
  /** The tab the body draws; undefined only while the last tab is closing. */
  readonly activeTab: string | undefined
  /** Shells the tab bar offers, in settings-table order. */
  readonly profiles: readonly TerminalProfile[]
  /**
   * The shell a new tab starts with, or empty for the Host's own default.
   *
   * Settings owns this choice: the tab bar's plus button, the keyboard command,
   * and the tab a freshly opened panel creates all ask for "the default shell",
   * and this is what answers them.
   */
  readonly defaultProfileId: string
}

/** The panel's observable state plus the writes its seats perform. */
export interface TerminalPanel {
  /** Open flag, height, tabs, and shells, bound to the panel's selector hooks. */
  readonly state: SnapshotStore<TerminalPanelState>
  /** Open the panel when closed, close it when open. */
  toggle(): void
  /** Show the panel, leaving an already open one alone. */
  open(): void
  /** Close the panel. */
  close(): void
  /**
   * Set the panel height, clamped to the supported range.
   * @param height - requested height in pixels.
   */
  resize(height: number): void
  /**
   * Open a tab and focus it.
   * @param profileId - shell to launch, or empty for the Host's default.
   * @returns the new tab's occurrence key.
   */
  openTab(profileId: string): string
  /**
   * Open a tab on the default shell and focus it.
   * @returns the new tab's occurrence key.
   */
  openDefaultTab(): string
  /**
   * Close one tab; closing the last one closes the panel with it.
   * @param id - the tab's occurrence key.
   */
  closeTab(id: string): void
  /**
   * Focus one tab.
   * @param id - the tab's occurrence key.
   */
  selectTab(id: string): void
  /**
   * Choose the shell a new tab starts with.
   * @param id - the profile's id, or empty for the Host's default shell.
   */
  setDefaultProfile(id: string): void
  /**
   * Add or replace one shell profile. A profile with an empty id is new and is
   * given an id here.
   * @param profile - the shell to keep.
   * @returns the stored profile, with its id filled in.
   */
  saveProfile(profile: TerminalProfile): TerminalProfile
  /**
   * Forget one shell profile. Tabs opened from it fall back to the Host default.
   * @param id - the profile's id.
   */
  removeProfile(id: string): void
  /**
   * Fill an empty shell list from the Host's discovery. A list that already has
   * entries is left alone, so seeding never overwrites an edited table.
   * @param profiles - shells the Host reported.
   */
  seedProfiles(profiles: readonly TerminalProfile[]): void
}

/** Tab and profile ids only have to be unique within one page. */
let sequence = 0

/**
 * Mint an id that is unique for this page.
 * @param prefix - short tag naming the kind of id.
 * @returns the id.
 */
function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${sequence.toString(36)}-${Date.now().toString(36)}`
}

/**
 * The browser's storage, when it has any: the terminal panel is usable in
 * contexts (tests, embedded views) where `localStorage` is absent or throws.
 * @returns the store, or undefined when it cannot be reached.
 */
function storage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

/**
 * Whether a parsed value has the shape of a stored profile.
 * @param value - one entry of the stored list.
 * @returns true when every field is a string.
 */
function isProfile(value: unknown): value is TerminalProfile {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.id === 'string'
    && typeof candidate.name === 'string'
    && typeof candidate.shellPath === 'string'
}

/**
 * Read the remembered shell list.
 * @returns the stored profiles, or an empty list when nothing usable is stored.
 */
function readProfiles(): readonly TerminalProfile[] {
  try {
    const raw = storage()?.getItem(PROFILES_KEY)
    if (raw === null || raw === undefined) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isProfile) : []
  } catch {
    return []
  }
}

/**
 * Remember the shell list. Storage is optional, so a failure is not an error.
 * @param profiles - the list to store.
 */
function writeProfiles(profiles: readonly TerminalProfile[]): void {
  try {
    storage()?.setItem(PROFILES_KEY, JSON.stringify(profiles))
  } catch {
    // A full or disabled store only costs the list its persistence.
  }
}

/**
 * Read the remembered default shell.
 * @returns the stored profile id, or empty when the Host's default is chosen.
 */
function readDefaultProfile(): string {
  try {
    return storage()?.getItem(DEFAULT_KEY) ?? ''
  } catch {
    return ''
  }
}

/**
 * Remember the default shell. Storage is optional, so a failure is not an error.
 * @param id - the profile id to store; empty means the Host's default.
 */
function writeDefaultProfile(id: string): void {
  try {
    storage()?.setItem(DEFAULT_KEY, id)
  } catch {
    // A full or disabled store only costs the choice its persistence.
  }
}

/**
 * Keep a wanted height inside the panel's range.
 *
 * A drag writes the height straight to the element so the edge can follow the
 * pointer without a React render in between; it therefore has to apply the same
 * bounds the store does, or the panel would slide past the range and snap back
 * the moment the drag is committed.
 * @param height - the height the pointer asks for, in CSS pixels.
 * @returns that height, rounded and clamped to the panel's range.
 */
export function clampHeight(height: number): number {
  return Math.round(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)))
}

/**
 * Create the panel state.
 * @returns the observable state and its writers.
 */
export function createTerminalPanel(): TerminalPanel {
  const state = createSnapshotStore<TerminalPanelState>({
    open: false,
    height: DEFAULT_HEIGHT,
    tabs: [],
    activeTab: undefined,
    profiles: readProfiles(),
    defaultProfileId: readDefaultProfile(),
  })
  // Every writer builds a fresh object, so an unchanged field can be detected by
  // identity: only a real change notifies, which keeps a drag from repainting
  // the rail and the tab bar on every pixel.
  const patch = (next: Partial<TerminalPanelState>): void => {
    const current = state.getSnapshot()
    const merged = { ...current, ...next }
    if (merged.open === current.open
      && merged.height === current.height
      && merged.tabs === current.tabs
      && merged.activeTab === current.activeTab
      && merged.profiles === current.profiles
      && merged.defaultProfileId === current.defaultProfileId) return
    state.set(merged)
  }
  return {
    state,
    toggle: () => {
      patch({ open: !state.getSnapshot().open })
    },
    open: () => {
      patch({ open: true })
    },
    close: () => {
      patch({ open: false })
    },
    resize: (height) => {
      patch({ height: clampHeight(height) })
    },
    openTab: (profileId) => {
      const tab: TerminalTab = { id: nextId('tab'), profileId }
      const current = state.getSnapshot()
      patch({ tabs: [...current.tabs, tab], activeTab: tab.id })
      return tab.id
    },
    openDefaultTab: () => {
      const current = state.getSnapshot()
      // A remembered shell the table no longer has would only launch a failed
      // terminal, so the default falls back to the Host's own shell.
      const known = current.profiles.some((profile) => profile.id === current.defaultProfileId)
      const tab: TerminalTab = { id: nextId('tab'), profileId: known ? current.defaultProfileId : '' }
      patch({ tabs: [...current.tabs, tab], activeTab: tab.id })
      return tab.id
    },
    setDefaultProfile: (id) => {
      const current = state.getSnapshot()
      const next = id === '' || current.profiles.some((profile) => profile.id === id) ? id : ''
      patch({ defaultProfileId: next })
      writeDefaultProfile(next)
    },
    closeTab: (id) => {
      const current = state.getSnapshot()
      const index = current.tabs.findIndex((tab) => tab.id === id)
      if (index === -1) return
      const tabs = current.tabs.filter((tab) => tab.id !== id)
      // Focus follows the tab that took the closed one's place, and the panel
      // closes with its last tab the way an editor's panel does.
      const activeTab = current.activeTab === id
        ? tabs[Math.min(index, tabs.length - 1)]?.id
        : current.activeTab
      patch({ tabs, activeTab, open: tabs.length === 0 ? false : current.open })
    },
    selectTab: (id) => {
      if (!state.getSnapshot().tabs.some((tab) => tab.id === id)) return
      patch({ activeTab: id })
    },
    saveProfile: (profile) => {
      const stored: TerminalProfile = profile.id === '' ? { ...profile, id: nextId('profile') } : profile
      const current = state.getSnapshot()
      const index = current.profiles.findIndex((item) => item.id === stored.id)
      const profiles = index === -1
        ? [...current.profiles, stored]
        : current.profiles.map((item) => (item.id === stored.id ? stored : item))
      patch({ profiles })
      writeProfiles(profiles)
      return stored
    },
    removeProfile: (id) => {
      const current = state.getSnapshot()
      const profiles = current.profiles.filter((item) => item.id !== id)
      if (profiles.length === current.profiles.length) return
      // Deleting the shell new tabs were starting on leaves the Host's default
      // in its place, which is the only choice that still exists.
      const defaultProfileId = current.defaultProfileId === id ? '' : current.defaultProfileId
      patch({ profiles, defaultProfileId })
      writeProfiles(profiles)
      if (defaultProfileId !== current.defaultProfileId) writeDefaultProfile(defaultProfileId)
    },
    seedProfiles: (profiles) => {
      const current = state.getSnapshot()
      if (current.profiles.length > 0) return
      const seen = new Set<string>()
      // Seeded rows are stored rows: they need ids of their own, or editing one
      // would append a second row instead of replacing it.
      const seeded = profiles
        .filter((profile) => {
          if (profile.shellPath === '' || seen.has(profile.shellPath)) return false
          seen.add(profile.shellPath)
          return true
        })
        .map((profile) => ({ ...profile, id: profile.id === '' ? nextId('profile') : profile.id }))
      if (seeded.length === 0) return
      patch({ profiles: seeded })
      writeProfiles(seeded)
    },
  }
}