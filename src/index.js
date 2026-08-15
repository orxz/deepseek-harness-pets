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
 * 悬浮窗唯一视图状态源。只显示当前活动 turn：非当前 turn 的事件一律不驱动
 * （旧 turn 迟到 update 忽略）。registry（turn-contexts.js）已随之删除。
 */
const store = createPetStore();

const petNodeDefinition = {
  kind: "dsh-pet",
  target: "chat",

  /**
   * 身份提取（identity extractor，非 fold）：turn/start 唯一开启一个 turn，
   * 其余 durable 事件按同一 turn id 归并为 update；无法定位 turn id 的事件忽略
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

  // 右下角常驻悬浮窗：shell.overlay 为 root 域全框架浮动层（list 插槽，
  // badge/toast 同层），组件自管 fixed 定位与 pointer-events。
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      { name: "shell.overlay", id: "dsh-pet" },
      createPetOverlay(store, mappings, { createElement, useRef, useState, useEffect }),
    ),
  );
}
