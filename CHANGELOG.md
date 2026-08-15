# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Live screenshots of the floating overlay captured from a real `dsh web` session (idle / hover / click / dragged / close-up) under `docs/screenshots/`, embedded in both READMEs and the install guides.

## [0.2.3] — 2026-08-15

Documentation and DX release — no runtime changes.

- Bilingual docs: English README (two-command quick start via `dsh plugin add`) with the original Chinese content preserved as README.zh.md; full install guides split into docs/installation.md and installation.zh.md (prerequisites, state table, configuration, source checkout, hand-written patch row, troubleshooting).
- CHANGELOG.md added (this file).
- CI polish: concurrency groups (stale PR runs cancel; releases serialize with `cancel-in-progress: false`), Node version pinned via `.nvmrc`.
- Fixed a DOM attribute name in the troubleshooting notes (`data-dsh-pet-overlay`).

## [0.2.2] — 2026-08-15

First version published by the automated release pipeline (push a `v*` tag → GitHub Actions verifies and publishes to npm via [trusted publishing](https://docs.npmjs.com/generating-provenance-statements/), zero tokens, with provenance).

- Release workflow now upgrades npm to ≥ 11.5 before publishing — the npm bundled with Node 22 cannot complete the OIDC credential exchange and fails with 404 (#2545e10).
- No runtime changes; identical to 0.2.0 apart from the release pipeline itself.

## [0.2.0] — 2026-08-15

The pet moves out of the chat stream. **Breaking**: the chat-card form is removed and replaced by a persistent bottom-right floating overlay (`shell.overlay` slot, root scope, survives session switches).

### Added

- Persistent floating overlay with the official DeepSeek whale SVG (brand blue `#4D6BFE`, ~96 px), rendered through the dsh `shell.overlay` slot.
- Lifelike interactions: click reaction (jump + happy bubble, ~1.5 s), hover reaction (scale + tilt + "嗯？"), random idle fidgets every 20–60 s while idle, and dragging with viewport clamping plus `localStorage` position persistence.
- State-driven CSS animations for all seven semantic states: idle bobbing, loading anticipation, inferring swim, scoring review, done waving, sota jump, error belly-up + grayscale.
- `src/pet-store.js` — single observable view-state source; terminal states fall back to idle after 4 s; transient interactions take precedence over semantic state.
- CI: verify workflow with a prebuilt-artifact drift gate (`git diff --exit-code -- lib/client.js`) — source changes must ship with a rebuilt client bundle.

### Changed

- `package.json` is publish-ready: `private` removed, `repository`/`homepage`/`bugs`/`publishConfig` added.
- CONTRIBUTING gains a maintainer release runbook (tag `vX.Y.Z` → push → CI publishes).
- Architecture views and evidence records redrawn for the overlay form (docs/architecture).

### Removed

- Chat-stream pet card (`petCardView` and the `conversation.chat.node` slot injection) and the bounded turn-context registry (`src/turn-contexts.js`) — superseded by the overlay.

### Fixed

- Pointer capture failures (synthetic/unresponsive pointers) no longer throw uncaught `NotFoundError` — capture/release are best-effort (#e5f4f16).

## [0.1.0] — 2026-08-15

Initial scaffold: chat-card form. Kept for the record; superseded by 0.2.0.

- Conversation-node pet card in the chat stream (`petCardView`, 8×9 Petdex spritesheet frame player with CSS `steps()` animation).
- dsh durable-session-event state machine (`pet-state.js`): turn/step/tool events fold into seven semantic states (idle/loading/inferring/scoring/done/sota/error) with replay determinism.
- Pet skin pool with three-source discovery (custom `~/.dsh/pets` > petdex `~/.petdex/pets` > bundled `assets/pets`) and Host-side settings registration (`pet` / `pets` fields, schemastery schema).
- State mapping contract (`mappings/harness-states.json`): semantic states → Petdex animation rows + fps + bubble copy, machine-readable and test-locked.
- 92 unit tests (node:test, zero runtime dependencies); full-pipeline verification against a real dsh 0.1.0-rc.5 checkout.

[0.2.3]: https://github.com/orxz/deepseek-harness-pets/releases/tag/v0.2.3
[0.2.2]: https://github.com/orxz/deepseek-harness-pets/releases/tag/v0.2.2
[0.2.0]: https://github.com/orxz/deepseek-harness-pets/releases/tag/v0.2.0
