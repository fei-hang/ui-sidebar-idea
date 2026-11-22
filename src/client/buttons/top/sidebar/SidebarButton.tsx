/*
 * The sidebar's own button: the panel-left toggle that returns the column to
 * its sidebar body. Copied verbatim from the rail strip that used to draw it
 * inline, so the first column's two buttons — this one and the file tree — sit
 * together under `buttons/top`.
 */
import clsx from 'clsx'
import { FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './SidebarButton.module.css'

/**
 * Whale mark of the built-in panel button.
 *
 * The glyph is the product's own brand mark, drawn inline by `FishLogo`: that
 * component emits a plain <path fill="currentColor">, so it survives inside this
 * pinned strip. (The product icon set is deliberately not used here — those are
 * <use> references into a sprite injected elsewhere in the document, and inside
 * this strip the reference resolves to nothing, leaving a blank box.)
 *
 * The mark is a wide silhouette rather than a square icon, so it is sized by its
 * width and reads a little larger than the 18px line icons beside it.
 */
const MARK_SIZE = 20

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
      <span className={css.mark}>
        <FishLogo size={MARK_SIZE} />
      </span>
    </button>
  )
}
