import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

import { SEMANTIC_STATES } from "../src/pet-state.js";
import { BUNDLED_ARTWORK } from "../src/pet-pool.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const mappings = JSON.parse(
  readFileSync(join(repoRoot, "mappings", "harness-states.json"), "utf8"),
);

const CANONICAL_ROWS = [
  "idle",
  "running-right",
  "running-left",
  "waving",
  "jumping",
  "failed",
  "waiting",
  "running",
  "review",
];

test("standardRows 与 Petdex 官方 9 标准行完全一致", () => {
  assert.deepEqual([...mappings.standardRows].sort(), [...CANONICAL_ROWS].sort());
  assert.equal(mappings.standardRows.length, 9);
});

test("每个语义状态的动画行都 ⊆ 9 标准行，且气泡文案齐全", () => {
  for (const [key, def] of Object.entries(mappings.states)) {
    const rows = [def.row, ...(def.variants ?? [])];
    for (const row of rows) {
      assert.ok(
        mappings.standardRows.includes(row),
        `state ${key} 引用了非标准行动画行 ${row}`,
      );
    }
    assert.ok(def.bubble?.zh, `state ${key} 缺少中文气泡`);
    assert.ok(def.bubble?.en, `state ${key} 缺少英文气泡`);
  }
});

test("代码中的 SEMANTIC_STATES 与映射契约 keys 完全一致（唯一契约面）", () => {
  assert.deepEqual(
    [...SEMANTIC_STATES].sort(),
    Object.keys(mappings.states).sort(),
  );
});

test("官方基准语义（done→waving、error→failed、inferring→running）与映射一致", () => {
  assert.equal(mappings.states.done.row, "waving");
  assert.equal(mappings.states.error.row, "failed");
  assert.equal(mappings.states.inferring.row, "running");
  assert.equal(mappings.states.loading.row, "waiting");
  assert.equal(mappings.states.sota.row, "jumping");
  assert.equal(mappings.states.idle.row, "idle");
});

test("每个语义状态声明合法播放帧率 fps（驱动 renderer.frameAtTime）", () => {
  for (const [key, def] of Object.entries(mappings.states)) {
    assert.ok(
      Number.isFinite(def.fps) && def.fps > 0 && def.fps <= 30,
      `state ${key} 缺少合法 fps（0 < fps ≤ 30）`,
    );
  }
});

test("BUNDLED_ARTWORK 与 assets/pets 实际 spritesheet 文件一致（防破图/防漏登记）", () => {
  const ALLOWED = ["spritesheet.webp", "spritesheet.png"];
  for (const pet of petDirs()) {
    const declared = BUNDLED_ARTWORK[pet.name];
    const existing = ALLOWED.filter((file) => existsSync(join(pet.dir, file)));
    if (declared !== undefined) {
      assert.ok(
        ALLOWED.includes(declared),
        `${pet.name} 登记了非法文件名 ${declared}（只允许 webp/png）`,
      );
      assert.ok(
        existing.includes(declared),
        `${pet.name} 登记了 ${declared} 但文件不存在 → 会渲染破图，请先提交像素图`,
      );
    } else {
      assert.equal(
        existing.length,
        0,
        `${pet.name} 已有 spritesheet（${existing.join(",")}）但未登记 BUNDLED_ARTWORK → 新皮肤不会显示`,
      );
    }
  }
});

function petDirs() {
  const petsRoot = join(repoRoot, "assets", "pets");
  assert.ok(existsSync(petsRoot), "assets/pets 目录不存在");
  const dirs = readdirSync(petsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  assert.ok(dirs.length >= 2, "random 随机池需要至少两只宠物");
  return dirs.map((name) => ({
    name,
    dir: join(petsRoot, name),
    json: JSON.parse(readFileSync(join(petsRoot, name, "pet.json"), "utf8")),
  }));
}

test("每只宠物：slug=目录名、9 状态齐全、帧规格 192×208×8×9、背景纯品红", () => {
  for (const pet of petDirs()) {
    assert.equal(pet.json.slug, pet.name, `${pet.name} slug 与目录名不一致`);
    assert.deepEqual(
      Object.keys(pet.json.states).sort(),
      [...CANONICAL_ROWS].sort(),
      `${pet.name} states 必须恰好覆盖 9 标准行`,
    );
    const rows = Object.values(pet.json.states).map((s) => s.row);
    assert.deepEqual(
      [...rows].sort(),
      [0, 1, 2, 3, 4, 5, 6, 7, 8],
      `${pet.name} 行号必须 0-8 且不重复`,
    );
    assert.equal(pet.json.frame.width, 192, `${pet.name} 帧宽`);
    assert.equal(pet.json.frame.height, 208, `${pet.name} 帧高`);
    assert.equal(pet.json.frame.columns, 8, `${pet.name} 列数`);
    assert.equal(pet.json.frame.rows, 9, `${pet.name} 行数`);
    assert.equal(
      pet.json.palette.background,
      "#FF00FF",
      `${pet.name} 背景必须纯品红`,
    );
  }
});

test("每只宠物目录含 spritesheet 占位规范说明", () => {
  for (const pet of petDirs()) {
    assert.ok(
      existsSync(join(pet.dir, "spritesheet.README.md")),
      `${pet.name} 缺少 spritesheet.README.md`,
    );
  }
});
