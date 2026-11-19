/**
 * Two artifacts, one package: the Host half the profile loader activates, and
 * the browser half the client module loader fetches.
 *
 * The browser half reproduces the shape DSH's client loader requires — a CJS
 * factory registered through `window.__ModuleLoader__.load`, with everything
 * outside the shared module table inlined — and compiles `*.module.css` into
 * hashed class names plus one injected `<style>` tag per stylesheet.
 * @module tsdown.config
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { defineConfig } from 'tsdown'
import { transform } from 'lightningcss'

const ID = 'dsh-client-ui-sidebar-idea'
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
/** The suffix must not read as `.css`, or tsdown's own stylesheet pipeline claims the id. */
const CSS_VIRTUAL_SUFFIX = '.mjs'

/**
 * The shared module table: these specifiers stay `require()` calls answered by
 * the host page, so the plugin and the shell share one React, one Cordis, and
 * one slot registry. Everything else is bundled into this artifact.
 */
const PLATFORM_MODULES = [
  'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis',
  'zod', '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/** This package's manifest: the build and the loader read one list. */
const manifest = JSON.parse(await readFile(new URL('./package.json', import.meta.url), 'utf8')) as {
  readonly version: string
  readonly dsh?: { readonly client?: { readonly external?: readonly string[] } }
}

/**
 * The package's own requested rows, read from `package.json` so the build and
 * the loader agree on one list.
 * @returns the specifiers kept external.
 */
function requestedExternals(): ReadonlySet<string> {
  return new Set([...PLATFORM_MODULES, ...(manifest.dsh?.client?.external ?? [])])
}

const externals = await requestedExternals()

/**
 * One virtual module that installs a stylesheet and exports its class map.
 * @param fileId - absolute stylesheet path, which also names the style tag.
 * @param css - the compiled stylesheet text.
 * @param classMap - local class name to compiled class name.
 * @returns the module source.
 */
function styleInjectionModule(fileId: string, css: string, classMap: Record<string, string>): string {
  const tagId = `${ID}/${basename(fileId)}`
  return `const css = ${JSON.stringify(css)};
const tagId = ${JSON.stringify(tagId)};
if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {
  const tag = document.createElement('style');
  tag.dataset.plugin = ${JSON.stringify(ID)};
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}
export default ${JSON.stringify(classMap)};`
}

/** Compile `*.module.css` through lightningcss and inject the result. */
const cssModulesPlugin = {
  name: 'dsh-css-modules-inline',
  resolveId(source: string, importer: string | undefined) {
    if (!source.endsWith('.module.css')) return null
    const absolute = importer === undefined
      ? resolve(source)
      : resolve(dirname(importer), source)
    return CSS_VIRTUAL_PREFIX + absolute + CSS_VIRTUAL_SUFFIX
  },
  async load(virtualId: string) {
    if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
    const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
    this.addWatchFile(fileId)
    const source = await readFile(fileId)
    const { code, exports: cssExports } = transform({
      filename: fileId,
      code: source,
      cssModules: { pattern: '[hash]_[local]' },
      minify: true,
    })
    const classMap: Record<string, string> = {}
    const entries = Object.entries(cssExports ?? {})
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    for (const [local, exported] of entries) classMap[local] = exported.name
    return styleInjectionModule(fileId, code.toString(), classMap)
  },
}

export default defineConfig([
  {
    name: `${ID}/host`,
    entry: { index: 'src/index.ts' },
    outDir: 'lib',
    format: 'esm',
    platform: 'node',
    fixedExtension: false,
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
  },
  {
    name: `${ID}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: (specifier: string) => externals.has(specifier),
      // A `require()` the page's module table cannot answer is a guaranteed
      // runtime throw, so everything unrequested is bundled here instead.
      alwaysBundle: (specifier: string) => !externals.has(specifier),
    },
    inputOptions: {
      resolve: {
        conditionNames: [
          (process.env.NODE_ENV ?? 'production') === 'development' ? 'development' : 'production',
          'browser', 'import', 'module', 'default',
        ],
      },
    },
    // There is no `process` in the page: every build value the source reads has
    // to be substituted here, or the slot throws on its first render. The badge
    // carries this package's own version; a published tarball has no commit to
    // name, so the commit and dirty markers stay absent.
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'process.env.DSH_CLIENT_VERSION': JSON.stringify(manifest.version),
      'process.env.DSH_CLIENT_COMMIT_HASH': 'undefined',
      'process.env.DSH_CLIENT_GIT_DIRTY': 'undefined',
      'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
      'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
    },
    plugins: [cssModulesPlugin],
    outputOptions: {
      entryFileNames: 'client.js',
      chunkFileNames: 'client.[name].js',
      sourcemapExcludeSources: false,
      banner: (chunk) => `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, ${
        chunk.isEntry ? '' : `chunk: ${JSON.stringify(chunk.fileName)}, `}factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
