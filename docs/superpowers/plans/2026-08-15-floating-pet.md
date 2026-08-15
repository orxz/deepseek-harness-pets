# 右下角常驻悬浮窗桌宠 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把桌宠从聊天流卡片改为 Web UI 右下角常驻悬浮窗（官方鲸鱼 SVG + 拟真互动），删除聊天卡渲染。

**Architecture:** 复用已验证的 `petNodeDefinition` 折叠引擎（`start`/`update` 折叠后写新模块级可观察 store `pet-store.js`），悬浮窗组件经 dsh `shell.overlay` 插槽（root 域常驻）渲染；视觉层 `pet-art.js` 提供内联 SVG 与语义状态→CSS transform 动画表；`overlay-view.js` 为 React 薄壳组件 + 可单测纯函数。

**Tech Stack:** Node ≥22 ESM、React 18/19（peerDependency，经宿主注入、esbuild external，**项目 node_modules 中没有 react，测试不得 import react**）、`node --test`、esbuild。

**Spec:** `docs/superpowers/specs/2026-08-15-floating-pet-design.md`（已批准）

## Global Constraints

- 零新增 runtime 依赖；react 保持 peerDependency，测试图中不得出现 `import "react"`（node --test 会解析失败）。
- 组件薄壳不直接单测（项目现状：`src/index.js` 亦无单测，靠实机目验）；一切可测逻辑放纯函数/纯模块。
- fail-open 家规：渲染路径永不抛错；`localStorage` 不可用回退默认位置；未知状态回落 idle。
- 品牌蓝 `#4D6BFE`；SVG path 用用户提供的官方 seeklogo 单 path 矢量（见 Task 1，勿改动 path data）。
- 终态回 idle 常量 `TERMINAL_IDLE_DELAY_MS = 4000`；点击/拖拽阈值 `DRAG_THRESHOLD_PX = 5`；随机闲置间隔 20000–60000ms、时长 3000ms；点击瞬态 1500ms。
- 代码注释用简体中文，风格对齐现有文件（模块头注释 + 关键函数 JSDoc）。
- 本仓库当前**无任何 git 提交**（全部文件 untracked）；每个 Task 末尾的 commit 将构成初始提交链，commit message 用英文 conventional 风格。
- 每次改浏览器半边代码后必须 `npm run build`（dsh 不热加载，`lib/client.js` 是被服务的产物）。

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `src/pet-art.js` | 新建 | 内联鲸鱼 SVG path、动画表、keyframes 生成、动画样式与气泡文案选择（纯函数） |
| `src/pet-store.js` | 新建 | 模块级可观察 store：单 pet-state 实例 + petSlug + 瞬态；终态回 idle（时钟/定时器注入） |
| `src/overlay-view.js` | 新建 | 纯函数（clamp/拖拽判定/位置持久化/闲置调度）+ `createPetOverlay` React 薄壳组件 |
| `src/index.js` | 修改 | Definition 折叠写 store；`buildViewNode` 恒 null；删 `conversation.chat.node` 注入；注册 `shell.overlay` |
| `src/renderer.js` | 修改 | 删 `petCardView` 与内部 `spriteAnimStyle`；保留帧计算函数（spritesheet 未来切换点） |
| `test/pet-art.test.js` | 新建 | 动画表完整性、keyframes 生成、样式与气泡选择 |
| `test/pet-store.test.js` | 新建 | 折叠→状态、终态回 idle、订阅通知、瞬态优先级 |
| `test/overlay-view.test.js` | 新建 | clamp/拖拽阈值/位置解析/闲置延迟纯函数 |
| `test/renderer.test.js` | 修改 | 删 5 个 `petCardView` 测试，保留帧计算测试 |
| `README.md` / `docs/architecture/evidence.md` | 修改 | 形态描述更新、Roadmap 勾选、证据条目更新 |

---

### Task 1: pet-art.js — SVG 资产与动画表

**Files:**
- Create: `src/pet-art.js`
- Test: `test/pet-art.test.js`

**Interfaces:**
- Consumes: 无（零依赖；不 import renderer.js）
- Produces:
  - `WHALE_SVG_PATH: string`（官方 path data）
  - `PET_SIZE = 96`
  - `OVERLAY_ANIMATIONS: object`（key ∈ 7 语义状态 + `'click' | 'fidget'` 瞬态 → `{ name, duration, filter? }`）
  - `buildOverlayAnimationCss(): string`（全部 keyframes + 基类）
  - `overlayAnimStyle({ semanticState, transient }): { animationName, animationDuration, animationIterationCount, filter? }`（瞬态优先；未知状态回落 idle）
  - `bubbleFor({ stateDef, transient, hovered }): string`
  - `CLICK_BUBBLES` / `FIDGET_BUBBLES`（文案数组）

- [ ] **Step 1: 写失败测试**

