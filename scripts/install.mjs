/**
 * Install this plugin into a DSH Desktop profile.
 *
 * A profile is a directory under `~/.dsh/profiles`. It is a package of its own:
 * the plugins it runs are `link:` dependencies in its `package.json`, and the
 * ones it actually activates are named in `dsh.profile.bundles`, in load order.
 * Installing therefore means writing those two places and then letting the
 * profile's package manager link the directory in.
 *
 * The script is idempotent: an entry already present is left alone, so running
 * it again after a `git pull` only refreshes the link.
 *
 * ```sh
 * pnpm install
 * pnpm build
 * pnpm run install:profile          # into "desktop"
 * pnpm run install:profile web      # into "web"
 * ```
 * @module scripts/install
 */
import { spawn } from 'node:child_process'
import { readFile, writeFile, access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Package name, which is also the bundle id the profile activates. */
const PACKAGE = 'dsh-client-ui-sidebar-idea'

// The bundle's own patch layer disables the stock sidebar column and the stock
// right-sidebar terminal, so selecting the bundle is the whole install: nothing
// in the profile's patch file has to be edited by hand.

/** Directory holding this package. */
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The profile to install into.
 *
 * Two spellings reach this script, because `pnpm run` forwards whatever follows
 * the script name and does not strip its own separators:
 *
 *   pnpm run install:profile            -> []
 *   pnpm run install:profile web        -> ['web']
 *   pnpm run install:profile -- web     -> ['--', 'web']
 *   pnpm run install:profile -- --profile web -> ['--', '--profile', 'web']
 *
 * So the first argument that is neither `--` nor an option flag is the profile.
 * @param argv - process arguments after the script path.
 * @returns the profile name.
 */
function profileName(argv) {
  const args = argv.filter((arg) => arg !== '--')
  const index = args.indexOf('--profile')
  const named = index === -1 ? undefined : args[index + 1]
  const positional = args.find((arg) => !arg.startsWith('-') && arg !== named)
  return named ?? positional ?? process.env.DSH_PROFILE ?? 'desktop'
}

/**
 * Whether a built artifact exists.
 * @param relative - path inside this package.
 * @returns whether it is there.
 */
async function built(relative) {
  try {
    await access(join(packageRoot, relative))
    return true
  } catch {
    return false
  }
}

const name = profileName(process.argv.slice(2))
const dir = join(homedir(), '.dsh', 'profiles', name)
const manifestPath = join(dir, 'package.json')

// The profile links this directory rather than a copy, so it loads whatever
// `lib/` holds at the moment the app starts: installing an unbuilt tree would
// hand it a package with no entry point.
for (const artifact of ['lib/index.js', 'lib/client.js']) {
  if (await built(artifact)) continue
  console.error(`${artifact} is missing — run "pnpm build" first.`)
  process.exit(1)
}

let raw
try {
  raw = await readFile(manifestPath, 'utf8')
} catch {
  console.error(`No profile at ${dir}.`)
  console.error('Start DSH Desktop once to create it, or pass --profile <name>.')
  process.exit(1)
}

const manifest = JSON.parse(raw)
manifest.dependencies ??= {}
manifest.dsh ??= {}
manifest.dsh.profile ??= {}
manifest.dsh.profile.bundles ??= []

// The link makes the package resolvable from the profile; the bundle row makes
// the profile load it. Bundles apply in order, so an appended row lands after
// the layers it is meant to override.
// A Windows path is written with forward slashes, the way the profile's own
// hand-written links are: `link:` values are read back as paths either way, and
// one spelling keeps a diff between two installs readable.
const linkTarget = packageRoot.replaceAll('\\', '/')
manifest.dependencies[PACKAGE] = `link:${linkTarget}`
const bundles = manifest.dsh.profile.bundles
const added = !bundles.includes(PACKAGE)
if (added) bundles.push(PACKAGE)

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

console.log(`${PACKAGE} -> ${dir}`)
console.log(`  dependency  link:${linkTarget}`)
console.log(`  bundle      ${added ? 'added' : 'already listed'}`)

// A link dependency only becomes a real module once the profile installs it.
// The command is one string because `pnpm` is a `.cmd` shim on Windows, which
// only a shell can run; passing it as an argument list would be both deprecated
// and unescaped.
const child = spawn('pnpm install', { cwd: dir, stdio: 'inherit', shell: true })
child.on('exit', (code) => {
  if (code === 0) {
    console.log('')
    console.log('Restart DSH Desktop to load the plugin.')
    return
  }
  console.error('')
  console.error(`pnpm install failed in ${dir}; run it there by hand.`)
  process.exit(code ?? 1)
})
