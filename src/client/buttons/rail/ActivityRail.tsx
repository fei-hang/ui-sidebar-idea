/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * Activity rail: the always-visible button strip at the left edge of the
 * sidebar area.
 *
 * The rail owns the button boxes, the pressed state, and the drag reorder; a
 * registrant supplies only the glyph and reports clicks through `onSelect`.
 * Two list seats split the strip around a flexible gap: `sidebar.button.top`
 * runs top-down from the rail's head, `sidebar.button.tail` runs bottom-up from
 * the built-in panel button, so the first tail registration sits nearest it.
 * A button whose id also registers a `sidebar.button.panel` body opens that
 * body in the sidebar area; a button without one is an action of its own.
 */
import { useState, type DragEvent } from 'react'
import clsx from 'clsx'
import type { ButtonRail } from '../../status/button-order.ts'
import type { SidebarButtonMetadata, SidebarRootComponentProps } from '../../contract/slots.ts'
import { SidebarButton } from '../top/sidebar/SidebarButton.tsx'
import css from './ActivityRail.module.css'

/** List id the built-in panel button reports; registrants must not reuse it. */
export const SIDEBAR_BUTTON_ID = 'sidebar'

/**
 * Width the rail reserves; the column subtracts it from the width it is given.
 *
 * The same number is declared once as `--dsh-rail-width` on the page
 * (shell/SidebarRoot.module.css), which is what actually draws the rail and the
 * bottom panel's gutter; this copy exists because the column's frozen width is
 * arithmetic, not a style. Keep the two equal.
 */
export const RAIL_WIDTH = 48

/** Props the sidebar shell hands the rail. */
export interface ActivityRailProps {
  /** Head buttons in render order. */
  readonly top: readonly SidebarButtonMetadata[]
  /** Tail buttons in stored order, bottom-up. */
  readonly tail: readonly SidebarButtonMetadata[]
  /** Selected rail id, or null while the shell shows its own body. */
  readonly selected: string | null
  /** Whether the built-in panel button reads as pressed. */
  readonly panelActive: boolean
  /** Accessible name of the strip. */
  readonly label: string
  /** Select one rail id. */
  readonly onSelect: (id: string) => void
  /** Move one rail button within its own rail. */
  readonly onMove: (rail: ButtonRail, id: string, beforeId: string | null) => void
  /** Toggle the sidebar body from the built-in panel button. */
  readonly onPanel: () => void
  /** Pin the strip to the window's left edge instead of laying it out in the column. */
  readonly fixed?: boolean
  /** This panel button is the sidebar's only toggle in the current layout. */
  readonly panelToggle?: boolean
  /** Slot renderer carrying the rail's two button seats. */
  readonly renderSlot: SidebarRootComponentProps['renderSlot']
}

/** Drag identity, held only while a drag is in flight. */
interface Dragging {
  readonly rail: ButtonRail
  readonly id: string
}

/**
 * Render the activity rail.
 * @param props - Button metadata, selection, and the shell's callbacks.
 * @returns The rail strip.
 */
export function ActivityRail(props: ActivityRailProps) {
  const [dragging, setDragging] = useState<Dragging | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const dropTarget = (rail: ButtonRail, targetId: string, sourceId: string): string | null => {
    if (rail === 'top') {
      // Dropping onto a row means "take that row's place". Dragging downward,
      // the source already sits before the target, so anchoring to the target
      // would leave the order unchanged; anchor to the target's successor
      // instead, which is the row the user is dropping past.
      const source = props.top.findIndex(item => item.id === sourceId)
      const target = props.top.findIndex(item => item.id === targetId)
      if (source !== -1 && target !== -1 && source < target) return props.top[target + 1]?.id ?? null
      return targetId
    }
    // The tail renders bottom-up, so a row dropped above another sits later in
    // stored order: it belongs before that row's successor.
    const index = props.tail.findIndex(item => item.id === targetId)
    return props.tail[index + 1]?.id ?? null
  }

  const row = (rail: ButtonRail, item: SidebarButtonMetadata) => {
    const key = `${rail}:${item.id}`
    const active = props.selected === item.id
    const isOver = dragging !== null && dragging.rail === rail && over === key && dragging.id !== item.id
    const finish = (): void => {
      setDragging(null)
      setOver(null)
    }
    const onDragStart = (event: DragEvent<HTMLDivElement>): void => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', key)
      setDragging({ rail, id: item.id })
    }
    const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
      if (dragging === null || dragging.rail !== rail || dragging.id === item.id) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setOver(key)
    }
    const onDrop = (event: DragEvent<HTMLDivElement>): void => {
      event.preventDefault()
      const source = dragging
      finish()
      if (source === null || source.rail !== rail || source.id === item.id) return
      props.onMove(rail, source.id, dropTarget(rail, item.id, source.id))
    }
    return (
      <div
        key={key}
        className={clsx(css.row, isOver && css.rowOver)}
        draggable
        data-rail={rail}
        data-rail-id={item.id}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={() => { if (over === key) setOver(null) }}
        onDrop={onDrop}
        onDragEnd={finish}
      >
        {rail === 'top' && item.id === SIDEBAR_BUTTON_ID
          ? (
            <SidebarButton
              active={props.panelActive}
              label={item.label}
              toggle={props.panelToggle === true}
              onClick={props.onPanel}
            />
          )
          : rail === 'top'
            ? props.renderSlot('sidebar.button.top', {
              size: 18,
              active,
              onSelect: () => { props.onSelect(item.id) },
            }, { only: item.id, fallback: null })
            : props.renderSlot('sidebar.button.tail', {
              size: 18,
              active,
              onSelect: () => { props.onSelect(item.id) },
            }, { only: item.id, fallback: null })}
      </div>
    )
  }

  return (
    <div
      className={clsx(css.rail, props.fixed === true && css.railFixed)}
      role="toolbar"
      aria-label={props.label}
      aria-orientation="vertical"
      data-sidebar-rail=""
    >
      <div className={css.group}>
        {props.top.map(item => row('top', item))}
      </div>
      <div className={css.gap} />
      <div className={css.group}>
        {[...props.tail].reverse().map(item => row('tail', item))}
      </div>
    </div>
  )
}
