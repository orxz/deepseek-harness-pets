# Installation

English | [简体中文](installation.zh.md)

A persistent pet whale swims in the bottom-right corner of your DeepSeek Harness Web UI, reacting to your agent's turns — loading, inferring, scoring, celebrating SOTA. Two commands install it.

## Quick start

```sh
dsh plugin --profile web add deepseek-harness-pets
dsh web
```

`web` is the shipped Web profile, initialized on first use. Open `http://localhost:3080` — the whale is already floating in the bottom-right corner, bobbing in idle. Send a message and watch it change animation with the turn state.

Remove it just as easily:

```sh
dsh plugin --profile web remove deepseek-harness-pets
```

## Prerequisites

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) with the Web surface (`dsh web`). Verified against dsh 0.1.0-rc.5; dsh is in developer preview, so newer versions may behave differently.
- pnpm on `PATH` — `dsh plugin` forwards its arguments to pnpm inside the profile directory. `corepack enable` is enough.
- Node.js ≥ 22 (the `.nvmrc` pin).
- Nothing else. The harness supplies cordis, schemastery, and React through the loader's module table; this package ships its prebuilt browser bundle (`lib/client.js`) and needs no companions.

## What you get

| dsh signal | Pet state | Animation | Bubble |
|---|---|---|---|
| session idle | `idle` | slow bobbing | zzZ |
| `turn/start` first prep | `loading` | buoyant anticipation | Loading data… |
| `step/start` / tool activity | `inferring` | quick swimming sway | Inferring… |
| report/scoring tool calls | `scoring` | leaning review | Scoring… |
| `turn/end` completed | `done` | fin waving | Done! |
| completion with SOTA text | `sota` | jump + splash | SOTA! |
| `turn/end` failed | `error` | belly-up + grayscale | [ERROR] check logs |

Interactions: click (jump + happy bubble), hover (scale + tilt), random idle fidgets every 20–60 s, drag anywhere — position persists across reloads (`localStorage` key `dsh-pets-overlay-pos`).

## Configuring the pet

Edit `~/.dsh/settings.yaml` (user layer) and restart `dsh web`:

```yaml
deepseek-harness-pets:
  pet: deepseek-octo   # default is deepseek-whale; "random" picks per turn id
```

Or pin it in the profile patch layer (`~/.dsh/profiles/web/cordis.patch.yml`):

```yaml
- id: deepseek-harness-pets
  config:
    pet: random
```

Resolution order: user settings > profile patch > schema default (`deepseek-whale`). Values outside the discovered pool are rejected at startup (fail loud); skins from custom (`~/.dsh/pets`) and petdex (`~/.petdex/pets`) sources participate in selection — until pixel spritesheets land (Roadmap), the overlay always renders the official whale SVG regardless of skin.

## Installing from a source checkout

For developing the plugin itself:

```sh
git clone https://github.com/orxz/deepseek-harness-pets.git
cd deepseek-harness-pets && npm install && npm run build

# register into the web profile (link, no npm publish needed)
cd ~/.dsh/profiles/web
# package.json: dependencies += "deepseek-harness-pets": "link:<repo path>"
#              dsh.profile.bundles += "deepseek-harness-pets"
pnpm install

dsh web   # bundles are not hot-reloaded — restart after every rebuild
```

Verify: `dsh --profile web --dump-config` lists `deepseek-harness-pets`; the browser console's `window.__DSH_BOOT__` contains the entry; `/plugins/deepseek-harness-pets/client.js` returns 200.

## Hand-written patch row

For profiles that prefer explicit layers, the equivalent of `dsh plugin add` is:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: deepseek-harness-pets
```

with the package installed (`pnpm add deepseek-harness-pets` inside the profile directory). That row is the alternative to `dsh plugin`, not a companion to it.

## Troubleshooting

- **No whale in the corner** — dsh ≥ 0.1.0-rc.5 required (`shell.overlay` slot); restart `dsh web` (bundles are not hot-reloaded); check `dsh --profile web --dump-config` for the entry and the browser console for errors. The plugin is fail-open: if anything is off, the pet silently does not appear rather than breaking the UI.
- **Position reset after reload** — `localStorage` was cleared; the pet returns to the default bottom-right corner. Expected.
- **Switched skins but the whale looks the same** — expected until spritesheets land (Roadmap); selection still takes effect (`data-pet-overlay` attribute shows the slug).
- **Settings ignored / panel missing the pet row** — values outside the pool make registration fail silently-but-safely; fix the value or delete the section and restart. The settings-panel picker row is on the Roadmap.
- **After a dsh upgrade things break** — dsh is a developer preview. File an issue with your `--dump-config` output.
