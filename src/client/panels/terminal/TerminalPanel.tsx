/**
 * The bottom panel that holds the terminal.
 *
 * It occupies the frame's `shell.bottom` seat: a row that spans every column of
 * the frame and shrinks them by exactly its own height. The seat cannot exclude
 * the sidebar track itself, so the panel keeps the rail's strip clear — the strip
 * owns its own toggle button and has to stay reachable — and paints it in the
 * rail's fill: the panel covers the sidebar's second column, the main column and
 * the right bar, and only the rail stays uncovered. That reservation is the
 * content box's own left padding, not a sibling block, so the head and the screen
 * are laid out inside one box and nothing beside them can move independently.
 * The width is the same `--dsh-rail-width` the rail itself is drawn with. That
 * padding stays fixed for the panel's whole life: the shell cancels the frame's
 * own left reservation under this row, so the row is pinned to the window's left
 * edge even while the sidebar collapses and the columns above it travel. A panel
 * that gave the strip back at the same rate as the frame took it would keep its
 * left edge still but not its box — its width and origin would change on every
 * frame, re-rasterising the tabs, which reads as the close buttons twitching.
 * Drawer mode is the only case that zeroes the padding, because there the sidebar
 * floats over the content and covers the rail outright. Nothing is measured at
 * runtime: the panel is one self-contained box whose width follows from the
 * frame's own markers, exactly like the sidebar column beside it.
 *
 * `shell.bottom` carries no Session binding, so the panel declares one child
 * seat (`sidebar.terminal.panel`) and renders it inside the framework's
 * `SessionProvider`: that child is what gives the terminal the Session it
 * belongs to.
 *
 * Opening and closing are the same height transition in both directions: the
 * section is in the tree at zero height and is moved to the stored height on the
 * next frame, then on close it drops back to zero and stays there. The row above
 * it shrinks and grows by that height, so the whole frame follows instead of the
 * panel appearing in place.
 */
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import type {
  InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime, SlotComponent,
} from '@deepseek-ai/dsh-client-ui-slots'
// The `shell.bottom` seat, and the Session area the panel's child needs.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { TerminalTabs } from './TerminalTabs.tsx'
import { clampHeight, type TerminalPanel as TerminalPanelStore } from './terminal-state.ts'
import type { NS } from './index.ts'
import css from './TerminalPanel.module.css'

/**
 * Keep a closed panel out of the tab order and off the pointer.
 *
 * The section stays mounted at zero height, so its tabs and its close button are
 * still in the document and would otherwise be reachable by keyboard while the
 * row is shut. `inert` says exactly that; the cast is because the React version
 * this plugin builds against does not declare it yet.
 * @param shown - whether the row is open.
 * @returns the inert attribute while closed, and nothing while open.
 */
const inertUnless = (shown: boolean): { inert?: string } => (
  shown ? {} : { inert: '' }
)

/** What the panel module hands its seat. */
export interface TerminalPanelInjected {
  /** Open flag, height, tabs, and the writers both the panel and its rail button use. */
  readonly panel: TerminalPanelStore
  /** Close one tab and the Host terminal behind it. */
  readonly closeTab: (tabId: string) => void
}

/** Props of the bottom panel: its seat, its declared child, and its copy. */
export type TerminalPanelProps =
  & PropsRuntime<'shell.bottom'>
  & PropsRenderSlots<'sidebar.terminal.panel'>
  & InjectFace<TerminalPanelInjected>
  & PropsLocale<typeof NS>

/**
 * Draw the bottom panel, sliding it open and shut.
 *
 * The section is always in the tree; a closed panel is a zero-height box. See
 * the state comment below for why the box and its contents both stay.
 * @param props - the panel state, its child seat's render share, and copy.
 * @returns the panel, at whatever height the store currently holds.
 */
