import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createPetState,
  selectPet,
  resolvePetPreference,
  SEMANTIC_STATES,
} from "../src/pet-state.js";

const ev = (type, data = {}, seq = 0) => ({ type, data, seq });

test("初始状态为 idle", () => {
  const pet = createPetState();
  assert.equal(pet.state, "idle");
});

test("turn/start 进入 loading（数据准备窗口）", () => {
  const pet = createPetState();
  const { state, changed } = pet.onEvent(ev("turn/start"));
  assert.equal(state, "loading");
  assert.equal(changed, true);
});

test("turn/start 到首个 step/start 之间保持 loading", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  const { state } = pet.onEvent(ev("user/message", { text: "跑 Terminal-Bench" }));
  assert.equal(state, "loading");
});

test("step/start 进入 inferring（模型请求开始）", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  const { state } = pet.onEvent(ev("step/start"));
  assert.equal(state, "inferring");
});

test("普通 tool/call 落到 inferring（官方基准 running，保守映射）", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("step/start"));
  pet.onEvent(ev("tool/call", { tool: "bash" }));
  assert.equal(pet.state, "inferring");
});

test("报告/评分类工具名进入 scoring", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("step/start"));
  const { state } = pet.onEvent(ev("tool/call", { tool: "write_score_report" }));
  assert.equal(state, "scoring");
});

test("scoring 后普通工具回落 inferring", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("step/start"));
  pet.onEvent(ev("tool/call", { tool: "eval_summary" }));
  pet.onEvent(ev("tool/call", { tool: "bash" }));
  assert.equal(pet.state, "inferring");
});

test("scoring 正则不误报单词内子串（retrieval 含 eval、upgrade 含 grade）", () => {
  for (const tool of ["retrieval_search", "web_search", "upgrade_tool", "retrieval"] ) {
    const pet = createPetState();
    pet.onEvent(ev("turn/start"));
    pet.onEvent(ev("step/start"));
    pet.onEvent(ev("tool/call", { tool }));
    assert.equal(pet.state, "inferring", tool);
  }
});

test("snake_case 评分类工具名仍命中 scoring（下划线不算词内字符）", () => {
  for (const tool of [
    "write_score_report",
    "eval_summary",
    "evaluate_metrics",
    "grade_run",
    "final_report",
  ]) {
    const pet = createPetState();
    pet.onEvent(ev("turn/start"));
    pet.onEvent(ev("step/start"));
    pet.onEvent(ev("tool/call", { tool }));
    assert.equal(pet.state, "scoring", tool);
  }
});

test("turn/end 正常结束进入 done", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("step/start"));
  const { state } = pet.onEvent(ev("turn/end", { status: "completed" }));
  assert.equal(state, "done");
});

test("turn/end 带失败信号进入 error（真实契约 reason.kind 失败族）", () => {
  for (const kind of ["error", "max-tokens", "blocked", "interrupted"]) {
    const pet = createPetState();
    pet.onEvent(ev("turn/start"));
    const { state } = pet.onEvent(ev("turn/end", { turn: 1, reason: { kind } }));
    assert.equal(state, "error", kind);
  }
});

test("turn/end 用户取消（aborted）安静收场为 done，不误报 ERROR", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  const { state } = pet.onEvent(ev("turn/end", { turn: 1, reason: { kind: "aborted" } }));
  assert.equal(state, "done");
});

test("turn/end 旧字段（status/error/outcome）防御性兑底仍生效（stopped≡用户取消→done）", () => {
  for (const data of [
    { status: "failed" },
    { error: { message: "boom" } },
  ]) {
    const pet = createPetState();
    pet.onEvent(ev("turn/start"));
    const { state } = pet.onEvent(ev("turn/end", data));
    assert.equal(state, "error", JSON.stringify(data));
  }
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  assert.equal(pet.onEvent(ev("turn/end", { outcome: "stopped" })).state, "done");
});

test("真实事件形态：tool/result 的 SOTA 文本在 data.message.content 消息块里", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(
    ev("tool/result", {
      turn: 1,
      step: 1,
      message: { role: "tool", content: [{ type: "text", text: "accuracy 0.902 SOTA on Terminal-Bench" }] },
    }),
  );
  pet.onEvent(ev("turn/end", { turn: 1, reason: { kind: "completed" } }));
  assert.equal(pet.state, "sota");
});

test("真实事件形态：assistant/message 的文本在 data.message 里（usage 等字段共存）", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(
    ev("assistant/message", {
      turn: 1,
      step: 1,
      message: { role: "assistant", content: [{ type: "text", text: "new record high accuracy" }] },
      usage: { input: 10, output: 5 },
    }),
  );
  pet.onEvent(ev("turn/end", { turn: 1, reason: { kind: "completed" } }));
  assert.equal(pet.state, "sota");
});

test("turn/end 前出现过 SOTA 文本特征则进入 sota（v0.1 近似）", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("step/start"));
  pet.onEvent(ev("tool/result", { tool: "write_score_report", text: "accuracy 0.891 new record high" }));
  const { state } = pet.onEvent(ev("turn/end", { turn: 1, reason: { kind: "completed" } }));
  assert.equal(state, "sota");
});

test("SOTA 检测支持结构化 content（消息块数组/嵌套对象，不再退化成 [object Object]）", () => {
  const blockArray = createPetState();
  blockArray.onEvent(ev("turn/start"));
  blockArray.onEvent(
    ev("assistant/message", { content: [{ type: "text", text: "accuracy 0.902 new record high" }] }),
  );
  blockArray.onEvent(ev("turn/end", { status: "completed" }));
  assert.equal(blockArray.state, "sota");

  const nested = createPetState();
  nested.onEvent(ev("turn/start"));
  nested.onEvent(ev("tool/result", { content: { text: "SOTA on Terminal-Bench" } }));
  nested.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  assert.equal(nested.state, "sota");
});

