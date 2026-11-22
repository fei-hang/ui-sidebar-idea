/**
 * The bottom panel's own state: the open flag its rail button reads, the height
 * its drag handle writes, and the tab and shell lists its bar and settings table
 * edit. Every writer must clamp what it can and stay quiet when nothing actually
 * changes, or a drag would repaint the whole rail.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTerminalPanel } from '../src/client/panels/terminal/terminal-state.ts'

describe('the bottom terminal panel state', () => {
  // The shell list is the one part that persists, so each case starts from none.
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts closed, at a usable height, with no tabs and no shells', () => {
    const panel = createTerminalPanel()

    expect(panel.state.getSnapshot()).toEqual({
      open: false,
      height: 280,
      tabs: [],
      activeTab: undefined,
      profiles: [],
      defaultProfileId: '',
    })
  })

  it('toggles open and closed', () => {
    const panel = createTerminalPanel()

    panel.toggle()
    expect(panel.state.getSnapshot().open).toBe(true)
    panel.toggle()
    expect(panel.state.getSnapshot().open).toBe(false)
  })

  it('closes an already closed panel without notifying', () => {
    const panel = createTerminalPanel()
    const listener = vi.fn()
    panel.state.subscribe(listener)

    panel.close()

    expect(listener).not.toHaveBeenCalled()
  })

  it('clamps the height to the supported range', () => {
    const panel = createTerminalPanel()

    panel.resize(10_000)
    expect(panel.state.getSnapshot().height).toBe(720)
    panel.resize(0)
    expect(panel.state.getSnapshot().height).toBe(120)
    panel.resize(300.6)
    expect(panel.state.getSnapshot().height).toBe(301)
  })

  it('does not notify when a resize lands on the current height', () => {
    const panel = createTerminalPanel()
    const listener = vi.fn()
    panel.state.subscribe(listener)

    panel.resize(280)

    expect(listener).not.toHaveBeenCalled()
  })

  it('opens a tab, focuses it, and closes the panel with the last tab', () => {
    const panel = createTerminalPanel()

    const first = panel.openTab('')
    const second = panel.openTab('')
    expect(panel.state.getSnapshot().tabs).toHaveLength(2)
    expect(panel.state.getSnapshot().activeTab).toBe(second)

    panel.closeTab(first)
    expect(panel.state.getSnapshot().activeTab).toBe(second)

    panel.closeTab(second)
    expect(panel.state.getSnapshot().tabs).toHaveLength(0)
    expect(panel.state.getSnapshot().open).toBe(false)
  })

  it('gives a new shell an id and replaces it on the next save', () => {
    const panel = createTerminalPanel()

    const saved = panel.saveProfile({ id: '', name: 'PowerShell', shellPath: 'C:/shells/pwsh.exe' })
    expect(saved.id).not.toBe('')
    expect(panel.state.getSnapshot().profiles).toHaveLength(1)

    panel.saveProfile({ ...saved, shellPath: 'C:/shells/sh.exe' })
    expect(panel.state.getSnapshot().profiles).toHaveLength(1)
    expect(panel.state.getSnapshot().profiles[0]?.shellPath).toBe('C:/shells/sh.exe')
  })

  it('forgets a removed shell', () => {
    const panel = createTerminalPanel()
    const saved = panel.saveProfile({ id: '', name: 'sh', shellPath: '/bin/sh' })

    panel.removeProfile(saved.id)

    expect(panel.state.getSnapshot().profiles).toHaveLength(0)
  })

  it('starts new tabs on the chosen default shell and remembers the choice', () => {
    const panel = createTerminalPanel()
    const saved = panel.saveProfile({ id: '', name: 'PowerShell', shellPath: 'C:/shells/pwsh.exe' })

    panel.setDefaultProfile(saved.id)
    expect(panel.state.getSnapshot().defaultProfileId).toBe(saved.id)

    const tab = panel.openDefaultTab()
    const opened = panel.state.getSnapshot().tabs.find((item) => item.id === tab)
    expect(opened?.profileId).toBe(saved.id)
    expect(panel.state.getSnapshot().activeTab).toBe(tab)

    // The choice outlives the store, so a reload opens the same shell.
    expect(createTerminalPanel().state.getSnapshot().defaultProfileId).toBe(saved.id)
  })

  it('falls back to the Host default when the chosen shell is gone', () => {
    const panel = createTerminalPanel()
    const saved = panel.saveProfile({ id: '', name: 'sh', shellPath: '/bin/sh' })

    panel.setDefaultProfile(saved.id)
    panel.removeProfile(saved.id)

    expect(panel.state.getSnapshot().defaultProfileId).toBe('')

    const tab = panel.openDefaultTab()
    expect(panel.state.getSnapshot().tabs.find((item) => item.id === tab)?.profileId).toBe('')
  })

  it('ignores a default shell that is not in the table', () => {
    const panel = createTerminalPanel()
    const listener = vi.fn()
    panel.state.subscribe(listener)

    panel.setDefaultProfile('no-such-profile')

    expect(panel.state.getSnapshot().defaultProfileId).toBe('')
    expect(listener).not.toHaveBeenCalled()
  })

  it('seeds an empty shell list once and never overwrites an edited one', () => {
    const panel = createTerminalPanel()
    const shell = { id: '', name: 'PowerShell', shellPath: 'C:/shells/pwsh.exe' }

    panel.seedProfiles([shell, shell])
    expect(panel.state.getSnapshot().profiles).toHaveLength(1)

    const saved = panel.saveProfile({ ...panel.state.getSnapshot().profiles[0]!, shellPath: 'C:/edited/pwsh.exe' })
    panel.seedProfiles([shell])
    expect(panel.state.getSnapshot().profiles[0]?.shellPath).toBe('C:/edited/pwsh.exe')
    expect(saved.shellPath).toBe('C:/edited/pwsh.exe')
  })
})