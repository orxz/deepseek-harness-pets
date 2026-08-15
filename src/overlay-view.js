/**
 * overlay-view.js — 悬浮窗组件与可单测纯逻辑（位置/拖拽/闲置调度）。
 * 组件依赖的 React 经参数注入（项目 node_modules 无 react，测试图中不得 import）。
 */

import {
  buildOverlayAnimationCss,
  bubbleFor,
  CLICK_BUBBLES,
  FIDGET_BUBBLES,
  overlayAnimStyle,
  PET_SIZE,
  WHALE_SVG_PATH,
} from "./pet-art.js";

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

/** 随机闲置小动作时长（ms）。 */
const FIDGET_DURATION_MS = 3000;

/** 点击瞬态时长（ms）。 */
const CLICK_DURATION_MS = 1500;

/**
 * 悬浮窗组件工厂。React（createElement/hooks）经参数注入：项目 node_modules
 * 无 react，且宿主经模块表提供同一实例。
 *
 * @param {{ getSnapshot, subscribe, setTransient }} store - pet-store 实例
 * @param {{ states: object }} mappings - mappings/harness-states.json
 * @param {{ createElement: Function, useRef: Function, useState: Function, useEffect: Function }} React
 * @returns {Function} React 组件
 */
export function createPetOverlay(store, mappings, { createElement, useRef, useState, useEffect }) {
  const h = createElement;

  /** 读取持久化位置（任何异常回落 null = 默认右下角 CSS 定位）。 */
  function loadSaved() {
    try {
      return parseSavedPosition(globalThis.localStorage?.getItem(OVERLAY_STORAGE_KEY) ?? null);
    } catch {
      return null;
    }
  }

  function save(pos) {
    try {
      globalThis.localStorage?.setItem(OVERLAY_STORAGE_KEY, serializePosition(pos));
    } catch {
      // 隐私模式/配额满：不持久化（fail-open）。
    }
  }

  return function PetOverlay() {
    const [snap, setSnap] = useState(store.getSnapshot);
    const [pos, setPos] = useState(loadSaved); // null = 默认右下角
    const [hovered, setHovered] = useState(false);
    const dragRef = useRef(null); // { startX, startY, moved }

    useEffect(() => store.subscribe(() => setSnap(store.getSnapshot())), [store]);

    // 随机闲置：仅在 idle 且无瞬态时调度下一次小动作。
    const idleNow = snap.semanticState === "idle" && snap.transient === null;
    useEffect(() => {
      if (!idleNow || typeof globalThis.setTimeout !== "function") return undefined;
      const timer = globalThis.setTimeout(() => {
        store.setTransient("fidget", FIDGET_DURATION_MS);
      }, nextFidgetDelay());
      return () => globalThis.clearTimeout(timer);
    }, [idleNow, snap.transient]);

    // 视口 resize：越界位置拉回（一次 clamp，不监听拖拽中的连续变化）。
    useEffect(() => {
      const onResize = () => {
        setPos((current) => {
          if (current == null) return current;
          return clampPosition(current.x, current.y, {
            vw: globalThis.innerWidth,
            vh: globalThis.innerHeight,
            w: PET_SIZE,
            h: PET_SIZE,
          });
        });
      };
      globalThis.addEventListener?.("resize", onResize);
      return () => globalThis.removeEventListener?.("resize", onResize);
    }, []);

    function onPointerDown(e) {
      dragRef.current = { startX: e.clientX, startY: e.clientY, moved: false };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    }

    function onPointerMove(e) {
      const drag = dragRef.current;
      if (drag == null) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (!drag.moved && !isDragMovement(dx, dy)) return;
      drag.moved = true;
      const clamped = clampPosition(e.clientX - PET_SIZE / 2, e.clientY - PET_SIZE / 2, {
        vw: globalThis.innerWidth,
        vh: globalThis.innerHeight,
        w: PET_SIZE,
        h: PET_SIZE,
      });
      setPos(clamped);
    }

    function onPointerUp(e) {
      const drag = dragRef.current;
      dragRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (drag != null && !drag.moved) {
        // 位移未超阈值 = 点击：瞬态跳跃（随机开心文案在 bubble 渲染分支处理）。
        store.setTransient("click", CLICK_DURATION_MS);
      } else if (drag?.moved) {
        setPos((current) => {
          if (current != null) save(current);
          return current;
        });
      }
    }

    const anim = overlayAnimStyle(snap);
    const bubble = snap.transient === "click"
      ? CLICK_BUBBLES[Math.floor(Math.random() * CLICK_BUBBLES.length)]
      : snap.transient === "fidget"
        ? FIDGET_BUBBLES[Math.floor(Math.random() * FIDGET_BUBBLES.length)]
        : bubbleFor({ stateDef: mappings.states[snap.semanticState], transient: null, hovered });

    return h(
      "div",
      {
        "data-dsh-pet-overlay": snap.petSlug,
        "data-pet-state": snap.semanticState,
        style: {
          position: "fixed",
          left: pos != null ? `${pos.x}px` : undefined,
          top: pos != null ? `${pos.y}px` : undefined,
          right: pos == null ? "24px" : undefined,
          bottom: pos == null ? "24px" : undefined,
          width: `${PET_SIZE}px`,
          height: `${PET_SIZE}px`,
          zIndex: 30,
          pointerEvents: "auto",
          touchAction: "none",
          cursor: "grab",
          userSelect: "none",
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerEnter: () => setHovered(true),
        onPointerLeave: () => setHovered(false),
      },
      h(
        "div",
        {
          className: "dsh-pet-overlay",
          style: {
            width: "100%",
            height: "100%",
            transform: hovered ? "scale(1.08) rotate(-4deg)" : undefined,
            transition: "transform 0.2s ease",
            ...anim,
          },
        },
        h(
          "svg",
          { viewBox: "0 0 300 300", width: "100%", height: "100%", "aria-hidden": true },
          h("path", { d: WHALE_SVG_PATH, fill: "#4D6BFE" }),
        ),
      ),
      h(
        "span",
        {
          style: {
            position: "absolute",
            right: "100%",
            bottom: "60%",
            marginRight: "6px",
            padding: "2px 8px",
            borderRadius: "8px",
            background: "rgba(77, 107, 254, 0.92)",
            color: "#fff",
            fontSize: "13px",
            whiteSpace: "nowrap",
          },
        },
        bubble,
      ),
    );
  };
}

/** 悬浮窗动画 CSS 一次性注入（幂等，index.js 调用）。 */
export function ensureOverlayStyles(document_) {
  if (document_ == null || document_.getElementById("dsh-harness-pets-overlay-anim") != null) return;
  const style = document_.createElement("style");
  style.id = "dsh-harness-pets-overlay-anim";
  style.textContent = buildOverlayAnimationCss();
  document_.head.append(style);
}
