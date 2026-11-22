/**
 * The panel's tab strip: one tab per open terminal, a button that opens another,
 * and the shell menu behind it.
 *
 * The menu lists the shells the Host discovered, which is also the source the
 * shell table in Settings draws from: a shell the Host cannot launch would only
 * ever produce a failed terminal, so the menu never offers one.
 *
 * The plus trails the last tab inside the scrolling box, so it always sits right
 * after the row it extends rather than at a fixed edge. That box clips its
 * overflow, which is why the menu is portalled: an in-place popup would be cut
 * off at the strip's edge and the button would look dead.
 */
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { shellNameOf } from './terminal-shell.ts'
import type { TerminalPanel } from './terminal-state.ts'
import type { NS } from './index.ts'
import css from './TerminalTabs.module.css'

/** Props of the tab strip. */
export interface TerminalTabsProps {
  /** Tabs, the focused tab, and the shell list. */
  readonly panel: TerminalPanel
  /** Close one tab and the Host terminal behind it. */
  readonly closeTab: (tabId: string) => void
  /** Copy for this panel. */
  readonly t: PropsLocale<typeof NS>['t']
}

/** Prefix that turns a profile id into a menu row id. */
const PROFILE_PREFIX = 'profile:'

/**
 * Draw the tab strip.
 * @param props - the panel store, the close action, and copy.
 * @returns the tab row.
 */
export function TerminalTabs({ panel, closeTab, t }: TerminalTabsProps): ReactNode {
  const state = useSyncExternalStore(
    (listener) => panel.state.subscribe(listener),
    () => panel.state.getSnapshot(),
  )
  const [menu, setMenu] = useState(false)
  // Every shell the table holds is a menu row, the Host's own default included:
  // discovery lists that shell first, so it needs no separate "default" entry.
  const items: MenuEntry[] = state.profiles.map((profile): MenuEntry => ({
    id: `${PROFILE_PREFIX}${profile.id}`,
    label: profile.name === '' ? shellNameOf(profile.shellPath) : profile.name,
  }))
  const onSelect = (id: string): void => {
    setMenu(false)
    panel.openTab(id.startsWith(PROFILE_PREFIX) ? id.slice(PROFILE_PREFIX.length) : '')
  }
  return (
    <div className={css.strip}>
      <div className={css.tabs} role="tablist" aria-label={t('panel.title')}>
        {state.tabs.map((tab) => {
          // A tab names the shell it runs. A tab started on the Host's own
          // default carries no profile id, and that shell is the one discovery
          // lists first, so the table's first row is the name to show.
          const profile = state.profiles.find((item) => item.id === tab.profileId)
            ?? state.profiles[0]
          const label = profile === undefined
            ? t('tab.default')
            : (profile.name === '' ? shellNameOf(profile.shellPath) : profile.name)
          const active = tab.id === state.activeTab
          return (
            <div key={tab.id} className={active ? `${css.tab} ${css.tabActive}` : css.tab}>
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={css.label}
                title={label}
                onClick={() => { panel.selectTab(tab.id) }}
              >
                {label}
              </button>
              <button
                type="button"
                className={css.close}
                aria-label={t('tab.close')}
                title={t('tab.close')}
                onClick={() => { closeTab(tab.id) }}
              >
                <svg width={10} height={10} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
      <Menu
        open={menu}
        anchor={(
          <button
            type="button"
            className={css.add}
            aria-label={t('tab.new')}
            title={t('tab.new')}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => { setMenu((open) => !open) }}
          >
            <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
        )}
        items={items}
        onSelect={onSelect}
        onClose={() => { setMenu(false) }}
        side="top"
        align="end"
        portal
      />
    </div>
  )
}
