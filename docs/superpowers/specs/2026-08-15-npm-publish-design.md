# npm 发布基建 设计

日期：2026-08-15
状态：已批准
范围：v0.2.0 起，deepseek-harness-pets 公开发布到 npm + CI 验证流水线

## 决策

- **发布模式**：本地发布（维护者 `npm publish`），CI 只做验证不持 token（用户裁定：本机 npm login，CI 无 NPM_TOKEN）。
- **触发**：CI 在 push main / PR；release 验证在推 `v*` tag 时。
- **可见性**：public（移除 `private: true`，`publishConfig.access: "public"` 显式声明）。

## 单元

1. **`.github/workflows/ci.yml`**：Node 22 单档；`npm ci → npm test → npm run build → git diff --exit-code -- lib/client.js`（源码与预构建产物漂移门禁）。
2. **`.github/workflows/release.yml`**：`v*` tag 触发；同 CI 步骤 + `npm pack --dry-run`（发布物清单进日志供核对）；不 publish。
3. **package.json 元数据**：删 `private`；补 `repository`/`homepage`/`bugs`（github orxz/deepseek-harness-pets）与 `publishConfig`。
4. **发布 runbook**：CONTRIBUTING.md "发布流程"节——改版本 → build+test → `npm publish` → tag `vX.Y.Z` 推送（触发 release 验证）。
5. **GitHub topics**：发布后 `gh repo edit` 打 `dsh-plugin pet petdex deepseek`。

## 错误处理

- CI 漂移门禁红 = 忘记 build：本地 `npm run build` 后提交。
- publish 版本冲突：npm 拒绝，改版本重来。
- release workflow 对已发布包只验证不重复发布，无副作用。

## 测试

- push main 后 Actions CI 绿。
- `v0.2.0` tag 实测 release workflow 绿。
- `npm view deepseek-harness-pets version` 返回 0.2.0。

## YAGNI（不做）

- Node 多版本矩阵（engines ≥22 一档）。
- npm provenance。
- CI 自动 publish（token 面）。
