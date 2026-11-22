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

The same layer also disables `@deepseek-ai/dsh-client-ui-sidebar-terminal`:
that package claims the Ctrl+` gesture for the right sidebar's terminal, and one
keyboard default cannot belong to two commands, so the bottom panel's own
command could not register beside it. The panel paragraph under "Directory
layout" explains what the gesture then does.

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
    shell/                       The two-column frame around the rail and the panel column.
      index.ts                   Seat registration, panel and button aggregation, services.
      SidebarRoot.tsx            Frame body: rail on the left, panel column on the right.
      HeaderLeadingControls.tsx  Collapsed-column controls, mounted in the frame chrome.
      PanelIcon.tsx              Icon face for a main panel entry.
      scroll-handoff.ts          Scroll ownership between the column and the page.
    buttons/                     First column: one folder per rail button.
      rail/                      The rail strip itself, holding both button groups.
        ActivityRail.tsx         Strip: button slots, drag reordering, panel toggle.
      top/                       Buttons rendered top-down, one folder per button.
        sidebar/                 The sidebar's own toggle: back to the sidebar body.
        files/                   The workspace tree button.
      tail/                      Buttons rendered bottom-up, one folder per button.
        terminal/                Opens the bottom terminal panel (also Ctrl+`).
    status/                      Rail state, no UI: order, pins, and the service face.
      button-order.ts            Per-user rail order and selection, in memory.
      panel-pins.ts              Pinned and unpinned panel rows.
      rail.ts                    `sidebarRail` service: reveal one rail item's body.
    panels/                      One folder per body a rail button opens.
      terminal/                  Bottom panel: frame, tabs, xterm surface, the open command.
        TerminalProfiles.tsx     The shell table: names and executable locations.
        TerminalSettingsSection.tsx  That page: the settings.section entry.
      files/
        index.ts                 `sidebarFiles` service and the file tree seats.
        FilesBody.tsx            Panel body: directory listing, expansion, current file.
        tree-store.ts            Open directories and the current file, per Session.
        tree.ts                  Entry and directory projection over the listing.
        paths.ts                 Workspace path to tree key conversion.
        actions.ts               `sidebarFiles` service declaration.
    locales/                     Dictionaries, one module per namespace.
