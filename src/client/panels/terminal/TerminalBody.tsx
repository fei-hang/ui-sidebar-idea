/**
 * The Session-bound half of the bottom panel: it turns the tab the panel has
 * focused into that tab's terminal view and draws it.
 *
 * The emulator is bundled with the plugin rather than fetched on demand: the
 * Host serves one client bundle per package, and a dynamic import would have to
 * go through `require.async` to reach a sibling chunk.
 *
 * The screen mounts as soon as the Host has handed back a terminal identity,
 * not when the attachment finishes: `TerminalView.mount()` is what flips the
 * view's `mounted` flag, and `connect()` refuses to attach while that flag is
 * false. Waiting for `connected` before drawing the screen therefore deadlocks
 * on the very phase it is waiting for, so the phase is drawn as an overlay on
 * top of the mounted screen instead of replacing it.
 */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  TerminalView, TerminalViewState,
} from '@deepseek-ai/dsh-api-terminal-controller/client'
import { TerminalScreen } from './TerminalScreen.tsx'
import type { TerminalPanel, TerminalPanelState } from './terminal-state.ts'
import type { NS } from './index.ts'
import css from './TerminalBody.module.css'

/** What the body receives from its module. */
export interface TerminalBodyInjected {
  /** The Session this area resolved; undefined while the frame has none. */
  readonly sessionId: SessionId | undefined
  /** The panel's writers: opening tabs, editing the shell table. */
  readonly panel: TerminalPanel
  /** Open (or focus) one tab's terminal, launching it with `shellPath` when new. */
  readonly ensure: (sessionId: SessionId, tabId: string, shellPath?: string) => TerminalView | undefined
  /** Ask the Host for the shells it can launch; a no-op once they are known. */
  readonly discover: (sessionId: SessionId) => void
  /** The stores this seat re-renders from. */
  readonly hooks: {
    /** The panel's tabs, focused tab, and shell list. */
    readonly panel: ObservableSnapshot<TerminalPanelState>
    /** The terminal the module is drawing, bound to `useTerminal`. */
    readonly terminal: ObservableSnapshot<TerminalView | undefined>
  }
}

/** Props of the terminal body. */
export type TerminalBodyProps =
  & PropsRuntime<'sidebar.terminal.panel'>
  & InjectFace<TerminalBodyInjected>
  & PropsLocale<typeof NS>

/** Copy the body reads, taken from its own locale seat. */
type Copy = PropsLocale<typeof NS>['t']

/**
 * Draw the focused tab's terminal, or the reason there is none.
 * @param props - the resolved Session, the panel's stores, and copy.
 * @returns the screen, a status line, or an empty state.
 */
export function TerminalBody(props: TerminalBodyProps): ReactNode {
  const {
    sessionId, panel: store, ensure, discover, visible,
    usePanel, useTerminal, t,
  } = props
  const panel = usePanel(value => value)
  const view = useTerminal(value => value)
  const tab = panel.tabs.find((item) => item.id === panel.activeTab)
  const profile = panel.profiles.find((item) => item.id === tab?.profileId)
  const shellPath = profile?.shellPath ?? ''
  // Everything below costs a commit or a frame: opening the first tab, asking
  // the Host for its shells, building the emulator. The panel's slide is
  // scheduled on the two frames after it mounts, so doing that work now would
  // land between those two frames and hold the panel at zero height — the click
  // reads as unresponsive and the slide starts late. Arming on the same two
  // frames puts the panel first: it is already moving, with the loading line in
  // place, before the terminal is asked for.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    let inner: number | null = null
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => { setArmed(true) })
    })
    return () => {
      cancelAnimationFrame(outer)
      if (inner !== null) cancelAnimationFrame(inner)
    }
  }, [])
  // A panel with no tabs would have nothing to draw, so the first one is opened
  // here; closing the last tab closes the panel, which is what reopens it.
  useEffect(() => {
    if (armed && sessionId !== undefined && panel.tabs.length === 0) store.openDefaultTab()
  }, [armed, sessionId, store, panel.tabs.length])
  // Discovery fills the shell menu and the table in Settings. It runs once per
  // Session, on the first render that has one.
  useEffect(() => {
    if (armed && sessionId !== undefined) discover(sessionId)
  }, [armed, sessionId, discover])
  // Creating the terminal touches the controller's caches and stores, so it
  // happens after the render rather than while the slot resolves its props.
  useEffect(() => {
    if (armed && sessionId !== undefined && tab !== undefined) ensure(sessionId, tab.id, shellPath)
  }, [armed, sessionId, ensure, tab, shellPath])
  if (view === undefined || tab === undefined) {
    return (
      <div className={css.empty}>
        {sessionId === undefined ? t('terminal.empty') : t('terminal.loading')}
      </div>
    )
  }
  return <TerminalSurface view={view} label={t('panel.title')} visible={visible} t={t} />
}

