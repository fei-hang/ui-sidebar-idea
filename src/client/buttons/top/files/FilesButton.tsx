/* Ported from @deepseek-ai/dsh-client-ui-sidebar; keep the two in step. */

/**
 * The activity rail's folder button. The rail owns the row, the pressed state,
 * and the drag handle; this component draws the control that fills the row and
 * reports its press through the rail's `onSelect`.
 */
import type { ReactNode } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { FolderIcon } from './FolderIcon.tsx'
import css from './FilesButton.module.css'

/**
 * Draw the rail button for the workspace file tree.
 * @param props - rail owner props: glyph size, pressed state, and the press handler.
 * @returns the button element.
 */
export function FilesButton({ size, active, onSelect }: PropsRuntime<'sidebar.button.top'>): ReactNode {
  return (
    <button
      type="button"
      className={active ? `${css.button} ${css.active}` : css.button}
      aria-pressed={active}
      onClick={onSelect}
    >
      <FolderIcon size={size} />
    </button>
  )
}