```js
// test/pet-art.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  WHALE_SVG_PATH,
  PET_SIZE,
  OVERLAY_ANIMATIONS,
  buildOverlayAnimationCss,
  overlayAnimStyle,
  bubbleFor,
  CLICK_BUBBLES,
  FIDGET_BUBBLES,
} from "../src/pet-art.js";

const SEMANTIC = ["idle", "loading", "inferring", "scoring", "done", "sota", "error"];

test("WHALE_SVG_PATH 是官方单 path 矢量（非空、以 M 起笔）", () => {
  assert.ok(typeof WHALE_SVG_PATH === "string" && WHALE_SVG_PATH.length > 500);
  assert.match(WHALE_SVG_PATH.trim(), /^M[\d.,]/);
});

test("PET_SIZE 默认 96", () => {
  assert.equal(PET_SIZE, 96);
});

test("OVERLAY_ANIMATIONS 覆盖全部 7 语义状态与 2 瞬态", () => {
  for (const key of [...SEMANTIC, "click", "fidget"]) {
    const anim = OVERLAY_ANIMATIONS[key];
    assert.ok(anim, key);
    assert.match(anim.name, /^dsh-pet-ov-[a-z-]+$/);
    assert.match(anim.duration, /^\d+(\.\d+)?s$/);
  }
});

test("overlayAnimStyle：每个 key 的 name/duration 来自表，循环播放", () => {
  const style = overlayAnimStyle({ semanticState: "inferring", transient: null });
  assert.equal(style.animationName, OVERLAY_ANIMATIONS.inferring.name);
  assert.equal(style.animationDuration, OVERLAY_ANIMATIONS.inferring.duration);
  assert.equal(style.animationIterationCount, "infinite");
});

test("overlayAnimStyle：瞬态优先于语义状态", () => {
  const style = overlayAnimStyle({ semanticState: "idle", transient: "click" });
  assert.equal(style.animationName, OVERLAY_ANIMATIONS.click.name);
});

test("overlayAnimStyle：error 带灰度滤镜", () => {
  const style = overlayAnimStyle({ semanticState: "error", transient: null });
  assert.match(style.filter, /grayscale/);
});

test("overlayAnimStyle：未知状态回落 idle（fail-open）", () => {
  const style = overlayAnimStyle({ semanticState: "bogus", transient: null });
  assert.equal(style.animationName, OVERLAY_ANIMATIONS.idle.name);
});

test("buildOverlayAnimationCss：含全部动画 keyframes 与基类", () => {
  const css = buildOverlayAnimationCss();
  for (const key of Object.keys(OVERLAY_ANIMATIONS)) {
    assert.ok(css.includes(`@keyframes ${OVERLAY_ANIMATIONS[key].name} {`), key);
  }
  assert.ok(css.includes(".dsh-pet-overlay {"));
});

test("bubbleFor：悬停最高优先", () => {
  assert.equal(bubbleFor({ stateDef: { bubble: { zh: "推理中…" } }, transient: "click", hovered: true }), "嗯？");
});

test("bubbleFor：瞬态 click/fidget 用互动文案", () => {
  assert.ok(CLICK_BUBBLES.includes(bubbleFor({ stateDef: { bubble: { zh: "zzZ" } }, transient: "click", hovered: false })));
  assert.ok(FIDGET_BUBBLES.includes(bubbleFor({ stateDef: { bubble: { zh: "zzZ" } }, transient: "fidget", hovered: false })));
});

test("bubbleFor：无瞬态回落语义气泡（bubbleText 兼容 zh/en）", () => {
  assert.equal(bubbleFor({ stateDef: { bubble: { zh: "完成！", en: "Done!" } }, transient: null, hovered: false }), "完成！");
  assert.equal(bubbleFor({ stateDef: undefined, transient: null, hovered: false }), "");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/pet-art.test.js`
Expected: FAIL（`Cannot find module '../src/pet-art.js'`）

- [ ] **Step 3: 实现 src/pet-art.js**

```js
/**
 * pet-art.js — 悬浮窗艺术层 v1：官方 DeepSeek 鲸鱼 SVG（用户提供，seeklogo 单 path）
 * + 语义状态 → CSS transform 动画表。纯函数零依赖；spritesheet 就绪后在此替换为实现。
 */

/** 官方鲸鱼标志 path data（viewBox 0 0 300 300，勿改动）。 */
export const WHALE_SVG_PATH =
  "M195,166.1c-2.4,1-4.9,1.8-7.2,1.9-3.6.2-7.6-1.3-9.7-3.1-3.3-2.8-5.7-4.4-6.7-9.2-.4-2.1-.2-5.3.2-7.2.9-4-.1-6.5-2.9-8.9-2.3-1.9-5.2-2.4-8.4-2.4s-2.3-.5-3.1-1c-1.3-.7-2.4-2.3-1.4-4.4.3-.7,2-2.3,2.3-2.5,4.3-2.5,9.4-1.7,14,.2,4.3,1.7,7.5,5,12.2,9.5,4.8,5.5,5.6,7,8.4,11.1,2.1,3.2,4.1,6.6,5.4,10.4.8,2.4-.2,4.3-3.1,5.5ZM157.1,146.7c0-2.1,1.7-3.7,3.8-3.7s.9.1,1.3.2c.5.2,1,.5,1.4.9.7.7,1.1,1.6,1.1,2.6,0,2.1-1.7,3.8-3.8,3.8s-3.7-1.7-3.7-3.8ZM144.9,225.2c-25.5-20-37.8-26.6-42.9-26.3-4.8.3-3.9,5.7-2.8,9.3,1.1,3.5,2.5,5.9,4.5,9,1.4,2,2.3,5.1-1.4,7.3-8.2,5.1-22.5-1.7-23.1-2-16.6-9.8-30.5-22.7-40.2-40.3-9.5-17-14.9-35.2-15.8-54.6-.2-4.7,1.1-6.4,5.8-7.2,6.2-1.1,12.5-1.4,18.7-.5,26,3.8,48.1,15.4,66.7,33.8,10.6,10.5,18.6,23,26.8,35.2,8.8,13,18.2,25.4,30.2,35.5,4.3,3.6,7.6,6.3,10.9,8.2-9.8,1.1-26.1,1.3-37.2-7.5ZM293.2,60.4c-3.1-1.5-4.4,1.4-6.3,2.8-.6.5-1.1,1.1-1.7,1.7-4.5,4.8-9.8,8-16.8,7.6-10.1-.6-18.7,2.6-26.4,10.4-1.6-9.5-7-15.2-15.2-18.9-4.3-1.9-8.6-3.8-11.6-7.9-2.1-2.9-2.7-6.2-3.7-9.4-.7-2-1.3-3.9-3.6-4.3-2.4-.4-3.4,1.7-4.3,3.4-3.8,7-5.3,14.6-5.2,22.4.3,17.5,7.7,31.5,22.4,41.4,1.7,1.1,2.1,2.3,1.6,3.9-1,3.4-2.2,6.7-3.3,10.1-.7,2.2-1.7,2.7-4,1.7-8.1-3.4-15-8.4-21.2-14.4-10.4-10.1-19.9-21.2-31.6-30-2.8-2.1-5.5-4-8.4-5.7-12-11.7,1.6-21.3,4.7-22.4,3.3-1.2,1.2-5.3-9.5-5.2-10.6,0-20.3,3.6-32.8,8.4-1.8.7-3.7,1.2-5.7,1.7-11.3-2.1-22.9-2.6-35.1-1.2-23,2.5-41.4,13.4-54.8,32C4.7,110.7.9,136,5.6,162.4c4.9,27.8,19.1,50.9,41,68.9,22.6,18.7,48.7,27.8,78.5,26.1,18.1-1,38.2-3.5,60.9-22.7,5.7,2.8,11.7,4,21.7,4.8,7.7.7,15.1-.4,20.8-1.5,9-1.9,8.4-10.2,5.1-11.7-26.3-12.3-20.5-7.3-25.7-11.3,13.3-15.8,33.5-32.2,41.3-85.4.6-4.2.1-6.9,0-10.3,0-2.1.4-2.9,2.8-3.1,6.6-.8,13-2.6,18.8-5.8,17-9.3,23.9-24.6,25.5-42.9.2-2.8,0-5.7-3-7.2Z";

/** 悬浮窗主体默认边长（px）。 */
export const PET_SIZE = 96;

/**
 * 语义状态/瞬态 → CSS transform 动画。name 对应 buildOverlayAnimationCss
 * 生成的 keyframes；duration 调性：高唤醒状态更快。
 */
export const OVERLAY_ANIMATIONS = Object.freeze({
  idle: { name: "dsh-pet-ov-idle", duration: "3s" },
  loading: { name: "dsh-pet-ov-loading", duration: "1.2s" },
  inferring: { name: "dsh-pet-ov-swim", duration: "0.6s" },
  scoring: { name: "dsh-pet-ov-scoring", duration: "2s" },
  done: { name: "dsh-pet-ov-done", duration: "1s" },
  sota: { name: "dsh-pet-ov-jump", duration: "1.2s" },
  error: { name: "dsh-pet-ov-error", duration: "0.8s", filter: "grayscale(0.8)" },
  click: { name: "dsh-pet-ov-jump", duration: "0.9s" },
  fidget: { name: "dsh-pet-ov-wiggle", duration: "1.5s" },
});

/** 点击互动的开心文案池。 */
export const CLICK_BUBBLES = Object.freeze(["好耶！", "收到！", "咕噜~", "扑通！"]);

/** 随机闲置小动作的文案池。 */
export const FIDGET_BUBBLES = Object.freeze(["喷个水~", "游两圈~", "小睡片刻…"]);

/** 语义状态 key 表（fail-open 回落用）。 */
const KNOWN = new Set(Object.keys(OVERLAY_ANIMATIONS));

/**
 * 生成悬浮窗动画 CSS：每个动画一条 keyframes + 基类。
 * 纯文本拼装，浏览器/Node 均可调用（沿用 renderer.js 的 <style> 注入模式）。
 */
export function buildOverlayAnimationCss() {
  return [
    "@keyframes dsh-pet-ov-idle {",
    "  0%, 100% { transform: translateY(0); }",
    "  50% { transform: translateY(-6px); }",
    "}",
    "@keyframes dsh-pet-ov-loading {",
    "  0%, 100% { transform: translateY(0) rotate(0deg); }",
    "  50% { transform: translateY(-5px) rotate(-3deg); }",
    "}",
    "@keyframes dsh-pet-ov-swim {",
    "  0%, 100% { transform: rotate(-8deg) translateX(0); }",
    "  50% { transform: rotate(8deg) translateX(4px); }",
    "}",
    "@keyframes dsh-pet-ov-scoring {",
    "  0%, 100% { transform: rotate(0deg) scale(1); }",
    "  50% { transform: rotate(6deg) scale(1.04); }",
    "}",
    "@keyframes dsh-pet-ov-done {",
    "  0%, 100% { transform: rotate(-12deg); }",
    "  50% { transform: rotate(12deg); }",
    "}",
    "@keyframes dsh-pet-ov-jump {",
    "  0% { transform: translateY(0) scale(1, 1); }",
    "  35% { transform: translateY(-48px) scale(0.94, 1.08); }",
    "  70% { transform: translateY(0) scale(1.08, 0.92); }",
    "  85% { transform: translateY(-10px) scale(1, 1); }",
    "  100% { transform: translateY(0) scale(1, 1); }",
    "}",
    "@keyframes dsh-pet-ov-error {",
    "  0%, 100% { transform: rotate(180deg); }",
    "  50% { transform: rotate(172deg); }",
    "}",
    "@keyframes dsh-pet-ov-wiggle {",
    "  0%, 100% { transform: rotate(0deg) translateY(0); }",
    "  25% { transform: rotate(-6deg) translateY(-8px); }",
    "  75% { transform: rotate(6deg) translateY(-8px); }",
    "}",
    ".dsh-pet-overlay {",
    "  will-change: transform;",
    "}",
  ].join("\n");
}

/**
 * 选择某快照的动画内联样式。瞬态 > 语义状态；未知状态回落 idle（fail-open）。
 *
 * @param {{ semanticState: string, transient: string|null }} snap
 * @returns {{ animationName: string, animationDuration: string, animationIterationCount: string, filter?: string }}
 */
export function overlayAnimStyle({ semanticState, transient }) {
  const key =
    (transient != null && KNOWN.has(transient) ? transient : null) ??
    (KNOWN.has(semanticState) && semanticState !== "click" && semanticState !== "fidget"
      ? semanticState
      : "idle");
  const anim = OVERLAY_ANIMATIONS[key];
  const style = {
    animationName: anim.name,
    animationDuration: anim.duration,
    animationIterationCount: "infinite",
  };
  if (anim.filter != null) style.filter = anim.filter;
  return style;
}

/**
 * 气泡文案：悬停 > 瞬态互动 > 语义状态（与 renderer.js bubbleText 的 zh/en 兼容）。
 *
 * @param {{ stateDef?: { bubble?: { zh?: string, en?: string } }, transient: string|null, hovered: boolean }} input
 * @returns {string}
 */
export function bubbleFor({ stateDef, transient, hovered }) {
  if (hovered) return "嗯？";
  if (transient === "click") return CLICK_BUBBLES[0];
  if (transient === "fidget") return FIDGET_BUBBLES[0];
  return stateDef?.bubble?.zh ?? stateDef?.bubble?.en ?? "";
}
```

注：`bubbleFor` 对瞬态文案取 `[0]`（确定性，便于测试与重放一致）；组件层的"随机"由调用方对数组取随机下标后传入覆盖文案，见 Task 4。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/pet-art.test.js`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet-art.js test/pet-art.test.js
git commit -m "feat(overlay): add whale SVG art and state animation table"
```

---

### Task 2: pet-store.js — 可观察视图状态 store

**Files:**
- Create: `src/pet-store.js`
- Test: `test/pet-store.test.js`

**Interfaces:**
- Consumes: `createPetState`（`src/pet-state.js`，已存在）
- Produces:
  - `TERMINAL_IDLE_DELAY_MS = 4000`
  - `createPetStore({ now, setTimer, clearTimer })` →
    `{ getSnapshot, subscribe, beginTurn, onEvent, setTransient, currentTurnId }`
    - `getSnapshot(): { petSlug, semanticState, transient, busy }`（`busy` = 语义状态非终态；`transient` ∈ `null | 'click' | 'fidget'`）
    - `subscribe(fn): () => void`
    - `beginTurn(turnId, petSlug)`：重置状态机、锁定该 turn 的皮肤、清瞬态
    - `onEvent(event)`：委托 pet-state；进入终态后经注入定时器 4000ms 回 idle
    - `setTransient(kind, durationMs)`：设置瞬态并定时回落 null；新瞬态覆盖旧瞬态
  - 后续任务假定：`createPetState({ now })` 签名不变（已存在）

- [ ] **Step 1: 写失败测试**

```js
// test/pet-store.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { createPetStore, TERMINAL_IDLE_DELAY_MS } from "../src/pet-store.js";

/** 受控定时器：手动推进，收集回调。 */
function makeFakeTimers() {
  let seq = 0;
  const timers = new Map();
  return {
    setTimer(fn, ms) {
      seq += 1;
      timers.set(seq, { fn, ms });
      return seq;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    /** 触发全部"已到期"（ms <= given）的定时器。 */
    fire(elapsedMs) {
      for (const [id, { fn, ms }] of [...timers]) {
        if (ms <= elapsedMs) {
          timers.delete(id);
          fn();
        }
      }
    },
    pending() {
      return [...timers.values()].map((t) => t.ms);
    },
  };
}

function makeStore() {
  const timers = makeFakeTimers();
  const store = createPetStore({
    now: () => 0,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  return { store, timers };
}

const ev = (type, data = {}) => ({ type, data });

test("TERMINAL_IDLE_DELAY_MS 为 4000", () => {
  assert.equal(TERMINAL_IDLE_DELAY_MS, 4000);
});

test("初始快照：idle、无瞬态、busy=false", () => {
  const { store } = makeStore();
  assert.deepEqual(store.getSnapshot(), {
    petSlug: "deepseek-whale",
    semanticState: "idle",
    transient: null,
    busy: false,
  });
});

test("beginTurn：锁定该 turn 皮肤并进入 loading", () => {
  const { store } = makeStore();
  store.beginTurn("7", "deepseek-octo");
  assert.equal(store.getSnapshot().petSlug, "deepseek-octo");
  assert.equal(store.getSnapshot().semanticState, "idle"); // 状态由事件驱动
  assert.equal(store.currentTurnId, "7");
  store.onEvent(ev("turn/start"));
  assert.equal(store.getSnapshot().semanticState, "loading");
  assert.equal(store.getSnapshot().busy, true);
});

test("事件折叠：tool/call 报告类 → scoring；turn/end → done", () => {
  const { store } = makeStore();
  store.beginTurn("1", "deepseek-whale");
  store.onEvent(ev("turn/start"));
  store.onEvent(ev("tool/call", { tool: "write_score_report" }));
  assert.equal(store.getSnapshot().semanticState, "scoring");
  store.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  assert.equal(store.getSnapshot().semanticState, "done");
});

test("终态 4000ms 后自动回 idle（受控定时器）", () => {
  const { store, timers } = makeStore();
  store.beginTurn("1", "deepseek-whale");
  store.onEvent(ev("turn/start"));
  store.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  assert.equal(store.getSnapshot().semanticState, "done");
  timers.fire(3999);
  assert.equal(store.getSnapshot().semanticState, "done");
  timers.fire(4000);
  assert.equal(store.getSnapshot().semanticState, "idle");
  assert.equal(store.getSnapshot().busy, false);
});

test("回 idle 前又开新 turn：旧定时器不误伤新状态", () => {
  const { store, timers } = makeStore();
  store.beginTurn("1", "deepseek-whale");
  store.onEvent(ev("turn/start"));
  store.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  store.beginTurn("2", "deepseek-octo");
  store.onEvent(ev("turn/start"));
  timers.fire(100000);
  assert.equal(store.getSnapshot().semanticState, "loading"); // 仍是新 turn 状态
});

test("subscribe：状态与瞬态变化均通知，退订后不再通知", () => {
  const { store } = makeStore();
  let notified = 0;
  const off = store.subscribe(() => {
    notified += 1;
  });
  store.beginTurn("1", "deepseek-whale");
  store.onEvent(ev("turn/start"));
  assert.ok(notified >= 2);
  off();
  store.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  const after = notified;
  store.beginTurn("3", "deepseek-whale");
  assert.equal(notified, after);
});

test("setTransient：设置并按时回落；新瞬态覆盖旧瞬态", () => {
  const { store, timers } = makeStore();
  store.setTransient("fidget", 3000);
  assert.equal(store.getSnapshot().transient, "fidget");
  store.setTransient("click", 1500); // 覆盖，旧定时器被清除
  assert.equal(store.getSnapshot().transient, "click");
  timers.fire(1500);
  assert.equal(store.getSnapshot().transient, null);
});

test("beginTurn 清空残留瞬态", () => {
  const { store } = makeStore();
  store.setTransient("click", 1500);
  store.beginTurn("1", "deepseek-whale");
  assert.equal(store.getSnapshot().transient, null);
});

test("快照不可变性：外部改返回对象不影响内部状态", () => {
  const { store } = makeStore();
  store.getSnapshot().semanticState = "bogus";
  assert.equal(store.getSnapshot().semanticState, "idle");
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/pet-store.test.js`
Expected: FAIL（`Cannot find module '../src/pet-store.js'`）

- [ ] **Step 3: 实现 src/pet-store.js**

```js
/**
 * pet-store.js — 悬浮窗视图状态 store（模块级单例由 index.js 创建）。
 *
 * 定位：视图状态而非 durable 状态——终态回 idle、瞬态互动都是客户端表现层
 * 定时器，不进入 pet-state 的可重放语义（重放一致性由折叠引擎保证）。
 * 时钟/定时器全部注入，纯逻辑可在 node --test 下受控推进。
 */

import { createPetState } from "./pet-state.js";
import { DEFAULT_PET } from "./pet-pool.js";

/** 终态（done/sota/error）停留时长，到点自动回 idle。 */
export const TERMINAL_IDLE_DELAY_MS = 4000;

const TERMINAL = new Set(["done", "sota", "error"]);
const TRANSIENTS = new Set(["click", "fidget"]);

/**
 * @param {object} [options]
 * @param {() => number} [options.now=Date.now]
 * @param {(fn: () => void, ms: number) => any} [options.setTimer=setTimeout]
 * @param {(id: any) => void} [options.clearTimer=clearTimeout]
 */
export function createPetStore({
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let pet = createPetState({ now });
  let petSlug = DEFAULT_PET;
  let turnId = null;
  let transient = null;
  let transientTimerId = null;
  let idleTimerId = null;
  const listeners = new Set();

  function notify() {
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch {
        // 单个订阅者异常不阻断其他通知（fail-open）。
      }
    }
  }

  function snapshot() {
    return Object.freeze({
      petSlug,
      semanticState: pet.state,
      transient,
      busy: !TERMINAL.has(pet.state),
    });
  }

  function clearIdleTimer() {
    if (idleTimerId != null) {
      clearTimer(idleTimerId);
      idleTimerId = null;
    }
  }

  function clearTransientTimer() {
    if (transientTimerId != null) {
      clearTimer(transientTimerId);
      transientTimerId = null;
    }
  }

  return {
    /** 当前 turn id（孤儿 update 判定用）。 */
    get currentTurnId() {
      return turnId;
    },

    getSnapshot: snapshot,

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /** 新 turn 开始：重置状态机、锁定皮肤、清瞬态与回 idle 定时器。 */
    beginTurn(id, slug) {
      clearIdleTimer();
      clearTransientTimer();
      transient = null;
      turnId = id;
      petSlug = slug;
      pet = createPetState({ now });
      notify();
    },

    /** 折叠引擎写入事件；进入终态时安排回 idle。 */
    onEvent(event) {
      const { state } = pet.onEvent(event);
      clearIdleTimer();
      if (TERMINAL.has(state)) {
        const generation = pet;
        idleTimerId = setTimer(() => {
          // 到点仍是同一状态机且仍处终态才回落（新 turn 已重置则跳过）。
          if (pet === generation && TERMINAL.has(pet.state)) {
            pet = createPetState({ now });
            notify();
          }
        }, TERMINAL_IDLE_DELAY_MS);
      }
      notify();
    },

    /** 瞬态互动（click/fidget）：新瞬态覆盖旧瞬态，到点回落 null。 */
    setTransient(kind, durationMs) {
      if (!TRANSIENTS.has(kind)) return;
      clearTransientTimer();
      transient = kind;
      transientTimerId = setTimer(() => {
        transient = null;
        notify();
      }, durationMs);
      notify();
    },
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/pet-store.test.js`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet-store.js test/pet-store.test.js
git commit -m "feat(overlay): add observable pet view store with terminal-idle fallback"
```

---

### Task 3: overlay-view.js 纯函数 — 拖拽/位置/闲置调度

**Files:**
- Create: `src/overlay-view.js`（本任务只写纯函数部分；组件在 Task 4 追加到同文件）
- Test: `test/overlay-view.test.js`

**Interfaces:**
- Consumes: 无
- Produces:
  - `DRAG_THRESHOLD_PX = 5`
  - `OVERLAY_MARGIN_PX = 8`、`OVERLAY_STORAGE_KEY = "dsh-pets-overlay-pos"`
  - `isDragMovement(dx, dy, threshold = DRAG_THRESHOLD_PX): boolean`
  - `clampPosition(x, y, { vw, vh, w, h, margin = OVERLAY_MARGIN_PX }): { x, number, y: number }`
  - `parseSavedPosition(raw: string|null): { x: number, y: number } | null`
  - `serializePosition({ x, y }): string`
  - `nextFidgetDelay(rand = Math.random): number`（20000–60000ms，含边界）

- [ ] **Step 1: 写失败测试**

```js
// test/overlay-view.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DRAG_THRESHOLD_PX,
  OVERLAY_STORAGE_KEY,
  isDragMovement,
  clampPosition,
  parseSavedPosition,
  serializePosition,
  nextFidgetDelay,
} from "../src/overlay-view.js";

