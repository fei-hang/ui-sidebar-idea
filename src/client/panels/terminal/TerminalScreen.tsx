/**
 * The xterm surface, drawn by the emulator this plugin bundles: the Host serves
 * one client bundle per package, and reaching a sibling chunk would mean going
 * through `require.async`, which the bundler does not emit for a dynamic import.
 *
 * The view it draws is Session-owned and outlives this component: unmounting
 * detaches the screen and leaves the shell process running, which is what lets
 * the panel close and reopen without losing the terminal.
 *
 * The terminal opens where the Host puts it — the Session's working directory —
 * and this screen neither knows nor changes that: a profile names a command
 * line, not a directory, so nothing is typed on the shell's behalf.
 */
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { TerminalView } from '@deepseek-ai/dsh-api-terminal-controller/client'
import css from './TerminalScreen.module.css'

/** Monospace stack the emulator draws with; it follows the shell's own choice. */
const FONT_STACK = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const FONT_SIZE = 12
/** Scrollback used until the Session reports its own budget. */
const DEFAULT_SCROLLBACK = 1000
/**
 * The shortest gap between two refits while the pointer is dragging the panel
 * edge. A drag changes the box on every frame, and refitting that often costs a
 * grid reflow plus a resize round trip to the Host per frame, which the gesture
 * cannot afford. Eighty milliseconds still tracks the edge in visible steps and
 * settles into exactly one refit at the end.
 */
const FIT_THROTTLE_MS = 80
/**
 * How long the box has to hold still before an animated resize is refitted.
 *
 * The panel's open and close are a height transition, so the box changes on
 * every frame of a 260ms slide. Refitting during that (as the drag throttle
 * would) rewraps the whole screen two or three times on the way down, and each
 * rewrap is a Host round trip — the text visibly reflows inside a box that is
 * still moving. Waiting for the motion to stop instead keeps the previous grid
 * for the length of the slide and refits once, when the edge has arrived. Any
 * resize that is not a drag is treated this way: a window resize lands on the
 * same quiet period and costs one refit rather than one per frame.
 */
const FIT_SETTLE_MS = 120

/** Props of one drawn terminal. */
export interface TerminalScreenProps {
  /** The Session's terminal view, already mounted by its owner. */
  readonly view: TerminalView
  /** Accessible name of the emulator's input surface. */
  readonly label: string
  /** Whether the panel holding this screen is open on screen. */
  readonly visible: boolean
}

/**
 * Draw one terminal view and keep the emulator in step with its state.
 * @param props - the view and the input surface's accessible name.
 * @returns the host element the emulator draws into.
 */
