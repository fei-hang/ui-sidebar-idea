/*
 * The sidebar's own button: the panel-left toggle that returns the column to
 * its sidebar body. Copied verbatim from the rail strip that used to draw it
 * inline, so the first column's two buttons — this one and the file tree — sit
 * together under `buttons/top`.
 */
import clsx from 'clsx'
import css from './SidebarButton.module.css'

/**
 * Panel-left glyph of the built-in panel button.
 *
 * Drawn here rather than taken from the primitives icon set: those icons are
 * <use> references into a sprite injected elsewhere in the document, and inside
 * this pinned strip the reference resolves to nothing — the button kept its box
 * and its accessible name but painted no glyph. The inline markup below is the
 * same geometry (16-unit viewBox, 1px stroke, currentColor) and cannot depend on
 * where the sprite happens to live.
 */
function PanelLeftIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={1}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path d="M13.5 1.5H2.5C1.94772 1.5 1.5 1.94772 1.5 2.5V13.5C1.5 14.0523 1.94772 14.5 2.5 14.5H13.5C14.0523 14.5 14.5 14.0523 14.5 13.5V2.5C14.5 1.94772 14.0523 1.5 13.5 1.5Z" />
      <path d="M5.5 1.5V14.5" />
    </svg>
  )
}

/** Props the rail strip hands its built-in sidebar button. */
export interface SidebarButtonProps {
  /** Whether the sidebar body (rather than a rail body) is showing. */
  readonly active: boolean
  /** Accessible name of the button. */
  readonly label: string
  /** Whether this button is the sidebar's only toggle in the current layout. */
  readonly toggle?: boolean
  /** Reveal or collapse the column. */
  readonly onClick: () => void
}

/**
 * Draw the sidebar button.
 * @param props - pressed state, accessible name, and the press handler.
 * @returns the button element.
 */
export function SidebarButton(props: SidebarButtonProps) {
  return (
    <button
      type="button"
      // On Windows this is the sidebar's only toggle (the caption copy is
      // hidden), so it carries the identity the shell restores focus to.
      data-sidebar-toggle={props.toggle === true ? true : undefined}
      className={clsx(css.panelButton, props.active && css.panelButtonActive)}
      aria-label={props.label}
      aria-pressed={props.active}
      onClick={props.onClick}
    >
      <PanelLeftIcon />
    </button>
  )
}
