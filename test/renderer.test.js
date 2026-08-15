import { test } from "node:test";
import assert from "node:assert/strict";

import {
  frameStyle,
  frameAtTime,
  buildAnimationCss,
  STANDARD_FRAME,
} from "../src/renderer.js";

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

test("buildAnimationCss：生成全 9 行的 steps 关键帧与基类样式", () => {
  const css = buildAnimationCss();
  for (let row = 0; row < 9; row += 1) {
    assert.ok(css.includes(`@keyframes dsh-pet-row-${row} {`), `row ${row}`);
  }
  assert.match(css, /background-position: -1536px -1664px/); // 第 8 行（review）终点
  assert.ok(css.includes(".dsh-pet-sprite {"));
  assert.ok(css.includes("image-rendering: pixelated"));
});
