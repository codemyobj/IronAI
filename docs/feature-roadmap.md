# IronAI 功能规划与扩展建议

> 本文档基于当前已实现的功能边界，梳理未来可扩展的功能方向，按**优先级分层**组织，并标注实现难度与技术要点，供后续迭代参考。

---

## 📊 当前功能边界

在规划新功能前，先明确当前已实现的能力：

| 模块 | 已实现功能 |
|------|----------|
| 认证 | 注册、登录、JWT 鉴权、token 持久化、自动登出 |
| 用户档案 | 基础信息（年龄、身高、体重、健身目标） |
| 训练 | 计划 CRUD（软删除）、练习管理、训练会话记录、会话历史 |
| 饮食 | 饮食记录 CRUD、按日查询、周汇总统计（卡路里 + 宏量） |
| AI | 训练分析、饮食建议、历史记录 |
| 前端 | 6 个页面、PWA、中英文 i18n、骨架屏、单元测试 |
| 部署 | Vercel + Supabase PostgreSQL + Prisma ORM |

---

## 🎯 功能规划分层

### 🥇 P0 — 核心体验补全（建议优先实现）

这些功能补全后，应用从"能用"升级为"好用"。

#### 1. 数据可视化图表

**痛点**：当前 Dashboard 和 Diet 页只有数字，缺少直观的趋势图。

**实现方案**：
- 引入 `recharts`（React 生态主流图表库，与现有技术栈兼容）
- Dashboard 增加近 7 天卡路里折线图、训练频率柱状图
- Diet 页增加宏量营养素饼图、周趋势折线图
- Training 页增加训练时长趋势、肌群分布雷达图

**技术要点**：
- 复用现有 `/api/diet/summary` 接口数据，无需新增后端
- 图表组件封装为 `<Chart>` 通用组件，支持主题色
- 移动端适配：图表宽度自适应，触摸交互

**难度**：⭐⭐（中低）

---

#### 2. 体重与体测追踪

**痛点**：用户档案的 `weight_kg` 是静态字段，无法记录历史变化，AI 分析缺少趋势数据。

**实现方案**：
- 新增 `body_measurements` 表：`user_id`、`weight_kg`、`body_fat_pct`、`muscle_mass_kg`、`measured_at`
- 新增 API：`GET/POST /api/body/measurements`
- 新增"体测"页面或在 Dashboard 嵌入体重记录卡片
- 体重趋势折线图 + 目标线
- AI 分析时注入体重趋势数据

**数据模型**：
```prisma
model BodyMeasurement {
  id           Int      @id @default(autoincrement())
  user_id      Int
  weight_kg    Float?
  body_fat_pct Float?
  muscle_mass_kg Float?
  waist_cm     Float?
  measured_at  DateTime @db.Date
  user         User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  @@index([user_id, measured_at])
  @@map("body_measurements")
}
```

**难度**：⭐⭐⭐（中）

---

#### 3. 每日营养目标与进度

**痛点**：Dashboard 的 ProgressRing 目标硬编码 2200 kcal，未基于用户档案计算。

**实现方案**：
- 后端计算 BMR（基础代谢率）与 TDEE（每日总能量消耗）
  - Mifflin-St Jeor 公式：`BMR = 10×体重 + 6.25×身高 - 5×年龄 - 161（女）/ + 5（男）`
  - `TDEE = BMR × 活动系数`（1.2~1.9）
- 根据健身目标调整：减脂 = TDEE × 0.8，增肌 = TDEE × 1.1
- 宏量分配：蛋白质 1.6-2.2g/kg、脂肪 0.8-1g/kg、碳水补余
- 前端展示"今日剩余卡路里 / 蛋白质 / 碳水 / 脂肪"

**技术要点**：
- 需要用户补充"性别"和"活动水平"字段
- 后端新增 `/api/user/goals` 接口返回计算结果
- 前端 ProgressRing 组件改为动态目标

**难度**：⭐⭐⭐（中）

---

#### 4. 水分摄入追踪

**痛点**：健身应用缺少饮水记录，而水分对代谢与恢复至关重要。

**实现方案**：
- 新增 `water_records` 表：`user_id`、`amount_ml`、`recorded_at`
- Dashboard 增加水杯组件（点击 +250ml）
- 每日目标：体重 × 35ml（可调）

**难度**：⭐⭐（中低）

---

### 🥈 P1 — 智能化增强

#### 5. AI 对话式助手

**痛点**：当前 AI 是单向生成报告，用户无法追问。

**实现方案**：
- 基于 DeepSeek API 的多轮对话能力
- 新增 `chat_messages` 表存储对话历史
- 新增 `/api/ai/chat` 流式接口（SSE）
- 前端新增聊天界面（类似 ChatGPT）
- 上下文注入：用户档案、最近饮食/训练数据作为 system prompt

