/**
 * pet-sources.js — 皮肤来源解析（纯逻辑，fs 经参数注入便于测试）。
 *
 * 优先级契约（用户定调）：自定义源 custom > 第三方源 petdex > 内置源 bundled。
 * 同 slug 时高优先源覆盖低优先源；某源目录缺失或不可读时降级为空，绝不阻断（fail-open）。
 */

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/** 源优先级顺序即数组顺序：custom > petdex > bundled。 */
export const PET_SOURCES = Object.freeze([
  {
    id: "custom",
    label: "自定义皮肤（~/.dsh/pets）",
    description: "用户自放或 hatch-pet 生成的皮肤，最高优先级，可覆盖任何同名皮肤",
  },
  {
    id: "petdex",
    label: "Petdex 社区源（~/.petdex/pets）",
    description: "npx petdex install 落地的社区皮肤（petdex.dev 画廊）",
  },
  {
    id: "bundled",
    label: "内置皮肤（本仓库 assets/pets）",
    description: "随插件分发的官方皮肤（deepseek-whale / deepseek-octo）",
  },
]);

const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** 各源默认根目录；DSH_HOME 存在时 custom 源随之迁移。 */
export function defaultSourceRoots(env = process.env, home = homedir()) {
  const dshHome = env.DSH_HOME && env.DSH_HOME !== "" ? env.DSH_HOME : join(home, ".dsh");
  return {
    customRoot: join(dshHome, "pets"),
    petdexRoot: join(home, ".petdex", "pets"),
    bundledRoot: join(PLUGIN_ROOT, "assets", "pets"),
  };
}

/**
 * 扫描三个源目录，返回按优先级排序的源数组（每源含 pets 列表）。
 * 目录缺失或读取抛错 → 该源 pets 为空数组（fail-open，不传播异常）。
 *
 * @param {object} [input]
 * @param {object} [input.fs] - 注入的 fs（默认 node:fs）。
 * @param {string} [input.bundledRoot] / [input.petdexRoot] / [input.customRoot]
 * @returns {Array<{id: string, label: string, root: string, pets: Array<{slug: string, dir: string, source: string}>}>}
 */
export function scanPetSources(input = {}) {
  const fs = input.fs ?? { existsSync, readdirSync };
  // 仅当调用方显式传入时覆盖默认根（无参调用的 undefined 不得清空三源）。
  const defaults = defaultSourceRoots();
  const roots = {
    bundledRoot: input.bundledRoot ?? defaults.bundledRoot,
    petdexRoot: input.petdexRoot ?? defaults.petdexRoot,
    customRoot: input.customRoot ?? defaults.customRoot,
  };
  const rootById = {
    custom: roots.customRoot,
    petdex: roots.petdexRoot,
    bundled: roots.bundledRoot,
  };
  return PET_SOURCES.map((meta) => {
    const root = rootById[meta.id];
    const pets = listPetDirs(fs, root).map((slug) => ({
      slug,
      dir: join(root, slug),
      source: meta.id,
    }));
    return { ...meta, root, pets };
  });
}

function listPetDirs(fs, root) {
  if (typeof root !== "string" || root === "") return [];
  try {
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    // 权限/IO 异常降级为空源；皮肤可选功能绝不阻断宿主。
    return [];
  }
}

/**
 * 合并多源为皮肤池：按源优先级（custom > petdex > bundled）排序后按 slug 去重，
 * 高优先源覆盖低优先源；池内 custom 皮肤排在最前。
 *
 * @param {Array<{id: string, pets: Array}>} sources - 任意顺序的源数组。
 * @returns {Array<{slug: string, dir: string, source: string}>}
 */
export function mergePetSources(sources) {
  const byId = new Map((sources ?? []).map((source) => [source.id, source]));
  const ordered = [...PET_SOURCES]
    .map((meta) => byId.get(meta.id))
    .filter((source) => source != null);
  const seen = new Set();
  const pool = [];
  for (const source of ordered) {
    for (const pet of source.pets ?? []) {
      if (seen.has(pet.slug)) continue;
      seen.add(pet.slug);
      pool.push(pet);
    }
  }
  return pool;
}

/**
 * 按源优先级解析某皮肤的实际资产位置。
 *
 * @param {Array<{id: string, pets: Array}>} sources - 任意顺序的源数组。
 * @param {string} slug
 * @returns {{slug: string, dir: string, source: string, spritesheet: string} | null}
 */
export function resolvePetAsset(sources, slug) {
  const byId = new Map((sources ?? []).map((source) => [source.id, source]));
  for (const meta of PET_SOURCES) {
    const source = byId.get(meta.id);
    const hit = (source?.pets ?? []).find((pet) => pet.slug === slug);
    if (hit != null) {
      return {
        ...hit,
        source: hit.source ?? meta.id,
        spritesheet: join(hit.dir, "spritesheet.webp"),
      };
    }
  }
  return null;
}
