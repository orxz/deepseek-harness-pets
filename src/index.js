/**
 * index.js — deepseek-harness-pets 的浏览器半边（exports["./client"]）。
 *
 * 已对照 dsh 源码验证的契约（docs/architecture/evidence.md #3/#12/#18，high）：
 * - 浏览器插件经 package.json 的 `dsh.client` 声明被发现，加载预构建的
 *   lib/client.js（CJS 工厂：window.__ModuleLoader__.load({id, factory})）；
 * - `apply(ctx)` 只收 ctx（WebBootEntry 不携带行 config，cordis.yml 级配置
 *   由 Host 半边经设置 base 层生效）；
 * - 用户偏好经 `ctx.settingsScope.bind({namespace})` 读取快照
 *   （status/value/base/user/revision），subscribe 监听变化；
 * - ConversationNodeDefinition：match 是身份提取器（非 fold），归并键用
 *   durable 事件自带的 `turn: number`；引擎契约禁止把 update 归并到
 * "最近的未完成 Context"，孤儿事件（无 turn id）一律忽略；
 * - 帧动画用纯 CSS steps()（buildAnimationCss），不依赖引擎 publication
 *   节拍重调 buildViewNode。
 */

import { createElement } from "react";

import { createPetState, selectPet } from "./pet-state.js";
import {
  DEFAULT_PET_POOL,
  BUNDLED_ARTWORK,
  composePetPool,
  SETTINGS_NAMESPACE,
} from "./pet-pool.js";
import { createTurnContextRegistry } from "./turn-contexts.js";
import { buildAnimationCss, petCardView } from "./renderer.js";
import mappings from "../mappings/harness-states.json" with { type: "json" };

export const name = "deepseek-harness-pets";

const TERMINAL_STATES = new Set(["done", "sota", "error"]);

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
 * 每个上下文（一个 turn）一份可重放状态：pet-state 实例 + 该上下文锁定的皮肤
 * （random 在 start 时按 id 选定，重放一致）。有界容量：超限后按最旧优先淘汰
 * 终态上下文（活动上下文绝不淘汰）——长会话内存有界（evidence.md #21）。
 */
const contexts = createTurnContextRegistry({
  isTerminal: (entry) => TERMINAL_STATES.has(entry.pet.state),
});

function snapshot(pet, petSlug) {
  return {
    petSlug,
    semanticState: pet.state,
    busy: !TERMINAL_STATES.has(pet.state),
  };
}

const petNodeDefinition = {
  kind: "dsh-pet",
  target: "chat",

  /**
   * 身份提取（identity extractor，非 fold）：turn/start 唯一开启一个宠物卡，
   * 其余 durable 事件按同一 turn id 归并为 update；无法定位 turn id的事件忽略
   * （引擎契约：绝不可归并到"最近的未完成 Context"）。
   */
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
    const pet = createPetState();
    pet.onEvent(match.event);
    const entry = { pet, petSlug: selectPetSafely(id) };
    contexts.set(id, entry);
    return snapshot(pet, entry.petSlug);
  },

  update: (context, match) => {
    const id = context.key ?? match.id;
    // 被淘汰的极旧 turn 收到迟到 update：按剩余事件重建（fail-open，不抛错）。
    const entry = contexts.get(id) ?? {
      pet: createPetState(),
      petSlug: selectPetSafely(id),
    };
    entry.pet.onEvent(match.event);
    contexts.set(id, entry);
    return snapshot(entry.pet, entry.petSlug);
  },

  publication: (match) =>
    match.event.type === "turn/start" || match.event.type === "turn/end"
      ? "immediate"
      : "animation-frame",

  buildLocationData: () => null,

  buildViewNode: (context) => {
    if (context.state === undefined) return null;
    // 初始帧取 0：帧推进由 CSS steps() 动画完成（见 buildAnimationCss）。
    return {
      key: context.key,
      kind: "dsh-pet",
      id: context.id,
      target: "chat",
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" },
      visibility: "visible",
      data: { ...context.state, frameIndex: 0 },
    };
  },
};

/** 生效偏好与池：由设置快照维护（宿主已解析 schema 默认→base→用户文档三层）。 */
const moduleConfig = {
  pet: undefined, // 生效偏好；undefined 即默认大鲸鱼（selectPet 兜底 DEFAULT_PET）
  pool: [...DEFAULT_PET_POOL], // 生效池（永远包含 bundled，非空）
};

/**
 * 只登记 BUNDLED_ARTWORK 的皮肤才有随包分发的 spritesheet（test/mappings.test.js
 * 强制登记项与 assets/pets 实际文件一致）；未登记（含外部源）返回 null → 占位块，
 * 杜绝指向不存在文件的 404 破图。
 */
function spritesheetUrlOf(petSlug) {
  const artwork = BUNDLED_ARTWORK[petSlug];
  return artwork == null ? null : `assets/pets/${petSlug}/${artwork}`;
}

/**
 * 从设置快照刷新生效偏好与池。
 * 浏览器侧永不抛错（抛错会杀死插件）：快照中的 pet 已过 Host schema 的
 * 枚举校验；若因池漂移出现池外值，降级回默认并 console.error（fail-open）。
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

/** 渲染路径的安全选皮：偏好已验证，异常（池被动过等极端场景）降级 pool[0]。 */
function selectPetSafely(seed) {
  try {
    return selectPet(moduleConfig.pet, moduleConfig.pool, seed);
  } catch {
    return moduleConfig.pool[0] ?? DEFAULT_PET_POOL[0];
  }
}

/** 注入帧动画样式（幂等：同 id 的 <style> 只插一次）。 */
function ensureAnimationStyles() {
  if (typeof document === "undefined") return;
  const styleId = "dsh-harness-pets-anim";
  if (document.getElementById(styleId) != null) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = buildAnimationCss();
  document.head.append(style);
}

/** 幂等标记（模块级；浏览器模块表每个 bundle 实例化一次）。 */
const applyState = { applied: false };

// remote/connection 是 settingsScope 失效订阅的载体：settings-scope.ts 把
// settings/updated 转发订阅注册在调用方 ctx 上（ui-theme/ui-conversation 同型），
// 缺 remote 注入时初始快照可读但偏好变更不推送（evidence.md #27）。
export const inject = ["conversationEvents", "slots", "connection", "remote", "settingsScope"];

/**
 * 浏览器插件体。
 * @param {import("@deepseek-ai/dsh-client-runtime/client").ClientContext} ctx
 */
export function apply(ctx) {
  if (applyState.applied) return;
  applyState.applied = true;

  ensureAnimationStyles();

  // 用户偏好：settingsScope 绑定命名空间，快照读值 + 订阅变化（下一个 turn 生效，
  // turn 中途不换皮，保证重放确定性）。
  try {
    const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
    refreshPreference(scope);
    scope.subscribe(() => refreshPreference(scope));
  } catch (error) {
    // 设置面不可用（如 memory 模式未就绪）：保持默认偏好（fail-open，不阻断渲染）。
    console.warn("[deepseek-harness-pets] settings scope unavailable:", error);
  }

  ctx.conversationEvents.register(petNodeDefinition);
  ctx.slots.inject("conversation.chat.node", () =>
    ctx.slots.register(
      { name: "conversation.chat.node", key: "dsh-pet" },
      ({ node }) =>
        petCardView(createElement, {
          petSlug: node.data.petSlug,
          semanticState: node.data.semanticState,
          stateDef: mappings.states[node.data.semanticState],
          frameIndex: node.data.frameIndex,
          busy: node.data.busy,
          spritesheetUrl: spritesheetUrlOf(node.data.petSlug),
        }),
    ),
  );
}