**技术要点**：
- 使用 Server-Sent Events 实现流式输出
- 对话窗口需处理 Markdown 渲染、自动滚动
- Token 消耗控制：限制历史消息数量

**难度**：⭐⭐⭐⭐（较高）

---

#### 6. AI 生成训练计划

**痛点**：用户需手动创建训练计划，门槛高。

**实现方案**：
- 新增 `/api/ai/generate-program` 接口
- 用户输入：目标、每周训练天数、可用器械、经验水平
- AI 返回结构化 JSON（计划名、动作、组数、次数）
- 前端一键导入为训练计划

**技术要点**：
- 使用 DeepSeek 的 JSON Mode（`response_format: { type: 'json_object' }`）
- 后端校验 AI 返回的 JSON 结构
- 直接调用 `prisma.trainingProgram.create` 嵌套创建

**难度**：⭐⭐⭐（中）

---

#### 7. 食物图片识别

**痛点**：手动输入食物名称和营养数据繁琐。

**实现方案**：
- 接入 DeepSeek Vision 或其他视觉模型
- 用户上传食物照片 → AI 识别食物 + 估算卡路里与宏量
- 用户确认后一键添加到饮食记录

**技术要点**：
- 前端：`<input type="file" accept="image/*" capture="environment">` 调用相机
- 后端：图片转 base64 发送给视觉 API
- Vercel 函数需注意请求体大小限制（4.5MB）

**难度**：⭐⭐⭐⭐（较高）

---

#### 8. 常见食物数据库

**痛点**：每次都要手动输入卡路里和宏量，重复劳动。

**实现方案**：
- 内置常见食物营养数据库（可从 USDA Food Data Central 导入）
- 新增 `food_database` 表：`name`、`calories_per_100g`、`protein`、`carbs`、`fat`、`category`
- 添加食物时支持搜索 + 自动填充营养数据
- 支持自定义食物保存到"我的食物"

**技术要点**：
- 可用 PostgreSQL 全文搜索（`tsvector`）或简单的 ILIKE 模糊匹配
- 初始数据通过 seed 脚本导入
- 用户自定义食物用 `user_id` 隔离

**难度**：⭐⭐⭐（中）

---

### 🥉 P2 — 体验优化

#### 9. 训练计时器与引导

**痛点**：训练时无法在应用内跟随计划执行。

**实现方案**：
- 新增"开始训练"模式：逐步展示每个动作的组数 × 次数
- 组间休息倒计时（带通知）
- 训练完成后自动生成 TrainingSession 记录
- 支持中途暂停

**技术要点**：
- 使用 `setInterval` + `useRef` 管理计时器
- 锁屏时用 Notification API 提醒
- 训练状态用 URL 参数保持（`/training/session/:programId`）

**难度**：⭐⭐⭐（中）

---

#### 10. 习惯打卡与成就系统

**痛点**：缺少长期激励机制，用户容易放弃。

**实现方案**：
- 连续打卡日历（记录饮食/训练/体测的天数）
- 成就徽章：首次训练、连续 7 天、累计 100km 等
- 每周/每月总结报告
- 可分享的成就卡片

**数据模型**：
```prisma
model UserStreak {
  id           Int      @id @default(autoincrement())
  user_id      Int
  type         String   @db.VarChar(20)  // 'diet' | 'training' | 'weight'
  current_streak Int
  longest_streak Int
  last_date    DateTime @db.Date
  user         User     @relation(fields: [user_id], references: [id], onDelete: Cascade)
  @@map("user_streaks")
}
```

**难度**：⭐⭐⭐（中）

---

#### 11. 数据导出与报告

**痛点**：数据被锁在应用里，无法外部分析或备份。

**实现方案**：
- 导出 CSV：饮食记录、训练历史、体测数据
- 导出 PDF：月度总结报告（含图表）
- 数据备份与恢复（JSON 格式）

**技术要点**：
- CSV：前端 `Blob` + `URL.createObjectURL` 直接生成
- PDF：引入 `jspdf` + `html2canvas`
- 后端新增 `/api/export/:type` 接口

**难度**：⭐⭐（中低）

---

#### 12. 通知与提醒

**痛点**：用户容易忘记记录饮食或训练。

**实现方案**：
- PWA Push Notification（Web Push API + Service Worker）
- 可配置提醒：早午晚餐记录、训练提醒、喝水提醒、称重提醒
- 前端设置页面配置提醒时间

**技术要点**：
- 需要 Service Worker（当前 PWA 未启用 SW，需补充）
- Vercel Serverless 不适合做定时任务，需用 Vercel Cron Jobs 或外部服务
- iOS Safari 对 Web Push 支持有限（iOS 16.4+）

**难度**：⭐⭐⭐⭐（较高）

---

### 🏅 P3 — 社交与生态扩展

#### 13. 训练计划市场

**痛点**：用户各自创建计划，无法复用优质内容。

