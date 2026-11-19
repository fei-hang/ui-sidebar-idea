// @vitest-environment jsdom
/**
 * The two services this package leaves for other packages: `sidebarRail`
 * reveals one rail item's body, `sidebarFiles` reveals a workspace path.
 */
import { Context } from '@deepseek-ai/cordis'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { fileAddressFor } from '@deepseek-ai/dsh-util-workspace-path'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { apply, inject } from '../src/client/index.ts'

const SESSION = 'reveal-session' as SessionId
const ROOT = 'C:\\work'
const keyOf = (...segments: string[]): string => [ROOT, ...segments].join('/')

interface Face {
  reportCollapsed: (collapsed: boolean) => void
  hooks: { selectedButton: { getSnapshot: () => string | null } }
}

interface PanelFace {
  hooks: { tree: { getSnapshot: () => { sessions: Record<string, { expanded: readonly string[]; current: string | null }> } } }
}

/**
 * @param root - the Session's workspace root, or null for one the list does not hold.
 * @returns a context carrying every declared service, and the face the column injects.
 */
async function bench(root: string | null = ROOT) {
  const ctx = new Context()
  onTestFinished(() => { void ctx.fiber.dispose() })
  const registered: { readonly seat: string; readonly options: Record<string, unknown> }[] = []
  const disposers: (() => void)[] = []
  ctx.provide('slots', {
    inject: (_seat: string, callback: () => unknown) => {
      const produced = callback()
      if (produced !== null && typeof produced === 'object' && Symbol.iterator in produced) {
        for (const disposer of produced as Iterable<() => void>) disposers.push(disposer)
      }
      return () => { for (const dispose of disposers.splice(0)) dispose() }
    },
    register: (options: Record<string, unknown>) => {
      registered.push({ seat: String(options.name), options })
      return () => {}
    },
    registerFactory: () => () => {},
    entriesOfSlot: () => [],
    subscribe: () => () => {},
  } as never)
  ctx.provide('locale', {
    register: () => () => {},
    subscribe: () => () => {},
    bind: () => (key: string) => key,
  } as never)
  ctx.provide('shortcuts', { catalog: createSnapshotStore([]), register: () => () => {} } as never)
  const toggleSidebar = vi.fn()
  ctx.provide('layout', { toggleSidebar, selectPanel: vi.fn() } as never)
  const list = vi.fn()
  ctx.provide('remote', { workspaceFiles: { list } } as never)
  ctx.provide('remote.workspaceFiles', { list } as never)
  const openResourceIn = vi.fn()
  ctx.provide('sidebarRight', { openResourceIn } as never)
  ctx.provide('sessions', {
    list: createSnapshotStore({
      ids: root === null ? [] : [SESSION],
      byId: root === null ? {} : { [SESSION]: { id: SESSION, cwd: root } },
      phase: 'ready',
      projectionsBySession: {},
    }),
  } as never)
  await ctx.plugin({ inject: [...inject], apply }).await()
  const faceOf = <T>(seat: string): T | undefined =>
    registered.find(entry => entry.seat === seat)?.options['inject'] as (() => T) | undefined
  const face = faceOf<Face>('sidebar')?.()
  const panel = faceOf<PanelFace>('sidebar.button.panel')?.()
  return { ctx, toggleSidebar, openResourceIn, face, panel }
}

describe('the rail service', () => {
  it('declares the services the column and the tree need', () => {
    expect(inject).toEqual(['slots', 'locale', 'shortcuts', 'layout', 'remote', 'remote.workspaceFiles', 'sidebarRight', 'sessions'])
  })

  it('selects the body a caller names without touching the column', async () => {
    const { ctx, toggleSidebar, face } = await bench()

    ctx.sidebarRail.select('files')

    expect(face?.hooks.selectedButton.getSnapshot()).toBe('files')
    expect(toggleSidebar).not.toHaveBeenCalled()
  })

  it('opens a collapsed column before showing the body', async () => {
    const { ctx, toggleSidebar, face } = await bench()
    face?.reportCollapsed(true)

    ctx.sidebarRail.select('files')

    expect(toggleSidebar).toHaveBeenCalledOnce()
    expect(face?.hooks.selectedButton.getSnapshot()).toBe('files')
  })

  it('returns to the sidebar body without touching the column', async () => {
    const { ctx, toggleSidebar, face } = await bench()
    face?.reportCollapsed(true)
    ctx.sidebarRail.select('files')

    ctx.sidebarRail.select(null)

    expect(face?.hooks.selectedButton.getSnapshot()).toBeNull()
    expect(toggleSidebar).toHaveBeenCalledOnce()
  })
})

describe('the files service', () => {
  it('opens a directory chain and selects the tree', async () => {
    const { ctx, face, panel } = await bench()

    ctx.sidebarFiles.openDirectory(SESSION, ROOT + '\\src\\app')

    expect(panel?.hooks.tree.getSnapshot().sessions[SESSION]).toEqual({
      expanded: [keyOf('src'), keyOf('src', 'app')],
      current: null,
    })
    expect(face?.hooks.selectedButton.getSnapshot()).toBe('files')
  })

  it('marks a file current and opens it at the requested line', async () => {
    const { ctx, openResourceIn, face, panel } = await bench()
    const path = ROOT + '\\src\\app\\index.ts'

    ctx.sidebarFiles.openFile(SESSION, path, { line: 42 })

    expect(panel?.hooks.tree.getSnapshot().sessions[SESSION]).toEqual({
      expanded: [keyOf('src'), keyOf('src', 'app')],
      current: keyOf('src', 'app', 'index.ts'),
    })
    expect(openResourceIn).toHaveBeenCalledWith(
      SESSION,
      fileAddressFor(SESSION, ROOT, path),
      { params: { line: 42 } },
    )
  })

  it('opens a file without a line when the caller names none', async () => {
    const { ctx, openResourceIn } = await bench()
    const path = ROOT + '\\src\\index.ts'

    ctx.sidebarFiles.openFile(SESSION, path)

    expect(openResourceIn).toHaveBeenCalledWith(SESSION, fileAddressFor(SESSION, ROOT, path))
  })

  it('reveals nothing but still opens the tree for a Session with no root', async () => {
    const { ctx, face, panel } = await bench(null)

    ctx.sidebarFiles.openDirectory(SESSION, '/elsewhere/lib')

    expect(panel?.hooks.tree.getSnapshot().sessions[SESSION]).toBeUndefined()
    expect(face?.hooks.selectedButton.getSnapshot()).toBe('files')
  })
})
