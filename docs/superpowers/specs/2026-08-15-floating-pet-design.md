# 右下角常驻悬浮窗桌宠 设计

日期：2026-08-15
状态：已实施（2026-08-15，实机目验待补）
承载插槽：dsh `shell.overlay`（root 域，跨会话常驻）

## 背景与需求

用户目验确认：聊天流占位块卡片链路全通，但形态不符合预期。定调：

1. **只保留右下角常驻悬浮窗**，删除聊天流卡片，不影响聊天流（需求 B）。
2. **视觉用官方 DeepSeek 鲸鱼 SVG**（用户提供的 seeklogo 单 path 矢量），不用蓝色虚线占位框。
3. **拟真互动**（v1 全四项）：点击反应、悬停反应、随机闲置行为、拖拽 + 位置持久化。

已验证事实（见 docs/architecture/evidence.md）：

- `shell.overlay` 为全框架浮动层（`position:absolute; inset:0; z-index:20; pointer-events:none`，子项恢复 pointer-events），root scope 不随会话卸载，list kind 可并存，注释明言 badge/toast 属此；右下角定位由组件自管 CSS。
- 现有 `petNodeDefinition`（conversationEvents 折叠契约）已验证可用，事件携带 `turn: number`。

## 方案

采用方案 1：复用折叠引擎 + 模块级 store + `shell.overlay` 渲染。

- 保留 `petNodeDefinition` 作事件折叠引擎，`start`/`update` 折叠后写 store，`buildViewNode` 恒返回 null（不再向聊天流输出节点）。
- 删除 `conversation.chat.node` 插槽注入。
- overlay 组件注册到 `shell.overlay`，订阅 store 渲染。

否决：方案 2（直接订阅原始事件流，契约未验证）、方案 3（Host 侧聚合推送，依赖不存在的 Host 能力，overkill）。

## §1 架构与数据流

| 单元 | 职责 | 形态 |
|---|---|---|
| `src/pet-store.js`（新） | 模块级可观察 store：单一 pet-state 实例 + `petSlug` + 瞬态互动状态；`getSnapshot()`/`subscribe()`；终态（done/sota/error）4000ms 后自动回 idle（常量 `TERMINAL_IDLE_DELAY_MS`，时钟注入可测） | 零依赖纯逻辑，可单测 |
| `src/index.js`（改） | 保留 Definition 折叠；`start`/`update` 写 store；`buildViewNode` 返回 null；移除 chat 插槽注入；注册 `shell.overlay` | 入口接线 |
| `src/overlay-view.js`（新） | 悬浮窗 React 组件：订阅 store，渲染鲸鱼 logo + 气泡；处理点击/悬停/拖拽；随机闲置定时器 | 视图层，仅依赖 store 接口 |
| `src/pet-art.js`（新） | 艺术 provider v1：内联鲸鱼 SVG（品牌蓝）+ 语义状态→CSS transform 动画表 | 纯函数：state→style/keyframes |
| `src/pet-state.js`/`pet-pool.js`/`turn-contexts.js` | 原样复用 | 不变 |

数据流：

```
dsh durable events (turn/step/tool)
  → petNodeDefinition.match/start/update（已验证契约，active session）
  → pet-store（单一状态源 + 终态回 idle）
  → overlay-view（shell.overlay，root 域常驻）
  → pet-art（state→CSS 动画）+ 气泡
```

决策：

- store 是**视图状态**而非 durable 状态：终态回 idle、随机闲置均为客户端定时器，不污染可重放语义。
- 悬浮窗跟随用户当前查看的 active session（折叠引擎事件来源与聊天流一致）。
- 艺术层预留 spritesheet 切换点（接口 state→视觉），v1 仅实现 logo 版。

## §2 视觉与互动

视觉：主体 = 官方鲸鱼 SVG（单 path 内联，fill 品牌蓝 `#4D6BFE`），默认约 96px。

语义状态 → CSS transform 动画（纯 keyframes，沿用 `buildAnimationCss` 注入模式）：

| 语义状态 | 动画 | 气泡 |
|---|---|---|
| idle | 缓慢上下浮动 + 偶尔微倾 | zzZ / 随机闲置气泡 |
| loading/waiting | 轻微上浮蓄力 | 加载数据中 |
| inferring/running | 快速左右游动摇摆 | 推理中 |
| scoring/review | 前倾审视微旋 | 评分中 |
| done/waving | 摆尾旋转挥动 | 完成！ |
| sota/jumping | 跃起（抛物线 + 落地回弹） | SOTA！ |
| error/failed | 翻肚（rotate 180°）+ 灰度滤镜 | [ERROR] 请检查日志 |

互动（v1 全四项）：

- 点击：瞬态 jumping + 随机开心气泡（~1.5s）；与拖拽用位移阈值区分（>5px 算拖拽，不触发点击）。
- 悬停：scale 1.08 + 微倾 + 气泡"嗯？"；离开恢复。
- 随机闲置：idle 时每 20–60s 随机触发一次 3s 小动作（跃起/喷水气泡/打盹切换）。
- 拖拽：pointer events 自由移动，clamp 视口内，`localStorage` 持久化（key `dsh-pets-overlay-pos`）；不可用回退内存。

瞬态优先级：互动反应 > 随机闲置 > 语义状态（高优先覆盖渲染，结束回落）。

## §3 清理、错误处理与测试

清理（需求 B）：

- 删除 `src/index.js` 的 `conversation.chat.node` 注入。
- 删除 `renderer.js` 的 `petCardView` 及其测试；保留帧计算 `frameAtTime`/`frameStyle`/`buildAnimationCss`（spritesheet 切换点用）。
- `buildViewNode` 恒返回 null。

错误处理（fail-open 家规）：

- overlay 渲染永不抛错：store 快照异常 → 渲染 idle 默认态。
- `localStorage` 不可用/损坏 → 默认右下角，不持久化。
- drag 中视口 resize → 下次渲染 clamp 回视口。
- `shell.overlay` 不存在（dsh 版本差异）→ `ctx.slots.inject` 等声明出现，永不报错，宠物安静不出现。

测试：

- `test/pet-store.test.js`（新）：事件折叠→状态序列、终态延时回 idle（时钟注入）、订阅通知、瞬态优先级。
- `test/pet-art.test.js`（新）：7 语义状态→动画表完整性、keyframes 生成。
- `test/overlay-view.test.js`（新）：点击/拖拽阈值区分、位置 clamp 纯函数。
- 现有测试全绿。
- 实机目验：浏览器发消息 + 点/悬停/拖拽确认形态。

不做（YAGNI）：spritesheet 渲染切换实现、设置面板行、多宠物同屏、位置重置按钮。
