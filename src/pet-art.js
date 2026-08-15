/**
 * pet-art.js — 悬浮窗艺术层 v1：官方 DeepSeek 鲸鱼 SVG（用户提供，seeklogo 单 path）
 * + 语义状态 → CSS transform 动画表。纯函数零依赖；spritesheet 就绪后在此替换为实现。
 */

/** 官方鲸鱼标志 path data（viewBox 0 0 300 300，勿改动）。 */
export const WHALE_SVG_PATH =
  "M195,166.1c-2.4,1-4.9,1.8-7.2,1.9-3.6.2-7.6-1.3-9.7-3.1-3.3-2.8-5.7-4.4-6.7-9.2-.4-2.1-.2-5.3.2-7.2.9-4-.1-6.5-2.9-8.9-2.3-1.9-5.2-2.4-8.4-2.4s-2.3-.5-3.1-1c-1.3-.7-2.4-2.3-1.4-4.4.3-.7,2-2.3,2.3-2.5,4.3-2.5,9.4-1.7,14,.2,4.3,1.7,7.5,5,12.2,9.5,4.8,5.5,5.6,7,8.4,11.1,2.1,3.2,4.1,6.6,5.4,10.4.8,2.4-.2,4.3-3.1,5.5ZM157.1,146.7c0-2.1,1.7-3.7,3.8-3.7s.9.1,1.3.2c.5.2,1,.5,1.4.9.7.7,1.1,1.6,1.1,2.6,0,2.1-1.7,3.8-3.8,3.8s-3.7-1.7-3.7-3.8ZM144.9,225.2c-25.5-20-37.8-26.6-42.9-26.3-4.8.3-3.9,5.7-2.8,9.3,1.1,3.5,2.5,5.9,4.5,9,1.4,2,2.3,5.1-1.4,7.3-8.2,5.1-22.5-1.7-23.1-2-16.6-9.8-30.5-22.7-40.2-40.3-9.5-17-14.9-35.2-15.8-54.6-.2-4.7,1.1-6.4,5.8-7.2,6.2-1.1,12.5-1.4,18.7-.5,26,3.8,48.1,15.4,66.7,33.8,10.6,10.5,18.6,23,26.8,35.2,8.8,13,18.2,25.4,30.2,35.5,4.3,3.6,7.6,6.3,10.9,8.2-9.8,1.1-26.1,1.3-37.2-7.5ZM293.2,60.4c-3.1-1.5-4.4,1.4-6.3,2.8-.6.5-1.1,1.1-1.7,1.7-4.5,4.8-9.8,8-16.8,7.6-10.1-.6-18.7,2.6-26.4,10.4-1.6-9.5-7-15.2-15.2-18.9-4.3-1.9-8.6-3.8-11.6-7.9-2.1-2.9-2.7-6.2-3.7-9.4-.7-2-1.3-3.9-3.6-4.3-2.4-.4-3.4,1.7-4.3,3.4-3.8,7-5.3,14.6-5.2,22.4.3,17.5,7.7,31.5,22.4,41.4,1.7,1.1,2.1,2.3,1.6,3.9-1,3.4-2.2,6.7-3.3,10.1-.7,2.2-1.7,2.7-4,1.7-8.1-3.4-15-8.4-21.2-14.4-10.4-10.1-19.9-21.2-31.6-30-2.8-2.1-5.5-4-8.4-5.7-12-11.7,1.6-21.3,4.7-22.4,3.3-1.2,1.2-5.3-9.5-5.2-10.6,0-20.3,3.6-32.8,8.4-1.8.7-3.7,1.2-5.7,1.7-11.3-2.1-22.9-2.6-35.1-1.2-23,2.5-41.4,13.4-54.8,32C4.7,110.7.9,136,5.6,162.4c4.9,27.8,19.1,50.9,41,68.9,22.6,18.7,48.7,27.8,78.5,26.1,18.1-1,38.2-3.5,60.9-22.7,5.7,2.8,11.7,4,21.7,4.8,7.7.7,15.1-.4,20.8-1.5,9-1.9,8.4-10.2,5.1-11.7-26.3-12.3-20.5-7.3-25.7-11.3,13.3-15.8,33.5-32.2,41.3-85.4.6-4.2.1-6.9,0-10.3,0-2.1.4-2.9,2.8-3.1,6.6-.8,13-2.6,18.8-5.8,17-9.3,23.9-24.6,25.5-42.9.2-2.8,0-5.7-3-7.2Z";

