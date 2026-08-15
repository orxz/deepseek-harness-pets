# 贡献指南

感谢为 deepseek-harness-pets 贡献代码、像素画或新皮肤！本项目是针对 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 的社区桌宠插件（非官方）。

## 快速上手

```bash
git clone https://github.com/<your-fork>/deepseek-harness-pets.git
cd deepseek-harness-pets
npm test          # node:test，零依赖，Node.js >= 22
```

测试即验收线：状态机（`test/pet-state.test.js`）与映射/资产一致性（`test/mappings.test.js`）必须全绿再提 PR。

## 贡献代码

- 约定：ESM（`"type": "module"`）、零运行时依赖（React 等由 dsh 宿主提供）、Node 内置 `node:test` 测试。
- 新行为先写测试（红）再实现（绿）；语义状态 key 必须与 `mappings/harness-states.json` 的 `states` keys 同步增删（`test/mappings.test.js` 会强制校验）。
- 事件消费保持 fail-open：未知事件类型不得改变状态、不得抛错（兼容 dsh developer preview 演进）。
- 配置项一律走 cordis.yml 的 Config 字段，不做硬编码开关。
- PR 前自检：`node --test` 全绿、`node --check src/*.js`、JSON 改动过 `python3 -m json.tool`。

## 贡献皮肤（像素画）

**皮肤目录有三处，优先级 custom > petdex > bundled**（同名 slug 高优先源覆盖）：

| 源 | 目录 | 适用 |
|---|---|---|
| custom（最高） | `~/.dsh/pets/<slug>/`（`$DSH_HOME/pets`） | 个人自用/覆盖实验，无需提 PR |
| petdex | `~/.petdex/pets/<slug>/` | `npx petdex install` 落地的社区皮肤 |
| bundled | 本仓库 `assets/pets/<slug>/` | 给本仓库贡献内置皮肤（提 PR） |

**内置皮肤（bundled）贡献流程**，每只宠物 = 一个标准 Petdex 宠物包：

1. **生成像素图**：推荐用 Codex 的 `hatch-pet` skill（文字描述或参考图即可生成整套动画），或手绘。
2. **帧规范（硬性）**：
   - `spritesheet.webp`（或 `.png`）：8 列 × 9 行，每帧 192×208 px，整图 1536×1872 px；
   - 行序自上而下：`idle, running-right, running-left, waving, jumping, failed, waiting, running, review`；
   - 背景纯品红 `#FF00FF`（运行时自动抠透明，边缘勿抗锯齿混色）。
3. **元数据**：复制任一现有 `pet.json` 修改；`slug` 必须等于目录名；`states` 必须恰好覆盖 9 标准行且行号 0–8 不重复。
4. **登记随机池与像素图**：在 `src/pet-pool.js` 的 `DEFAULT_PET_POOL` 加入新 slug（Host 设置 schema 与 Client 选皮共用此唯一事实源）；已提交 spritesheet 的皮肤还需在 `BUNDLED_ARTWORK` 登记（登记与文件一致性由 `test/mappings.test.js` 强制）。
5. **提交 PR**：标题注明 `[pet] <slug>`。

参考各宠物目录下的 `spritesheet.README.md` 有逐行动画语义说明（鲸鱼喷水=加载、下潜=推理、跃出=SOTA……新皮肤可以有自己的创意语义，但动画行只能取 9 标准行）。

## 上架 Petdex 社区画廊（可选）

```bash
npx petdex login
npx petdex submit ./assets/pets/<slug>/
```

审核约 24 小时；投稿保留作者署名，版权归你（在 `pet.json` 的 `license` 字段声明）。

## 分支与提交

- 功能分支命名：`feature/<topic>`、皮肤：`pet/<slug>`、修复：`fix/<topic>`。
- 不在 main 直接提交；提交信息用祈使句短句（如 `add deepseek-octo pet assets`）。

## 发布流程（维护者）

发布由 GitHub Actions 自动完成（npm trusted publishing：orxz/deepseek-harness-pets/release.yml，零 token、2FA 豁免）。维护者只需：

1. 改 `package.json` 的 `version`（semver；breaking 记得升 minor 之上的档位），提交并推 main。
2. 本地预验（与 CI 同套）：
   ```bash
   npm run build && npm test
   git diff --exit-code -- lib/client.js   # 漂移门禁，红了就提交重建产物
   ```
3. 打 tag 并精确推送（触发 Release workflow 验证+发布）：
   ```bash
   git tag vX.Y.Z && git push origin main vX.Y.Z
   ```
4. Actions 页确认 Release 绿；`npm view deepseek-harness-pets version` 应返回新版本。

CI 漂移门禁红 = 忘了 `npm run build`：本地重建后提交再走一遍。不要用 `--tags` 批量推（防杂散 tag 误触发发布）。

## 行为准则

友善、对事不对人；商标注意：仓库与文档中不得暗示 DeepSeek 官方背书。
