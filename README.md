# deepseek-harness-pets

English | [简体中文](README.zh.md)

> A desktop pet for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) — a whale that swims in the corner of your Web UI and reacts to your agent's turns.

A persistent little whale floats in the **bottom-right corner** of the DSH Web UI (`shell.overlay` slot — never touches your chat stream). It bobs while idle, braces while loading, swims hard while inferring, reviews while scoring, waves when a turn completes, leaps on SOTA, and floats belly-up on failure. Click it, hover it, drag it — it's a real pet.

Pet skins follow the [Petdex](https://github.com/crafter-station/petdex) standard (`pet.json` + 8×9 spritesheet), so assets interop with the Petdex desktop overlay and the petdex.dev community gallery.

## Install

Two commands (v0.2.2+ on npm):

```sh
dsh plugin --profile web add deepseek-harness-pets
dsh web
```

Open `http://localhost:3080` — the whale is already there. Full guide (prerequisites, source checkout, hand-written patch row, troubleshooting): [docs/installation.md](docs/installation.md).

## State mapping

Three-layer contract: **dsh event signal → plugin semantic state → overlay CSS animation + bubble**. Machine-readable: [mappings/harness-states.json](mappings/harness-states.json).

| dsh signal | State | Overlay visual / bubble |
|---|---|---|
| session idle | `idle` | bobbing doze / zzZ |
| `turn/start` first prep | `loading` | buoyant anticipation / Loading data… |
| `step/start`, tool activity | `inferring` | swimming sway / Inferring… |
| report/scoring tools | `scoring` | leaning review / Scoring… |
| `turn/end` completed | `done` | fin waving / Done! |
| completion with SOTA text | `sota` | leap + splash / SOTA! |
| `turn/end` failed | `error` | belly-up grayscale / [ERROR] check logs |

Animations are driven by the `OVERLAY_ANIMATIONS` table in `src/pet-art.js` (CSS transform keyframes over the official DeepSeek whale SVG). The Petdex 9-row set remains the asset contract for the future spritesheet switch point.

## Configuration

`~/.dsh/settings.yaml` (user layer) or the profile patch layer:

```yaml
deepseek-harness-pets:
  pet: random   # deepseek-whale (default) | deepseek-octo | random (deterministic per turn id)
```

Skin discovery scans three sources, highest priority first: `~/.dsh/pets` (custom) > `~/.petdex/pets` (community) > bundled `assets/pets`. Details: [docs/installation.md](docs/installation.md#configuring-the-pet).

## Creating a skin

Each pet is a standard Petdex package under `assets/pets/<slug>/` — contribute one via PR (`pet/<slug>` branch), or keep it local in `~/.dsh/pets/` where it always wins. Frame spec: 8×9 grid, 192×208 per frame, magenta `#FF00FF` background, row order idle→review. See [CONTRIBUTING.md](CONTRIBUTING.md) and each pet's `spritesheet.README.md`.

## Release

Published to npm by GitHub Actions via [trusted publishing](https://docs.npmjs.com/) (OIDC, zero tokens): push a `v*` tag → CI verifies (tests, build, artifact-drift gate) → publishes with provenance. Maintainer runbook: [CONTRIBUTING.md](CONTRIBUTING.md). Changelog: [CHANGELOG.md](CHANGELOG.md).

## Roadmap

- [x] Full-pipeline verification against a real dsh checkout (install → composition → boot graph → client bundle → settings, 2026-08-15)
- [x] Persistent floating overlay form (`shell.overlay`, v0.2)
- [x] Overlay live verification (bottom-right residency, interactions, drag persistence, zero console errors, 2026-08-15)
- [x] Published to npm via CI trusted publishing (v0.2.2, zero token; topics: dsh-plugin/pet/deepseek/petdex)
- [ ] Settings-panel pet picker row (`settings.general.item` slot)
- [ ] Pixel spritesheets (`spritesheet.webp` × 2, community-owned)
- [ ] Host static serving for custom/petdex skins (removes the single-SVG limitation)
- [ ] Host-side event family for precise eval-phase & SOTA detection
- [ ] `npx petdex submit` to the community gallery

## Contributing & license

- Guide: [CONTRIBUTING.md](CONTRIBUTING.md) · Architecture evidence: [docs/architecture/](docs/architecture/)
- Code MIT ([LICENSE](LICENSE)); pixel assets © their contributors, per each `pet.json`.

> **Disclaimer**: community-driven, unofficial, not affiliated with DeepSeek. "DeepSeek" is a registered trademark of DeepSeek AI, used here as thematic homage.
>
> **Package disambiguation**: the official harness is the npm package `@deepseek-ai/dsh` (Node.js). The PyPI `deepseek-harness` is an unrelated third-party Python library.
