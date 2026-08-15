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