export const TerminalPanel: SlotComponent<TerminalPanelProps> = (props: TerminalPanelProps) => {
  const { panel, closeTab, renderSlot, SessionProvider, t } = props
  const open = useSyncExternalStore(
    (listener) => panel.state.subscribe(listener),
    () => panel.state.getSnapshot().open,
  )
  const height = useSyncExternalStore(
    (listener) => panel.state.subscribe(listener),
    () => panel.state.getSnapshot().height,
  )
  const sectionRef = useRef<HTMLElement | null>(null)
  // The section never leaves the tree. It is one box whose height the store
  // owns, and an unmounted one has to be rebuilt — the terminal asked for, the
  // emulator constructed, the screen attached — before it can even start to
  // move. That is a full round trip to the Host in the gap between the click and
  // the first frame, which reads as the panel hesitating on every open but the
  // first (the first one is built while the app is still starting up). A closed
  // panel is a zero-height, `inert` box instead: nothing to build, nothing to
  // lay out, and the slide starts on the frame after the click.
  //
  // `shown` is the end the height transition is heading for, and `dragging`
  // suppresses the transition so a drag tracks the pointer exactly instead of
  // easing behind it. `closing` is set for the whole slide out and cleared the
  // moment the row opens again: it is what tells the sheet which direction the
  // height is travelling, so the two directions can run on different clocks
  // without the component guessing from the height itself.
  const [shown, setShown] = useState(open)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  // The box stays; its contents are built on the first open and then kept. A
  // terminal is a process and a screen, and tearing the screen down on close
  // means building it again on the next open: a new emulator, a new attach, a
  // refit round trip — all before the box can move, which is exactly the pause
  // this panel used to have. Keeping it mounted costs nothing while the box is
  // at zero height, and a closed panel is not asked for a terminal until it is
  // opened for the first time.
  const [everOpened, setEverOpened] = useState(open)

  useEffect(() => {
    if (open) {
      setEverOpened(true)
      setClosing(false)
      // Move only after the closed state has been painted. A transition needs
      // its start value on screen, and one frame is not enough of a promise: the
      // callback can land before the zero-height commit is visible, and the
      // panel would then appear at full height with no slide at all.
      let inner: number | null = null
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => { setShown(true) })
      })
      return () => {
        cancelAnimationFrame(outer)
        if (inner !== null) cancelAnimationFrame(inner)
      }
    }
    setShown(false)
    setClosing(true)
    return undefined
  }, [open])

  // The handle at the top edge is the only thing that resizes the panel, and it
  // tracks the pointer on the window so a fast drag never loses the grab.
  //
  // A drag writes the height straight to the element and only commits to the
  // store on release. Going through the store instead means a React render, a
  // fresh child seat, and a terminal refit for every pointer report — the screen
  // lags behind the pointer by however long that takes, which is what a drag
  // feels like when it is slow. The element write costs one style invalidation
  // and the terminal resizes once, after the pointer is released.
  const onHandleDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    const section = sectionRef.current
    if (section === null) return
    const startY = event.clientY
    // Take the height the box has on screen, not the one in the store: the
    // handle can be grabbed while the panel is still sliding, and starting from
    // the stored value would make the edge jump the difference on the first move.
    const startHeight = Math.round(section.getBoundingClientRect().height)
    section.style.height = `${startHeight}px`
    setDragging(true)
    let wanted = startHeight
    let frame: number | null = null
    const flush = (): void => {
      frame = null
      section.style.height = `${wanted}px`
    }
    const move = (moveEvent: PointerEvent): void => {
      wanted = clampHeight(startHeight + (startY - moveEvent.clientY))
      if (frame === null) frame = requestAnimationFrame(flush)
    }
    const end = (): void => {
      if (frame !== null) {
        cancelAnimationFrame(frame)
        frame = null
      }
      // Hand the element back to the store. The render that follows writes the
      // same height, so the inline value never changes under the pointer.
      panel.resize(wanted)
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }, [panel])

  // The height is written to the element rather than passed as a prop: a drag
  // owns that property while the pointer is down, and a render in the middle of
  // a drag (a tab opening, a locale change) would otherwise reset it to the
  // stored value and the edge would jump back under the pointer.
  useLayoutEffect(() => {
    const section = sectionRef.current
    if (section === null || dragging) return
    section.style.height = `${shown ? height : 0}px`
  }, [dragging, height, shown])

  // One box. The strip under the rail is this box's own left padding, so the
  // head and the screen are laid out inside it rather than beside it: there is
  // no second block that could be re-laid-out or scrolled under them.
  return (
    <section
      ref={sectionRef}
      className={css.panel}
      aria-label={t('panel.title')}
      aria-hidden={shown ? undefined : true}
      {...inertUnless(shown)}
      data-terminal-panel=""
      data-dragging={dragging ? '' : undefined}
      data-closing={closing ? '' : undefined}
    >
      <div className={css.content}>
        <div
          className={css.handle}
          role="separator"
          aria-orientation="horizontal"
          onPointerDown={onHandleDown}
        />
        <div className={css.head}>
          <TerminalTabs panel={panel} closeTab={closeTab} t={t} />
          <button
            type="button"
            className={css.close}
            aria-label={t('panel.close')}
            title={t('panel.close')}
            onClick={panel.close}
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className={css.body}>
          {everOpened ? (
            <SessionProvider>
              {renderSlot('sidebar.terminal.panel', { visible: shown }, {
                fallback: <div className={css.empty}>{t('terminal.empty')}</div>,
              })}
            </SessionProvider>
          ) : null}
        </div>
      </div>
    </section>
  )
}
