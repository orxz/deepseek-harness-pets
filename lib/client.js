window.__ModuleLoader__.load({
	id: "deepseek-harness-pets",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.js
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/pet-pool.js
var DEFAULT_PET_POOL = Object.freeze([
  "deepseek-whale",
  "deepseek-octo"
]);
var DEFAULT_PET = "deepseek-whale";
var SETTINGS_NAMESPACE = "deepseek-harness-pets";
function composePetPool(...slugLists) {
  const pool = [];
  for (const list of slugLists) {
    if (!Array.isArray(list)) continue;
    for (const slug of list) {
      if (typeof slug === "string" && slug.trim() !== "" && !pool.includes(slug)) {
        pool.push(slug);
      }
    }
  }
  return pool;
}
var BUNDLED_ARTWORK = Object.freeze({
  // "deepseek-whale": "spritesheet.webp",
  // "deepseek-octo": "spritesheet.png",
});

// src/pet-state.js
var SEMANTIC_STATES = Object.freeze([
  "idle",
  "loading",
  "inferring",
  "scoring",
  "done",
  "sota",
  "error"
]);
var ACTIVE_STATES = /* @__PURE__ */ new Set(["loading", "inferring", "scoring"]);
var SCORING_TOOL_RE = /(?<![a-z0-9])(report|summary|score|scoring|grade|eval(?:uate|uation)?)(?![a-z0-9])/i;
var SOTA_TEXT_RE = /(?<![a-z0-9])(sota|new high|record high|new record|historical high|历史最高|新高)(?![a-z0-9])/i;
function toolNameOf(data) {
  return String(data?.tool ?? data?.name ?? data?.toolName ?? "");
}
var MAX_TEXT_DEPTH = 4;
function textOf(data, depth = 0) {
  if (data == null || depth > MAX_TEXT_DEPTH) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    return data.map((item) => textOf(item, depth + 1)).join(" ");
  }
  if (typeof data === "object") {
    if (typeof data.text === "string") return data.text;
    return (textOf(data.content, depth + 1) + " " + textOf(data.message, depth + 1)).trim();
  }
  return "";
}
function turnOutcomeOf(data) {
  const kind = data?.reason?.kind;
  if (typeof kind === "string" && kind !== "") return kind;
  if (data?.status === "failed" || data?.error != null) return "error";
  if (data?.outcome === "failed" || data?.outcome === "stopped") return "aborted";
  if (data?.status === "completed" || data?.outcome === "completed") return "completed";
  return "unknown";
}
var FAILED_OUTCOMES = /* @__PURE__ */ new Set(["blocked", "error", "max-tokens", "interrupted"]);
function isFailedTurnEnd(data) {
  return FAILED_OUTCOMES.has(turnOutcomeOf(data));
}
function createPetState({ now = Date.now } = {}) {
  let state = "idle";
  let stateEnteredAt = now();
  let sawSotaText = false;
  return {
    get state() {
      return state;
    },
    /** 进入当前语义状态的时刻（毫秒时间戳）；状态变更时刷新，供动画帧计算。 */
    get stateEnteredAt() {
      return stateEnteredAt;
    },
    onEvent(event) {
      const previous = state;
      const data = event?.data ?? {};
      switch (event?.type) {
        case "turn/start":
          state = "loading";
          sawSotaText = false;
          break;
        case "step/start":
          if (ACTIVE_STATES.has(state)) state = "inferring";
          break;
        case "tool/call":
          if (ACTIVE_STATES.has(state)) {
            state = SCORING_TOOL_RE.test(toolNameOf(data)) ? "scoring" : "inferring";
          }
          break;
        case "tool/result":
        case "assistant/message":
          if (SOTA_TEXT_RE.test(textOf(data))) sawSotaText = true;
          break;
        case "turn/end":
          if (isFailedTurnEnd(data)) state = "error";
          else state = sawSotaText ? "sota" : "done";
          sawSotaText = false;
          break;
        default:
          break;
      }
      if (previous !== state) stateEnteredAt = now();
      return { state, changed: previous !== state };
    }
  };
}
function hashSeed(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}
function selectPet(pet, pool, seed) {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new Error("pet pool is empty; assets/pets must contain at least one pet");
  }
  const choice = pet == null || pet === "" ? DEFAULT_PET : pet;
  if (choice === "random") {
    return pool[hashSeed(String(seed ?? "")) % pool.length];
  }
  if (!pool.includes(choice)) {
    throw new Error(
      `unknown pet "${choice}"; available pets: ${pool.join(", ")}`
    );
  }
  return choice;
}

