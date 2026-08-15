/**
 * host.js — dsh Host 侧入口：把宠物选择注册为用户设置（设置面板可直接改）。
 *
 * 采用官方消费者封装 installSettingsSection（packages/settings/settings/src/index.ts）：
 * - 注册命名空间后，`pet` 字段出现在 dsh 配置面（设置 UI），用户改动持久化到设置文档；
 * - 解析层级 = schema 默认（deepseek-whale，标志性大鲸鱼）→ 本插件 cordis.yml entry（base）→ 用户设置文档；
 * - settings 服务未挂载时整个注册不运行，插件照常以 cordis.yml 组合工作（fail-open）。
 *
 * 证据：dsh-settings README + 源码（installSettingsSection / SettingsSectionHooks）；
 * schema 库为 @deepseek-ai/schemastery（schemastery，枚举 = z.union([...])）。
 * 已知限制：schemastery 版本与 vendored rescoped 包名以实机为准（见 README 故障排查）。
 */

import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";

import { scanPetSources, mergePetSources } from "./pet-sources.js";
import { DEFAULT_PET, DEFAULT_PET_POOL, SETTINGS_NAMESPACE } from "./pet-pool.js";

export const name = "deepseek-harness-pets-host";

/**
 * 构建设置 schema：pet 枚举 = random + 三源合并池（custom > petdex > bundled，同 slug 高优先源覆盖）。
 * 池为空时兜底 DEFAULT_PET_POOL，保证设置面板永远可选。
 */
function buildSchema(pool) {
  // 兑底用 pet-pool.js 的 DEFAULT_PET_POOL（唯一事实源），不再硬编码皮肤名单。
  const effectivePool = pool.length > 0 ? pool : [...DEFAULT_PET_POOL];
  return z.object({
    pet: z
      .union(["random", ...effectivePool])
      .default(DEFAULT_PET)
      .description(
        "Pet skin: defaults to deepseek-whale; 'random' picks per turn id; or a specific slug (custom > petdex > bundled priority)",
      ),
    pets: z
      .array(String)
      .default([])
      .description(
        "Derived pet pool, re-scanned on every Host start; advanced users may pin it, " +
          "stale entries only render placeholders and never hide bundled pets",
      ),
  });
}

/** 当前生效的解析值与源扫描结果（诊断/未来 Host 侧消费）。 */
export const hostState = { pet: undefined, pool: [], sources: [] };

/** 幂等标记：Host 入口重复挂载时不重复注册设置节。 */
const applyState = { applied: false };

/**
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {{ pet?: "deepseek-whale"|"deepseek-octo"|"random", pets?: string[] }} [config] 默认 deepseek-whale（大鲸鱼）
 */
export function apply(ctx, config = {}) {
  if (applyState.applied) return;
  applyState.applied = true;

  // 三源扫描：custom(~/.dsh/pets 或 $DSH_HOME/pets) > petdex(~/.petdex/pets) > bundled(assets/pets)。
  const sources = scanPetSources();
  const pool = mergePetSources(sources).map((pet) => pet.slug);
  hostState.sources = sources;
  hostState.pool = pool;

  const entry = {
    pet: typeof config.pet === "string" && config.pet !== "" ? config.pet : DEFAULT_PET,
    pets: pool.length > 0 ? pool : [...DEFAULT_PET_POOL],
  };
  installSettingsSection(
    ctx,
    settingsNamespace(SETTINGS_NAMESPACE),
    buildSchema(pool),
    entry, {
    setSource(current) {
      const resolved = current() ?? entry;
      hostState.pet = resolved.pet;
      hostState.pool = Array.isArray(resolved.pets) && resolved.pets.length > 0 ? resolved.pets : entry.pets;
    },
    onChange() {
      // 值变化无需 Host 侧动作：Client 经设置镜像（settings/updated，client-safe 类型）
      // 在下一个 turn 应用新选择；turn 中途不换皮以保证重放确定性。
    },
  });
}
