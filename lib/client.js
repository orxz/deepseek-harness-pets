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

// src/turn-contexts.js
function createTurnContextRegistry({
  limit = 64,
  isTerminal = () => false
} = {}) {
  const contexts2 = /* @__PURE__ */ new Map();
  function evictOverflow() {
    if (typeof limit !== "number" || !(limit >= 1) || contexts2.size <= limit) {
      return;
    }
    for (const id of [...contexts2.keys()]) {
      if (contexts2.size <= limit) break;
      if (isTerminal(contexts2.get(id))) contexts2.delete(id);
    }
  }
  return {
    get size() {
      return contexts2.size;
    },
    has: (id) => contexts2.has(id),
    get: (id) => contexts2.get(id) ?? null,
    set(id, entry) {
      contexts2.set(id, entry);
      evictOverflow();
    }
  };
}

// src/renderer.js
var STANDARD_FRAME = Object.freeze({
  width: 192,
  height: 208,
  columns: 8,
  rows: 9
});
function frameStyle({ row, frameIndex, frame = STANDARD_FRAME }) {
  const index = (frameIndex % frame.columns + frame.columns) % frame.columns;
  return {
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    backgroundSize: `${frame.width * frame.columns}px ${frame.height * frame.rows}px`,
    backgroundPosition: `-${index * frame.width}px -${row * frame.height}px`
  };
}
function bubbleText(stateDef, locale = "zh") {
  return stateDef?.bubble?.[locale] ?? stateDef?.bubble?.zh ?? "";
}
function petCardView(h, { petSlug, semanticState, stateDef, frameIndex, busy = false, spritesheetUrl = null }) {
  const safeUrl = encodeURI(String(spritesheetUrl));
  const sprite = spritesheetUrl ? h("div", {
    "data-pet-art": "sprite",
    title: petSlug,
    className: "dsh-pet-sprite",
    style: {
      ...spriteAnimStyle(stateDef, frameIndex),
      backgroundImage: `url("${safeUrl}")`
    }
  }) : h(
    "div",
    {
      "data-pet-art": "placeholder",
      title: `${petSlug}\uFF08\u50CF\u7D20\u56FE\u6682\u4E0D\u53EF\u7528\uFF1A\u5185\u7F6E\u76AE\u80A4\u5F85\u793E\u533A\u63D0\u4EA4 spritesheet\uFF0C\u5916\u90E8\u6E90\u76AE\u80A4\u5F85 Host \u9759\u6001\u670D\u52A1\uFF09`,
      style: {
        width: `${STANDARD_FRAME.width}px`,
        height: `${STANDARD_FRAME.height}px`,
        border: "2px dashed #4D6BFE",
        borderRadius: "8px",
        color: "#4D6BFE",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        textAlign: "center"
      }
    },
    petSlug
  );
  return h(
    "div",
    {
      "data-dsh-pet": petSlug,
      "data-pet-state": semanticState,
      style: {
        display: "inline-flex",
        alignItems: "flex-end",
        gap: "8px",
        padding: "4px 8px"
      }
    },
    sprite,
    h(
      "span",
      { style: { fontSize: "13px", opacity: busy ? 1 : 0.75 } },
      bubbleText(stateDef)
    )
  );
}
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
function spriteAnimStyle(stateDef, frameIndex) {
  const row = ROW_INDEX_BY_NAME[stateDef?.row] ?? 0;
  const style = frameStyle({ row, frameIndex });
  return {
    ...style,
    animationName: `dsh-pet-row-${row}`,
    // duration = 列数 / fps：fps 高的行（如 jumping 10fps）转得更快。
    animationDuration: `${STANDARD_FRAME.columns / (stateDef?.fps || 6)}s`,
    animationTimingFunction: `steps(${STANDARD_FRAME.columns})`,
    animationIterationCount: "infinite"
  };
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
var TERMINAL_STATES = /* @__PURE__ */ new Set(["done", "sota", "error"]);
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
var contexts = createTurnContextRegistry({
  isTerminal: (entry) => TERMINAL_STATES.has(entry.pet.state)
});
function snapshot(pet, petSlug) {
  return {
    petSlug,
    semanticState: pet.state,
    busy: !TERMINAL_STATES.has(pet.state)
  };
}
var petNodeDefinition = {
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
    const entry = contexts.get(id) ?? {
      pet: createPetState(),
      petSlug: selectPetSafely(id)
    };
    entry.pet.onEvent(match.event);
    contexts.set(id, entry);
    return snapshot(entry.pet, entry.petSlug);
  },
  publication: (match) => match.event.type === "turn/start" || match.event.type === "turn/end" ? "immediate" : "animation-frame",
  buildLocationData: () => null,
  buildViewNode: (context) => {
    if (context.state === void 0) return null;
    return {
      key: context.key,
      kind: "dsh-pet",
      id: context.id,
      target: "chat",
      anchorSeq: context.start?.event.seq ?? context.matches[0]?.event.seq ?? 0,
      location: context.start?.location ?? context.matches[0]?.location ?? { kind: "unresolved" },
      visibility: "visible",
      data: { ...context.state, frameIndex: 0 }
    };
  }
};
var moduleConfig = {
  pet: void 0,
  // 生效偏好；undefined 即默认大鲸鱼（selectPet 兜底 DEFAULT_PET）
  pool: [...DEFAULT_PET_POOL]
  // 生效池（永远包含 bundled，非空）
};
function spritesheetUrlOf(petSlug) {
  const artwork = BUNDLED_ARTWORK[petSlug];
  return artwork == null ? null : `assets/pets/${petSlug}/${artwork}`;
}
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
function ensureAnimationStyles() {
  if (typeof document === "undefined") return;
  const styleId = "dsh-harness-pets-anim";
  if (document.getElementById(styleId) != null) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = buildAnimationCss();
  document.head.append(style);
}
var applyState = { applied: false };
var inject = ["conversationEvents", "slots", "connection", "remote", "settingsScope"];
function apply(ctx) {
  if (applyState.applied) return;
  applyState.applied = true;
  ensureAnimationStyles();
  try {
    const scope = ctx.settingsScope.bind({ namespace: SETTINGS_NAMESPACE });
    refreshPreference(scope);
    scope.subscribe(() => refreshPreference(scope));
  } catch (error) {
    console.warn("[deepseek-harness-pets] settings scope unavailable:", error);
  }
  ctx.conversationEvents.register(petNodeDefinition);
  ctx.slots.inject(
    "conversation.chat.node",
    () => ctx.slots.register(
      { name: "conversation.chat.node", key: "dsh-pet" },
      ({ node }) => petCardView(import_react.createElement, {
        petSlug: node.data.petSlug,
        semanticState: node.data.semanticState,
        stateDef: harness_states_default.states[node.data.semanticState],
        frameIndex: node.data.frameIndex,
        busy: node.data.busy,
        spritesheetUrl: spritesheetUrlOf(node.data.petSlug)
      })
    )
  );
}
		return module.exports;
	},
});
