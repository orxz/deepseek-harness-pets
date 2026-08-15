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
