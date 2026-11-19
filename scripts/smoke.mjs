/**
 * Load the built client bundle the way the Host page does: register a factory
 * through `window.__ModuleLoader__`, then call it with a `require` that only
 * answers the shared module table. Proves the artifact parses, requires
 * nothing outside that table, and installs its stylesheet tags.
 */
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

const require_ = createRequire(import.meta.url)
const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

const styles = []
const document = {
  querySelector: (selector) => styles.find((tag) => selector.includes(tag.dataset.pluginCss)) ?? null,
  createElement: () => ({ dataset: {}, textContent: '' }),
  head: { appendChild: (tag) => styles.push(tag) },
}
const window = {}
const requested = []

globalThis.window = window
globalThis.document = document

const registrations = []
window.__ModuleLoader__ = { load: (entry) => registrations.push(entry) }
new Function('window', 'document', source)(window, document)

if (registrations.length !== 1) throw new Error(`expected one registration, got ${registrations.length}`)
const [entry] = registrations
if (entry.id !== 'dsh-client-ui-sidebar-idea') throw new Error(`unexpected id ${entry.id}`)

const table = new Map([
  ['react', { createElement: () => null, useState: () => [undefined, () => {}], useMemo: (fn) => fn(), useCallback: (fn) => fn, useEffect: () => {}, useRef: () => ({ current: null }), createContext: () => ({ Provider: () => null }), useContext: () => ({}) }],
  ['react/jsx-runtime', { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' }],
  ['@deepseek-ai/dsh-client-store', { createSnapshotStore: () => ({ getSnapshot: () => ({}), set: () => {}, subscribe: () => () => {}, update: () => {} }) }],
  ['@deepseek-ai/dsh-client-ui-slots', { resolveSlotLabel: () => undefined }],
  ['@deepseek-ai/dsh-client-ui-primitives', new Proxy({}, { get: () => () => null })],
])
const stub = (name) => {
  requested.push(name)
  if (!table.has(name)) throw new Error(`bundle required "${name}", which the shared module table does not answer`)
  return table.get(name)
}

const module = entry.factory(stub)
console.log(JSON.stringify({
  id: entry.id,
  exports: Object.keys(module).sort(),
  inject: module.inject,
  styles: styles.map((tag) => tag.dataset.pluginCss),
  required: [...new Set(requested)].sort(),
}, null, 2))

if (typeof module.apply !== 'function') throw new Error('client bundle exports no apply()')
