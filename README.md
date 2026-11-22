# dsh-client-ui-sidebar-idea

The Idea-style sidebar for DeepSeek Harness.

It replaces the stock sidebar column with three parts:

- an **activity rail** down the left edge, with buttons for the sidebar body, the
  workspace file tree, and a bottom terminal panel;
- a **panel column** that a rail button opens;
- a **terminal panel** along the bottom of the window, with tabs, a resizable
  body, and a real shell running in the current Session's directory.

The terminal panel opens with its rail button or with Ctrl and the backquote key.
Its shells are configured in **Settings → Terminal**, where you also pick which
one a new tab starts on.

This package occupies the same `sidebar` seat as the stock column, so enable one
or the other, never both.

## Build

```sh
pnpm install
pnpm build
```

`pnpm build` writes `lib/`, which is build output and is not committed.

## Install

Two ways, either is fine.

### Option 1: the script in this package

```sh
pnpm run install:profile          # into "desktop" (the default)
pnpm run install:profile web      # into "web"
```

The name after the command is the profile; leave it out for `desktop`.

It does three things:

1. adds a link dependency pointing at this directory to
   `~/.dsh/profiles/<name>/package.json`;
2. adds this package's name to `dsh.profile.bundles` in that same file;
3. runs `pnpm install` inside the profile, which turns that link into a real
   module.

### Option 2: the `dsh` command

```sh
# run from this directory
dsh plugin --profile web add .
```

`dsh plugin add` does the same work and resolves dependencies itself. It refuses
the `desktop` profile, though: that one is managed exclusively by the DSH Desktop
application and the command errors out. Use option 1 for `desktop`.

Both are safe to run twice. Restart DSH Desktop afterwards.

The package ships its own patch layer, which disables the stock sidebar column and
the stock right-sidebar terminal (that one claims the Ctrl+backquote gesture this
panel wants). Selecting the bundle is the whole install — the profile's patch
file needs no hand-editing.

## Development

```sh
pnpm check   # typecheck, tests, build, smoke
```
