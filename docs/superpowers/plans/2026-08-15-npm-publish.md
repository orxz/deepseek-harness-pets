# npm 发布基建 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deepseek-harness-pets v0.2.0 公开发布到 npm，配 CI 验证流水线（漂移门禁）与发布 runbook。

**Architecture:** 两个 GitHub Actions workflow（CI 验证 + release tag 验证，均不发布，npm publish 在维护者本地）+ package.json 发布元数据补全 + CONTRIBUTING 发布流程文档。发布本身是本地一次性操作，作为收尾任务执行。

**Tech Stack:** GitHub Actions（actions/checkout@v4、actions/setup-node@v4）、npm ≥10（Node 22 内置）、bash。

**Spec:** `docs/superpowers/specs/2026-08-15-npm-publish-design.md`（已批准）

## Global Constraints

- CI 一律**不持 npm token、不执行 publish**（用户裁定 B：本地发布）。
- 漂移门禁命令固定：`git diff --exit-code -- lib/client.js`（源码改动必须伴随重建产物提交）。
- Node 单档 22（engines ≥22，不做矩阵）。
- `publishConfig: {"access": "public"}`、repository 指 `github:orxz/deepseek-harness-pets`。
- workflow YAML 用简体中文注释（对齐仓库注释惯例）。
- 不做：Node 矩阵、npm provenance、CI 自动 publish（spec YAGNI 节）。
- 本仓库在 main 分支直接开发（单维护者，用户此前已裁定不走 PR 流程）；每任务一个 commit，全部推 main。
- 发布命令前必须全量测试绿 + `npm pack --dry-run` 清单核对（19 文件量级）。

---

### Task 1: CI workflow（漂移门禁）

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: 无
- Produces: `.github/workflows/ci.yml`（push main/PR 触发；Node 22；test+build+漂移门禁）。Task 2 的 release workflow 复用同一套步骤序列（直接复制展开，YAML 之间不搞复用抽象）。

- [ ] **Step 1: 写 workflow 文件**

```yaml
# CI：push main / PR 验证——测试、构建、预构建产物漂移门禁。
# 漂移门禁：lib/client.js 是随仓库分发的预构建产物，源码改动必须
# 伴随 npm run build 后的产物提交，否则用户 npm 装到旧客户端。
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      # 门禁：重建后工作树必须干净（lib/client.js 与提交版一致）
      - run: git diff --exit-code -- lib/client.js
```

- [ ] **Step 2: 本地等价验证**

Run: `npm test && npm run build && git diff --exit-code -- lib/client.js && echo GATE-OK`
Expected: 测试全绿、GATE-OK（当前 main 产物已同步）

- [ ] **Step 3: YAML 语法校验**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo YAML-OK`
Expected: YAML-OK（若本机无 pyyaml，改用 `npx --yes yaml-lint .github/workflows/ci.yml`）

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add verify workflow with prebuilt-artifact drift gate"
```

---

### Task 2: package.json 发布元数据

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: 无
- Produces: 可公开发布的 package.json（无 `private`；含 `repository`/`homepage`/`bugs`/`publishConfig`）。Task 4 的 `npm publish` 与 `npm view` 依赖此任务。

- [ ] **Step 1: 修改 package.json**

在 `"license": "MIT"` 前后补字段并删除 `"private": true` 行。修改后的相关片段（其余键不动）：

```json
{
  "name": "deepseek-harness-pets",
  "version": "0.2.0",
  "description": "DeepSeek Harness 桌宠插件：像素鲸鱼/机械章鱼随评测与回合状态在 DSH Web UI 中动起来；宠物资产兼容 Petdex 格式。",
  "type": "module",
```

（即删掉 `"private": true,` 行），并在 `"keywords"` 之前插入：

```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/orxz/deepseek-harness-pets.git"
  },
  "homepage": "https://github.com/orxz/deepseek-harness-pets#readme",
  "bugs": {
    "url": "https://github.com/orxz/deepseek-harness-pets/issues"
  },
  "publishConfig": {
    "access": "public"
  },
```

- [ ] **Step 2: 验证 JSON 与打包**

Run: `python3 -m json.tool package.json > /dev/null && npm pack --dry-run 2>&1 | grep -E "filename|total files"`
Expected: JSON 合法；tarball 名 `deepseek-harness-pets-0.2.0.tgz`；`total files: 19`

- [ ] **Step 3: 验证无 private**

