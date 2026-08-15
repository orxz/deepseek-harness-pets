# deepseek-octo spritesheet 占位规范

本目录的 `pet.json` 已就绪；`spritesheet.webp`（或 `.png`）为占位待补，由社区经 Codex `hatch-pet` skill 生成或手绘提交。
机械章鱼是 `pet: "random"` 随机池的第二成员。

## 帧规范（Petdex 标准，贡献必须严格遵守）

- 网格：8 列 × 9 行（v1 格式），每帧 192 × 208 px，整图 1536 × 1872 px
- 行序（自上而下，与 pet.json `states` 的 `row` 对应）：
  `idle, running-right, running-left, waving, jumping, failed, waiting, running, review`
- 背景：纯品红 `#FF00FF`（运行时自动抠为透明；勿用抗锯齿边缘混色）
- 造型：DeepSeek 机械章鱼（体 `#4D6BFE`、机械灰 `#8A9BB8`、屏幕辉光 `#A9C1FF`）
- 每行动画语义（对应本插件语义状态）：
  - idle：浮悬休眠，屏幕低亮度
  - waiting：单爪转圈加载
  - running / running-left / running-right：八爪并行敲键盘
  - review：触腕卷起报告审视
  - waving：双爪欢呼（完成）
  - jumping：弹射跳跃（SOTA 彩蛋）
  - failed：齿轮卡顿冒烟（报错）

## 提交

放好 `spritesheet.webp` 后即可向本仓库提 PR；如需上架 Petdex 画廊，另跑 `npx petdex submit ./assets/pets/deepseek-octo/`。
