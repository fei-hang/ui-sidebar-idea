/**
 * The shell table: one row per saved shell, pairing a name with the location of
 * its executable.
 *
 * The app's Settings page draws it, in its terminal section; the bottom panel is
 * only the tab strip and the screen, so Settings is the one surface that owns
 * this table. A row configures where the command line lives and nothing else:
 * the Host opens every terminal in the Session's working directory and its
 * create request has no directory field, so a directory is not a thing a row can
 * promise.
 *
 * The rows are the Host's own discovery, seeded once from the Session on screen,
 * so the table is read-only: it names what the machine already offers, and a
 * later discovery never overwrites it.
 */
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { shellNameOf } from './terminal-shell.ts'
import type { TerminalPanel } from './terminal-state.ts'
import type { NS } from './index.ts'
import css from './TerminalProfiles.module.css'

/** Props of the shell table. */
export interface TerminalProfilesProps {
  /** The shell list the table reads. */
  readonly panel: TerminalPanel
  /** Copy for this panel. */
  readonly t: PropsLocale<typeof NS>['t']
}

/** Prefix that turns a profile id into a menu row id. */
const PROFILE_PREFIX = 'profile:'

/**
 * Draw the shell table.
 * @param props - the panel store and copy.
 * @returns the table.
 */
export function TerminalProfiles({ panel, t }: TerminalProfilesProps): ReactNode {
  const state = useSyncExternalStore(
    (listener) => panel.state.subscribe(listener),
    () => panel.state.getSnapshot(),
  )
  const [defaultMenu, setDefaultMenu] = useState(false)
  // An unchosen default is not "nothing": it is the shell the Host reports first,
  // which is the one the table starts with. Naming it keeps the row honest.
  const defaultProfile = state.profiles.find((item) => item.id === state.defaultProfileId)
    ?? state.profiles[0]
  const defaultItems: MenuEntry[] = state.profiles.map((profile): MenuEntry => ({
    id: `${PROFILE_PREFIX}${profile.id}`,
    label: profile.name === '' ? shellNameOf(profile.shellPath) : profile.name,
  }))
  return (
    <div className={css.wrap}>
      {/* The shell a new tab starts on. It is a choice about the panel rather
          than about a row, so it sits above the table instead of inside it.
          The Host reports its own default shell first and the table is seeded in
          that order, so that shell is already a row here and needs no row of its
          own; an unchosen default simply means "whichever shell starts the list". */}
      {state.profiles.length === 0 ? null : (
        <div className={css.defaultRow}>
          <div className={css.identity}>
            <span className={css.name}>{t('settings.default')}</span>
            <span className={css.meta}>
              {defaultProfile === undefined
                ? ''
                : (defaultProfile.name === '' ? shellNameOf(defaultProfile.shellPath) : defaultProfile.name)}
            </span>
          </div>
          <Menu
            open={defaultMenu}
            anchor={(
              <Button
                variant="outline"
                aria-label={t('settings.default')}
                aria-haspopup="menu"
                aria-expanded={defaultMenu}
                onClick={() => { setDefaultMenu((value) => !value) }}
              >
                {t('settings.change')}
              </Button>
            )}
            items={defaultItems}
            selectedId={defaultProfile === undefined ? undefined : `${PROFILE_PREFIX}${defaultProfile.id}`}
            onSelect={(id) => {
              setDefaultMenu(false)
              panel.setDefaultProfile(id.startsWith(PROFILE_PREFIX) ? id.slice(PROFILE_PREFIX.length) : '')
            }}
            onClose={() => { setDefaultMenu(false) }}
            side="bottom"
            align="end"
            portal
          />
        </div>
      )}
      <div className={css.list}>
        {state.profiles.length === 0 ? <p className={css.empty}>{t('settings.empty')}</p> : null}
        {state.profiles.map((profile) => (
          <div key={profile.id} className={css.row}>
            <div className={css.identity}>
              <span className={css.name}>{profile.name === '' ? shellNameOf(profile.shellPath) : profile.name}</span>
              <span className={css.meta}>{profile.shellPath === '' ? t('tab.default') : profile.shellPath}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
