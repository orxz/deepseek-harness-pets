/**
 * renderer.js — spritesheet 帧播放的纯计算与视图构建（零依赖，React 由宿主经参数 h 注入）。
 *
 * 帧规格即 Petdex 标准：8 列 × 9 行、每帧 192×208；行序 idle..review 与 pet.json `states.row` 对应。
 */

/** Petdex v1 标准帧规格（与各宠物 pet.json 的 frame 字段一致）。 */
export const STANDARD_FRAME = Object.freeze({
  width: 192,
  height: 208,
  columns: 8,
  rows: 9,
});

/**
 * 按流逝时间计算当前帧序号（帧驱动：状态进入时刻 + fps → frameIndex）。
 *
 * @param {number} elapsedMs - 自进入当前状态以来的毫秒数。
 * @param {object} [options]
 * @param {number} [options.fps=6] - 每秒帧数（来自 mappings/harness-states.json 的 states.<key>.fps）。
 * @param {number} [options.columns] - 列数（缺省 STANDARD_FRAME.columns），结果按列数回绕。
 * @returns {number} 帧序号；非正/非法输入一律返回 0（fail-open，永不抛错）。
 */
export function frameAtTime(
  elapsedMs,
  { fps = 6, columns = STANDARD_FRAME.columns } = {},
) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !(fps > 0)) return 0;
  return Math.floor(elapsedMs / (1000 / fps)) % columns;
}

/**
 * 计算某动画行第 frameIndex 帧的样式（background-position 播帧）。
 *
 * @param {object} input
 * @param {number} input.row - 动画行号 0-8。
 * @param {number} input.frameIndex - 帧序号（自动按列数取模）。
 * @param {object} [input.frame] - 帧规格，缺省用 STANDARD_FRAME。
 * @returns {{ width: string, height: string, backgroundSize: string, backgroundPosition: string }}
 */
export function frameStyle({ row, frameIndex, frame = STANDARD_FRAME }) {
  const index = ((frameIndex % frame.columns) + frame.columns) % frame.columns;
  return {
    width: `${frame.width}px`,
    height: `${frame.height}px`,
    backgroundSize: `${frame.width * frame.columns}px ${frame.height * frame.rows}px`,
    backgroundPosition: `-${index * frame.width}px -${row * frame.height}px`,
  };
}

/**
 * 取语义状态的气泡文案。
 *
 * @param {{ row: string, bubble: { zh: string, en: string } }} stateDef - mappings.states[semanticState]。
 * @param {"zh"|"en"} [locale]
 * @returns {string}
 */
export function bubbleText(stateDef, locale = "zh") {
  return stateDef?.bubble?.[locale] ?? stateDef?.bubble?.zh ?? "";
}

/**
 * 构建宠物卡片虚拟节点（供 DSH Web UI Chat 流渲染）。
 *
 * @param {Function} h - 宿主注入的 createElement（React）。
 * @param {object} input
 * @param {string} input.petSlug - 皮肤 slug。
 * @param {string} input.semanticState - 语义状态 key。
 * @param {object} input.stateDef - mappings.states[semanticState]。
 * @param {number} input.frameIndex - 当前帧序号。
 * @param {boolean} [input.busy] - 是否进行中（终态 false）。
 * @param {string|null} [input.spritesheetUrl] - 精灵图 URL；bundled 皮肤有相对路径，
 *   custom/petdex 外部源在 Host 静态服务就绪前传 null → 渲染占位块（见 Roadmap）。
 * @returns {object} 虚拟节点。
 */
export function petCardView(
  h,
  { petSlug, semanticState, stateDef, frameIndex, busy = false, spritesheetUrl = null },
) {
  // URL 统一 percent-encode 后再放入带引号的 url("...")：slug/路径含空格、引号等
  // 特殊字符时既不破图，也堵住经 spritesheetUrl 注入 CSS 的 theoretical 途径。
  const safeUrl = encodeURI(String(spritesheetUrl));
  const sprite = spritesheetUrl
    ? h("div", {
        "data-pet-art": "sprite",
        title: petSlug,
        className: "dsh-pet-sprite",
        style: {
          ...spriteAnimStyle(stateDef, frameIndex),
          backgroundImage: `url("${safeUrl}")`,
        },
      })
    : h(
        "div",
        {
          "data-pet-art": "placeholder",
          title: `${petSlug}（像素图暂不可用：内置皮肤待社区提交 spritesheet，外部源皮肤待 Host 静态服务）`,
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
            textAlign: "center",
          },
        },
        petSlug,
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
        padding: "4px 8px",
      },
    },
    sprite,
    h(
      "span",
      { style: { fontSize: "13px", opacity: busy ? 1 : 0.75 } },
      bubbleText(stateDef),
    ),
  );
}

function rowOf(stateDef) {
  return ROW_INDEX_BY_NAME[stateDef?.row] ?? 0;
}
// 注：rowOf 供外部调试/诊断用途保留；spriteAnimStyle 内部直接查表。

/** 标准动画行名 → pet.json 行号（行序：idle, running-right, running-left, waving, jumping, failed, waiting, running, review）。 */
export const ROW_INDEX_BY_NAME = Object.freeze({
  idle: 0,
  "running-right": 1,
  "running-left": 2,
  waving: 3,
  jumping: 4,
  failed: 5,
  waiting: 6,
  running: 7,
  review: 8,
});

/**
 * 生成全郠9 行的 CSS 帧动画（纯函数，浏览器/Node 均可调用）：
 * 每行一条 @keyframes 用 steps(columns) 循环播放该行动画，
 * 配合 .dsh-pet-sprite 上由 CSS 变量（--dsh-pet-row / --dsh-pet-fps）驱动的 animation。
 *
 * 为什么用 CSS 而非事件驱动：dsh 的 publication: 'animation-frame' 只是把
 * 状态变更合并到帧节拍，不会在没有新事件时重调 buildViewNode；CSS 动画让宠物
 * 在两次事件之间也持续运动，且零引擎开销。
 *
 * @param {object} [frame] - 帧规格，缺省 STANDARD_FRAME。
 * @returns {string} 可注入 <style> 的 CSS 文本（含每行 keyframes 与基类样式）。
 */
export function buildAnimationCss(frame = STANDARD_FRAME) {
  const { width, height, columns, rows } = frame;
  const keyframes = Array.from({ length: rows }, (_, row) => {
    const y = `-${row * height}px`;
    return [
      `@keyframes dsh-pet-row-${row} {`,
      `  from { background-position: 0 ${y}; }`,
      `  to   { background-position: -${columns * width}px ${y}; }`,
      `}`,
    ].join("\n");
  }).join("\n");
  return [
    keyframes,
    ".dsh-pet-sprite {",
    "  image-rendering: pixelated;",
    "  background-repeat: no-repeat;",
    "}",
  ].join("\n");
}

/** 某语义状态的 sprite 内联样式：行偏移 + 该状态 fps 驱动的 CSS 动画。 */
function spriteAnimStyle(stateDef, frameIndex) {
  const row = ROW_INDEX_BY_NAME[stateDef?.row] ?? 0;
  const style = frameStyle({ row, frameIndex });
  return {
    ...style,
    animationName: `dsh-pet-row-${row}`,
    // duration = 列数 / fps：fps 高的行（如 jumping 10fps）转得更快。
    animationDuration: `${STANDARD_FRAME.columns / (stateDef?.fps || 6)}s`,
    animationTimingFunction: `steps(${STANDARD_FRAME.columns})`,
    animationIterationCount: "infinite",
  };
}
