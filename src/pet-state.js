/**
 * pet-state.js — dsh durable session 事件 → 宠物语义状态机（纯逻辑，零依赖）。
 *
 * 契约：
 * - 语义状态 key 与 mappings/harness-states.json 的 states keys 完全一致（SEMANTIC_STATES 是唯一契约面）。
 * - onEvent 只依赖事件内容（type/data），按 ascending seq 重放与实时追加得到相同终态。
 * - 未知事件类型不改变状态（fail-open，兼容 dsh developer preview 的新事件）。
 * - 终态（done/sota/error）吸收后续非 turn 事件，直到下一个 turn/start。
 */

export const SEMANTIC_STATES = Object.freeze([
  "idle",
  "loading",
  "inferring",
  "scoring",
  "done",
  "sota",
  "error",
]);

import { DEFAULT_PET } from "./pet-pool.js";

/**
 * 合成宠物偏好：设置面板值（用户设置文档，最高）→ cordis.yml 配置 → undefined（即默认大鲸鱼 DEFAULT_PET）。
 * 与 dsh-settings 的解析层级（schema 默认 → composition base → 用户文档）一致；
 * 空串/null 视为未设置（设置面板清空即回继承）。
 *
 * @param {string|undefined|null} settingPet - 设置镜像读到的 pet 值。
 * @param {string|undefined|null} configPet - cordis.yml entry config 的 pet 值。
 * @returns {string|undefined} 生效偏好；仍需经 selectPet 做池校验（fail loud）。
 */
export function resolvePetPreference(settingPet, configPet) {
  if (typeof settingPet === "string" && settingPet !== "") return settingPet;
  if (typeof configPet === "string" && configPet !== "") return configPet;
  return undefined;
}

/** turn 进行中的语义状态集合；终态之外的事件只有处于这些状态时才生效。 */
const ACTIVE_STATES = new Set(["loading", "inferring", "scoring"]);

/** 报告/评分类工具名特征（medium 置信推断；命中则进入 scoring，否则保守落到 inferring）。
 *  边界用排除下划线的环视：snake_case 工具名（write_score_report）的段必须能命中，
 *  而单词内子串（retrieval 含 eval、upgrade 含 grade）不得误报。 */
const SCORING_TOOL_RE =
  /(?<![a-z0-9])(report|summary|score|scoring|grade|eval(?:uate|uation)?)(?![a-z0-9])/i;

/** SOTA 文本特征（v0.1 近似判定；精确判定见 Roadmap 的 Host 事件族方案）。边界规则同上。 */
const SOTA_TEXT_RE =
  /(?<![a-z0-9])(sota|new high|record high|new record|historical high|历史最高|新高)(?![a-z0-9])/i;

function toolNameOf(data) {
  return String(data?.tool ?? data?.name ?? data?.toolName ?? "");
}

/** 深度上限：防御自引用/超深结构（真实消息两层内必达文本）。 */
const MAX_TEXT_DEPTH = 4;

/**
 * 提取事件的文本特征：支持 string、{text}、{content}、{message}（真实契约：
 * assistant/message 与 tool/result 的文本在 data.message.content 消息块里）与嵌套结构；
 * 避免对对象 content 做 String() 得到 "[object Object]" 导致 SOTA 检测失效。
 */
function textOf(data, depth = 0) {
  if (data == null || depth > MAX_TEXT_DEPTH) return "";
  if (typeof data === "string") return data;
  if (Array.isArray(data)) {
    return data.map((item) => textOf(item, depth + 1)).join(" ");
  }
  if (typeof data === "object") {
    if (typeof data.text === "string") return data.text;
    return (
      textOf(data.content, depth + 1) + " " + textOf(data.message, depth + 1)
    ).trim();
  }
  return "";
}

/** turn/end 的结果判定：真实契约为 reason: { kind }（SessionEventMap TurnEndReason）；
 *  兼容旧字段（status/error/outcome）作为防御性兑底。
 *  kind 语义：completed=正常；aborted=用户取消（非故障，安静收场）；
 *  blocked/error/max-tokens/interrupted=失败族（翻白肚/检查日志）。 */
function turnOutcomeOf(data) {
  const kind = data?.reason?.kind;
  if (typeof kind === "string" && kind !== "") return kind;
  if (data?.status === "failed" || data?.error != null) return "error";
  if (data?.outcome === "failed" || data?.outcome === "stopped") return "aborted";
  if (data?.status === "completed" || data?.outcome === "completed") return "completed";
  return "unknown";
}

const FAILED_OUTCOMES = new Set(["blocked", "error", "max-tokens", "interrupted"]);

function isFailedTurnEnd(data) {
  return FAILED_OUTCOMES.has(turnOutcomeOf(data));
}

/**
 * 创建宠物语义状态机实例。
 * @param {{ now?: () => number }} [options] - 时钟注入（测试/宿主可控）；驱动视图层动画帧计数。
 * @returns {{ state: string, stateEnteredAt: number, onEvent(event: {type: string, data?: object}): { state: string, changed: boolean } }}
 */
export function createPetState({ now = Date.now } = {}) {
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
            state = SCORING_TOOL_RE.test(toolNameOf(data))
              ? "scoring"
              : "inferring";
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
    },
  };
}

/** FNV-1a 字符串哈希；用于 random 宠物的确定性 seed 选择。 */
function hashSeed(seed) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * 选择宠物皮肤。
 *
 * @param {string|undefined} pet - 配置值：皮肤 slug 或 "random"；缺省/空串回落 DEFAULT_PET（大鲸鱼，deepseek-whale）。
 * @param {string[]} pool - 可用皮肤 slug 池（镜像 assets/pets 目录；生效池由 composePetPool 合成，恒含 bundled）。
 * @param {string} seed - 确定性种子（会话/回合标识），保证重放一致。
 * @returns {string} 选中的 slug。
 * @throws 配置了池外皮肤名（含 DEFAULT_PET 不在池内的极端情况）或池为空时抛错（misconfiguration fails loud）。
 */
export function selectPet(pet, pool, seed) {
  if (!Array.isArray(pool) || pool.length === 0) {
    throw new Error("pet pool is empty; assets/pets must contain at least one pet");
  }
  const choice = pet == null || pet === "" ? DEFAULT_PET : pet;
  if (choice === "random") {
    return pool[hashSeed(String(seed ?? "")) % pool.length];
  }
  if (!pool.includes(choice)) {
    throw new Error(
      `unknown pet "${choice}"; available pets: ${pool.join(", ")}`,
    );
  }
  return choice;
}