test("常量：阈值 5px、存储键、页边距 8px", () => {
  assert.equal(DRAG_THRESHOLD_PX, 5);
  assert.equal(OVERLAY_STORAGE_KEY, "dsh-pets-overlay-pos");
});

test("isDragMovement：位移超过阈值才算拖拽（欧氏距离）", () => {
  assert.equal(isDragMovement(3, 3), false); // ~4.24 < 5
  assert.equal(isDragMovement(3, 4), false); // = 5 不超过
  assert.equal(isDragMovement(4, 4), true); // ~5.66 > 5
  assert.equal(isDragMovement(-6, 0), true);
  assert.equal(isDragMovement(0, 0), false);
});

test("clampPosition：把位置限制在视口内（留 margin）", () => {
  const vp = { vw: 1280, vh: 800, w: 96, h: 96 };
  assert.deepEqual(clampPosition(100, 200, vp), { x: 100, y: 200 });
  assert.deepEqual(clampPosition(-50, 0, vp), { x: 8, y: 8 });
  assert.deepEqual(clampPosition(9999, 9999, vp), { x: 1280 - 96 - 8, y: 800 - 96 - 8 });
  assert.deepEqual(clampPosition(0, 9999, { ...vp, margin: 0 }), { x: 0, y: 704 });
});