export function TerminalScreen({ view, label, visible }: TerminalScreenProps): ReactNode {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const labelRef = useRef(label)
  const revisionRef = useRef(0)
  labelRef.current = label
  const snapshot = useSyncExternalStore(
    (listener) => view.state.subscribe(listener),
    () => view.state.getSnapshot(),
  )

  // The view owns the process; mounting attaches this DOM lifetime to it and
  // detaching leaves the shell running, so closing the panel is not a kill.
  useEffect(() => view.mount(), [view])

  // The caret follows the screen the user is looking at. Both ways of arriving
  // here land on this one effect: a tab switch remounts the screen with the panel
  // already open, and opening a panel that kept its screen flips `visible` on the
  // mount that was already there. Focus is what the textarea needs to take keys,
  // and it is deliberately not tied to `writable`: a shell that is still
  // attaching should already hold the caret, so the first keystroke after it
  // becomes usable is not swallowed by a click.
  useEffect(() => {
    if (!visible) {
      // Closing the panel leaves the textarea in the document at zero height;
      // keeping the caret there would send the next keystrokes to a shell the
      // user can no longer see.
      terminalRef.current?.blur()
      return
    }
    terminalRef.current?.focus()
  }, [visible])

  // Fit the emulator to its box, never past what the Host accepts.
  const fitScreen = (): void => {
    const terminal = terminalRef.current
    const fit = fitRef.current
    if (terminal === null || fit === null) return
    let proposed: { cols: number; rows: number } | undefined
    try {
      proposed = fit.proposeDimensions()
    } catch {
      // A hidden or zero-sized host has no dimensions to propose.
      return
    }
    if (proposed === undefined) return
    const environment = view.state.getSnapshot().environment
    const cols = Math.max(2, Math.min(proposed.cols, environment?.maxCols ?? proposed.cols))
    const rows = Math.max(1, Math.min(proposed.rows, environment?.maxRows ?? proposed.rows))
    if (cols === terminal.cols && rows === terminal.rows) return
    terminal.resize(cols, rows)
    view.resize(cols, rows)
  }

  useLayoutEffect(() => {
    const host = hostRef.current
    if (host === null) return undefined
    const environment = view.state.getSnapshot().environment
    const terminal = new Terminal({
      minimumContrastRatio: 4.5,
      cursorBlink: true,
      fontSize: FONT_SIZE,
      fontFamily: FONT_STACK,
      scrollback: environment?.scrollback ?? DEFAULT_SCROLLBACK,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host)
    terminal.textarea?.setAttribute('aria-label', labelRef.current)
    terminalRef.current = terminal
    fitRef.current = fit
    const input = terminal.onData((data) => { view.write(data) })
    // A resize observer fires per layout change, and a panel that is animating
    // or being dragged changes layout on every frame. Refitting each time means
    // a grid reflow plus a resize frame to the Host on every frame of the
    // gesture, and the Host answers each one by repainting the whole screen —
    // that queue is what makes a drag feel like it is being pulled through
    // treacle. So the two kinds of motion get different treatment:
    //
    //   - a drag follows the edge in steps, throttled to FIT_THROTTLE_MS, because
    //     the pointer is the thing being tracked and a frozen screen under a
    //     moving pointer reads as lag;
    //   - anything else (the open/close slide, a window resize) is refitted once
    //     after the box has been still for FIT_SETTLE_MS. The transition touches
    //     the box every frame, so that quiet period only elapses when the slide
    //     is over — the terminal keeps its grid for the whole animation and
    //     reflows exactly once, at the end.
    const panel = host.closest('[data-terminal-panel]')
    let timer: number | null = null
    let last = 0
    const run = (): void => {
      last = performance.now()
      fitScreen()
    }
    const schedule = (): void => {
      if (panel?.hasAttribute('data-dragging') === true) {
        if (timer !== null) return
        const wait = FIT_THROTTLE_MS - (performance.now() - last)
        if (wait <= 0) {
          run()
          return
        }
        timer = window.setTimeout(() => {
          timer = null
          run()
        }, wait)
        return
      }
      if (timer !== null) window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        timer = null
        run()
      }, FIT_SETTLE_MS)
    }
    const observer = new ResizeObserver(() => { schedule() })
    observer.observe(host)
    // The release of a drag does not resize the box: the last pointermove
    // already wrote that height, so the observer stays silent and the screen
    // would keep the grid from up to one throttle interval ago. Watching the
    // drag flag itself gives the release its own refit, which is the one that
    // lands on the final height.
    const dragWatch = panel === null
      ? null
      : new MutationObserver(() => {
        if (panel.hasAttribute('data-dragging')) return
        schedule()
      })
    dragWatch?.observe(panel as Element, { attributes: true, attributeFilter: ['data-dragging'] })
    fitScreen()
    return () => {
      observer.disconnect()
      dragWatch?.disconnect()
      if (timer !== null) window.clearTimeout(timer)
      input.dispose()
      terminalRef.current = null
      fitRef.current = null
      terminal.dispose()
    }
    // Rebuilding the emulator is only ever right for a different view; the
    // label is read through a ref so a locale change does not lose the screen.
  }, [view])

  // One screen write at a time: the view releases the next frame only after
  // the emulator reports it parsed the previous one.
  useLayoutEffect(() => {
    const terminal = terminalRef.current
    if (terminal === null) return
    terminal.options.disableStdin = !snapshot.writable
    const render = snapshot.render
    if (render === undefined) return
    if (render.revision <= revisionRef.current) return
    revisionRef.current = render.revision
    const frame = render.frame
    if (frame.type === 'snapshot') {
      terminal.reset()
      const info = snapshot.info
      if (info !== undefined) terminal.resize(info.cols, info.rows)
      terminal.write(frame.screen, () => { view.acknowledge(render.revision) })
      return
    }
    terminal.write(frame.data, () => { view.acknowledge(render.revision) })
  }, [snapshot, view])

  return <div ref={hostRef} className={css.screen} data-terminal-screen="" />
}
