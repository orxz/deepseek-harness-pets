import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_PET,
  DEFAULT_PET_POOL,
  SETTINGS_NAMESPACE,
  BUNDLED_ARTWORK,
  composePetPool,
} from "../src/pet-pool.js";

test("DEFAULT_PET 为 deepseek-whale（默认大鲸鱼），且在 DEFAULT_PET_POOL 内", () => {
  assert.equal(DEFAULT_PET, "deepseek-whale");
  assert.ok(DEFAULT_PET_POOL.includes(DEFAULT_PET));
});

test("DEFAULT_PET_POOL 与 SETTINGS_NAMESPACE 为稳定契约", () => {
  assert.deepEqual([...DEFAULT_PET_POOL], ["deepseek-whale", "deepseek-octo"]);
  assert.equal(SETTINGS_NAMESPACE, "deepseek-harness-pets");
});

test("composePetPool：按参数顺序合并去重（先到先得）", () => {
  assert.deepEqual(
    composePetPool(["custom-cat", "deepseek-whale"], ["deepseek-whale", "pet-dog"]),
    ["custom-cat", "deepseek-whale", "pet-dog"],
  );
});

test("composePetPool：过滤非字符串与空串（脏数据不入池）", () => {
  assert.deepEqual(
    composePetPool(["a", 42, null, "", "  ", "b", undefined, {}, ["c"]]),
    ["a", "b"],
  );
});

test("composePetPool：跳过非数组入参；bundled 由调用方显式追加兜底", () => {
  assert.deepEqual(composePetPool(undefined, null, ["x"]), ["x"]);
  // Client 的实际用法：设置镜像 pets ∪ cordis.yml pets ∪ bundled —— 过期快照藏不住内置皮肤
  assert.deepEqual(
    composePetPool(["stale-only"], undefined, DEFAULT_PET_POOL),
    ["stale-only", "deepseek-whale", "deepseek-octo"],
  );
});

test("composePetPool：全部入参为空时返回空数组（空池语义交由 selectPet fail loud）", () => {
  assert.deepEqual(composePetPool(), []);
  assert.deepEqual(composePetPool([], undefined), []);
});

test("BUNDLED_ARTWORK 为冻结对象（登记项与 assets 文件的一致性由 mappings.test.js 锁定）", () => {
  assert.ok(Object.isFrozen(BUNDLED_ARTWORK));
  for (const [slug, file] of Object.entries(BUNDLED_ARTWORK)) {
    assert.equal(typeof slug, "string");
    assert.ok(["spritesheet.webp", "spritesheet.png"].includes(file), `${slug}: ${file}`);
  }
});