/**
 * What the terminal is doing, in words, while it cannot be typed into.
 * @param state - the view's current state.
 * @param t - copy for this seat.
 * @returns a status line, or undefined once the shell is attached and writable.
 */
function statusOf(state: TerminalViewState, t: Copy): string | undefined {
  // The Host caps how many terminals a Session may hold, and a failed
  // allocation reports the cap rather than a broken terminal: nothing is wrong
  // with this tab, the Session is simply full.
  if (state.issue === 'terminalLimit') return t('terminal.limit')
  if (state.phase === 'idle' || state.phase === 'loading') return t('terminal.loading')
  if (state.phase === 'creating' || state.phase === 'connecting') return t('terminal.loading')
  if (state.phase === 'disconnected') return t('terminal.failed')
  if (state.phase === 'closed') return t('terminal.exited')
  if (state.phase === 'failed') return t('terminal.failed')
  if (state.info?.state === 'exited') return t('terminal.exited')
  if (state.info?.state === 'failed') return t('terminal.failed')
  return undefined
}

/**
 * One tab's terminal: the emulator, with its state drawn over it.
 * @param props - the view, the emulator's accessible name, and copy.
 * @returns the mounted screen and, while it is not usable, a status overlay.
 */
function TerminalSurface(props: {
  readonly view: TerminalView
  readonly label: string
  readonly visible: boolean
  readonly t: Copy
}): ReactNode {
  const { view, label, visible, t } = props
  const state = useSyncExternalStore(
    (listener) => view.state.subscribe(listener),
    () => view.state.getSnapshot(),
  )
  // The Host has allocated the process; from here the emulator owns the screen
  // even if the attachment is still being negotiated.
  const started = state.info !== undefined
  const status = statusOf(state, t)
  const failed = state.phase === 'failed' || state.phase === 'disconnected'
  // A full Session cannot be retried into: the slot frees up when a tab closes,
  // so the copy tells the user what to do instead of offering a dead button.
  const retry = failed && state.issue !== 'terminalLimit'
    ? (): void => { if (state.info === undefined) void view.refresh(); else view.connect() }
    : undefined
  if (!started) {
    return (
      <div className={css.message} role="status">
        <span>{status ?? t('terminal.loading')}</span>
        {retry === undefined ? null : <Retry action={retry} label={t('terminal.retry')} />}
      </div>
    )
  }
  return (
    <div className={css.surface}>
      <TerminalScreen key={view.id} view={view} label={label} visible={visible} />
      {status === undefined ? null : (
        <div className={css.overlay} role="status">
          <span className={css.status}>{status}</span>
          {failed && state.issue !== 'terminalLimit' && state.error !== undefined
            ? <span className={css.detail}>{state.error}</span>
            : null}
          {retry === undefined ? null : <Retry action={retry} label={t('terminal.retry')} />}
        </div>
      )}
    </div>
  )
}

/**
 * The retry control shown when the terminal could not be started or reattached.
 * @param props - the action to take and the button's label.
 * @returns a button that asks the Host for the terminal again.
 */
function Retry({ action, label }: { readonly action: () => void; readonly label: string }): ReactNode {
  return (
    <button type="button" className={css.retry} onClick={action}>
      {label}
    </button>
  )
}
