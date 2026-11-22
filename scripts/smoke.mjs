/**
 * Load the built client bundle the way the Host page does: register a factory
 * through `window.__ModuleLoader__`, then call it with a `require` that only
 * answers the shared module table. Proves the artifact parses, requires
 * nothing outside that table, and installs its stylesheet tags.
 *
 * On-demand chunks are checked the same way: each `client.*.js` file must
 * register itself with its `chunk` field and load with the same table, which is
 * how the page fetches the terminal emulator only when it is first needed.
 */
import { readFile, readdir } from 'node:fs/promises'
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
if (entry.chunk !== undefined) throw new Error(`the entry chunk must not carry a chunk field, got ${entry.chunk}`)

const table = new Map([
  ['react', {
    createElement: () => null,
    useState: () => [undefined, () => {}],
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect: () => {},
    useLayoutEffect: () => {},
    useRef: () => ({ current: null }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    createContext: () => ({ Provider: () => null }),
    useContext: () => ({}),
    lazy: () => () => null,
    Suspense: () => null,
  }],
  ['react/jsx-runtime', { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' }],
  ['@deepseek-ai/dsh-client-store', { createSnapshotStore: () => ({ getSnapshot: () => ({}), set: () => {}, subscribe: () => () => {}, update: () => {} }) }],
  ['@deepseek-ai/dsh-client-ui-slots', { resolveSlotLabel: () => undefined }],
  ['@deepseek-ai/dsh-client-ui-primitives', new Proxy({}, { get: () => () => null })],
])
/**
 * Answer one `require` from the shared table, recording every specifier asked for.
 * @param name - the module specifier.
 * @returns the shared module.
 */
const stub = (name) => {
  requested.push(name)
  if (!table.has(name)) throw new Error(`bundle required "${name}", which the shared module table does not answer`)
  return table.get(name)
}
stub.async = async (name) => {
  throw new Error(`unexpected require.async("${name}") before the chunk is registered`)
}

const module = entry.factory(stub)

// Every on-demand chunk: it must register under the owner id with its own file
// name, and its factory must load with the same table as the entry.
const files = (await readdir(new URL('../lib/', import.meta.url)))
  .filter((file) => file.startsWith('client.') && file.endsWith('.js') && file !== 'client.js')
const chunks = []
for (const file of files) {
  const chunkSource = await readFile(new URL(`../lib/${file}`, import.meta.url), 'utf8')
  registrations.length = 0
  new Function('window', 'document', chunkSource)(window, document)
  if (registrations.length !== 1) throw new Error(`expected one registration for ${file}, got ${registrations.length}`)
  const [chunk] = registrations
  if (chunk.id !== entry.id) throw new Error(`${file} registered under ${chunk.id}, not ${entry.id}`)
  if (chunk.chunk !== file) throw new Error(`${file} registered chunk ${chunk.chunk}, not ${file}`)
  const chunkModule = chunk.factory(stub)
  chunks.push({ file, exports: Object.keys(chunkModule).sort() })
}

console.log(JSON.stringify({
  id: entry.id,
  exports: Object.keys(module).sort(),
  inject: module.inject,
  styles: styles.map((tag) => tag.dataset.pluginCss),
  chunks,
  required: [...new Set(requested)].sort(),
}, null, 2))

if (typeof module.apply !== 'function') throw new Error('client bundle exports no apply()')
