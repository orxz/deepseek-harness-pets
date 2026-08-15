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

/** turn 进行中的语义状态（与 pet-state 的 ACTIVE_STATES 对齐）：
 *  busy 仅在 loading/inferring/scoring 为 true——idle 与终态都不算忙碌
 *  （悬浮窗在待机/收场时不得显示忙碌态，测试规格锁定）。 */
const ACTIVE_STATES = new Set(["loading", "inferring", "scoring"]);

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
    // 每次返回全新对象（防御性拷贝）：外部篡改返回值不影响内部状态。
    return {
      petSlug,
      semanticState: pet.state,
      transient,
      busy: ACTIVE_STATES.has(pet.state),
    };
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