**实现方案**：
- 训练计划支持"发布为模板"
- 新增 `program_templates` 公共表
- 浏览/搜索/收藏模板
- 一键导入为自己的计划

**难度**：⭐⭐⭐（中）

---

#### 14. 好友与排行榜

**痛点**：缺少社交激励。

**实现方案**：
- 好友系统（添加/删除好友）
- 周排行榜：训练时长、打卡天数
- 动态 Feed：好友训练/饮食记录动态

**技术要点**：
- 新增 `friendships` 表（双向关系）
- 排行榜用 Redis 缓存或定时聚合
- 隐私控制：用户可选择是否公开数据

**难度**：⭐⭐⭐⭐（较高）

---

#### 15. 多端扩展：微信小程序

**痛点**：PWA 在国内 iOS 生态体验受限，微信小程序更易触达用户。

**实现方案**：
- 使用 Taro 框架（可复用 React 代码）
- 复用现有后端 API
- 微信登录替换邮箱登录
- 小程序云开发或继续用 Vercel 后端

**技术要点**：
- 参考 [TRAE-generate-mini-app](../.trae/skills/) 技能生成 Taro 脚手架
- API 层需适配微信请求（`wx.request` → `Taro.request`）
- i18n 与 UI 组件大部分可复用

**难度**：⭐⭐⭐⭐⭐（高）

---

## 📈 优先级矩阵

| 功能 | 价值 | 难度 | 建议阶段 |
|------|------|------|---------|
| 数据可视化图表 | ⭐⭐⭐⭐⭐ | ⭐⭐ | P0 |
| 体重与体测追踪 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | P0 |
| 每日营养目标 | ⭐⭐⭐⭐ | ⭐⭐⭐ | P0 |
| 水分摄入追踪 | ⭐⭐⭐ | ⭐⭐ | P0 |
| AI 生成训练计划 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | P1 |
| 食物数据库 | ⭐⭐⭐⭐ | ⭐⭐⭐ | P1 |
| AI 对话助手 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P1 |
| 食物图片识别 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | P1 |
| 训练计时器 | ⭐⭐⭐⭐ | ⭐⭐⭐ | P2 |
| 习惯打卡与成就 | ⭐⭐⭐ | ⭐⭐⭐ | P2 |
| 数据导出 | ⭐⭐⭐ | ⭐⭐ | P2 |
| 通知提醒 | ⭐⭐⭐ | ⭐⭐⭐⭐ | P2 |
| 计划市场 | ⭐⭐ | ⭐⭐⭐ | P3 |
| 好友排行榜 | ⭐⭐ | ⭐⭐⭐⭐ | P3 |
| 微信小程序 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | P3 |

---

## 🛠️ 技术演进建议

### 数据库扩展原则
- 新表统一使用 `snake_case` + `@@map`，与现有 schema 一致
- 枚举字段用 `varchar + CHECK` 约束（不创建 PG 原生 enum）
- 时间戳用 `@db.Timestamptz`，日期用 `@db.Date`
- 高频查询字段加复合索引（如 `@@index([user_id, measured_at])`）

### 前端架构演进
- 状态管理：当前 Context + Hooks 够用，若引入实时聊天/排行榜再考虑 Zustand
- 图表库：推荐 `recharts`（轻量、React 友好）
- 离线支持：若实现 PWA Push，需引入 Service Worker（`vite-plugin-pwa`）
- 表单处理：复杂表单（如食物录入）可引入 `react-hook-form`

### 后端架构演进
- 定时任务（打卡重置、推送）：用 Vercel Cron Jobs
- 图片上传：Vercel Blob 或 Cloudflare R2
- 流式响应：Vercel Edge Functions 支持 SSE
- 缓存层：高频读接口（食物数据库）可引入 Upstash Redis

### 部署与运维
- 监控：Vercel Analytics + Sentry（错误监控）
- 日志：Vercel Functions Logs，必要时接入 Logtail
- CI/CD：当前 Git push 自动部署已够用，复杂化后可加 GitHub Actions 测试门禁

---

## 📝 实施建议

1. **小步快跑**：每个功能独立成 PR，避免大爆炸式发布
2. **数据先行**：涉及新表的功能，先设计 schema → 建表 → 写 API → 前端对接
3. **测试覆盖**：新 Hook 和页面延续现有 Vitest 测试模式，保持覆盖率
4. **文档同步**：每完成一个功能，更新对应实现文档
5. **用户反馈**：P0 功能上线后收集反馈，再决定 P1 优先级

---

## 🔗 相关文档

- [frontend-implementation.md](./frontend-implementation.md) — 当前前端实现
- [backend-implementation.md](./backend-implementation.md) — 当前后端实现
- [DEPLOY.md](./DEPLOY.md) — 部署指南
- [PROJECT_PLAN.md](./PROJECT_PLAN.md) — 项目初版计划（历史文档）
