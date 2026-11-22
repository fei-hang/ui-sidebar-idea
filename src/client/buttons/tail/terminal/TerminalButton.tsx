/**
 * The rail's terminal button: the tail-row control that opens and closes the
 * bottom terminal panel.
 *
 * The button does not use the rail's `onSelect`: a tail row toggles the bottom
 * panel rather than the sidebar column's body, so its pressed state comes from
 * the panel's own open flag instead of the rail's selection.
 */
import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import { TerminalIcon } from './TerminalIcon.tsx'
import type { NS } from '../../../panels/terminal/index.ts'
import css from './TerminalButton.module.css'

/** What the button asks of the panel module. */
export interface TerminalButtonInjected {
  /** Open the bottom panel when closed, close it when open. */
  readonly toggle: () => void
  /** The panel's open flag, bound to `useOpen` on the component. */
  readonly hooks: { readonly open: ObservableSnapshot<boolean> }
}

/** Props the rail button receives from its seat plus this module's injection. */
export type TerminalButtonProps =
  & PropsRuntime<'sidebar.button.tail'>
  & PropsLocale<typeof NS>
  & InjectFace<TerminalButtonInjected>

/**
 * Draw the terminal rail button.
 * @param props - glyph size from the rail, the panel's open flag and toggle.
 * @returns the button element.
 */
export function TerminalButton({ size, useOpen, toggle, t }: TerminalButtonProps): ReactNode {
  const open = useOpen(value => value)
  return (
    <button
      type="button"
      className={open ? css.button + ' ' + css.active : css.button}
      aria-pressed={open}
      aria-label={t('button.label')}
      title={t('button.label')}
      onClick={toggle}
    >
      <TerminalIcon size={size} />
    </button>
  )
}