Run: `node -e "const p=require('./package.json'); if ('private' in p) throw new Error('private still present'); if (p.publishConfig.access!=='public') throw new Error('access'); console.log('META-OK')"`
Expected: META-OK

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: prepare package.json for public npm publish"
```

---

### Task 3: release workflow + CONTRIBUTING runbook

**Files:**
- Create: `.github/workflows/release.yml`
- Modify: `CONTRIBUTING.md`（文末"行为准则"节之前插入"发布流程"节）

**Interfaces:**
- Consumes: Task 1 的步骤序列（复制展开）
- Produces: `v*` tag 触发的验证 workflow；CONTRIBUTING "发布流程"节（Task 4 按它执行）

- [ ] **Step 1: 写 release workflow**

```yaml
# Release 验证：推 v* tag 时跑完整验证 + 发布物清单快照。
# 不发布：npm publish 在维护者本地执行（见 CONTRIBUTING 发布流程）；
# 本 workflow 的价值是对打 tag 时刻的产物做独立环境复核。
name: Release

on:
  push:
    tags: ["v*"]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: git diff --exit-code -- lib/client.js
      # 发布物清单进日志：供人工核对（版本号/文件数/体积）
      - run: npm pack --dry-run
```

- [ ] **Step 2: CONTRIBUTING.md 插入发布流程节**

在 `## 行为准则` 之前插入：

```markdown
## 发布流程（维护者）

1. 改 `package.json` 的 `version`（semver；breaking 记得升 minor 之上的档位）。
2. 本地验证并发布（需 `npm login`）：
   ```bash
   npm run build && npm test
   npm pack --dry-run   # 核对清单（19 文件量级）
   npm publish          # 公开发布
   ```
3. 打 tag 推送（触发 Release workflow 独立复核）：
   ```bash
   git tag vX.Y.Z && git push origin main --tags
   ```
4. CI 漂移门禁红 = 忘了 `npm run build`：本地重建后提交再走一遍。

CI 不持 npm token，发布永远在本地；Release workflow 只验证不发布。
```

- [ ] **Step 3: 验证**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))" && grep -c "发布流程" CONTRIBUTING.md`
Expected: YAML 合法；`发布流程` 出现 ≥1 次

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml CONTRIBUTING.md
git commit -m "ci: add release tag verification and maintainer publish runbook"
```

---

### Task 4: 推送验证 + 首次发布 v0.2.0

**Files:**
- 无新文件（运行验证与发布）

**Interfaces:**
- Consumes: Task 1-3 全部产物
- Produces: npm 上的 `deepseek-harness-pets@0.2.0`；`v0.2.0` tag；两个 workflow 的首次绿跑记录

- [ ] **Step 1: 推送基建提交**

Run: `git push origin main`
Expected: 3 个新提交推送成功

- [ ] **Step 2: 等 CI 绿并记录**

Run: `gh run list --branch main --limit 1`
Expected: CI workflow 出现且结论 success（用 `gh run watch` 或轮询 `gh run list`，最多等 5 分钟；若需权限被拒则让用户在浏览器看 Actions 页并口头确认）

- [ ] **Step 3: 本地发布**

Run: `npm publish`
Expected: `+ deepseek-harness-pets@0.2.0`（本机已 npm login 为 orxz-bot）

- [ ] **Step 4: 验证发布**

Run: `npm view deepseek-harness-pets version`
Expected: `0.2.0`

- [ ] **Step 5: 打 tag 推送（触发 release 验证）**

```bash
git tag v0.2.0 && git push origin v0.2.0
```

Run: `gh run list --limit 1`（或浏览器确认）
Expected: Release workflow 对 v0.2.0 绿

- [ ] **Step 6: README Roadmap 勾选发布项 + 收尾提交**

README.md Roadmap 中 `- [ ] 发布到 npm 并登记 dsh-plugin topic（发布前需移除 package.json 的 "private": true）` 改为：

```markdown
- [x] 发布到 npm 并登记 `dsh-plugin` topic（v0.2.0 已发布，2026-08-15；topics: dsh-plugin/pet/deepseek/petdex）
```

```bash
git add README.md && git commit -m "docs: mark npm publish milestone complete" && git push origin main
```

---

## Self-Review 记录

- **Spec 覆盖**：CI（Task 1）、release（Task 3）、package 元数据（Task 2）、runbook（Task 3）、首次发布+验证（Task 4）、topics（已完成于计划外，Task 4 无需重复）。全覆盖。
- **占位符**：无 TBD；所有验证命令均给出期望输出。
- **一致性**：漂移门禁命令三处（ci.yml/release.yml/runbook）逐字一致 `git diff --exit-code -- lib/client.js`；tarball 名与版本号 0.2.0 贯穿；repository URL 与远端 origin 一致。
- **TDD 适配说明**：基建任务无单元测试面，每任务以"验收命令 + 期望输出"替代红绿循环；Task 4 Step 2/5 的 GitHub Actions 结果为本机不可直接断言项，fallback 为用户浏览器确认。
