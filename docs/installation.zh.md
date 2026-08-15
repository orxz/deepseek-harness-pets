# 安装

[English](installation.md) | 简体中文

一只常驻小鲸鱼游在 DeepSeek Harness Web UI 右下角，随 agent 回合状态实时反应——加载、推理、评分、SOTA 庆祝。两条命令装好。

## 快速开始

```sh
dsh plugin --profile web add deepseek-harness-pets
dsh web
```

`web` 是自带的 Web profile，首次使用自动初始化。打开 `http://localhost:3080`——鲸鱼已经在右下角浮动打瞌睡了。发一条消息，看它随回合状态换动画。

卸载同样一条：

```sh
dsh plugin --profile web remove deepseek-harness-pets
```

## 前置条件

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）且带 Web 面（`dsh web`）。验证于 dsh 0.1.0-rc.5；dsh 处于 developer preview，更新版本行为可能不同。
- pnpm 在 `PATH`——`dsh plugin` 把参数转发给 profile 目录内的 pnpm。`corepack enable` 即可。
- Node.js ≥ 22（`.nvmrc` 已固定版本）。
- 其他什么都不用。cordis、schemastery、React 由宿主经模块表提供；本包自带预构建浏览器产物（`lib/client.js`），无伴随依赖。

## 装完你会看到什么

| dsh 信号 | 宠物状态 | 动画 | 气泡 |
|---|---|---|---|
| 会话空闲 | `idle` | 缓慢上下浮动 | zzZ |
| `turn/start` 首轮准备 | `loading` | 上浮蓄力 | 加载数据中… |
| `step/start` / 工具高频活动 | `inferring` | 快速游动摇摆 | 推理中… |
| 报告/评分类工具调用 | `scoring` | 前倾审视 | 评分中… |
| `turn/end` 正常完成 | `done` | 摆动挥鳍 | 完成！ |
| 完成且带 SOTA 文本特征 | `sota` | 跃起回弹 | SOTA！ |
| `turn/end` 失败 | `error` | 翻肚 + 灰度 | [ERROR] 请检查日志 |

互动：点击（跃起 + 开心气泡）、悬停（放大微倾）、空闲时每 20–60 秒随机小动作、可拖到任意位置——位置刷新后保持（`localStorage` 键 `dsh-pets-overlay-pos`）。

## 配置宠物

编辑 `~/.dsh/settings.yaml`（用户设置层）后重启 `dsh web`：

```yaml
deepseek-harness-pets:
  pet: deepseek-octo   # 缺省 deepseek-whale；"random" 按 turn id 确定性选
```

或在 profile patch 层固定（`~/.dsh/profiles/web/cordis.patch.yml`）：

```yaml
- id: deepseek-harness-pets
  config:
    pet: random
```

解析优先级：用户设置 > profile patch > schema 默认（`deepseek-whale`）。池外值启动时被拒（fail loud）；自定义（`~/.dsh/pets`）与 petdex（`~/.petdex/pets`）源的皮肤参与选择——像素 spritesheet 就绪前（Roadmap），悬浮窗统一渲染官方鲸鱼 SVG，不随皮肤变。

## 从源码安装（开发者）

开发本插件本身时：

```sh
git clone https://github.com/orxz/deepseek-harness-pets.git
cd deepseek-harness-pets && npm install && npm run build

# 登记进 web profile（link 方式，无需发布 npm）
cd ~/.dsh/profiles/web
# package.json：dependencies 加 "deepseek-harness-pets": "link:<仓库路径>"
#               dsh.profile.bundles 数组加 "deepseek-harness-pets"
pnpm install

dsh web   # bundle 不热加载——每次重建后都要重启
```

验证：`dsh --profile web --dump-config` 含 `deepseek-harness-pets`；浏览器 console 的 `window.__DSH_BOOT__` 含该条目；`/plugins/deepseek-harness-pets/client.js` 返回 200。

## 手写 patch 行（等效替代）

喜欢显式层的 profile，`dsh plugin add` 的等效写法：

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: deepseek-harness-pets
```

前提是包已装（在 profile 目录内 `pnpm add deepseek-harness-pets`）。该行是 `dsh plugin` 的替代而非伴随。

## 故障排查

- **右下角没有鲸鱼**——需 dsh ≥ 0.1.0-rc.5（`shell.overlay` 插槽）；重启 `dsh web`（bundle 不热加载）；`dsh --profile web --dump-config` 查条目、浏览器 console 查报错。插件 fail-open：任何异常时宠物安静不出现，绝不破坏 UI。
- **刷新后位置重置**——`localStorage` 被清，宠物回默认右下角。预期行为。
- **换了皮肤但鲸鱼没变样**——spritesheet 就绪前预期如此（Roadmap）；选择实际已生效（`data-pet-overlay` 属性可见 slug）。
- **设置不生效 / 面板没有宠物行**——池外值会让注册被拒（安全但安静）；改正值或删掉该节后重启。设置面板选择行在 Roadmap。
- **dsh 升级后异常**——dsh 是 developer preview。请附 `--dump-config` 输出提 issue。
