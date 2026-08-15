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
