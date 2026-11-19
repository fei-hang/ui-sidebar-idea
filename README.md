# dsh-client-ui-sidebar-idea

The Idea sidebar column for DeepSeek Harness: an activity rail down the left
edge, a panel column that the rail's buttons open, and the workspace file tree
behind one of those buttons.

This package registers into the `sidebar` seat the frame declares, so it
replaces the stock `@deepseek-ai/dsh-client-ui-sidebar` column. Enable one or
the other, never both: two occupants of the same seat collide at load.

## Install into a profile

1. Build the package (`pnpm build`), then make it resolvable from the profile
   directory — a `file:` dependency, a workspace link, or a published package.
2. Select the bundle. `cordis.patch.yml` carries this package's own patch layer,
   which disables the stock column and inserts this one, so selecting the bundle
   is the whole install: no hand-editing of the profile's patch file.

```sh
dsh plugin --profile <name> add <path-or-package>
```

The bundle's patch layer applies in `dsh.profile.bundles` order, and an
installed bundle is appended, so the disable lands after the layer that inserts
`ui-sidebar`. A profile whose bundles carry no `ui-sidebar` row (headless, sdk)
logs `patch: entry "ui-sidebar" not found` and mounts this column with nothing
to replace.

**What the automatic disable does not cover:** a profile that also runs the
harness repository's own `@deepseek-ai/dsh-client-ui-sidebar-idea` (the
`DSH_IDEA_SHELL=1` composition behind the Idea desktop app). That plugin
registers the same `sidebar` seat under a different package name, and two
occupants of one seat fail at load. Enable one or the other.

The Host half contributes nothing (`apply()` is empty); everything this package
does happens in the browser half.

## Directory layout

```
src/
  index.ts                       Host half: an empty apply().
  client/
    index.ts                     Client entry: registers the column, then the file tree.
    contract/slots.ts            Seat declarations and the props each occupant receives.
    shell/                       The column itself.
      index.ts                   Seat registration, panel and button aggregation, services.
      SidebarRoot.tsx            Column body: header, panel list, footer.
      ActivityRail.tsx           Rail strip: button slots, drag reordering, panel toggle.
      HeaderLeadingControls.tsx  Collapsed-column controls, mounted in the frame chrome.
      PanelIcon.tsx              Icon face for a main panel entry.
      scroll-handoff.ts          Scroll ownership between the column and the page.
    rail/
      button-order.ts            Per-user rail order and selection, in memory.
      panel-pins.ts              Pinned and unpinned panel rows.
      rail.ts                    `sidebarRail` service: reveal one rail item's body.
    buttons/
      top/                       Rail buttons rendered top-down, one folder per button.
        files/                   The workspace tree button.
      tail/                      Rail buttons rendered bottom-up, one folder per button.
    panels/                      Panel bodies the rail buttons open, one folder per body.
      files/
        index.ts                 `sidebarFiles` service and the file tree seats.
        FilesBody.tsx            Panel body: directory listing, expansion, current file.
        tree-store.ts            Open directories and the current file, per Session.
        tree.ts                  Entry and directory projection over the listing.
        paths.ts                 Workspace path to tree key conversion.
        actions.ts               `sidebarFiles` service declaration.
    locales/                     Dictionaries, one module per namespace.
```

Adding a rail button: put the component under `buttons/top/<name>/` (or
`buttons/tail/<name>/` for the bottom-up group) and register it into
`sidebar.button.top` / `sidebar.button.tail` with a unique `id`. A button that
opens a panel body also registers into `sidebar.button.panel` with the same
`id`, and puts the body under `panels/<name>/`.

## Services

Two services leave this package so a plugin that knows a path or a panel id can
show it without owning the column.

```ts
ctx.get('sidebarRail')?.select('files')          // show a rail item's body
ctx.get('sidebarRail')?.select(null)             // back to the sidebar body

ctx.get('sidebarFiles')?.openDirectory(sessionId, '/workspace/src')
ctx.get('sidebarFiles')?.openFile(sessionId, '/workspace/src/index.ts', { line: 42 })
```

Read them with `ctx.get(...)` rather than declaring them in `inject`: both are
provided by this plugin, and a caller may activate before it does.

`openDirectory` opens that directory and every directory above it, shows the
tree in the column, and expands the column when it is collapsed. `openFile`
does the same for the file's directory chain, marks the file current, and opens
it in the Session's right Sidebar at `target.line` when one is given.

Paths may be absolute or relative to the Session's workspace root. A Session
whose root is not loaded yet has no key space to convert into, so the call only
opens the column.

## Build

```sh
pnpm install
pnpm build        # lib/index.js + lib/client.js
pnpm typecheck
pnpm test
```

`lib/client.js` is the artifact the Host page loads: a CommonJS factory
registered through `window.__ModuleLoader__.load`, with every dependency
inlined except the shared module table (`react`, `@deepseek-ai/cordis`,
`@deepseek-ai/dsh-client-store`, `@deepseek-ai/dsh-client-ui-slots`,
`@deepseek-ai/dsh-client-ui-primitives`, and the rest of that table). CSS
Modules are compiled at build time into hashed class names and injected as one
`<style>` tag per stylesheet.

The build also fixes the public build values into the artifact. There is no
`process` in the page, so every `process.env.DSH_CLIENT_*` the source reads
has to be substituted at build time — `tsdown.config.ts` does that from
`package.json`, which is why the brand badge shows this package's version
rather than the harness release it was built beside.

`scripts/smoke.mjs` loads the built bundle the way the page does and reports
what it registers, so a broken artifact fails before it reaches a profile.
