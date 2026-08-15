import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PET_SOURCES,
  scanPetSources,
  mergePetSources,
  resolvePetAsset,
  defaultSourceRoots,
} from "../src/pet-sources.js";

function fixtureSource(overrides = {}) {
  return {
    id: "test",
    label: "Test source",
    dir: "/nonexistent/test",
    pets: [],
    ...overrides,
  };
}

test("源优先级固定：custom > petdex > bundled", () => {
  assert.equal(PET_SOURCES[0].id, "custom");
  assert.equal(PET_SOURCES[1].id, "petdex");
  assert.equal(PET_SOURCES[2].id, "bundled");
});

test("mergePetSources：同 slug 时 custom 覆盖 petdex 覆盖 bundled", () => {
  const custom = fixtureSource({
    id: "custom",
    pets: [{ slug: "deepseek-whale", source: "custom" }],
  });
  const petdex = fixtureSource({
    id: "petdex",
    pets: [{ slug: "deepseek-whale", source: "petdex" }, { slug: "community-cat", source: "petdex" }],
  });
  const bundled = fixtureSource({
    id: "bundled",
    pets: [{ slug: "deepseek-whale", source: "bundled" }, { slug: "deepseek-octo", source: "bundled" }],
  });
  const pool = mergePetSources([bundled, petdex, custom]);
  assert.equal(pool.length, 3);
  const bySlug = Object.fromEntries(pool.map((p) => [p.slug, p]));
  assert.equal(bySlug["deepseek-whale"].source, "custom");
  assert.equal(bySlug["community-cat"].source, "petdex");
  assert.equal(bySlug["deepseek-octo"].source, "bundled");
});

test("mergePetSources：池按高优先源排序稳定（custom 在前）", () => {
  const pool = mergePetSources([
    fixtureSource({ id: "bundled", pets: [{ slug: "a", source: "bundled" }] }),
    fixtureSource({ id: "custom", pets: [{ slug: "b", source: "custom" }] }),
  ]);
  assert.equal(pool[0].slug, "b");
});

test("mergePetSources：空源列表返回空池（不抛错，fail-open）", () => {
  assert.deepEqual(mergePetSources([]), []);
});

test("无参调用 scanPetSources 使用真实默认根：bundled 源必扫到仓库内畬2只宠物（回归：undefined 覆盖默认根导致三源全空）", () => {
  const scanned = scanPetSources();
  const bundled = scanned.find((s) => s.id === "bundled");
  assert.equal(bundled.root, defaultSourceRoots().bundledRoot);
  assert.deepEqual(
    bundled.pets.map((p) => p.slug).sort(),
    ["deepseek-octo", "deepseek-whale"],
  );
});

test("scanPetSources：mock 目录扫描出宠物并标注来源与路径", () => {
  const scanned = scanPetSources({
    fs: {
      existsSync: () => true,
      readdirSync: (_dir, opts) => {
        assert.equal(opts.withFileTypes, true);
        return [
          { name: "deepseek-whale", isDirectory: () => true },
          { name: "README.md", isDirectory: () => false },
          { name: "deepseek-octo", isDirectory: () => true },
        ];
      },
    },
    bundledRoot: "/repo/assets/pets",
    petdexRoot: "/home/.petdex/pets",
    customRoot: "/home/.dsh/pets",
  });
  const custom = scanned.find((s) => s.id === "custom");
  assert.equal(custom.pets.length, 2);
  assert.deepEqual(
    custom.pets.map((p) => p.slug).sort(),
    ["deepseek-octo", "deepseek-whale"],
  );
  assert.equal(
    custom.pets.find((p) => p.slug === "deepseek-whale").dir,
    "/home/.dsh/pets/deepseek-whale",
  );
  assert.equal(custom.pets[0].source, "custom");
  // bundled root 同样被扫描
  const bundled = scanned.find((s) => s.id === "bundled");
  assert.equal(bundled.pets.length, 2);
});

test("scanPetSources：目录不存在时该源为空（fail-open）", () => {
  const scanned = scanPetSources({
    fs: {
      existsSync: (dir) => dir === "/repo/assets/pets",
      readdirSync: () => [{ name: "deepseek-whale", isDirectory: () => true }],
    },
    bundledRoot: "/repo/assets/pets",
    petdexRoot: "/missing/.petdex/pets",
    customRoot: "/missing/.dsh/pets",
  });
  assert.equal(scanned.find((s) => s.id === "custom").pets.length, 0);
  assert.equal(scanned.find((s) => s.id === "petdex").pets.length, 0);
  assert.equal(scanned.find((s) => s.id === "bundled").pets.length, 1);
});

test("scanPetSources：readdir 抛错时该源降级为空（不传播异常）", () => {
  const scanned = scanPetSources({
    fs: {
      existsSync: () => true,
      readdirSync: (dir) => {
        if (dir.includes(".dsh")) throw new Error("EACCES");
        return [{ name: "deepseek-whale", isDirectory: () => true }];
      },
    },
    bundledRoot: "/repo/assets/pets",
    petdexRoot: "/home/.petdex/pets",
    customRoot: "/home/.dsh/pets",
  });
  assert.equal(scanned.find((s) => s.id === "custom").pets.length, 0);
  assert.equal(scanned.find((s) => s.id === "bundled").pets.length, 1);
});

test("resolvePetAsset：返回首个命中源的绝对资源路径（custom 优先）", () => {
  const sources = [
    fixtureSource({ id: "custom", pets: [{ slug: "deepseek-whale", dir: "/custom/whale" }] }),
    fixtureSource({ id: "petdex", pets: [{ slug: "deepseek-whale", dir: "/petdex/whale" }] }),
    fixtureSource({ id: "bundled", pets: [{ slug: "deepseek-whale", dir: "/bundled/whale" }] }),
  ];
  const asset = resolvePetAsset(sources, "deepseek-whale");
  assert.equal(asset.dir, "/custom/whale");
  assert.equal(asset.source, "custom");
  assert.equal(asset.spritesheet, "/custom/whale/spritesheet.webp");
});

test("resolvePetAsset：未命中返回 null（由调用方决定回落 bundled 占位）", () => {
  assert.equal(resolvePetAsset([], "nobody"), null);
  const onlyBundled = [
    fixtureSource({ id: "bundled", pets: [{ slug: "deepseek-octo", dir: "/b/octo" }] }),
  ];
  assert.equal(resolvePetAsset(onlyBundled, "deepseek-whale"), null);
});
