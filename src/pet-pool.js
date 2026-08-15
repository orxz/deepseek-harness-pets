/**
 * pet-pool.js — 宠物皮肤池唯一事实源（Host 设置 schema 与 Client 选皮共用）。
 * 镜像 assets/pets/ 目录；新增皮肤时同步登记（或经 cordis.yml 的 pets 配置覆盖）。
 */

export const DEFAULT_PET_POOL = Object.freeze([
  "deepseek-whale",
  "deepseek-octo",
]);

/** 默认宠物：DeepSeek 标志性大鲸鱼（用户定调）；random 仍是可选值，但不再是缺省。 */
export const DEFAULT_PET = "deepseek-whale";

/** dsh 设置命名空间：Host 入口注册，Client 入口按此读取。 */
export const SETTINGS_NAMESPACE = "deepseek-harness-pets";

/**
 * 合成 Client 侧生效皮肤池：按参数顺序去重合并（先到先得），
 * 调用方显式追加 DEFAULT_PET_POOL 兑底 —— 设置镜像里过期的 pets 快照
 * 只会多出幻觉条目（渲染占位块），永远不会藏住随包分发的内置皮肤
 * （见 docs/architecture/evidence.md #21，test/pet-pool.test.js 锁定）。
 *
 * @param {...(string[]|undefined)} slugLists
 * @returns {string[]}
 */
export function composePetPool(...slugLists) {
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

/**
 * bundled 皮肤的 spritesheet 登记表：slug → 随包分发的图文件名。
 * 只登记已真实提交的图（当前两张均为占位待补，故为空）；
 * test/mappings.test.js 强制校验登记项与 assets/pets 实际文件一致：
 * 登记了但文件不存在 → 会渲染破图；文件已提交但未登记 → 新皮肤永远不显示。
 */
export const BUNDLED_ARTWORK = Object.freeze({
  // "deepseek-whale": "spritesheet.webp",
  // "deepseek-octo": "spritesheet.png",
});