// src/pet-store.js
var TERMINAL_IDLE_DELAY_MS = 4e3;
var TERMINAL = /* @__PURE__ */ new Set(["done", "sota", "error"]);
var TRANSIENTS = /* @__PURE__ */ new Set(["click", "fidget"]);
var ACTIVE_STATES2 = /* @__PURE__ */ new Set(["loading", "inferring", "scoring"]);
function createPetStore({
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) {
  let pet = createPetState({ now });
  let petSlug = DEFAULT_PET;
  let turnId = null;
  let transient = null;
  let transientTimerId = null;
  let idleTimerId = null;
  const listeners = /* @__PURE__ */ new Set();
  function notify() {
    for (const fn of [...listeners]) {
      try {
        fn();
      } catch {
      }
    }
  }
  function snapshot() {
    return {
      petSlug,
      semanticState: pet.state,
      transient,
      busy: ACTIVE_STATES2.has(pet.state)
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
    }
  };
}

// src/pet-art.js
var WHALE_SVG_PATH = "M195,166.1c-2.4,1-4.9,1.8-7.2,1.9-3.6.2-7.6-1.3-9.7-3.1-3.3-2.8-5.7-4.4-6.7-9.2-.4-2.1-.2-5.3.2-7.2.9-4-.1-6.5-2.9-8.9-2.3-1.9-5.2-2.4-8.4-2.4s-2.3-.5-3.1-1c-1.3-.7-2.4-2.3-1.4-4.4.3-.7,2-2.3,2.3-2.5,4.3-2.5,9.4-1.7,14,.2,4.3,1.7,7.5,5,12.2,9.5,4.8,5.5,5.6,7,8.4,11.1,2.1,3.2,4.1,6.6,5.4,10.4.8,2.4-.2,4.3-3.1,5.5ZM157.1,146.7c0-2.1,1.7-3.7,3.8-3.7s.9.1,1.3.2c.5.2,1,.5,1.4.9.7.7,1.1,1.6,1.1,2.6,0,2.1-1.7,3.8-3.8,3.8s-3.7-1.7-3.7-3.8ZM144.9,225.2c-25.5-20-37.8-26.6-42.9-26.3-4.8.3-3.9,5.7-2.8,9.3,1.1,3.5,2.5,5.9,4.5,9,1.4,2,2.3,5.1-1.4,7.3-8.2,5.1-22.5-1.7-23.1-2-16.6-9.8-30.5-22.7-40.2-40.3-9.5-17-14.9-35.2-15.8-54.6-.2-4.7,1.1-6.4,5.8-7.2,6.2-1.1,12.5-1.4,18.7-.5,26,3.8,48.1,15.4,66.7,33.8,10.6,10.5,18.6,23,26.8,35.2,8.8,13,18.2,25.4,30.2,35.5,4.3,3.6,7.6,6.3,10.9,8.2-9.8,1.1-26.1,1.3-37.2-7.5ZM293.2,60.4c-3.1-1.5-4.4,1.4-6.3,2.8-.6.5-1.1,1.1-1.7,1.7-4.5,4.8-9.8,8-16.8,7.6-10.1-.6-18.7,2.6-26.4,10.4-1.6-9.5-7-15.2-15.2-18.9-4.3-1.9-8.6-3.8-11.6-7.9-2.1-2.9-2.7-6.2-3.7-9.4-.7-2-1.3-3.9-3.6-4.3-2.4-.4-3.4,1.7-4.3,3.4-3.8,7-5.3,14.6-5.2,22.4.3,17.5,7.7,31.5,22.4,41.4,1.7,1.1,2.1,2.3,1.6,3.9-1,3.4-2.2,6.7-3.3,10.1-.7,2.2-1.7,2.7-4,1.7-8.1-3.4-15-8.4-21.2-14.4-10.4-10.1-19.9-21.2-31.6-30-2.8-2.1-5.5-4-8.4-5.7-12-11.7,1.6-21.3,4.7-22.4,3.3-1.2,1.2-5.3-9.5-5.2-10.6,0-20.3,3.6-32.8,8.4-1.8.7-3.7,1.2-5.7,1.7-11.3-2.1-22.9-2.6-35.1-1.2-23,2.5-41.4,13.4-54.8,32C4.7,110.7.9,136,5.6,162.4c4.9,27.8,19.1,50.9,41,68.9,22.6,18.7,48.7,27.8,78.5,26.1,18.1-1,38.2-3.5,60.9-22.7,5.7,2.8,11.7,4,21.7,4.8,7.7.7,15.1-.4,20.8-1.5,9-1.9,8.4-10.2,5.1-11.7-26.3-12.3-20.5-7.3-25.7-11.3,13.3-15.8,33.5-32.2,41.3-85.4.6-4.2.1-6.9,0-10.3,0-2.1.4-2.9,2.8-3.1,6.6-.8,13-2.6,18.8-5.8,17-9.3,23.9-24.6,25.5-42.9.2-2.8,0-5.7-3-7.2Z";
var PET_SIZE = 96;
var OVERLAY_ANIMATIONS = Object.freeze({
  idle: { name: "dsh-pet-ov-idle", duration: "3s" },
  loading: { name: "dsh-pet-ov-loading", duration: "1.2s" },
  inferring: { name: "dsh-pet-ov-swim", duration: "0.6s" },
  scoring: { name: "dsh-pet-ov-scoring", duration: "2s" },
  done: { name: "dsh-pet-ov-done", duration: "1s" },
  sota: { name: "dsh-pet-ov-jump", duration: "1.2s" },
  error: { name: "dsh-pet-ov-error", duration: "0.8s", filter: "grayscale(0.8)" },
  click: { name: "dsh-pet-ov-jump", duration: "0.9s" },
  fidget: { name: "dsh-pet-ov-wiggle", duration: "1.5s" }
});
var CLICK_BUBBLES = Object.freeze(["\u597D\u8036\uFF01", "\u6536\u5230\uFF01", "\u5495\u565C~", "\u6251\u901A\uFF01"]);
var FIDGET_BUBBLES = Object.freeze(["\u55B7\u4E2A\u6C34~", "\u6E38\u4E24\u5708~", "\u5C0F\u7761\u7247\u523B\u2026"]);
var KNOWN = new Set(Object.keys(OVERLAY_ANIMATIONS));
function buildOverlayAnimationCss() {
  return [
    "@keyframes dsh-pet-ov-idle {",
    "  0%, 100% { transform: translateY(0); }",
    "  50% { transform: translateY(-6px); }",
    "}",
    "@keyframes dsh-pet-ov-loading {",
    "  0%, 100% { transform: translateY(0) rotate(0deg); }",
    "  50% { transform: translateY(-5px) rotate(-3deg); }",
    "}",
    "@keyframes dsh-pet-ov-swim {",
    "  0%, 100% { transform: rotate(-8deg) translateX(0); }",
    "  50% { transform: rotate(8deg) translateX(4px); }",
    "}",
    "@keyframes dsh-pet-ov-scoring {",
    "  0%, 100% { transform: rotate(0deg) scale(1); }",
    "  50% { transform: rotate(6deg) scale(1.04); }",
    "}",
    "@keyframes dsh-pet-ov-done {",
    "  0%, 100% { transform: rotate(-12deg); }",
    "  50% { transform: rotate(12deg); }",
    "}",
    "@keyframes dsh-pet-ov-jump {",
    "  0% { transform: translateY(0) scale(1, 1); }",
    "  35% { transform: translateY(-48px) scale(0.94, 1.08); }",
    "  70% { transform: translateY(0) scale(1.08, 0.92); }",
    "  85% { transform: translateY(-10px) scale(1, 1); }",
    "  100% { transform: translateY(0) scale(1, 1); }",
    "}",
    "@keyframes dsh-pet-ov-error {",
    "  0%, 100% { transform: rotate(180deg); }",
    "  50% { transform: rotate(172deg); }",
    "}",
    "@keyframes dsh-pet-ov-wiggle {",
    "  0%, 100% { transform: rotate(0deg) translateY(0); }",
    "  25% { transform: rotate(-6deg) translateY(-8px); }",
    "  75% { transform: rotate(6deg) translateY(-8px); }",
    "}",
    ".dsh-pet-overlay {",
    "  will-change: transform;",
    "}"
  ].join("\n");
}
function overlayAnimStyle({ semanticState, transient }) {
  const key = (transient != null && KNOWN.has(transient) ? transient : null) ?? (KNOWN.has(semanticState) && semanticState !== "click" && semanticState !== "fidget" ? semanticState : "idle");
  const anim = OVERLAY_ANIMATIONS[key];
  const style = {
    animationName: anim.name,
    animationDuration: anim.duration,
    animationIterationCount: "infinite"
  };
  if (anim.filter != null) style.filter = anim.filter;
  return style;
}
function bubbleFor({ stateDef, transient, hovered }) {
  if (hovered) return "\u55EF\uFF1F";
  if (transient === "click") return CLICK_BUBBLES[0];
  if (transient === "fidget") return FIDGET_BUBBLES[0];
  return stateDef?.bubble?.zh ?? stateDef?.bubble?.en ?? "";
}

// src/overlay-view.js
var DRAG_THRESHOLD_PX = 5;
var OVERLAY_MARGIN_PX = 8;
var OVERLAY_STORAGE_KEY = "dsh-pets-overlay-pos";
function isDragMovement(dx, dy, threshold = DRAG_THRESHOLD_PX) {
  return Math.sqrt(dx * dx + dy * dy) > threshold;
}
function clampPosition(x, y, { vw, vh, w, h, margin = OVERLAY_MARGIN_PX }) {
  const clamp = (v, min, max) => Math.min(Math.max(v, min), Math.max(min, max));
  return {
    x: clamp(x, margin, vw - w - margin),
    y: clamp(y, margin, vh - h - margin)
  };
}
function parseSavedPosition(raw) {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== "object" || !Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) {
      return null;
    }
    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}