test("parseSavedPosition：合法 JSON 且为有限数字才接受", () => {
  assert.deepEqual(parseSavedPosition('{"x":120,"y":80}'), { x: 120, y: 80 });
  assert.equal(parseSavedPosition(null), null);
  assert.equal(parseSavedPosition(""), null);
  assert.equal(parseSavedPosition("not json"), null);
  assert.equal(parseSavedPosition('{"x":"a","y":1}'), null);
  assert.equal(parseSavedPosition('{"x":Infinity,"y":1}'), null);
  assert.equal(parseSavedPosition('{"x":10}'), null);
});

test("serializePosition 与 parseSavedPosition 互逆", () => {
  const pos = { x: 333, y: 222 };
  assert.deepEqual(parseSavedPosition(serializePosition(pos)), pos);
});

test("nextFidgetDelay：20–60s 区间，rand 单调", () => {
  assert.equal(nextFidgetDelay(0), 20000);
  assert.equal(nextFidgetDelay(1), 60000);
  const mid = nextFidgetDelay(0.5);
  assert.ok(mid > 20000 && mid < 60000);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/overlay-view.test.js`
Expected: FAIL（`Cannot find module '../src/overlay-view.js'`）

- [ ] **Step 3: 实现 overlay-view.js 纯函数部分**

```js
/**
 * overlay-view.js — 悬浮窗组件与可单测纯逻辑（位置/拖拽/闲置调度）。
 * 组件依赖的 React 经参数注入（项目 node_modules 无 react，测试图中不得 import）。
 */

/** 点击与拖拽的位移分界（px，欧氏距离）。 */
export const DRAG_THRESHOLD_PX = 5;

/** 悬浮窗与视口边缘的最小留白（px）。 */
export const OVERLAY_MARGIN_PX = 8;

/** 位置持久化的 localStorage 键。 */
export const OVERLAY_STORAGE_KEY = "dsh-pets-overlay-pos";

/**
 * @param {number} dx - pointerdown 到当前的水平位移。
 * @param {number} dy - 垂直位移。
 * @param {number} [threshold=DRAG_THRESHOLD_PX]
 * @returns {boolean} 超过阈值（拖拽）为 true。
 */
export function isDragMovement(dx, dy, threshold = DRAG_THRESHOLD_PX) {
  return Math.sqrt(dx * dx + dy * dy) > threshold;
}

/**
 * 把悬浮窗位置限制在视口内（resize/拖拽越界时回落）。
 *
 * @param {number} x - 期望 left（px）。
 * @param {number} y - 期望 top（px）。
 * @param {{ vw: number, vh: number, w: number, h: number, margin?: number }} vp
 * @returns {{ x: number, y: number }}
 */
export function clampPosition(x, y, { vw, vh, w, h, margin = OVERLAY_MARGIN_PX }) {
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  return {
    x: clamp(x, margin, vw - w - margin),
    y: clamp(y, margin, vh - h - margin),
  };
}

/**
 * 解析持久化位置；任何非法输入（缺字段/非有限数字/坏 JSON）返回 null（fail-open）。
 *
 * @param {string|null} raw
 * @returns {{ x: number, y: number }|null}
 */
export function parseSavedPosition(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y)
    ) {
      return null;
    }
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

/**
 * @param {{ x: number, y: number }} pos
 * @returns {string}
 */
export function serializePosition({ x, y }) {
  return JSON.stringify({ x, y });
}

/**
 * 随机闲置小动作的下次触发延迟（ms）：均匀分布于 [20000, 60000]。
 *
 * @param {() => number} [rand=Math.random]
 */
export function nextFidgetDelay(rand = Math.random) {
  return 20000 + rand() * 40000;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/overlay-view.test.js`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/overlay-view.js test/overlay-view.test.js
git commit -m "feat(overlay): add drag/clamp/persist/fidget pure helpers"
```

---

### Task 4: 组件 + 接线 — shell.overlay 注册、删除聊天卡

**Files:**
- Modify: `src/overlay-view.js`（追加 `createPetOverlay` 组件）
- Modify: `src/index.js`（全量改写接线）
- Modify: `src/renderer.js`（删 `petCardView` 与 `spriteAnimStyle`）
- Modify: `test/renderer.test.js`（删 5 个 `petCardView` 测试）
- Delete: `src/turn-contexts.js`、`test/turn-contexts.test.js`（用户裁定 2026-08-15：update 过滤修正后 registry 仅剩写入无读取，死代码彻底移除）

**Interfaces:**
- Consumes:
  - Task 1 `overlayAnimStyle` / `bubbleFor` / `buildOverlayAnimationCss` / `WHALE_SVG_PATH` / `PET_SIZE` / `CLICK_BUBBLES` / `FIDGET_BUBBLES`
  - Task 2 `createPetStore`
  - Task 3 全部纯函数
  - 既有 `bubbleText` 不再使用（气泡逻辑已并入 `bubbleFor`）
- Produces:
  - `createPetOverlay(store, mappings, { createElement, useRef, useState, useEffect })` → React 组件
  - `src/index.js` 导出不变：`name`、`inject`、`apply(ctx)`（`inject` 仍为 `["conversationEvents", "slots", "connection", "remote", "settingsScope"]`）

- [ ] **Step 1: 删除 renderer.js 的 petCardView 与其测试**

`src/renderer.js`：删除 `petCardView` 函数（L76-132）、内部函数 `spriteAnimStyle`（文件尾部）与 `rowOf`；保留 `STANDARD_FRAME`、`frameAtTime`、`frameStyle`、`bubbleText`、`ROW_INDEX_BY_NAME`、`buildAnimationCss`。模块头注释里"视图构建"改为只描述帧计算。

`test/renderer.test.js`：删除 import 中的 `petCardView`，删除以下 5 个测试块：
- `petCardView：有 spritesheetUrl 时渲染像素精灵节点（CSS 动画驱动帧）`
- `petCardView：不同状态的 fps 映射为不同动画时长（jumping 快于 idle）`
- `petCardView：spritesheet URL percent-encode 并加引号包裹（防空格破图/CSS 注入）`
- `petCardView：外部源皮肤（无 URL）渲染占位块并标注 slug，不硬编码 bundled 路径`
- 以及顶部 `const h = ...` 替身与 `const stateDef = ...`（仅被删除测试使用时）

保留其余帧计算测试。

- [ ] **Step 2: 跑 renderer 测试确认仍绿**

Run: `node --test test/renderer.test.js`
Expected: 剩余测试全 PASS（无 petCardView 引用残留）

- [ ] **Step 3: 给 overlay-view.js 追加组件（同文件下半部分）**

```js
import {
  buildOverlayAnimationCss,
  bubbleFor,
  CLICK_BUBBLES,
  FIDGET_BUBBLES,
  overlayAnimStyle,
  PET_SIZE,
  WHALE_SVG_PATH,
} from "./pet-art.js";

/** 随机闲置小动作时长（ms）。 */
const FIDGET_DURATION_MS = 3000;

/** 点击瞬态时长（ms）。 */
const CLICK_DURATION_MS = 1500;

/**
 * 悬浮窗组件工厂。React（createElement/hooks）经参数注入：项目 node_modules
 * 无 react，且宿主经模块表提供同一实例。
 *
 * @param {{ getSnapshot, subscribe, setTransient }} store - pet-store 实例
 * @param {{ states: object }} mappings - mappings/harness-states.json
 * @param {{ createElement: Function, useRef: Function, useState: Function, useEffect: Function }} React
 * @returns {Function} React 组件
 */
export function createPetOverlay(store, mappings, { createElement, useRef, useState, useEffect }) {
  const h = createElement;

  /** 读取持久化位置（任何异常回落 null = 默认右下角 CSS 定位）。 */
  function loadSaved() {
    try {
      return parseSavedPosition(globalThis.localStorage?.getItem(OVERLAY_STORAGE_KEY) ?? null);
    } catch {
      return null;
    }
  }

  function save(pos) {
    try {
      globalThis.localStorage?.setItem(OVERLAY_STORAGE_KEY, serializePosition(pos));
    } catch {
      // 隐私模式/配额满：不持久化（fail-open）。
    }
  }

  return function PetOverlay() {
    const [snap, setSnap] = useState(store.getSnapshot);
    const [pos, setPos] = useState(loadSaved); // null = 默认右下角
    const [hovered, setHovered] = useState(false);
    const dragRef = useRef(null); // { startX, startY, moved }

    useEffect(() => store.subscribe(() => setSnap(store.getSnapshot())), [store]);

    // 随机闲置：仅在 idle 且无瞬态时调度下一次小动作。
    const idleNow = snap.semanticState === "idle" && snap.transient === null;
    useEffect(() => {
      if (!idleNow || typeof globalThis.setTimeout !== "function") return undefined;
      const timer = globalThis.setTimeout(() => {
        store.setTransient("fidget", FIDGET_DURATION_MS);
      }, nextFidgetDelay());
      return () => globalThis.clearTimeout(timer);
    }, [idleNow, snap.transient]);

    // 视口 resize：越界位置拉回（一次 clamp，不监听拖拽中的连续变化）。
    useEffect(() => {
      const onResize = () => {
        setPos((current) => {
          if (current == null) return current;
          return clampPosition(current.x, current.y, {
            vw: globalThis.innerWidth,
            vh: globalThis.innerHeight,
            w: PET_SIZE,
            h: PET_SIZE,
          });
        });
      };
      globalThis.addEventListener?.("resize", onResize);
      return () => globalThis.removeEventListener?.("resize", onResize);
    }, []);

    function onPointerDown(e) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e) {
      const drag = dragRef.current;
      if (drag == null) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && !isDragMovement(dx, dy)) return;
      drag.moved = true;
      const clamped = clampPosition(e.clientX - PET_SIZE / 2, e.clientY - PET_SIZE / 2, {
        vw: globalThis.innerWidth,
        vh: globalThis.innerHeight,
        w: PET_SIZE,
        h: PET_SIZE,
      });
      setPos(clamped);
    }

    function onPointerUp(e) {
      const drag = dragRef.current;
      dragRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (drag != null && !drag.moved) {
        // 位移未超阈值 = 点击：瞬态跳跃 + 随机开心文案（经 title/气泡展示）。
        store.setTransient(CLICK_BUBBLES[Math.floor(Math.random() * CLICK_BUBBLES.length)] === "" ? "click" : "click", CLICK_DURATION_MS);
      } else if (drag?.moved) {
        setPos((current) => {
          if (current != null) save(current);
          return current;
        });
      }
    }

    const anim = overlayAnimStyle(snap);
    const bubble = snap.transient === "click"
      ? CLICK_BUBBLES[Math.floor(Math.random() * CLICK_BUBBLES.length)]
      : snap.transient === "fidget"
        ? FIDGET_BUBBLES[Math.floor(Math.random() * FIDGET_BUBBLES.length)]
        : bubbleFor({ stateDef: mappings.states[snap.semanticState], transient: null, hovered });

    return h(
      "div",
      {
        "data-dsh-pet-overlay": snap.petSlug,
        "data-pet-state": snap.semanticState,
        style: {
          position: "fixed",
          left: pos != null ? `${pos.x}px` : undefined,
          top: pos != null ? `${pos.y}px` : undefined,
          right: pos == null ? "24px" : undefined,
          bottom: pos == null ? "24px" : undefined,
          width: `${PET_SIZE}px`,
          height: `${PET_SIZE}px`,
          zIndex: 30,
          pointerEvents: "auto",
          touchAction: "none",
          cursor: "grab",
          userSelect: "none",
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerEnter: () => setHovered(true),
        onPointerLeave: () => setHovered(false),
      },
      h(
        "div",
        {
          className: "dsh-pet-overlay",
          style: {
            width: "100%",
            height: "100%",
            transform: hovered ? "scale(1.08) rotate(-4deg)" : undefined,
            transition: "transform 0.2s ease",
          },
          ...anim,
        },
        h(
          "svg",
          { viewBox: "0 0 300 300", width: "100%", height: "100%", "aria-hidden": true },
          h("path", { d: WHALE_SVG_PATH, fill: "#4D6BFE" }),
        ),
      ),
      h(
        "span",
        {
          style: {
            position: "absolute",
            right: "100%",
            bottom: "60%",
            marginRight: "6px",
            padding: "2px 8px",
            borderRadius: "8px",
            background: "rgba(77, 107, 254, 0.92)",
            color: "#fff",
            fontSize: "13px",
            whiteSpace: "nowrap",
          },
        },
        bubble,
      ),
    );
  };
}

/** 悬浮窗动画 CSS 一次性注入（幂等，index.js 调用）。 */
export function ensureOverlayStyles(document_) {
  if (document_ == null || document_.getElementById("dsh-harness-pets-overlay-anim") != null) return;
  const style = document_.createElement("style");
  style.id = "dsh-harness-pets-overlay-anim";
  style.textContent = buildOverlayAnimationCss();
  document_.head.append(style);
}
```

注意：上面 `onPointerUp` 里 `store.setTransient(CLICK_BUBBLES[...] === "" ? "click" : "click", ...)` 是笔误防护写法，落地时直接写 `store.setTransient("click", CLICK_DURATION_MS)`；随机文案已在 `bubble` 渲染分支处理。

- [ ] **Step 4: 全量改写 src/index.js**

```js
/**
 * index.js — deepseek-harness-pets 的浏览器半边（exports["./client"]）。
 *
 * 形态：右下角常驻悬浮窗（shell.overlay 插槽，root 域跨会话常驻）。
 * 折叠引擎（petNodeDefinition）保留：dsh durable 事件 → pet-store 单一视图状态；
 * buildViewNode 恒 null（不向聊天流输出节点——聊天卡形态已于 v0.2 移除）。
 */

import { createElement, useEffect, useRef, useState } from "react";

import { selectPet } from "./pet-state.js";
import {
  DEFAULT_PET_POOL,
  composePetPool,
  SETTINGS_NAMESPACE,
} from "./pet-pool.js";
import { createPetStore } from "./pet-store.js";
import { createPetOverlay, ensureOverlayStyles } from "./overlay-view.js";
import { buildAnimationCss } from "./renderer.js";
import mappings from "../mappings/harness-states.json" with { type: "json" };

export const name = "deepseek-harness-pets";

/** 本 Definition 消费的 durable 事件（turn 生命周期内的 update 信号）。 */
const DURABLE_UPDATE_TYPES = new Set([
  "turn/end",
  "step/start",
  "step/end",
  "tool/call",
  "tool/result",
  "user/message",
  "assistant/message",
]);

/** 真实契约（SessionEventMap）：turn/step/tool 事件均携带 `turn: number`。 */
function turnIdOf(event) {
  const data = event?.data ?? {};
  return data.turn ?? data.turnId ?? event?.turn ?? null;
}

/**
 * 悬浮窗只显示当前活动 turn；非当前 turn 的事件一律不驱动（旧 turn 迟到
 * update / 被淘汰条目忽略）。registry（turn-contexts.js）已随之删除。
 */
/** 悬浮窗唯一视图状态源。 */
const store = createPetStore();

const petNodeDefinition = {
  kind: "dsh-pet",
  target: "chat",

  match: (event) => {
    if (event?.type === "turn/start") {
      return { id: String(turnIdOf(event) ?? event.seq), role: "start" };
    }
    if (DURABLE_UPDATE_TYPES.has(event?.type)) {
      const id = turnIdOf(event);
      return id == null ? null : { id: String(id), role: "update" };
    }
    return null;
  },

  start: (_context, match) => {
    const id = match.id;
    const petSlug = selectPetSafely(id);
    store.beginTurn(id, petSlug);
    store.onEvent(match.event);
    return { petSlug };
  },

  update: (context, match) => {
    // 非当前 turn 的事件不驱动悬浮窗（重放按 seq 升序，旧 turn 迟到 update 一律忽略）。
    if ((context.key ?? match.id) !== store.currentTurnId) return context.state;
    store.onEvent(match.event);
    return context.state;
  },

  publication: (match) =>
    match.event.type === "turn/start" || match.event.type === "turn/end"
      ? "immediate"
      : "animation-frame",

  buildLocationData: () => null,

  // 悬浮窗形态不产出聊天流节点：恒 null（折叠引擎仅作事件管道）。
  buildViewNode: () => null,
};

/** 生效偏好与池：由设置快照维护（宿主已解析 schema 默认→base→用户文档三层）。 */
const moduleConfig = {
  pet: undefined,
  pool: [...DEFAULT_PET_POOL],
};

/**
 * 从设置快照刷新生效偏好与池（fail-open：池外值降级默认并 console.error）。
 */
function refreshPreference(scope) {
  const value = scope?.getSnapshot?.()?.value;
  const pet = typeof value?.pet === "string" && value.pet !== "" ? value.pet : undefined;
  const pets = Array.isArray(value?.pets) ? value.pets : [];
  const pool = composePetPool(pets, DEFAULT_PET_POOL);
  if (pet !== undefined && pet !== "random" && !pool.includes(pet)) {
    console.error(
      `[deepseek-harness-pets] settings pet "${pet}" not in pool [${pool.join(", ")}]; falling back to default`,
    );
    moduleConfig.pet = undefined;
  } else {
    moduleConfig.pet = pet;
  }
  moduleConfig.pool = pool;
}

/** 渲染路径的安全选皮：偏好已验证，异常降级 pool[0]。 */
function selectPetSafely(seed) {
  try {
    return selectPet(moduleConfig.pet, moduleConfig.pool, seed);
  } catch {
    return moduleConfig.pool[0] ?? DEFAULT_PET_POOL[0];
  }
}

/** 幂等标记（模块级；浏览器模块表每个 bundle 实例化一次）。 */
const applyState = { applied: false };

// remote/connection 是 settingsScope 失效订阅的载体（evidence.md #27）。
export const inject = ["conversationEvents", "slots", "connection", "remote", "settingsScope"];

/**
 * 浏览器插件体。
 * @param {import("@deepseek-ai/dsh-client-runtime/client").ClientContext} ctx
 */
export function apply(ctx) {
  if (applyState.applied) return;
  applyState.applied = true;

  // 悬浮窗动画样式注入（spritesheet 帧动画样式一并保留，见 renderer.js）。
  ensureOverlayStyles(typeof document === "undefined" ? undefined : document);
  const idleStyle = document?.getElementById("dsh-harness-pets-anim");
  if (idleStyle == null && typeof document !== "undefined") {
    const style = document.createElement("style");
    style.id = "dsh-harness-pets-anim";
    style.textContent = buildAnimationCss();
    document.head.append(style);
  }

  try {
    const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
    refreshPreference(scope);
    scope.subscribe(() => refreshPreference(scope));
  } catch (error) {
    console.warn("[deepseek-harness-pets] settings scope unavailable:", error);
  }

  ctx.conversationEvents.register(petNodeDefinition);

  // 右下角常驻悬浮窗：shell.overlay 为 root 域全框架浮动层（list 插槽，
  // badge/toast 同层），组件自管 fixed 定位与 pointer-events。
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      { name: "shell.overlay", id: "dsh-pet" },
      createPetOverlay(store, mappings, { createElement, useRef, useState, useEffect }),
    ),
  );
}
```

- [ ] **Step 5: 全量测试 + 构建**

Run: `npm test && npm run build`
Expected: 全部测试 PASS（含删除 petCardView 测试后的 renderer.test.js）；esbuild 产出 `lib/client.js` 无报错

- [ ] **Step 6: Commit**

```bash
git add src/overlay-view.js src/index.js src/renderer.js test/renderer.test.js
git commit -m "feat(overlay)!: render pet as bottom-right floating overlay via shell.overlay"
```

（`!` 标注 breaking：移除聊天流卡片形态。）

---

### Task 5: 文档更新 + 实机目验

**Files:**
- Modify: `README.md`
- Modify: `docs/architecture/evidence.md`
- Modify: `docs/superpowers/specs/2026-08-15-floating-pet-design.md`（状态行 → 已实施）

**Interfaces:**
- Consumes: Task 1-4 全部产物（无新代码接口）
- Produces: 无（文档与验证结论）

- [ ] **Step 1: 更新 README.md**

- 首段与"核心特性"：宠物出现在 **Web UI 右下角常驻悬浮窗**（不再是会话流卡片）；补充拟真互动四项（点击/悬停/随机闲置/拖拽+位置持久化）。
- "宠物状态映射"表：视觉列改为悬浮窗动画描述（idle 浮动 / inferring 摇摆游动 / sota 跃起 / error 翻肚灰度等，对应 `OVERLAY_ANIMATIONS`）。
- "安装"验收段：`/plugins/deepseek-harness-pets/client.js` 200 不变；新增"打开任意会话应看到右下角鲸鱼悬浮窗"。
- "故障排查"：删除"设置面板没有宠物项"之前的聊天卡描述中涉及"聊天流卡片"的句子，改为悬浮窗描述；新增条目——**悬浮窗不出现**：确认 dsh ≥ 0.1.0-rc.5（shell.overlay 插槽存在）、重启 DSH Web、查 console；**位置丢失**：localStorage 被清即回默认右下角（预期行为）。
- Roadmap：勾选"常驻浮层形态（非聊天流卡的其他 slots 注入点）"；"会话内目验"条目改写为悬浮窗目验（本任务 Step 3 完成后勾选）。

- [ ] **Step 2: 更新 docs/architecture/evidence.md**

- 新增条目 #29：`shell.overlay` 插槽实测（list/root，AppFrame overlayLayer，pointer-events 自管，z-index 20 上层组件 30）——来源：本机源码对照 + 实机目验。
- 修订条目：原 #21/#55 中"聊天流卡片"相关表述标注"v0.2 起由悬浮窗形态取代（见 #29）"。

- [ ] **Step 3: 实机目验（需要重启 DSH Web，bundle 不热加载）**

目验步骤（执行者跑，需用户配合重启或经确认后执行）：

1. 重启服务：`kill <dsh web PID>` 后由用户运行 `dsh web`（或征得同意后代跑 `node ~/.dsh/profiles/node_modules/@deepseek-ai/dsh/lib/bin.js web`）。
2. 浏览器打开 `http://localhost:3080`，确认**未发消息**时右下角已有鲸鱼悬浮窗（idle 浮动 + zzZ 气泡）。
3. 悬停：宠物放大微倾，气泡变"嗯？"。
4. 点击：瞬态跃起 + 开心文案，~1.5s 回落。
5. 拖拽到屏幕左上角 → 刷新页面 → 位置保持（localStorage 持久化）。
6. 发一条消息触发 turn：状态依次 loading → inferring（摇摆）→ done（挥动，4s 后回 idle）。
7. Console 无 `[deepseek-harness-pets]` 报错；聊天流中**无**宠物卡片。
8. 等 20–60s 观察一次随机闲置小动作（idle 时）。

任一步失败：回到对应 Task 修复（systematic-debugging 流程），不绕过。

- [ ] **Step 4: 全量测试最终确认**

Run: `npm test`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add README.md docs/architecture/evidence.md docs/superpowers/specs/2026-08-15-floating-pet-design.md
git commit -m "docs: floating overlay form, shell.overlay evidence and roadmap update"
```

---

## Self-Review 记录

- **Spec 覆盖**：§1 架构（Task 1/2/3/4）、§2 视觉与互动四项（Task 1 动画表 + Task 4 组件）、§3 清理/错误处理/测试（Task 4 Step 1 删 petCardView、各 Task fail-open 测试、Task 5 目验）——全覆盖。瞬态优先级由 `overlayAnimStyle`（瞬态>语义）与 `bubbleFor`（悬停>瞬态>语义）实现，与 spec §2 一致。
- **占位符**：无 TBD/TODO；Task 4 Step 3 含一处笔误防护说明并给出落地写法。
- **类型一致性**：`createPetOverlay(store, mappings, { createElement, useRef, useState, useEffect })` 在 Task 4 定义并同任务消费；`store.setTransient("click"|"fidget", ms)` 与 Task 2 `TRANSIENTS` 集合一致；`clampPosition` 返回 `{x, y}` 与 `parseSavedPosition`/`serializePosition` 互逆测试锁定。
- **已知偏差**：Task 4 组件不单测（Global Constraints 第 2 条，薄壳原则）；README 更新为指令式而非逐字 diff（文档无接口锁定需求）。