test("textOf 深度受限：自引用结构不爆栈、不误判 SOTA", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  const cyclic = {};
  cyclic.self = cyclic;
  pet.onEvent(ev("tool/result", { content: cyclic }));
  pet.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  assert.equal(pet.state, "done");
});

test("sota 判定在每个 turn 结束后重置，不泄漏到下一轮", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("tool/result", { text: "SOTA!" }));
  pet.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  pet.onEvent(ev("turn/start"));
  const { state } = pet.onEvent(ev("turn/end", { reason: { kind: "completed" } }));
  assert.equal(state, "done");
});

test("done/error 后回不到 idle：无新 turn 时状态保持终态", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("turn/end", { status: "completed" }));
  pet.onEvent(ev("tool/call", { tool: "bash" }));
  assert.equal(pet.state, "done");
});

test("未知事件类型不改变状态（fail-open，向前兼容 preview 变更）", () => {
  const pet = createPetState();
  pet.onEvent(ev("turn/start"));
  pet.onEvent(ev("compaction/some-future-event"));
  assert.equal(pet.state, "loading");
});

test("事件按 seq 升序重放与实时追加得到相同终态（可重放性）", () => {
  const events = [
    ev("turn/start", {}, 1),
    ev("step/start", {}, 2),
    ev("tool/call", { tool: "bash" }, 3),
    ev("tool/call", { tool: "score_report" }, 4),
    ev("tool/result", { text: "SOTA new high" }, 5),
    ev("turn/end", { status: "completed" }, 6),
  ];
  const live = createPetState();
  for (const e of events) live.onEvent(e);
  const replay = createPetState();
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) replay.onEvent(e);
  assert.equal(live.state, replay.state);
  assert.equal(live.state, "sota");
});

test("SEMANTIC_STATES 覆盖全部七个语义状态", () => {
  assert.deepEqual([...SEMANTIC_STATES].sort(), [
    "done",
    "error",
    "idle",
    "inferring",
    "loading",
    "scoring",
    "sota",
  ]);
});

test("stateEnteredAt 随状态变更刷新（时钟注入，驱动动画帧），未变更不动", () => {
  let t = 1000;
  const pet = createPetState({ now: () => t });
  assert.equal(pet.stateEnteredAt, 1000);

  t = 2000;
  pet.onEvent(ev("turn/start")); // idle → loading
  assert.equal(pet.stateEnteredAt, 2000);

  t = 3000;
  pet.onEvent(ev("user/message", { text: "hi" })); // 状态不变
  assert.equal(pet.stateEnteredAt, 2000);

  t = 4000;
  pet.onEvent(ev("step/start")); // loading → inferring
  assert.equal(pet.stateEnteredAt, 4000);

  t = 5000;
  pet.onEvent(ev("tool/call", { tool: "bash" })); // inferring → inferring（scoring 之外保守回落）
  assert.equal(pet.state, "inferring");
  assert.equal(pet.stateEnteredAt, 4000);
});

test("selectPet 指定皮肤名直接返回", () => {
  const pool = ["deepseek-whale", "deepseek-octo"];
  assert.equal(selectPet("deepseek-whale", pool, "seed"), "deepseek-whale");
  assert.equal(selectPet("deepseek-octo", pool, "seed"), "deepseek-octo");
});

test("selectPet random 由会话 seed 确定性选择（重放一致）", () => {
  const pool = ["deepseek-whale", "deepseek-octo"];
  const a = selectPet("random", pool, "session-42");
  const b = selectPet("random", pool, "session-42");
  const c = selectPet("random", pool, "session-43");
  assert.equal(a, b);
  assert.ok(pool.includes(a));
  assert.ok(pool.includes(c));
});

test("selectPet 未配置时默认大鲸鱼 deepseek-whale（标志性出场皮肤）", () => {
  const pool = ["deepseek-whale", "deepseek-octo"];
  assert.equal(selectPet(undefined, pool, "s"), "deepseek-whale");
  assert.equal(selectPet("", pool, "s"), "deepseek-whale");
});

test("selectPet 对未知皮肤名与空池抛错（misconfiguration fails loud）", () => {
  assert.throws(() => selectPet("no-such-pet", ["deepseek-whale"], "s"));
  assert.throws(() => selectPet("random", [], "s"));
});

test("resolvePetPreference：设置面板值优先于 cordis.yml 配置", () => {
  assert.equal(
    resolvePetPreference("deepseek-octo", "deepseek-whale"),
    "deepseek-octo",
  );
});

test("resolvePetPreference：设置未覆盖时回落 cordis.yml 配置", () => {
  assert.equal(resolvePetPreference(undefined, "deepseek-whale"), "deepseek-whale");
});

test("resolvePetPreference：两者皆未配置时返回 undefined（交给 selectPet 默认大鲸鱼）", () => {
  assert.equal(resolvePetPreference(undefined, undefined), undefined);
});

test("resolvePetPreference：空串/null 视为未设置（设置 UI 清空即回继承）", () => {
  assert.equal(resolvePetPreference("", "deepseek-octo"), "deepseek-octo");
  assert.equal(resolvePetPreference(null, "deepseek-octo"), "deepseek-octo");
  assert.equal(resolvePetPreference("", undefined), undefined);
});

test("resolvePetPreference 的结果仍受 selectPet 池校验约束（fail loud）", () => {
  const pool = ["deepseek-whale", "deepseek-octo"];
  const pref = resolvePetPreference("no-such-pet", undefined);
  assert.throws(() => selectPet(pref, pool, "s"));
});
