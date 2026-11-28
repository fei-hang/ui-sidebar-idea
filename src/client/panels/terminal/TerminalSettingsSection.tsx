/**
 * The terminal page of the app's Settings.
 *
 * The bottom panel is only a tab strip and a screen, so the shell table — the
 * one place a command line's location is chosen — lives here, in the settings
 * shell's `settings.section` list, beside every other page.
 *
 * The section is root-scoped: it has no Session of its own, so it seeds its
 * table from the Session the main view is showing, and it does nothing when
 * there is none.
 */
import { useEffect, type ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { TerminalShell } from '@deepseek-ai/dsh-api-terminal-controller/types'
// The `settings.section` seat this page fills.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { TerminalProfiles } from './TerminalProfiles.tsx'
import type { TerminalPanel, TerminalPanelState } from './terminal-state.ts'
import type { NS } from './index.ts'
import css from './TerminalSettingsSection.module.css'

/** What this page receives from its module. */
export interface TerminalSettingsSectionInjected {
  /** The Session on screen, whose shells are the ones to offer. */
  readonly sessionId: SessionId | undefined
  /** The shell table the page edits. */
  readonly panel: TerminalPanel
  /** Ask the Host for the shells it can launch; a no-op once they are known. */
  readonly discover: (sessionId: SessionId) => void
  /** The stores this page re-renders from. */
  readonly hooks: {
    /** The panel's saved shells. */
    readonly panel: ObservableSnapshot<TerminalPanelState>
    /** Shells the Host reported for that Session. */
    readonly shells: ObservableSnapshot<readonly TerminalShell[]>
  }
}

/** Props of the terminal settings page. */
export type TerminalSettingsSectionProps =
  & PropsRuntime<'settings.section'>
  & InjectFace<TerminalSettingsSectionInjected>
  & PropsLocale<typeof NS>

/**
 * Draw the terminal page: its heading, what the table means, and the table.
 * @param props - the Session on screen, the panel's stores, and copy.
 * @returns the page.
 */
export function TerminalSettingsSection(props: TerminalSettingsSectionProps): ReactNode {
  const {
    sessionId, panel, discover, useShells, t,
  } = props
  const shells = useShells(value => value)
  // Discovery is what fills the shell choice, so it is asked for once, on the
  // first render that has a Session to ask about.
  useEffect(() => {
    if (sessionId !== undefined && shells.length === 0) discover(sessionId)
  }, [discover, sessionId, shells.length])
  return (
    <div className={css.page}>
      <h2 className={css.title}>{t('settings.title')}</h2>
      <p className={css.hint}>{t('settings.description')}</p>
      <TerminalProfiles panel={panel} t={t} />
    </div>
  )
}
