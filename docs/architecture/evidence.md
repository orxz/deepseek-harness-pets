# Architecture Evidence

本文件记录三张视图（l1-context.mmd / l2-containers.mmd / runtime-flow.mmd）背后的证据来源与置信度。
生成：2026-08-15，SDD 定调阶段（brainstorming → architecture-communicator 流程）。
视图由 `architecture-communicator` 产出，采用 Mermaid（Markdown-native 嵌入需求）。

## 视图清单

| 视图 | 回答的问题 | 受众 |
|---|---|---|
| l1-context | 本插件在 dsh 与 Petdex 生态中的角色与边界 | 仓库所有者 / 潜在贡献者 |
| l2-containers | 插件包内部单元、契约位置、依赖方向 | 插件开发者 |
| runtime-flow | dsh 事件如何变成宠物动画与气泡 | 插件开发者 |

## 证据与置信度

| # | 结论 | 置信度 | 来源 |
|---|---|---|---|
| 1 | dsh 是 Cordis 插件架构，"一切皆插件"，无特权核心 | high | github.com/deepseek-ai/deepseek-harness `docs/architecture.md` |
| 2 | bundle/profile 安装机制：package.json `dsh` 字段（`dsh.bundle.patch` → cordis.patch.yml）；profile 存于 Harness home（`~/.dsh/profiles/web`）；`dsh --profile web --dump-config` 查看组合树 | high | 同上 Profiles and bundles 节 + petdex `integrations/dsh/package.json` |
| 3 | Client 插件注册 ConversationNode：`inject = ['conversationEvents', 'slots']`；`apply(ctx: ClientContext)`；`ctx.conversationEvents.register(definition)` + `ctx.slots.inject('conversation.chat.node', ...)`；React keyed renderer；`publication: 'animation-frame'` 动画帧发布 | high | dsh 官方 cookbook `docs/cookbook/adding-a-conversation-node.md`（含完整代码示例） |
| 4 | turn/step/tool/assistant 均为 durable session events，可直接被 Definition.match 消费，且可重放（ascending seq 确定 State） | high | dsh `docs/architecture.md` Turn flow 节 + cookbook 第 4 节 ingestion paths |
| 5 | 官方事件流不含"评测阶段"语义；benchmark 经 Python SDK `jsonrpc-agent` 跑 session | high | dsh `BENCHMARK.md`（全文仅指引 Python SDK） |
| 6 | loading vs inferring vs scoring 的细分靠工具活动特征推断 | medium | 由 5 推论：无原生评测事件，只能启发式；保守映射到官方基准行 |
| 7 | Petdex 宠物包格式：pet.json + spritesheet.{webp,png}，8×9 网格（或 v2 8×11）、每帧 192×208、9 状态行、背景 #FF00FF | high | github.com/crafter-station/petdex README Pet package format 节 + packages/petdex-desktop-native README（9-state canonical table） |
| 8 | 9 标准状态行名称：idle, running-right, running-left, waving, jumping, failed, waiting, running, review | high | petdex README："The native renderer supports nine state rows: idle, running-right, running-left, waving, jumping, failed, waiting, running, and review" |
| 9 | Petdex 桌面端 hook server：127.0.0.1:7777，token 门控（~/.petdex/runtime/update-token），/state 与 /bubble 端点，fail-open 原则 | high | petdex `integrations/dsh/src/index.js` 源码 |
| 10 | 官方 @petdex/dsh-plugin 状态映射基准（turn started→jumping；活动→running；approval→waiting；completed→waving；failed→failed） | high | petdex `integrations/dsh/README.md` State mapping 表 |
| 11 | cordis.patch.yml 格式：顶层数组，`- id:` 覆盖行 / `- insert: [{id, name, config?}]` 插入行 | high（实测） | dsh 源码 packages/bundle/web-app/cordis.patch.yml + @dshthemes/ui 同名文件 + `--dump-config` 输出验证（2026-08-15 本机验收） |
| 12 | client 插件发现与加载：package.json `dsh.client`（inject=服务包名列表、platform:web）声明，node 半边扫 Loader 条目、解析 `exports["./client"]` 并哈希入 boot graph，浏览器经 `/plugins/<id>/client.js` 取 CJS 工厂（`window.__ModuleLoader__.load({id, factory})`）；浏览器半边 apply 只收 ctx（WebBootEntry 不携带行 config，cordis.yml 级配置经 Host 设置 base 层生效）；需预构建产物（scripts/build-client.mjs，esbuild） | high（实测） | dsh 源码 packages/client/modules + 本机验收：/plugins/deepseek-harness-pets/client.js 200、__DSH_BOOT__ 含条目、注入边正确 |
| 13 | 随机/切换做成 Config 字段符合官方惯例 | high | dsh `AGENTS.md`："No hardcoded tunables in plugins ... validated Config fields changeable from cordis.yml" |
| 14 | npm `@deepseek-ai/dsh` 与 PyPI `deepseek-harness` 为两个无关项目 | high | dsh 官方 README（MIT，Node.js）+ aireiter.com 对比表（PyPI 版为第三方 Henry Zhang 的协议适配库） |
| 15 | dsh user-settings：`ctx.settings.register(ns, schema, {base})` 返回 SettingsScope（get/watch/update）；解析层级 = schema 默认 → composition base（插件 cordis.yml entry）→ 用户设置文档；无 provider 时消费者回落 entry config | high | dsh `packages/settings/settings/README.md`（Service API 节） |
| 16 | 官方消费者封装 `installSettingsSection(ctx, ns, schema, entry, hooks)`：动态 inject settings、entry 作 base、watch 自动通知、服务摘除自动回落 entry | high | 同包 `src/index.ts` L828-897（SettingsSectionHooks + installSettingsSection 实现） |
| 17 | schema 库 = `@deepseek-ai/schemastery`（vendored rescoped schemastery 3.18.1，profile node_modules 可解析）；枚举 `z.union([...])`，链式 `.default()/.description()`，union 拒绝池外值 | high（实测） | profile node_modules 实物 + node 验证 `s({pet:'bogus'})` throws |
| 18 | 浏览器侧无 `ctx.settings` 镜像：用户偏好经 `ctx.settingsScope.bind({namespace})` → getSnapshot().value（status/value/base/user/revision）+ subscribe；写经 set(field,v)/unset(field)；需 inject 'settingsScope' | high（实测） | dsh 源码 packages/client/ui-settings settings-scope.ts + runtime contract（ui-theme/ui-conversation 同型用法） |
| 19 | Petdex 安装目录 `~/.petdex/pets/<slug>/`（pet.json + spritesheet）；DSH_HOME 存在时 dsh home 迁移到 `$DSH_HOME`（custom 源随之） | high | petdex README Quick start（"~/.petdex/pets/boba/"）+ petdex integrations/dsh README（"$DSH_HOME/profiles/web 或 ~/.dsh/profiles/web"） |
| 20 | 皮肤源优先级 custom > petdex > bundled 为本项目设计决策（用户定调 2026-08-15）；custom 根目录 `~/.dsh/pets`（`$DSH_HOME/pets`）为本项目约定，非上游事实 | decision | 用户指令 + src/pet-sources.js 实现（test/pet-sources.test.js 锁定优先级顺序） |
| 21 | Client 生效池 = 设置镜像 pets ∪ cordis.yml pets ∪ bundled（并集）：过期设置快照只会多出多余条目，永远不会藏住内置皮肤；原 v0.1 的有界 turn 上下文注册表（64，聊天流卡片渲染支撑）已随 v0.2 删除（src/turn-contexts.js 及其测试移除） | decision | src/pet-pool.js composePetPool（test/pet-pool.test.js 锁定）；v0.2 起聊天流卡片形态由悬浮窗形态取代（见 #29） |
| 22 | 动画帧 = stateEnteredAt（时钟注入）+ mappings fps，在 buildViewNode 按 animation-frame 发布现算（不污染可重放语义状态）；bundled 像素图经 BUNDLED_ARTWORK 登记，登记项与实际文件一致性由测试强制（防破图/防漏登记）；选皮校验分层：apply 加载时 fail-loud，settings 更新与渲染路径永不抛错 | decision | src/pet-state.js / src/renderer.js frameAtTime / src/pet-pool.js BUNDLED_ARTWORK / src/index.js（test/mappings.test.js、test/renderer.test.js 锁定） |
| 23 | 默认宠物 = deepseek-whale（DeepSeek 标志性大鲸鱼，用户定调 2026-08-15）：schema 默认、Host entry 兑底、selectPet 缺省回落均取 DEFAULT_PET（pet-pool.js 唯一事实源）；random 仍是可选值但不再是缺省 | decision | src/pet-pool.js DEFAULT_PET + src/host.js + src/pet-state.js（test/pet-pool.test.js、test/pet-state.test.js 锁定） |
| 24 | 真实 durable 事件契约（SessionEventMap）：turn/step/tool 事件均携带 `turn: number`；`turn/end` 结果在 `data.reason.kind`（completed/aborted/blocked/error/max-tokens/interrupted；aborted=用户取消→安静 done，失败族→error）；assistant/tool 文本在 `data.message.content` 消息块；scoring 用工具 `name` 字段 | high（实测） | dsh 源码 packages/core/session/src/types.ts SessionEventMap + TurnEndReasonMap（2026-08-15 对照，test/pet-state.test.js 锁定映射） |
| 25 | 设置注册失败容纳性：文档中 schema 非法的 section 使注册被拒、命名空间不装，但 web 启动不会中断（fiber 失败被容纳，无 fail loud 告警）——诊断靠 settings.get(ns)=undefined / 面板缺项 | high（实测） | 本机探针：bogus pet 时启动正常且 get=undefined；合法 octo 时 get={pet:deepseek-octo,pets:[whale,octo]} |
| 26 | 无参 scanPetSources 的默认根覆盖 bug（undefined 清空三源）曾致 Host 池恒空，已修复并加回归测试（test/pet-sources.test.js 首例）；教训：默认参合并必须用 `??` 而非对象展开覆盖 | fixed | 本机探针发现（2026-08-15），修复后 bundled 源扫到 whale/octo，设置 base 层池正确 |
| 27 | 浏览器侧 `settingsScope.bind` 的失效订阅（settings/updated 转发）注册在调用方自己的 ctx 上，调用方需注入 `remote`（及 `connection`）服务才能收到偏好变更推送；缺注入时初始快照可读但变更不推送 | high（源码+参照） | packages/client/ui-settings settings-scope.ts 头注 + ui-theme/ui-conversation 运行时 inject 列表；本插件 src/index.js 已同步 |
| 28 | 设置面板不会自动渲染已注册命名空间：面板偏好行是浏览器半边向 `settings.general.item` 插槽注册的组件（{name,id,order,store,locale,inject} + 行组件，自绘标签/取值/写路径经 scope.set）；Host 侧 register 仅让文档接受并校验命名空间 | high（实测） | packages/client/ui-settings contract/slots.ts + @dshthemes/ui ThemePickerRow 实例；用户实测发现（2026-08-15），面板行列于 Roadmap |
| 29 | `shell.overlay` 插槽：kind `list`（多插件并存）、scope `root`（不随会话卸载，badge/toast 同域）；宿主 AppFrame 渲染 overlayLayer 全框架浮层（`position:absolute; inset:0; z-index:20; pointer-events:none`），子项须自管 pointer-events（本插件根节点 `zIndex:30` + `pointerEvents:auto`，高于浮层基座 20）；右下角常驻定位由组件自身 CSS 管理 | high（源码对照 + 实机目验 2026-08-15：悬浮窗常驻出现/点击瞬态/拖拽持久化刷新恢复/console 零报错全过） | dsh 源码 slots contract + AppFrame overlayLayer（2026-08-15 源码对照，Task 1 brainstorming 验证）+ 本插件 src/index.js（shell.overlay 注入）/ src/overlay-view.js（pointer-events 自管实现）；Chrome DevTools 实测通过 |

## 已知限制与后续验证任务

- 像素图未就绪：v0.2 悬浮窗统一渲染内联鲸鱼 SVG；spritesheet 提交后需登记 src/pet-pool.js 的 BUNDLED_ARTWORK（测试强制一致性）并接入渲染切换点
- 悬浮窗实机目验已完成（2026-08-15，Chrome DevTools 实测）：常驻右下角/悬停/点击瞬态/拖拽持久化（localStorage + 刷新恢复）/turn 状态流转/console 零报错全过（见 #29）；随机闲置（20-60s 周期）由单测锁定机制、代码路径与点击瞬态同源，未逐一等待人工确认
- custom/petdex 外部源皮肤的像素图渲染依赖 Host 静态服务（未验证的 dsh 路由/静态能力）→ Roadmap；就绪前悬浮窗不区分皮肤视觉
- 设置注册失败的容纳性见 #25：非法文档值不会阻断启动，诊断靠面板缺项/settings.get=undefined
- "常驻浮层"形态已实施（v0.2，shell.overlay root 域注入，见 #29）；实机目验已完成（同上条）
- SOTA 精确判定需 Host 侧专用事件族（SessionEventMap 扩展，需 TS declaration merging，纯 JS 包不可行）→ Roadmap