/** 悬浮窗主体默认边长（px）。 */
export const PET_SIZE = 96;

/**
 * 语义状态/瞬态 → CSS transform 动画。name 对应 buildOverlayAnimationCss
 * 生成的 keyframes；duration 调性：高唤醒状态更快。
 */
export const OVERLAY_ANIMATIONS = Object.freeze({
  idle: { name: "dsh-pet-ov-idle", duration: "3s" },
  loading: { name: "dsh-pet-ov-loading", duration: "1.2s" },
  inferring: { name: "dsh-pet-ov-swim", duration: "0.6s" },
  scoring: { name: "dsh-pet-ov-scoring", duration: "2s" },
  done: { name: "dsh-pet-ov-done", duration: "1s" },
  sota: { name: "dsh-pet-ov-jump", duration: "1.2s" },
  error: { name: "dsh-pet-ov-error", duration: "0.8s", filter: "grayscale(0.8)" },
  click: { name: "dsh-pet-ov-jump", duration: "0.9s" },
  fidget: { name: "dsh-pet-ov-wiggle", duration: "1.5s" },
});

/** 点击互动的开心文案池。 */
export const CLICK_BUBBLES = Object.freeze(["好耶！", "收到！", "咕噜~", "扑通！"]);

/** 随机闲置小动作的文案池。 */
export const FIDGET_BUBBLES = Object.freeze(["喷个水~", "游两圈~", "小睡片刻…"]);

/** 语义状态 key 表（fail-open 回落用）。 */
const KNOWN = new Set(Object.keys(OVERLAY_ANIMATIONS));

/**
 * 生成悬浮窗动画 CSS：每个动画一条 keyframes + 基类。
 * 纯文本拼装，浏览器/Node 均可调用（沿用 renderer.js 的 <style> 注入模式）。
 */
export function buildOverlayAnimationCss() {
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
    "}",
  ].join("\n");
}

/**
 * 选择某快照的动画内联样式。瞬态 > 语义状态；未知状态回落 idle（fail-open）。
 *
 * @param {{ semanticState: string, transient: string|null }} snap
 * @returns {{ animationName: string, animationDuration: string, animationIterationCount: string, filter?: string }}
 */
export function overlayAnimStyle({ semanticState, transient }) {
  const key =
    (transient != null && KNOWN.has(transient) ? transient : null) ??
    (KNOWN.has(semanticState) && semanticState !== "click" && semanticState !== "fidget"
      ? semanticState
      : "idle");
  const anim = OVERLAY_ANIMATIONS[key];
  const style = {
    animationName: anim.name,
    animationDuration: anim.duration,
    animationIterationCount: "infinite",
  };
  if (anim.filter != null) style.filter = anim.filter;
  return style;
}

/**
 * 气泡文案：悬停 > 瞬态互动 > 语义状态（与 renderer.js bubbleText 的 zh/en 兼容）。
 *
 * @param {{ stateDef?: { bubble?: { zh?: string, en?: string } }, transient: string|null, hovered: boolean }} input
 * @returns {string}
 */
export function bubbleFor({ stateDef, transient, hovered }) {
  if (hovered) return "嗯？";
  if (transient === "click") return CLICK_BUBBLES[0];
  if (transient === "fidget") return FIDGET_BUBBLES[0];
  return stateDef?.bubble?.zh ?? stateDef?.bubble?.en ?? "";
}
