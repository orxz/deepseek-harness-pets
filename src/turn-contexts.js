/**
 * turn-contexts.js — 有界 turn 上下文注册表（纯逻辑，零依赖）。
 *
 * 解决直接用 Map 的无限增长问题：终态 turn 的上下文按容量上限淘汰
 * （最旧终态先淘汰；活动上下文绝不淘汰，宁超容量——不打断进行中的 turn）。
 * 代价：被淘汰 turn 的宠物卡在聊天流重渲染时消失（可接受，见 docs/architecture/evidence.md #21）。
 *
 * 注：update 的归并键就是 durable 事件自带的 turn id（真实契约：所有
 * turn/step/tool 事件均携带 `turn: number`）；引擎契约禁止把 update 归并到
 * "最近的未完成 Context"（cookbook 第 1 节），孤儿事件一律由调用方忽略。
 */

/**
 * @param {object} [options]
 * @param {number} [options.limit=64] - 注册表容量上限（仅淘汰终态条目）。
 * @param {(entry: any) => boolean} [options.isTerminal] - 终态判定（注入，避免本模块耦合宠物语义）。
 * @returns {{
 *   size: number,
 *   has(id: string): boolean,
 *   get(id: string): any|null,
 *   set(id: string, entry: any): void,
 * }}
 */
export function createTurnContextRegistry({
  limit = 64,
  isTerminal = () => false,
} = {}) {
  const contexts = new Map();

  /** 超限时按插入序（最旧优先）淘汰终态条目；全是活动条目时停止（不淘汰活动上下文）。 */
  function evictOverflow() {
    if (typeof limit !== "number" || !(limit >= 1) || contexts.size <= limit) {
      return;
    }
    for (const id of [...contexts.keys()]) {
      if (contexts.size <= limit) break;
      if (isTerminal(contexts.get(id))) contexts.delete(id);
    }
  }

  return {
    get size() {
      return contexts.size;
    },
    has: (id) => contexts.has(id),
    get: (id) => contexts.get(id) ?? null,

    set(id, entry) {
      // Map 对已有 key 的 set 保留原插入位置 → 淘汰顺序稳定（FIFO）。
      contexts.set(id, entry);
      evictOverflow();
    },
  };
}
