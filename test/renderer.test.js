import { test } from "node:test";
import assert from "node:assert/strict";

import {
  frameStyle,
  frameAtTime,
  petCardView,
  buildAnimationCss,
  STANDARD_FRAME,
} from "../src/renderer.js";

/** 极简 createElement 替身：返回 { type, props, children }。 */
const h = (type, props, ...children) => ({ type, props: props ?? {}, children });

const stateDef = { row: "waiting", bubble: { zh: "加载数据中…", en: "Loading..." } };

test("frameStyle：按行列偏移计算 background-position（Petdex 规格）", () => {
  const style = frameStyle({ row: 6, frameIndex: 3 });
  assert.equal(style.width, "192px");
  assert.equal(style.height, "208px");
  assert.equal(style.backgroundSize, "1536px 1872px");
  assert.equal(style.backgroundPosition, "-576px -1248px");
});

test("frameStyle：frameIndex 超界自动按列数取模（循环播放）", () => {
  const a = frameStyle({ row: 0, frameIndex: 8 });
  const b = frameStyle({ row: 0, frameIndex: 0 });
  assert.equal(a.backgroundPosition, b.backgroundPosition);
});

test("STANDARD_FRAME 与 Petdex v1 规格一致", () => {
  assert.deepEqual({ ...STANDARD_FRAME }, { width: 192, height: 208, columns: 8, rows: 9 });
});

test("frameAtTime：按流逝毫秒与 fps 计算帧号，并按列数回绕", () => {
  assert.equal(frameAtTime(0, { fps: 8 }), 0);
  assert.equal(frameAtTime(124, { fps: 8 }), 0);
  assert.equal(frameAtTime(125, { fps: 8 }), 1);
  assert.equal(frameAtTime(875, { fps: 8 }), 7);
  assert.equal(frameAtTime(1000, { fps: 8 }), 0); // 8 帧 → 回绕到 0
  assert.equal(frameAtTime(250, { fps: 4 }), 1);
});

test("frameAtTime：非正/非法输入归 0（fail-open，渲染路径永不抛错）", () => {
  assert.equal(frameAtTime(-5, { fps: 8 }), 0);
  assert.equal(frameAtTime(NaN, { fps: 8 }), 0);
  assert.equal(frameAtTime(Infinity, { fps: 8 }), 0);
  assert.equal(frameAtTime(1000, { fps: 0 }), 0);
  assert.equal(frameAtTime(1000, { fps: -3 }), 0);
});

test("frameAtTime：缺省 fps=6", () => {
  assert.equal(frameAtTime(1000), 6); // floor(1000 / 166.67) = 6
});

test("petCardView：有 spritesheetUrl 时渲染像素精灵节点（CSS 动画驱动帧）", () => {
  const node = petCardView(h, {
    petSlug: "deepseek-whale",
    semanticState: "loading",
    stateDef,
    frameIndex: 2,
    spritesheetUrl: "assets/pets/deepseek-whale/spritesheet.webp",
  });
  assert.equal(node.props["data-dsh-pet"], "deepseek-whale");
  assert.equal(node.props["data-pet-state"], "loading");
  const sprite = node.children[0];
  assert.equal(sprite.props["data-pet-art"], "sprite");
  assert.equal(sprite.props.className, "dsh-pet-sprite");
  assert.match(sprite.props.style.backgroundImage, /deepseek-whale\/spritesheet\.webp/);
  assert.equal(sprite.props.style.animationName, "dsh-pet-row-6"); // waiting 行
  assert.equal(sprite.props.style.animationTimingFunction, "steps(8)");
});

test("petCardView：不同状态的 fps 映射为不同动画时长（jumping 快于 idle）", () => {
  const durOf = (row, fps) =>
    petCardView(h, {
      petSlug: "deepseek-whale",
      semanticState: "x",
      stateDef: { row, fps },
      frameIndex: 0,
      spritesheetUrl: "assets/pets/x.webp",
    }).children[0].props.style.animationDuration;
  assert.equal(durOf("idle", 4), "2s"); // 8 列 / 4fps
  assert.equal(durOf("jumping", 10), "0.8s"); // 8 列 / 10fps
});

test("buildAnimationCss：生成全 9 行的 steps 关键帧与基类样式", () => {
  const css = buildAnimationCss();
  for (let row = 0; row < 9; row += 1) {
    assert.ok(css.includes(`@keyframes dsh-pet-row-${row} {`), `row ${row}`);
  }
  assert.match(css, /background-position: -1536px -1664px/); // 第 8 行（review）终点
  assert.ok(css.includes(".dsh-pet-sprite {"));
  assert.ok(css.includes("image-rendering: pixelated"));
});

test("petCardView：spritesheet URL percent-encode 并加引号包裹（防空格破图/CSS 注入）", () => {
  const node = petCardView(h, {
    petSlug: "weird pet",
    semanticState: "loading",
    stateDef,
    frameIndex: 0,
    spritesheetUrl: 'assets/pets/weird pet/x".png',
  });
  const url = node.children[0].props.style.backgroundImage;
  assert.ok(url.startsWith('url("') && url.endsWith('")'), url);
  const inner = url.slice(5, -2);
  assert.ok(inner.includes("weird%20pet"), url); // 空格已编码
  assert.ok(!inner.includes('"') && !inner.includes("\\"), url); // 内层引号/反斜杠已消除
});

test("petCardView：外部源皮肤（无 URL）渲染占位块并标注 slug，不硬编码 bundled 路径", () => {
  const node = petCardView(h, {
    petSlug: "community-cat",
    semanticState: "idle",
    stateDef: { row: "idle", bubble: { zh: "zzZ", en: "zzZ" } },
    frameIndex: 0,
    spritesheetUrl: null,
  });
  const sprite = node.children[0];
  assert.equal(sprite.props["data-pet-art"], "placeholder");
  assert.ok(String(sprite.children).includes("community-cat"));
  assert.equal(sprite.props.style.backgroundImage, undefined);
});
