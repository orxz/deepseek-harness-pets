import { test } from "node:test";
import assert from "node:assert/strict";

import { createTurnContextRegistry } from "../src/turn-contexts.js";

const isTerminal = (entry) => entry.terminal === true;

test("set/get/has 基本操作，get 未命中返回 null", () => {
  const r = createTurnContextRegistry({ isTerminal });
  r.set("a", { terminal: false });
  assert.ok(r.has("a"));
  assert.deepEqual(r.get("a"), { terminal: false });
  assert.equal(r.get("nobody"), null);
  assert.equal(r.size, 1);
});

test("超容量按最旧优先淘汰终态条目，活动条目保留", () => {
  const r = createTurnContextRegistry({ limit: 3, isTerminal });
  r.set("a", { terminal: true });
  r.set("b", { terminal: false });
  r.set("c", { terminal: true });
  r.set("d", { terminal: true }); // 超限 → 淘汰最旧终态 a
  assert.equal(r.has("a"), false);
  assert.ok(r.has("b") && r.has("c") && r.has("d"));
  assert.equal(r.size, 3);
});

test("对已有 key 的 set 保留原插入位置（淘汰顺序稳定 FIFO）", () => {
  const r = createTurnContextRegistry({ limit: 2, isTerminal });
  r.set("a", { terminal: true });
  r.set("b", { terminal: true });
  r.set("a", { terminal: true }); // 刷新 a 的值，不改变其"最旧"地位
  r.set("c", { terminal: true }); // 超限 → 仍淘汰 a
  assert.equal(r.has("a"), false);
  assert.ok(r.has("b") && r.has("c"));
});

test("全部为活动条目时宁超容量也不淘汰（不打断进行中的 turn）", () => {
  const r = createTurnContextRegistry({ limit: 2, isTerminal });
  r.set("a", { terminal: false });
  r.set("b", { terminal: false });
  r.set("c", { terminal: false });
  assert.equal(r.size, 3);
  assert.ok(r.has("a") && r.has("b") && r.has("c"));
});

test("终态条目随后也可被新 set 触发的淘汰清理（泄漏有界）", () => {
  const r = createTurnContextRegistry({ limit: 2, isTerminal });
  for (const id of ["t1", "t2", "t3", "t4", "t5"]) {
    r.set(id, { terminal: true });
  }
  assert.equal(r.size, 2);
  assert.ok(r.has("t4") && r.has("t5"));
});

test("默认 isTerminal 恒为 false（不淘汰），默认 limit=64", () => {
  const r = createTurnContextRegistry();
  for (let i = 0; i < 80; i += 1) r.set(`t${i}`, { anything: true });
  assert.equal(r.size, 80);
});
