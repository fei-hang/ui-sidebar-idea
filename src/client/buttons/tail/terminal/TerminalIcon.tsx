/**
 * The rail's terminal glyph: the lucide `square-terminal` mark (ISC licensed),
 * drawn inline so it renders inside the pinned strip without the shared sprite.
 *
 * The framed variant is deliberate: a bare prompt chevron reads as a chevron at
 * 18px, while the surrounding square makes the control recognisable at a glance.
 */
import type { ReactNode } from 'react'

/** Props of one rail glyph. */
export interface TerminalIconProps {
  /** Rendered square size in pixels. */
  readonly size?: number
}

/**
 * Draw the terminal glyph.
 * @param props - glyph size; the rail passes the size it lays out.
 * @returns the inline svg element.
 */
export function TerminalIcon({ size = 18 }: TerminalIconProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m7 11 2-2-2-2" />
      <path d="M11 13h4" />
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    </svg>
  )
}