```

Adding a rail button: put the component under `buttons/top/<name>/` for the
top-down group or `buttons/tail/<name>/` for the bottom-up one, and register it
into `sidebar.button.top` / `sidebar.button.tail` with a unique `id`. A top-row
button that opens a body in the second column also registers into
`sidebar.button.panel` with the same `id`, and puts the body under
`panels/<name>/`.

A tail-row button owns the bottom of the page instead. The terminal button
(`buttons/tail/terminal/`) opens the panel in `panels/terminal/`, which
registers into `shell.bottom`, the frame's seat below all three columns, so
opening it pushes the columns up rather than replacing the second column.

The panel holds tabs the way an editor's panel does: each tab is its own
terminal, keyed by the tab id, so two tabs in one Session run two Host
processes. The strip's `+` button opens the shell menu, which lists the shells
the Host reported (`webTerminals.launchShells`) plus a row that just takes the
Host's default. Closing the last tab closes the panel; the panel opens a fresh
tab when it is shown again.

The `+` is the last child of the scrolling strip, so it always sits right after
the last tab instead of at a fixed edge, and it scrolls with the row it extends.
The menu is portalled: a scrolling box clips its overflow, so an in-place popup
would be cut off at the strip's edge and the button would look dead. The menu
only picks a shell: the table that edits one lives in the app's Settings, under
the terminal section, so the panel itself stays a strip and a screen.

That seat is one grid row spanning the whole frame (`grid-column: 1 / -1`), so
the seat itself cannot exclude any column. The panel therefore keeps the rail's
strip clear — the strip owns its own toggle button and has to stay reachable —
and paints it in the rail's fill: the panel covers the sidebar's second column,
the main column and the right bar, and only the rail stays uncovered.

That strip is the content box's own left padding, not a block beside it. The head
and the screen are laid out inside the padded box, so the tabs sit at a fixed
offset from the box's own edge and there is no second element between them and
the layout that could be re-laid-out or scrolled under them: the tab row cannot
move by a pixel without the screen moving with it. Its width is the page's
`--dsh-rail-width` token, not a measurement of the column beside it, so the panel
is one self-contained box whose width follows from the layout's own markers —
nothing is read back at runtime and no observer has to chase an animation frame
by frame.

That padding is fixed, and staying fixed is the point. It used to shrink to zero
as the sidebar collapsed, handing the strip back to the frame at the same rate:
the sum was constant, so the panel's left edge looked still, but both halves were
travelling and the box's own geometry changed on every frame of the gesture. Its
left edge and width moved, and with them the origin every tab label and close
button was rasterised from, so the glyphs were re-hinted at a new sub-pixel
offset each frame — which reads as the close buttons twitching, worst on the
widest labels. The shell now cancels the frame's reservation under this row
instead, so the row is pinned to the window's left edge from the first frame to
the last and this box never moves at all. Drawer mode is the only case that still
drops the padding to zero: there the sidebar floats over the content and covers
the rail outright, and that is a static rule rather than half of an animation.

Opening and closing animate the seat's own height, and because the seat is a grid
row the frame shrinks and grows with it, so the panel slides out from under the
columns instead of appearing in place. The section is mounted at zero height and
moved to the stored height on the next frame (a transition needs a committed
starting value), and on close it drops back to zero and is only unmounted once
the 220ms transition has finished.

Dragging the top edge turns the transition off so the edge sits exactly under the
pointer, and the drag writes the height straight to the element: one write per
animation frame, committed to the store only on release. Going through the store
would mean a React render, a fresh child seat and a terminal refit per pointer
report, and the edge would trail the pointer by however long that takes. The
height is likewise written by a layout effect rather than passed as a prop, so a
render in the middle of a drag (a tab opening, a locale change) cannot reset it
under the pointer.

The terminal's own refit is throttled to one per 80ms while the box is moving.
A resize observer fires per layout change, and both a drag and the open/close
transition change the box on every frame; refitting each time costs a grid reflow
plus a resize round trip to the Host, which is what makes a drag feel slow. The
throttle keeps the terminal following the edge in visible steps and settles into
exactly one refit when the gesture ends.

The sidebar's own collapse animation carries the same duration and curve as the
frame's track (220–300ms, `cubic-bezier(0.2, 0.9, 0.25, 1)`), so the two boxes
inside the track and the track itself arrive together. The curve is applied by
replacing `--ds-ease-in-out` on the animating frame, which is where ui-layout's
own track transition reads it.

On Windows the rail's 48px strip has to be reserved by whoever spans it, and that
reservation changes hands during the collapse: the column body holds it while the
sidebar has a track, the layout frame holds it once the track is gone. The
reservation is therefore one number, `--dsh-frame-reserve`, declared once on the
frame and read by every owner — registered with `@property` as a length so it
interpolates instead of snapping, and so descendants can read the animated value
rather than each keeping a copy that drifts from the others. The column holds
whatever the frame has not taken, so the two add up to the strip at every instant
and the body's left edge never moves: only its right edge travels with the track.
A body that kept its own 48px while the frame added another would put the sum at
96px and slide 48px right as the track closed — widening the strip beside it and
snapping back at settle, which is what the eye reads as the column swelling
before it shrinks.

The bottom row spans the whole frame, so that reservation would start it 48px to
the right, and during the collapse the offset travels. The row therefore cancels
it with a negative margin of the same animated value, which pins the row's border
box to the window's left edge on every frame; the columns above move, the row does
not. The frame's transition also spells the titlebar attribute on `html` so it
outranks ui-layout's own `.frame[data-animating]` transition instead of tying
with it, where source order alone would decide.

`shell.bottom` carries no Session binding, so the panel declares one child seat
of its own, `sidebar.terminal.panel`, scoped to the current Session and drawn
inside the framework's `SessionProvider`; that child is what gives the terminal
its Session. The emulator (xterm.js) is bundled into `lib/client.js`; its
stylesheet is inlined into the same style tag as the plugin's own rules, because
the served page has no other way to fetch it.

The terminal controller keeps a Host-side hold only for the terminal tabs the
layout reports as open, and `webTerminals.retainTabs` replaces that whole list
on every write. The list belongs to the page rather than to this plugin: the
right sidebar writes it from its own tabs alone, so a write from either side
would release the other's hold, and a released hold ends the Host terminal. This
module therefore writes the union — the right sidebar's terminal tabs plus its
own — and re-writes it on a microtask after the right sidebar changes its tabs,
so the last write always covers both. Switching Sessions releases the terminals
of the Session left behind, and closing a tab closes its Host terminal.

A hold can still be lost (another owner writing later, or a Host-side eviction).
That failure cannot be refreshed back to life, so the module watches for it and
opens a fresh terminal under the same content id — which is why the panel
survives the right sidebar closing its own terminal.

The panel is the frame's bottom seat, not a sidebar body, so no rail handler can
reach it: a keyboard command is what opens it. It registers
`sidebarTerminalIdea.terminal` on Ctrl+` (Command+` on macOS) and reveals the
panel, growing a tab when the panel is already open — the gesture behaves the
same whether the panel was hidden or in front. The command id is namespaced
because a command id belongs to one package: the stock right sidebar terminal
claims `terminal.new` on the same gesture, and the registry rejects a second
command that shares a default, so the bundle's patch layer disables
`@deepseek-ai/dsh-client-ui-sidebar-terminal` and the key is this panel's. A
profile whose patch file lacks that entry keeps both packages: the rail button
still opens the panel, and the gesture stays with whichever command registered
first. Registration is wrapped so a collision only costs the key, never the
column.

A Session may hold only so many terminals — eight by default, and a terminal that
has already exited keeps its slot. The controller reports a refused allocation as
the `terminalLimit` issue rather than as a broken terminal, so the body names the
cap and tells the user to close a tab, and neither offers a retry (nothing a retry
could free) nor repeats the Host's English error line under the message. The
module's own recovery watch skips the same issue for the same reason: it exists to
reopen a terminal whose Host process was lost, not to ask for capacity twice.

Each shell row pairs a name with the location of its executable, and that is all
a row carries. The Host opens every terminal in the Session's working directory —
its create request carries a shell and a size but no directory — so a per-shell
directory was never a promise the panel could keep, and nothing is typed on the
shell's behalf any more. The location is typed or picked from the Host's shell
discovery, and the table is seeded from that discovery the first time it is empty
and then belongs to the user.

The table is drawn on the terminal page of the app's Settings
(`TerminalSettingsSection.tsx`), registered into the settings shell's
`settings.section` list as `id: 'terminal'`. The bottom panel deliberately has
no settings surface of its own: it is the tab strip and the screen, and the one
table that edits a shell is not something to draw twice. That seat is
root-scoped and carries no Session, so the page seeds from the Session the main
view is showing (`retainedBy.mainView`) and stays empty when there is none.

Three paints divide the column and the panel. The rail keeps the sidebar tint;
the column body and the terminal's screen are both the same black, declared once
as `--dsh-idea-body-fill` on `html` so the bottom panel — which is not inside the
column — reaches the same value; and the panel's head is the rail's tint again,
which is what separates the tool strip from the screen under it. The panel's
gutter under the rail carries the rail tint as well, so the strip runs unbroken
to the bottom of the window while the row's left edge stays the strip's. No line
is drawn where the body meets the rail: the two fills already differ, and a
hairline there only reads as a stray white edge.

The panel's black belongs to the screen alone. The panel box, its grab strip and
its head are all the rail's tint, and only the box under the head is black — so
the tabs sit on the strip's material instead of on a black lip, and the seam
between the two is a change of fill with no line drawn across it.

Both tints are named here as `--dsh-idea-rail-fill` and `--dsh-idea-body-fill`
because the shell has no token for the rail: `--dsw-specific-sidebar-fill`
exists (the sidebar column paints with it), but the rail has always simply
inherited that column's background, so anything outside the column — the
bottom panel's head and its gutter — has to be told the colour explicitly.
An undefined variable paints nothing, and a transparent strip over the page
background is exactly what made the first attempt look unchanged.

Both black slabs are rounded on a 12px radius, and each is a slab laid on the
rail's tint rather than a fill of its own: the column body rounds inside the
frame that paints the strip, so its corners show that strip; the panel rounds as
a whole — the box clips its square screen — so its corners show the same strip.
Only the panel's top pair is round: it is flush with the window's bottom edge, and
a dock that ends the page should not float above it.

Every head row is draggable, including the strip's own sidebar toggle: the
shell projects that button into `sidebar.button.top` under the reserved id
`sidebar` (`SIDEBAR_BUTTON_ID`) instead of pinning it above the registrants,
so the whole first column reorders with one drag. Ids a plugin has never seen
keep their registration order behind the ones already arranged.

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