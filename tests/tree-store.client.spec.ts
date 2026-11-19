// @vitest-environment jsdom
/** Revealing a path opens its directory chain without closing what the reader opened. */
import { describe, expect, it, vi } from 'vitest'
import { ancestorsOf, treeKeyOf } from '../src/client/panels/files/paths.ts'
import { createTreeStore, NO_TREE } from '../src/client/panels/files/tree-store.ts'

const SESSION = 'session-1'
const ROOT = 'C:\\work\\app'

describe('treeKeyOf', () => {
  it('keeps the root spelling and joins the segments below it with slashes', () => {
    expect(treeKeyOf(ROOT, ROOT + '\\src\\main.ts')).toBe(ROOT + '/src/main.ts')
  })

  it('accepts a path already relative to the root', () => {
    expect(treeKeyOf(ROOT, 'src/main.ts')).toBe(ROOT + '/src/main.ts')
  })

  it('normalizes a trailing separator away', () => {
    expect(treeKeyOf(ROOT, ROOT + '\\src\\')).toBe(ROOT + '/src')
  })

  it('names the root itself as the empty key', () => {
    expect(treeKeyOf(ROOT, ROOT)).toBe('')
  })

  it('keeps a path outside the root absolute', () => {
    expect(treeKeyOf(ROOT, '/elsewhere/lib')).toBe('/elsewhere/lib')
  })

  it('keeps an absolute path as written when the root is unknown', () => {
    expect(treeKeyOf('', '/work/app/src')).toBe('work/app/src')
  })

  it('does not treat a sibling whose name starts with the root as nested', () => {
    expect(treeKeyOf('/work/app', '/work/application/x.ts')).toBe('/work/application/x.ts')
  })
})

describe('ancestorsOf', () => {
  it('lists every parent below the root, outermost first', () => {
    expect(ancestorsOf(ROOT, ROOT + '/src/client/main.ts')).toEqual([ROOT + '/src', ROOT + '/src/client'])
  })

  it('gives a key directly under the root no ancestors', () => {
    expect(ancestorsOf(ROOT, ROOT + '/README.md')).toEqual([])
    expect(ancestorsOf('', 'src/main.ts')).toEqual(['src'])
  })
})

describe('createTreeStore', () => {
  it('draws an unvisited Session as an empty tree', () => {
    const tree = createTreeStore()
    expect(tree.state.getSnapshot().sessions[SESSION] ?? NO_TREE).toEqual(NO_TREE)
  })

  it('opens and closes one directory', () => {
    const tree = createTreeStore()
    tree.expand(SESSION, 'src', true)
    expect(tree.state.getSnapshot().sessions[SESSION]?.expanded).toEqual(['src'])
    tree.expand(SESSION, 'src', false)
    expect(tree.state.getSnapshot().sessions[SESSION]?.expanded).toEqual([])
  })

  it('notifies nobody when the state would not change', () => {
    const tree = createTreeStore()
    tree.expand(SESSION, 'src', true)
    const listener = vi.fn()
    tree.state.subscribe(listener)
    tree.expand(SESSION, 'src', true)
    tree.reveal(SESSION, ['src'])
    tree.setCurrent(SESSION, null)
    expect(listener).not.toHaveBeenCalled()
  })

  it('adds a chain without closing directories the reader opened', () => {
    const tree = createTreeStore()
    tree.expand(SESSION, 'docs', true)
    tree.reveal(SESSION, ['src', 'src/client'])
    expect(tree.state.getSnapshot().sessions[SESSION]?.expanded).toEqual(['docs', 'src', 'src/client'])
  })

  it('keeps each Session apart', () => {
    const tree = createTreeStore()
    tree.expand(SESSION, 'src', true)
    tree.setCurrent(SESSION, 'src/main.ts')
    expect(tree.state.getSnapshot().sessions.other).toBeUndefined()
  })

  it('marks one file current and clears it with null', () => {
    const tree = createTreeStore()
    tree.setCurrent(SESSION, 'src/main.ts')
    expect(tree.state.getSnapshot().sessions[SESSION]?.current).toBe('src/main.ts')
    tree.setCurrent(SESSION, null)
    expect(tree.state.getSnapshot().sessions[SESSION]?.current).toBeNull()
  })
})
