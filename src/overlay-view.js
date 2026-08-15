/**
 * overlay-view.js — 悬浮窗组件与可单测纯逻辑（位置/拖拽/闲置调度）。
 * 组件依赖的 React 经参数注入（项目 node_modules 无 react，测试图中不得 import）。
 */

/** 点击与拖拽的位移分界（px，欧氏距离）。 */
export const DRAG_THRESHOLD_PX = 5;

/** 悬浮窗与视口边缘的最小留白（px）。 */
export const OVERLAY_MARGIN_PX = 8;

/** 位置持久化的 localStorage 键。 */
export const OVERLAY_STORAGE_KEY = "dsh-pets-overlay-pos";

/**
 * @param {number} dx - pointerdown 到当前的水平位移。
 * @param {number} dy - 垂直位移。
 * @param {number} [threshold=DRAG_THRESHOLD_PX]
 * @returns {boolean} 超过阈值（拖拽）为 true。
 */
export function isDragMovement(dx, dy, threshold = DRAG_THRESHOLD_PX) {
  return Math.sqrt(dx * dx + dy * dy) > threshold;
}

/**
 * 把悬浮窗位置限制在视口内（resize/拖拽越界时回落）。
 *
 * @param {number} x - 期望 left（px）。
 * @param {number} y - 期望 top（px）。
 * @param {{ vw: number, vh: number, w: number, h: number, margin?: number }} vp
 * @returns {{ x: number, y: number }}
 */
export function clampPosition(x, y, { vw, vh, w, h, margin = OVERLAY_MARGIN_PX }) {
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  return {
    x: clamp(x, margin, vw - w - margin),
    y: clamp(y, margin, vh - h - margin),
  };
}

/**
 * 解析持久化位置；任何非法输入（缺字段/非有限数字/坏 JSON）返回 null（fail-open）。
 *
 * @param {string|null} raw
 * @returns {{ x: number, y: number }|null}
 */
export function parseSavedPosition(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed == null ||
      typeof parsed !== "object" ||
      !Number.isFinite(parsed.x) ||
      !Number.isFinite(parsed.y)
    ) {
      return null;
    }
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

/**
 * @param {{ x: number, y: number }} pos
 * @returns {string}
 */
export function serializePosition({ x, y }) {
  return JSON.stringify({ x, y });
}

/**
 * 随机闲置小动作的下次触发延迟（ms）：均匀分布于 [20000, 60000]。
 * 随机源既可注入函数（默认 Math.random），也可直接传 rand 值（测试/确定性调用）。
 *
 * @param {() => number | number} [rand=Math.random]
 */
export function nextFidgetDelay(rand = Math.random) {
  const r = typeof rand === "function" ? rand() : rand;
  return 20000 + r * 40000;
}
