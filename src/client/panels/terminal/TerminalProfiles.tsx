/**
 * The shell table: one row per saved shell, pairing a name with the location of
 * its executable, plus the inline editor that writes a row.
 *
 * The app's Settings page draws it, in its terminal section; the bottom panel is
 * only the tab strip and the screen, so Settings is the one surface that owns
 * this table. A row configures where the command line lives and nothing else:
 * the Host opens every terminal in the Session's working directory and its
 * create request has no directory field, so a directory is not a thing a row can
 * promise.
 *
 * The location can be typed or picked from the Host's own discovery, because a
 * shell it did not report may not exist on this machine.
 *
 * Seeding happens once, from the Session on screen, so a table the user has
 * edited is never overwritten by a later discovery.
 */
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, Input, Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { TerminalShell } from '@deepseek-ai/dsh-api-terminal-controller/types'
import { shellNameOf } from './terminal-shell.ts'
import type { TerminalPanel, TerminalProfile } from './terminal-state.ts'
import type { NS } from './index.ts'
import css from './TerminalProfiles.module.css'

/** Props of the shell table. */
export interface TerminalProfilesProps {
  /** The shell list the table edits. */
  readonly panel: TerminalPanel
  /** Shells the Host reported for the current Session, offered as suggestions. */
  readonly shells: readonly TerminalShell[]
  /** Copy for this panel. */
  readonly t: PropsLocale<typeof NS>['t']
}

/** A row being edited; its id is empty until the first save. */
type Draft = TerminalProfile

/** Prefix that turns a profile id into a menu row id. */
const PROFILE_PREFIX = 'profile:'

/**
 * Draw the shell table and its editor.
 * @param props - the panel store, the Host's shells, and copy.
 * @returns the table, or the editor while a row is being written.
 */
export function TerminalProfiles({ panel, shells, t }: TerminalProfilesProps): ReactNode {
  const state = useSyncExternalStore(
    (listener) => panel.state.subscribe(listener),
    () => panel.state.getSnapshot(),
  )
  const [draft, setDraft] = useState<Draft | undefined>(undefined)
  const [menu, setMenu] = useState(false)
  const [defaultMenu, setDefaultMenu] = useState(false)
  const shellItems: MenuEntry[] = shells.map((shell): MenuEntry => ({
    id: shell.path,
    label: shell.name === '' ? shellNameOf(shell.path) : shell.name,
  }))
  const save = (): void => {
    if (draft === undefined) return
    panel.saveProfile({
      ...draft,
      name: draft.name.trim() === '' ? shellNameOf(draft.shellPath) : draft.name.trim(),
    })
    setDraft(undefined)
  }
  if (draft !== undefined) {
    return (
      <div className={css.editor}>
        <label className={css.field}>
          <span className={css.fieldLabel}>{t('settings.name')}</span>
          <Input
            value={draft.name}
            placeholder={shellNameOf(draft.shellPath)}
            onChange={(event) => { setDraft({ ...draft, name: event.target.value }) }}
          />
        </label>
        <div className={css.field}>
          <label className={css.fieldLabel} htmlFor="terminal-shell-path">{t('settings.path')}</label>
          <div className={css.picker}>
            <Input
              id="terminal-shell-path"
              value={draft.shellPath}
              placeholder={shells[0]?.path ?? ''}
              onChange={(event) => { setDraft({ ...draft, shellPath: event.target.value }) }}
            />
            {shells.length === 0 ? null : (
              <Menu
                open={menu}
                anchor={(
                  <Button
                    variant="outline"
                    aria-label={t('settings.shell')}
                    aria-haspopup="menu"
                    aria-expanded={menu}
                    onClick={() => { setMenu((value) => !value) }}
                  >
                    {t('settings.shell')}
                  </Button>
                )}
                items={shellItems}
                selectedId={draft.shellPath}
                onSelect={(id) => { setDraft({ ...draft, shellPath: id }); setMenu(false) }}
                onClose={() => { setMenu(false) }}
                side="bottom"
                align="end"
                portal
              />
            )}
          </div>
        </div>
        <div className={css.footer}>
          <Button variant="ghost" onClick={() => { setDraft(undefined) }}>
            {t('settings.cancel')}
          </Button>
          <Button variant="primary" onClick={save}>
            {t('settings.save')}
          </Button>
        </div>
      </div>
    )
  }
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
            <div className={css.actions}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setDraft(profile) }}
              >
                {t('settings.edit')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { panel.removeProfile(profile.id) }}
              >
                {t('settings.delete')}
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className={css.footer}>
        <Button
          variant="outline"
          onClick={() => { setDraft({ id: '', name: '', shellPath: shells[0]?.path ?? '' }) }}
        >
          {t('settings.add')}
        </Button>
      </div>
    </div>
  )
}
