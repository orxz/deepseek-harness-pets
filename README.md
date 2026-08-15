# deepseek-harness-pets

> 让 DeepSeek Harness 的状态动起来——官方原生 dsh 桌宠插件。

本项目是一个**符合 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 官方原生安装要求的插件**：按官方 bundle/profile 机制安装后，一只鲸鱼（官方 DeepSeek Whale SVG，v0.2 艺术层）会常驻 DSH Web UI 的**右下角悬浮窗**（`shell.overlay` 插槽，不占用聊天流），随你的评测与回合状态实时换动作、弹气泡——像 Codex 桌宠一样，但零外部依赖。

宠物可通过 cordis.yml 一行配置**切换或随机**；宠物资产采用 [Petdex](https://github.com/crafter-station/petdex) 标准格式（`pet.json` + 8×9 spritesheet），将来可直接复用到 Petdex 桌面悬浮端或提交到 petdex.dev 社区画廊。

> 效果演示：（待像素图就绪后补 GIF——见 [皮肤创作指南](#-皮肤创作指南)）

---

> **免责声明**：本项目是社区驱动的非官方项目，与 DeepSeek（深度求索）无隶属关系。"DeepSeek" 是 DeepSeek AI 的注册商标，此处仅作主题致敬。
>
> **包名区分**：dsh 官方为 npm 包 `@deepseek-ai/dsh`（Node.js）。PyPI 上的 `deepseek-harness` 是与本插件无关的第三方 Python 库，安装时请勿混淆。

## 核心特性

- **官方原生安装**：标准 dsh bundle（`package.json` 的 `dsh.bundle.patch` + `cordis.patch.yml`），无 fork、无补丁宿主。
- **右下角常驻悬浮窗**：宠物浮在 Web UI 右下角（`shell.overlay` root 域插槽，跨会话常驻，不占聊天流），基于官方 DeepSeek 鲸鱼 SVG，随回合状态实时换 CSS 动画。
- **拟真互动四项**：**点击**（跃起 + 随机开心文案，~1.5s 回落）、**悬停**（放大微倾 + 气泡"嗯？"）、**随机闲置**（idle 时每 20–60s 一次 3s 小动作）、**拖拽**（自由摆放、clamp 视口内、localStorage 位置持久化，刷新不丢）。
- **状态实时映射**：dsh durable session 事件（turn/step/tool）驱动宠物状态机，评测跑分过程一眼可读。
- **彩蛋触发**：评测完成弹 Score 气泡、跃出水面；检测到 SOTA 特征（v0.1 为文本近似判定）触发限定动画。
- **宠物切换 / 随机**：默认出场是 DeepSeek 标志性大鲸鱼 `deepseek-whale`；可在 `~/.dsh/settings.yaml`（用户设置层）或 profile patch（base 层）换成 `random`（按 turn id 种子确定性选择，重放一致）或三源发现的任意皮肤；设置面板选择行开发中（见 Roadmap）。注：v0.2 悬浮窗艺术层统一渲染鲸鱼 SVG，其他皮肤的专属视觉待 spritesheet 就绪（见 Roadmap）。
- **皮肤源优先级**：自定义源 > Petdex 社区源 > 内置源——同名皮肤高优先源覆盖，你的自定义皮肤永远赢。
- **Petdex 资产兼容**：像素资产即标准 Petdex 宠物包，可 `npx petdex submit` 上架社区画廊。

## 宠物状态映射

三层契约：**dsh 事件信号 → 插件语义状态 → 悬浮窗 CSS 动画 + 气泡**（Petdex 动画行作为 spritesheet 就绪后的资产契约保留）。机器可读版见 [mappings/harness-states.json](mappings/harness-states.json)。

| dsh 事件信号 | 语义状态 | 动画行 | 悬浮窗视觉 / 气泡 |
|---|---|---|---|
| 会话空闲 | `idle` | idle | 缓慢浮动打瞌睡 / zzZ |
| `turn/start` 后首轮准备 | `loading` | waiting | 上浮蓄力 / 加载数据中 |
| `step/start`、工具高频活动 | `inferring` | running | 左右摇摆游动 / 推理中 |
| 报告/评分类工具调用 | `scoring` | review | 审视微旋 / 评分中 |
| `turn/end` 正常完成 | `done` | waving | 摆动挥舞 / 完成！ |
| 完成且带 SOTA 文本特征 | `sota` | jumping | 跃起回弹 / SOTA！ |
| `turn/end` 失败/中断 | `error` | failed | 翻肚灰度 / [ERROR] 请检查日志 |

悬浮窗视觉由 `src/pet-art.js` 的 `OVERLAY_ANIMATIONS` 动画表驱动（CSS transform keyframes，v0.2 艺术层为内联鲸鱼 SVG）；动画行仍为 Petdex 9 标准行（idle / running / running-left / running-right / waving / jumping / failed / waiting / review）的子集，供 spritesheet 切换点消费。失败信号（`status: failed`、`error`、`outcome: stopped`）任一命中即进入 `error`。

## 安装

前置：Node.js ≥ 22，已可运行 `dsh web`（dsh 0.1.0-rc.5 验证通过）。

**方式 A：安装到 dsh profile（官方 bundle 机制，已实测）**

```bash
# 1) 构建浏览器半边产物 lib/client.js（dsh 的 node 半边按 exports["./client"] 加载它）
cd deepseek-harness-pets && npm install && npm run build

# 2) 登记进 web profile（~/.dsh/profiles/web）
#    package.json 两处：dependencies 加 "deepseek-harness-pets": "link:<本仓库路径>"；
#    dsh.profile.bundles 数组末尾追加 "deepseek-harness-pets"
cd ~/.dsh/profiles/web && pnpm install

# 3) 重启 DSH Web（bundle 不热加载）
dsh web
```

安装后可用 `dsh --profile web --dump-config` 检查 `deepseek-harness-pets` 行是否在组合树中；
浏览器打开后 `window.__DSH_BOOT__` 应含该条目，`/plugins/deepseek-harness-pets/client.js` 返回 200，且打开任意会话应看到右下角鲸鱼悬浮窗（idle 浮动 + zzZ 气泡）。

**方式 B：`dsh plugin add`（等价于方式 A 的自动化路径）**

```bash
dsh plugin --profile web add <git-url|npm包|本地路径>   # dsh 0.1.0-rc.5 实测可用
```

**方式 C：从 npm 安装（发布后可用）**

```bash
npm install -g deepseek-harness-pets   # 计划中，见 Roadmap
```

给本仓库打上 GitHub topic `dsh-plugin`，即可被 [dsh 官方插件生态](https://github.com/deepseek-ai/deepseek-harness)发现。

## 皮肤源优先级（custom > petdex > bundled）

插件启动时扫描三个皮肤目录，同名 slug 按以下优先级覆盖（离线判定，不依赖网络）：

| 优先级 | 源 | 目录 | 说明 |
|---|---|---|---|
| 1（最高） | 自定义 custom | `~/.dsh/pets/`（`$DSH_HOME/pets`） | 你自己放或 hatch-pet 生成的皮肤，可覆盖任何同名皮肤 |
| 2 | Petdex 社区 petdex | `~/.petdex/pets/` | `npx petdex install <slug>` 落地的社区皮肤 |
| 3（兜底） | 内置 bundled | 插件包内 `assets/pets/` | 随插件分发的 deepseek-whale / deepseek-octo |

合并后的池进入设置可选值与 random 随机池（设置面板选择行开发中，当前经 settings.yaml 消费）；某源目录缺失/不可读时该源降级为空，绝不阻断（fail-open）。

> 注：v0.1 中 custom/petdex 皮肤的选中与优先级判定已生效；v0.2 悬浮窗艺术层统一渲染内联鲸鱼 SVG，外部源与内置皮肤的 spritesheet 像素图待 Host 静态服务与渲染切换点接入（Roadmap）。spritesheet 契约仍由 `src/pet-pool.js` 的 `BUNDLED_ARTWORK` 登记表锁定（测试强制登记与实际文件一致，杜绝破图）。

## 配置（宠物切换 / 随机）

**方式一（当前可用）：编辑用户设置文档**。插件已把 `pet` 注册为 dsh 用户设置（命名空间 `deepseek-harness-pets`，Host 侧 schema 校验生效）：直接编辑
`~/.dsh/settings.yaml`，重启 DSH Web 生效（设置面板选择行开发中，见 Roadmap）：

```yaml
deepseek-harness-pets:
  pet: deepseek-octo   # 缺省不写 = 默认大鲸鱼；random = 按 turn id 确定性随机
```

**方式二：profile patch 行 config（composition base 层）**：在
`~/.dsh/profiles/web/cordis.patch.yml` 里按 id 覆盖：

```yaml
- id: deepseek-harness-pets
  config:
    pet: random            # deepseek-whale（默认·大鲸鱼） | deepseek-octo | random
    # pets:                # 可选：覆盖皮肤池扫描结果
    #   - deepseek-whale
    #   - deepseek-octo
```

- 优先级：**用户设置文档 > 行 config（base） > schema 默认 deepseek-whale（大鲸鱼）**；
  删掉用户层字段即回继承 base 层；
- `pet: random` 时每个 turn 按其 id 种子确定性选皮，同一会话重放结果一致；
- 池外皮肤名会被 Host 侧 schema 校验拒绝（注册时 fail loud，命名空间不装）；
- 配置/文档层之外，浏览器侧对池漂移降级回默认并 console.error（fail-open，不阻断会话渲染）。

## 宠物资产与 Petdex 互通

每只宠物就是一个标准 Petdex 宠物包：

```
assets/pets/deepseek-whale/
├── pet.json            # Petdex 元数据（slug/帧规格/9 状态行/调色板）
└── spritesheet.webp    # 8 列 × 9 行、每帧 192×208、背景纯品红 #FF00FF（占位待补）
```

想把这只会动的鲸鱼浮在**桌面**上？把 `assets/pets/deepseek-whale/` 复制到 `~/.petdex/pets/`（或 `~/.codex/pets/`），装 [Petdex 桌面端](https://petdex.dev)即可——同一套资产，两种形态。也欢迎 `npx petdex submit ./assets/pets/deepseek-whale/` 上架社区画廊（审核约 24 小时）。

## 皮肤创作指南

**放哪里？** 三选一（见上文源优先级）：
- 想让皮肤只在自己机器生效且优先级最高 → 放 `~/.dsh/pets/<slug>/`；
- 想用社区现成皮肤 → `npx petdex install <slug>`（落在 `~/.petdex/pets/`）；
- 想给本仓库贡献内置皮肤 → 提 PR 到 `assets/pets/`。

**内置皮肤贡献流程**：

1. Fork 本仓库，在 `assets/pets/` 下新建 `<你的slug>/` 目录；
2. 用 Codex 的 `hatch-pet` skill 生成或手绘 spritesheet，严格遵守 [帧规范](assets/pets/deepseek-whale/spritesheet.README.md)：8×9 网格、每帧 192×208、背景纯品红 `#FF00FF`、行序 idle→review；
3. 复制一份 `pet.json` 改成你的宠物元数据；
4. 提 PR。想让宠物进随机池？在 `src/index.js` 的 `DEFAULT_PET_POOL` 中同步登记（或用 cordis.yml 的 `pets` 覆盖）。

创意方向欢迎：不同参数量大小的鲸鱼宝宝、穿格子衬衫的 AI 鲸鱼、更多机械海洋生物……

## Roadmap

- [x] 真实 dsh 环境全链路验收（安装→组合→boot graph→client bundle→设置注册→三层解析，2026-08-15 实测）
- [ ] 设置面板宠物选择行：浏览器半边注册 `settings.general.item` 偏好行（defineStore + locale + scope.set，参照 @dshthemes/ui 的 ThemePickerRow 形态）
- [x] 悬浮窗实机目验（2026-08-15 完成：常驻右下角/悬停/点击瞬态/拖拽持久化刷新恢复/turn 状态流转/loading→动画/console 零报错/聊天流零卡片，Chrome DevTools 实测）
- [ ] 像素图就绪（`spritesheet.webp` × 2，社区认领）
- [ ] Host 静态服务：向 Web UI 提供 custom/petdex 源的 spritesheet（消除占位块）
- [ ] Host 侧专用事件族：精确判定评测阶段与 SOTA（需 TS declaration merging，迁移到 TS 包）
- [x] 常驻浮层形态（`shell.overlay` root 域插槽注入，v0.2 已实施——见 evidence.md #29）
- [x] 发布到 npm 并登记 `dsh-plugin` topic（v0.2.0 起在 npm；发布经 GitHub Actions trusted publishing 自动完成——推 `v*` tag 即验证+发布，零 token，见 CONTRIBUTING 发布流程）
- [ ] 机械章鱼 octo 上色稿
- [ ] `npx petdex submit` 上架画廊

## 贡献与许可

- 贡献指南：[CONTRIBUTING.md](CONTRIBUTING.md)
- 架构与证据：[docs/architecture/](docs/architecture/)（三视图 + 证据置信度）
- 代码 MIT（见 [LICENSE](LICENSE)）；像素资产版权归各自贡献者，按其 `pet.json` 声明的许可使用。

## 故障排查

- **设置面板没有宠物项**：属预期——面板偏好行（`settings.general.item` 插槽）开发中（见 Roadmap）；当前用 `~/.dsh/settings.yaml` 或 profile patch 配置。
- **悬浮窗不出现**：先确认 dsh ≥ 0.1.0-rc.5（更早版本无 `shell.overlay` 插槽）；bundle 不热加载，重启 DSH Web；仍无则 `dsh --profile web --dump-config` 确认 `deepseek-harness-pets` 行存在，浏览器控制台查 `window.__DSH_BOOT__` 是否含该条目、Network 看 `/plugins/deepseek-harness-pets/client.js` 是否 200（404 多半是没跑 `npm run build` 或 exports["./client"] 指错），console 无 `[deepseek-harness-pets]` 报错即说明插槽声明被宿主静默忽略（fail-open 设计，宠物安静不出现）。
- **悬浮窗位置丢失（回到右下角）**：属预期——拖拽位置存于浏览器 localStorage（key `dsh-pets-overlay-pos`），清缓存/换浏览器/隐私模式后回落默认右下角。
- **设置面板缺项但能启动**：`~/.dsh/settings.yaml` 里该命名空间的值不合法时注册被拒、命名空间不装但启动不会报错（实测容纳性，见 evidence.md #25）；改正为池内值或删掉该 section 重启。
- **换了皮肤但悬浮窗视觉没变**：v0.2 艺术层统一渲染内联鲸鱼 SVG，皮肤选中与优先级已生效（slug 见悬浮窗 `data-dsh-pet-overlay` 属性），专属像素视觉待 spritesheet 切换点接入（见 Roadmap 的像素图与 Host 静态服务）。
- **random 每次不一样**：random 按 turn id 种子选择，同一 turn 重放一致；跨 turn 允许换皮（这是特性）。
- **dsh 升级后异常**：dsh 处于 developer preview，不排除 breaking changes；本插件验证于 dsh 0.1.0-rc.5（2026-08 本机实测：安装→组合→boot graph→设置注册→三层解析全链路），出新问题时请附 `--dump-config` 输出提 issue。