function serializePosition({ x, y }) {
  return JSON.stringify({ x, y });
}
function nextFidgetDelay(rand = Math.random) {
  const r = typeof rand === "function" ? rand() : rand;
  return 2e4 + r * 4e4;
}
var FIDGET_DURATION_MS = 3e3;
var CLICK_DURATION_MS = 1500;
function createPetOverlay(store2, mappings, { createElement: createElement2, useRef: useRef2, useState: useState2, useEffect: useEffect2 }) {
  const h = createElement2;
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
    }
  }
  return function PetOverlay() {
    const [snap, setSnap] = useState2(store2.getSnapshot);
    const [pos, setPos] = useState2(loadSaved);
    const [hovered, setHovered] = useState2(false);
    const dragRef = useRef2(null);
    useEffect2(() => store2.subscribe(() => setSnap(store2.getSnapshot())), [store2]);
    const idleNow = snap.semanticState === "idle" && snap.transient === null;
    useEffect2(() => {
      if (!idleNow || typeof globalThis.setTimeout !== "function") return void 0;
      const timer = globalThis.setTimeout(() => {
        store2.setTransient("fidget", FIDGET_DURATION_MS);
      }, nextFidgetDelay());
      return () => globalThis.clearTimeout(timer);
    }, [idleNow, snap.transient]);
    useEffect2(() => {
      const onResize = () => {
        setPos((current) => {
          if (current == null) return current;
          return clampPosition(current.x, current.y, {
            vw: globalThis.innerWidth,
            vh: globalThis.innerHeight,
            w: PET_SIZE,
            h: PET_SIZE
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
        h: PET_SIZE
      });
      setPos(clamped);
    }
    function onPointerUp(e) {
      const drag = dragRef.current;
      dragRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      if (drag != null && !drag.moved) {
        store2.setTransient("click", CLICK_DURATION_MS);
      } else if (drag?.moved) {
        setPos((current) => {
          if (current != null) save(current);
          return current;
        });
      }
    }
    function onPointerCancel(e) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
    const anim = overlayAnimStyle(snap);
    const bubble = snap.transient === "click" ? CLICK_BUBBLES[Math.floor(Math.random() * CLICK_BUBBLES.length)] : snap.transient === "fidget" ? FIDGET_BUBBLES[Math.floor(Math.random() * FIDGET_BUBBLES.length)] : bubbleFor({ stateDef: mappings.states[snap.semanticState], transient: null, hovered });
    return h(
      "div",
      {
        "data-dsh-pet-overlay": snap.petSlug,
        "data-pet-state": snap.semanticState,
        style: {
          position: "fixed",
          left: pos != null ? `${pos.x}px` : void 0,
          top: pos != null ? `${pos.y}px` : void 0,
          right: pos == null ? "24px" : void 0,
          bottom: pos == null ? "24px" : void 0,
          width: `${PET_SIZE}px`,
          height: `${PET_SIZE}px`,
          zIndex: 30,
          pointerEvents: "auto",
          touchAction: "none",
          cursor: "grab",
          userSelect: "none"
        },
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onPointerEnter: () => setHovered(true),
        onPointerLeave: () => setHovered(false)
      },
      h(
        "div",
        {
          className: "dsh-pet-overlay",
          style: {
            width: "100%",
            height: "100%",
            transform: hovered ? "scale(1.08) rotate(-4deg)" : void 0,
            transition: "transform 0.2s ease",
            ...anim
          }
        },
        h(
          "svg",
          { viewBox: "0 0 300 300", width: "100%", height: "100%", "aria-hidden": true },
          h("path", { d: WHALE_SVG_PATH, fill: "#4D6BFE" })
        )
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
            whiteSpace: "nowrap"
          }
        },
        bubble
      )
    );
  };
}
function ensureOverlayStyles(document_) {
  if (document_ == null || document_.getElementById("dsh-harness-pets-overlay-anim") != null) return;
  const style = document_.createElement("style");
  style.id = "dsh-harness-pets-overlay-anim";
  style.textContent = buildOverlayAnimationCss();
  document_.head.append(style);
}

// src/renderer.js
var STANDARD_FRAME = Object.freeze({
  width: 192,
  height: 208,
  columns: 8,
  rows: 9
});
var ROW_INDEX_BY_NAME = Object.freeze({
  idle: 0,
  "running-right": 1,
  "running-left": 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8
});
function buildAnimationCss(frame = STANDARD_FRAME) {
  const { width, height, columns, rows } = frame;
  const keyframes = Array.from({ length: rows }, (_, row) => {
    const y = `-${row * height}px`;
    return [
      `@keyframes dsh-pet-row-${row} {`,
      `  from { background-position: 0 ${y}; }`,
      `  to   { background-position: -${columns * width}px ${y}; }`,
      `}`
    ].join("\n");
  }).join("\n");
  return [
    keyframes,
    ".dsh-pet-sprite {",
    "  image-rendering: pixelated;",
    "  background-repeat: no-repeat;",
    "}"
  ].join("\n");
}

// mappings/harness-states.json
var harness_states_default = {
  version: "0.1.0",
  description: "deepseek-harness-pets \u72B6\u6001\u6620\u5C04\u5951\u7EA6\uFF1Adsh durable session \u4E8B\u4EF6\u4FE1\u53F7 \u2192 \u63D2\u4EF6\u8BED\u4E49\u72B6\u6001\uFF08pet-state.js\uFF09\u2192 Petdex \u6807\u51C6\u52A8\u753B\u884C + \u64AD\u653E\u5E27\u7387 fps + \u6C14\u6CE1\u6587\u6848\uFF08renderer.js\uFF09\u3002\u8BED\u4E49\u72B6\u6001 key \u662F\u63D2\u4EF6\u4EE3\u7801\u4E0E\u672C\u6587\u4EF6\u7684\u552F\u4E00\u5951\u7EA6\u3002",
  standardRows: [
    "idle",
    "running-right",
    "running-left",
    "waving",
    "jumping",
    "failed",
    "waiting",
    "running",
    "review"
  ],
  officialBaseline: {
    description: "\u5B98\u65B9 @petdex/dsh-plugin \u7684\u6620\u5C04\u57FA\u51C6\uFF0C\u672C\u6620\u5C04\u5728\u5176\u4E0A\u53E0\u52A0 eval \u8BED\u4E49\u5C42\uFF1B\u63A8\u65AD\u4FE1\u53F7\u7F6E\u4FE1 medium \u65F6\u5B81\u53EF\u56DE\u843D\u5230\u57FA\u51C6\u884C\u3002",
    source: "petdex integrations/dsh/README.md State mapping"
  },
  states: {
    idle: {
      row: "idle",
      fps: 4,
      signals: ["\u65E0\u8FDB\u884C\u4E2D\u7684 turn\uFF08\u4F1A\u8BDD\u7A7A\u95F2\uFF09"],
      visual: "\u6D6E\u6C34\u6253\u778C\u7761",
      bubble: { zh: "zzZ", en: "zzZ" }
    },
    loading: {
      row: "waiting",
      fps: 6,
      signals: ["turn \u5F00\u59CB\u540E\u9996\u8F6E\u6570\u636E\u96C6\u62C9\u53D6/\u51C6\u5907\u7C7B\u5DE5\u5177\u8C03\u7528\uFF08\u63A8\u65AD\uFF1A\u62C9\u53D6\u7C7B\u5DE5\u5177\u7279\u5F81\uFF09"],
      visual: "\u9CB8\u9C7C\u55B7\u6C34",
      bubble: { zh: "\u52A0\u8F7D\u6570\u636E\u4E2D\u2026", en: "Loading data..." }
    },
    inferring: {
      row: "running",
      fps: 8,
      variants: ["running", "running-left", "running-right"],
      signals: ["step/tool \u9AD8\u9891\u6D3B\u52A8\uFF08\u5B98\u65B9\u57FA\u51C6=running\uFF09"],
      visual: "\u6781\u901F\u4E0B\u6F5C\u3001\u8BA4\u771F\u6572\u952E\u76D8",
      bubble: { zh: "\u63A8\u7406\u4E2D\u2026", en: "Inferring..." }
    },
    scoring: {
      row: "review",
      fps: 6,
      signals: ["\u6C47\u603B/\u62A5\u544A\u7C7B\u5DE5\u5177\u8C03\u7528\uFF08\u63A8\u65AD\uFF1A\u62A5\u544A\u7C7B\u5DE5\u5177\u7279\u5F81\uFF09"],
      visual: "\u4E3E\u62A5\u544A\u5BA1\u89C6",
      bubble: { zh: "\u8BC4\u5206\u4E2D\u2026", en: "Scoring..." }
    },
    done: {
      row: "waving",
      fps: 6,
      signals: ["turn completed\uFF08\u5B98\u65B9\u57FA\u51C6=waving\uFF09"],
      visual: "\u6325\u9C7C\u9CCD",
      bubble: { zh: "\u5B8C\u6210\uFF01", en: "Done!" }
    },
    sota: {
      row: "jumping",
      fps: 10,
      signals: ["\u8BC4\u6D4B\u5206\u6570\u521B\u65B0\u9AD8\uFF08v0.1 \u4EE5\u5B8C\u6210\u4E8B\u4EF6\u7279\u5F81\u8FD1\u4F3C\uFF0C\u7CBE\u786E\u5224\u5B9A\u89C1 Roadmap\uFF09"],
      visual: "\u8DC3\u51FA\u6C34\u9762\u3001\u653E\u70DF\u82B1",
      bubble: { zh: "SOTA\uFF01", en: "SOTA!" }
    },
    error: {
      row: "failed",
      fps: 4,
      signals: ["turn failed / stopped\uFF08\u5B98\u65B9\u57FA\u51C6=failed\uFF09"],
      visual: "\u7FFB\u767D\u809A\u3001\u673A\u68B0\u6545\u969C",
      bubble: { zh: "[ERROR] \u8BF7\u68C0\u67E5\u65E5\u5FD7", en: "[ERROR] Check logs" }
    }
  }
};

// src/index.js
var name = "deepseek-harness-pets";
var DURABLE_UPDATE_TYPES = /* @__PURE__ */ new Set([
  "turn/end",
  "step/start",
  "step/end",
  "tool/call",
  "tool/result",
  "user/message",
  "assistant/message"
]);
function turnIdOf(event) {
  const data = event?.data ?? {};
  return data.turn ?? data.turnId ?? event?.turn ?? null;
}
var store = createPetStore();
var petNodeDefinition = {
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
    if ((context.key ?? match.id) !== store.currentTurnId) return context.state;
    store.onEvent(match.event);
    return context.state;
  },
  publication: (match) => match.event.type === "turn/start" || match.event.type === "turn/end" ? "immediate" : "animation-frame",
  buildLocationData: () => null,
  // 悬浮窗形态不产出聊天流节点：恒 null（折叠引擎仅作事件管道）。
  buildViewNode: () => null
};
var moduleConfig = {
  pet: void 0,
  pool: [...DEFAULT_PET_POOL]
};
function refreshPreference(scope) {
  const value = scope?.getSnapshot?.()?.value;
  const pet = typeof value?.pet === "string" && value.pet !== "" ? value.pet : void 0;
  const pets = Array.isArray(value?.pets) ? value.pets : [];
  const pool = composePetPool(pets, DEFAULT_PET_POOL);
  if (pet !== void 0 && pet !== "random" && !pool.includes(pet)) {
    console.error(
      `[deepseek-harness-pets] settings pet "${pet}" not in pool [${pool.join(", ")}]; falling back to default`
    );
    moduleConfig.pet = void 0;
  } else {
    moduleConfig.pet = pet;
  }
  moduleConfig.pool = pool;
}
function selectPetSafely(seed) {
  try {
    return selectPet(moduleConfig.pet, moduleConfig.pool, seed);
  } catch {
    return moduleConfig.pool[0] ?? DEFAULT_PET_POOL[0];
  }
}
var applyState = { applied: false };
var inject = ["conversationEvents", "slots", "connection", "remote", "settingsScope"];
function apply(ctx) {
  if (applyState.applied) return;
  applyState.applied = true;
  ensureOverlayStyles(typeof document === "undefined" ? void 0 : document);
  const idleStyle = document?.getElementById("dsh-harness-pets-anim");
  if (idleStyle == null && typeof document !== "undefined") {
    const style = document.createElement("style");
    style.id = "dsh-harness-pets-anim";
    style.textContent = buildAnimationCss();
    document.head.append(style);
  }
  try {
    const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
    refreshPreference(scope);
    scope.subscribe(() => refreshPreference(scope));
  } catch (error) {
    console.warn("[deepseek-harness-pets] settings scope unavailable:", error);
  }
  ctx.conversationEvents.register(petNodeDefinition);
  ctx.slots.inject(
    "shell.overlay",
    () => ctx.slots.register(
      { name: "shell.overlay", id: "dsh-pet" },
      createPetOverlay(store, harness_states_default, { createElement: import_react.createElement, useRef: import_react.useRef, useState: import_react.useState, useEffect: import_react.useEffect })
    )
  );
}
		return module.exports;
	},
});
