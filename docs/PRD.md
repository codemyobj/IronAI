# IronAI 产品需求文档 (PRD)

> **版本**: v1.0  
> **更新日期**: 2026-08-12  
> **产品状态**: 已上线 (Vercel + Supabase)  
> **文档定位**: 基于已实现功能的完整产品规格说明，涵盖现状与规划功能

---

## 1. 产品概述

### 1.1 产品定位

IronAI 是一款 **AI 驱动的个人健身追踪应用**，面向健身爱好者提供训练计划管理、饮食记录、数据可视化与 AI 智能分析能力。应用采用移动优先 (Mobile-First) 设计，支持 PWA 添加到主屏幕，以翠绿色为核心品牌色，提供简洁、高效的数据记录与反馈体验。

### 1.2 目标用户

| 用户画像 | 特征 | 核心需求 |
|----------|------|----------|
| 健身初学者 | 刚开始系统训练，缺乏计划 | 预设训练计划、动作指导、AI 建议 |
| 进阶训练者 | 有训练经验，追求数据化 | 精细记录、趋势分析、周期对比 |
| 减脂/增肌人群 | 目标明确，关注饮食 | 卡路里追踪、宏量分配、体测变化 |
| 健身爱好者 | 长期记录，关注趋势 | 数据可视化、历史回顾、AI 洞察 |

### 1.3 核心价值

1. **一站式追踪** — 训练、饮食、体测数据统一管理
2. **AI 智能分析** — DeepSeek AI 提供个性化训练与饮食建议，回复语言跟随用户界面语言设置 (中/英/西)
3. **数据可视化** — 趋势图表直观展示进度
4. **移动原生体验** — PWA + 底部 Tab + 安全区域适配
5. **国际化** — 支持中文、英文、西班牙语三语切换

### 1.4 技术架构概览

| 层级 | 技术栈 |
|------|--------|
| 前端 | React 19 + Vite 8 + TypeScript 6 + react-router-dom 7 + axios + i18next + Recharts |
| 后端 | Express 5 + Prisma 5.22 + TypeScript 6 + JWT + bcryptjs + DeepSeek AI |
| 数据库 | PostgreSQL 15+ (Supabase 海外免费套餐, 连接池模式) |
| 部署 | Vercel (前端静态托管 + 后端 Serverless Function) |
| 包管理 | pnpm 工作区 (本地) / npm (Vercel 构建) |

---

## 2. 功能架构

### 2.1 功能地图

```
IronAI
├── 认证模块
│   ├── 注册 (邮箱 + 密码)
│   ├── 登录 (JWT 鉴权)
│   ├── 自动登出 (token 失效)
│   └── 用户档案 (年龄/身高/体重/健身目标)
│
├── Dashboard 首页
│   ├── 今日卡路里统计 (进度环)
│   ├── 训练会话统计 (进度环)
│   ├── 卡路里趋势折线图 (7天)
│   ├── 训练频率柱状图 (7天)
│   ├── 快捷操作 (开始训练/记录饮食/AI分析)
│   └── 最近训练记录列表
│
├── 训练模块
│   ├── 训练计划 CRUD (软删除)
│   ├── 练习管理 (增删/排序)
│   ├── 训练会话记录 (时长/强度)
│   ├── 会话历史查询
│   ├── 训练时长趋势柱状图
│   └── 肌群分布径向图
│
├── 饮食模块
│   ├── 饮食记录 CRUD (按日查询)
│   ├── 宏量营养素统计 (蛋白质/碳水/脂肪)
│   ├── 宏量分布饼图
│   ├── 周卡路里趋势折线图
│   ├── 餐食分组 (早餐/午餐/晚餐/加餐)
│   └── 周汇总统计
│
├── AI 分析模块
│   ├── AI 训练分析 (DeepSeek)
│   ├── AI 饮食建议 (DeepSeek)
│   ├── 历史分析记录
│   └── Markdown 渲染
│
└── 全局功能
    ├── 国际化 (EN / 中 / ES)
    ├── PWA (添加到主屏幕)
    ├── 骨架屏加载
    └── 底部 Tab 导航
```

### 2.2 页面路由

| 路由 | 页面 | 认证 | 说明 |
|------|------|------|------|
| `/login` | 登录页 | 公开 | 邮箱密码登录 |
| `/register` | 注册页 | 公开 | 邮箱密码注册 |
| `/dashboard` | 首页 | 需登录 | 数据概览 + 图表 + 快捷操作 |
| `/training` | 训练页 | 需登录 | 训练计划管理 + 会话记录 |
| `/diet` | 饮食页 | 需登录 | 饮食记录 + 宏量统计 |
| `/ai-analysis` | AI 分析页 | 需登录 | AI 分析 + 历史记录 |
| `/profile` | 我的页 | 需登录 | 个人信息管理 + 退出登录 |
| `*` | 重定向 | - | 默认跳转 `/dashboard` |

---

## 3. 功能规格说明

### 3.1 认证模块

#### 3.1.1 注册

- **入口**: `/register` 页面
- **输入**: 用户名、邮箱、密码
- **规则**:
  - 邮箱唯一性校验
  - 密码使用 bcryptjs 加密存储
  - 注册成功后自动登录并跳转 Dashboard
- **API**: `POST /api/auth/register`

#### 3.1.2 登录

- **入口**: `/login` 页面
- **输入**: 邮箱、密码
- **规则**:
  - 验证成功后返回 JWT token
  - Token 存储在 localStorage，axios 拦截器自动注入 Authorization Header
  - Token 失效时自动跳转登录页
- **API**: `POST /api/auth/login`

#### 3.1.3 用户档案

- **字段**: 姓名、年龄、身高 (cm)、体重 (kg)、健身目标
- **健身目标类型**: `general` (通用) / `weight_loss` (减脂) / `muscle_gain` (增肌) / `endurance` (耐力)
- **API**: `GET /api/auth/me` (获取当前用户信息)

---

### 3.2 Dashboard 首页

#### 3.2.1 数据统计卡片

| 卡片 | 数据源 | 展示形式 |
|------|--------|----------|
| 今日卡路里 | `GET /api/diet/records?date=today` | 数值 + 进度环 (目标 2200 kcal) |
| 训练会话数 | `GET /api/training/sessions?limit=5` | 数值 + 进度环 (目标 24 次/月) |

#### 3.2.2 数据可视化图表

| 图表 | 数据源 | 类型 |
|------|--------|------|
| 卡路里趋势 (7天) | `GET /api/diet/summary?start=7天前&end=今天` | 折线图 |
| 训练频率 (7天) | `GET /api/training/sessions` 聚合 | 柱状图 |

#### 3.2.3 快捷操作

| 操作 | 跳转目标 |
|------|----------|
| 开始训练 | `/training` |
| 记录饮食 | `/diet` |
| 查看统计 | 当前页滚动 |
| AI 分析 | `/ai-analysis` |

#### 3.2.4 最近训练记录

- 展示最近 5 条训练会话
- 每条显示: 计划名称、时间、时长、主观强度 (1-10)
- 数据源: `GET /api/training/sessions?limit=5`

---

### 3.3 训练模块

#### 3.3.1 训练计划管理

- **创建计划**: 名称、描述、难度 (beginner/intermediate/advanced)、目标肌群
- **编辑/删除**: 支持软删除 (`is_active = false`)
- **练习管理**: 每个计划下可添加多个练习
  - 练习字段: 名称、组数、次数、重量 (kg)、休息时间 (秒)、备注、排序
- **API 列表**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/training/programs` | 获取用户所有计划 |
| POST | `/api/training/programs` | 创建训练计划 |
| GET | `/api/training/programs/:id` | 获取计划详情 (含练习) |
| PUT | `/api/training/programs/:id` | 更新计划 |
| DELETE | `/api/training/programs/:id` | 删除计划 (软删除) |
| POST | `/api/training/programs/:programId/exercises` | 添加练习 |
| DELETE | `/api/training/exercises/:exerciseId` | 删除练习 |

#### 3.3.2 训练会话记录

- **记录内容**: 关联计划、开始时间、结束时间、时长 (分钟)、主观强度 (1-10)、备注
- **历史查询**: 支持按时间倒序查看会话历史
- **API 列表**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/training/sessions` | 获取会话历史 |
| POST | `/api/training/sessions` | 记录训练会话 |

#### 3.3.3 数据可视化

| 图表 | 数据源 | 类型 |
|------|--------|------|
| 训练时长趋势 | 最近 10 次会话 | 柱状图 (紫色) |
| 肌群分布 | 计划的 `target_muscle_group` | 径向条形图 |

---

### 3.4 饮食模块

#### 3.4.1 饮食记录管理

- **记录字段**: 餐食类型 (breakfast/lunch/dinner/snack)、食物名称、卡路里、蛋白质 (g)、碳水 (g)、脂肪 (g)、份量描述、记录日期
- **按日查询**: 指定日期查看当日所有饮食记录
- **餐食分组**: 自动按餐食类型分组展示
- **API 列表**:

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/diet/records?date=YYYY-MM-DD` | 查询指定日期记录 |
| POST | `/api/diet/records` | 添加饮食记录 |
| DELETE | `/api/diet/records/:id` | 删除饮食记录 |

#### 3.4.2 宏量营养素统计

- **当日统计**: 蛋白质、碳水、脂肪、卡路里总量
- **宏量分布饼图**: 直观展示三大营养素比例
- **周汇总**: `GET /api/diet/summary?start=&end=` 返回每日卡路里与宏量汇总

#### 3.4.3 数据可视化

| 图表 | 数据源 | 类型 |
|------|--------|------|
| 宏量营养素分布 | 当日记录汇总 | 饼图 |
| 周卡路里趋势 | `/api/diet/summary` | 折线图 |

---

### 3.5 AI 分析模块

#### 3.5.1 AI 训练分析

- **输入**: 用户最近训练数据 + 用户档案 + 当前界面语言 (`lang`)
- **输出**: Markdown 格式的训练分析报告 (语言跟随 `lang` 参数)
- **AI 引擎**: DeepSeek API
- **多语言**: 前端传入 `i18n.language`，后端通过 `getLanguageInstruction()` 在 system prompt 末尾注入语言指令 (zh/es/en)
- **API**: `POST /api/ai/training-analysis`

#### 3.5.2 AI 饮食建议

- **输入**: 用户最近饮食数据 + 用户档案 + 当前界面语言 (`lang`)
- **输出**: Markdown 格式的饮食建议报告 (语言跟随 `lang` 参数)
- **AI 引擎**: DeepSeek API
- **多语言**: 同上，通过 `getLanguageInstruction()` 注入语言指令
- **API**: `POST /api/ai/diet-recommendation`

#### 3.5.3 历史记录

- 按类型 (training/diet) 查看历史 AI 分析结果
- 点击历史项可重新查看分析内容
- **API**: `GET /api/ai/history?type=training|diet`

---

### 3.6 我的页面 (Profile)

#### 3.6.1 个人信息展示

- **顶部 Hero 卡片** (渐变品牌色背景):
  - 头像 (首字母占位圆形头像)
  - 姓名 + 邮箱
  - 健身目标胶囊 (🎯)
  - 「编辑资料」按钮
- **数据统计三宫格**：累计训练次数、累计饮食记录数、加入时间
- **信息列表** (Settings 风格卡片)：姓名 / 邮箱 / 年龄 / 身高 / 体重 / 健身目标

#### 3.6.2 编辑资料

- 底部弹出模态框 (Bottom Sheet)
- 可编辑字段：姓名、年龄、身高 (cm)、体重 (kg)、健身目标 (下拉选择：通用/减脂/增肌/耐力)
- 前端校验：数字为正数；后端白名单校验
- 保存后自动刷新 useAuth 中的 user，全站联动更新
- 底部 Tab 新增第 5 个 Tab "我的" (用户轮廓图标)

#### 3.6.3 退出登录

- 右上角按钮 → confirm 弹窗 → 清 token → 跳 `/login`

#### 3.6.4 API 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/profile/stats` | 返回 { totalTrainingSessions, totalDietRecords } |
| PUT | `/api/auth/profile` | 修改资料 (name/age/height_cm/weight_kg/fitness_goal) |

---

### 3.7 全局功能

#### 3.7.1 国际化 (i18n)

- **支持语言**: English (en) / 中文 (zh) / Español (es)
- **切换方式**: 固定在右上角的语言切换按钮，三语循环 (EN → 中 → ES)
- **持久化**: 语言选择存储在 localStorage (`i18nLang`)
- **翻译覆盖**: nav、auth、goals、dashboard、training、diet、ai、common、profile 模块

#### 3.7.2 PWA 支持

- **manifest.json**: 应用名称、图标、显示模式 (standalone)
- **添加到主屏幕**: iOS Safari + Android Chrome 支持
- **安全区域适配**: `env(safe-area-inset-*)` 适配刘海屏/底部安全区
- **动态视口**: `100dvh` 适配 iOS Safari 地址栏

#### 3.7.3 加载体验

- **骨架屏**: Dashboard、Training、Diet 页面均有骨架屏加载状态
- **Spinner**: AI 分析加载时显示旋转动画
- **空状态**: 无数据时显示引导文案 + 操作入口

#### 3.7.4 底部 Tab 导航

| Tab | 图标 (SVG 自绘) | 路由 |
|-----|------|------|
| 首页 | 带门房子轮廓 | `/dashboard` |
| 训练 | 闪电 | `/training` |
| 饮食 | 餐盘 + 爱心食物 | `/diet` |
| AI | 五角星 (四角装饰点) | `/ai-analysis` |
| 我的 | 人形轮廓 (头 + 肩) | `/profile` |

- 激活状态: 图标填充 + 品牌色高亮 + 轻微缩放 (1.05)
- 未激活: 2px 描边图标 + 次要文字色
- 5 Tab 时 < 400px 小屏幕自动收紧字号 (10px) 和图标尺寸 (22px)

---

## 4. 数据模型

### 4.1 ER 关系图

```
User (用户)
 ├── 1:N → TrainingProgram (训练计划)
 │           ├── 1:N → Exercise (练习)
 │           └── 1:N → TrainingSession (训练会话)
 ├── 1:N → DietRecord (饮食记录)
 └── 1:N → AIAnalysis (AI分析记录)
```

### 4.2 数据表定义

#### users (用户表)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK, AUTO | 主键 |
| email | VARCHAR(255) | UNIQUE, NOT NULL | 邮箱 |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt 加密密码 |
| name | VARCHAR(100) | NOT NULL | 用户名 |
| age | INT | NULL | 年龄 |
| height_cm | FLOAT | NULL | 身高 (cm) |
| weight_kg | FLOAT | NULL | 体重 (kg) |
| fitness_goal | VARCHAR(50) | DEFAULT 'general', CHECK | 健身目标 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

#### training_programs (训练计划表)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK, AUTO | 主键 |
| user_id | INT | FK → users.id, NOT NULL | 用户 ID |
| name | VARCHAR(200) | NOT NULL | 计划名称 |
| description | TEXT | NULL | 描述 |
| difficulty | VARCHAR(50) | DEFAULT 'beginner', CHECK | 难度 |
| target_muscle_group | VARCHAR(100) | NULL | 目标肌群 |
| is_active | BOOLEAN | DEFAULT TRUE | 是否活跃 (软删除) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

#### exercises (练习表)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK, AUTO | 主键 |
| program_id | INT | FK → training_programs.id, NOT NULL | 计划 ID |
| name | VARCHAR(200) | NOT NULL | 练习名称 |
| sets | INT | DEFAULT 3 | 组数 |
| reps | INT | DEFAULT 10 | 次数 |
| weight_kg | FLOAT | NULL | 重量 (kg) |
| rest_seconds | INT | DEFAULT 60 | 休息时间 (秒) |
| notes | TEXT | NULL | 备注 |
| sort_order | INT | DEFAULT 0 | 排序 |

#### training_sessions (训练会话表)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK, AUTO | 主键 |
| user_id | INT | FK → users.id, NOT NULL | 用户 ID |
| program_id | INT | FK → training_programs.id, NULL | 计划 ID (可空) |
| started_at | TIMESTAMPTZ | DEFAULT NOW() | 开始时间 |
| ended_at | TIMESTAMPTZ | NULL | 结束时间 |
| duration_minutes | INT | NULL | 时长 (分钟) |
| perceived_effort | INT | NULL | 主观强度 (1-10) |
| notes | TEXT | NULL | 备注 |

#### diet_records (饮食记录表)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK, AUTO | 主键 |
| user_id | INT | FK → users.id, NOT NULL | 用户 ID |
| meal_type | VARCHAR(20) | NOT NULL, CHECK | 餐食类型 |
| food_name | VARCHAR(300) | NOT NULL | 食物名称 |
| calories | INT | NULL | 卡路里 |
| protein_grams | FLOAT | NULL | 蛋白质 (g) |
| carbs_grams | FLOAT | NULL | 碳水 (g) |
| fat_grams | FLOAT | NULL | 脂肪 (g) |
| portion_description | VARCHAR(200) | NULL | 份量描述 |
| recorded_at | DATE | DEFAULT NOW() | 记录日期 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

#### ai_analyses (AI 分析记录表)

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | SERIAL | PK, AUTO | 主键 |
| user_id | INT | FK → users.id, NOT NULL | 用户 ID |
| analysis_type | VARCHAR(50) | NOT NULL | 分析类型 (training/diet) |
| request_data | JSONB | NULL | 请求数据 |
| response_text | TEXT | NOT NULL | AI 返回内容 (Markdown) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

### 4.3 CHECK 约束

| 表 | 字段 | 约束值 |
|------|------|------|
| users | fitness_goal | `general`, `weight_loss`, `muscle_gain`, `endurance` |
| training_programs | difficulty | `beginner`, `intermediate`, `advanced` |
| diet_records | meal_type | `breakfast`, `lunch`, `dinner`, `snack` |
| ai_analyses | analysis_type | `training`, `diet` |

---

## 5. UI/UX 设计规范

### 5.1 设计主题

- **品牌色**: 翠绿色 `#10b981` (Emerald)
- **设计风格**: 简约、现代、移动优先
- **核心原则**: 内容优先、拇指友好、即时反馈、一致性

### 5.2 颜色系统

| 用途 | 变量 | 色值 |
|------|------|------|
| 品牌主色 | `--primary` | `#10b981` |
| 品牌悬停 | `--primary-hover` | `#059669` |
| 品牌浅色 | `--primary-light` | `#ecfdf5` |
| 背景色 | `--bg` | `#f8fafc` |
| 卡片面 | `--surface` | `#ffffff` |
| 主文字 | `--text` | `#0f172a` |
| 次文字 | `--text-secondary` | `#475569` |
| 弱文字 | `--text-muted` | `#94a3b8` |
| 危险 | `--danger` | `#ef4444` |
| 警告 | `--warning` | `#f59e0b` |
| 信息 | `--info` | `#3b82f6` |

### 5.3 布局规范

| 元素 | 规格 |
|------|------|
| 内容最大宽度 | 480px (居中) |
| 底部导航高度 | 68px + safe-area |
| 卡片圆角 | 16px (`--radius`) |
| 按钮圆角 | 999px (全圆角) |
| 输入框圆角 | 10px (`--radius-sm`) |
| 模态框顶部圆角 | 24px (`--radius-xl`) |
| 卡片阴影 | `0 1px 2px rgba(0,0,0,0.04)` |
| 品牌阴影 | `0 4px 14px rgba(16,185,129,0.3)` |

### 5.4 组件清单

| 组件 | 说明 |
|------|------|
| 按钮 | Primary / Outline / Ghost / Danger / Small / Full |
| 表单 | 输入框 / 选择框 / 文本域 (focus 状态有品牌色光晕) |
| 统计卡片 | 数值 + 标签 + 进度环 (SVG) |
| 图表卡片 | 标题 + Recharts 图表 (折线/柱状/饼图/径向) |
| 训练计划卡片 | 标题 + 难度徽章 + 肌群 + 练习列表 |
| 饮食餐食组 | 餐食标题 + 卡路里 + 食物列表 |
| AI 操作卡片 | 图标 + 标题 + 描述 + 触发按钮 |
| 底部弹出模态框 | 遮罩层 + 滑入动画 + 拖拽指示条 |
| 骨架屏 | shimmer 动画 + 结构化占位 |
| 空状态 | 虚线边框 + 图标 + 引导文案 |
| 徽章 | 难度等级 / 肌群标签 (颜色区分) |
| 语言切换器 | 固定右上角 + 三语循环 |

### 5.5 交互规范

| 场景 | 交互方式 |
|------|----------|
| 页面切换 | 底部 Tab 点击，激活态图标填充 + 品牌色 |
| 数据录入 | 底部弹出模态框 (slideUp 动画 0.3s) |
| 卡片悬停 | translateY(-2px) + 阴影加深 |
| 按钮点击 | translateY(0) 回弹 |
| 加载状态 | 骨架屏 (shimmer 1.4s) → 数据渲染 |
| AI 分析中 | Spinner 旋转动画 + 等待文案 |
| 图表交互 | 触摸悬浮显示 Tooltip |
| 语言切换 | 点击按钮即时切换，无页面刷新 |

---

## 6. API 规范

### 6.1 认证 API

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| POST | `/api/auth/register` | `{ name, email, password }` | `{ token, user }` |
| POST | `/api/auth/login` | `{ email, password }` | `{ token, user }` |
| GET | `/api/auth/me` | — (需 Authorization) | `{ user }` |

### 6.2 训练 API

| 方法 | 路径 | 参数/请求体 | 响应 |
|------|------|-------------|------|
| GET | `/api/training/programs` | — | `{ programs: [...] }` |
| POST | `/api/training/programs` | `{ name, description?, difficulty?, target_muscle_group? }` | `{ program }` |
| GET | `/api/training/programs/:id` | — | `{ program, exercises: [...] }` |
| PUT | `/api/training/programs/:id` | `{ name?, description?, ... }` | `{ program }` |
| DELETE | `/api/training/programs/:id` | — | `{ success: true }` |
| POST | `/api/training/programs/:programId/exercises` | `{ name, sets?, reps?, weight_kg?, rest_seconds? }` | `{ exercise }` |
| DELETE | `/api/training/exercises/:exerciseId` | — | `{ success: true }` |
| GET | `/api/training/sessions` | `?limit=N` | `{ sessions: [...] }` |
| POST | `/api/training/sessions` | `{ program_id?, duration_minutes?, perceived_effort?, notes? }` | `{ session }` |

### 6.3 饮食 API

| 方法 | 路径 | 参数/请求体 | 响应 |
|------|------|-------------|------|
| GET | `/api/diet/records` | `?date=YYYY-MM-DD` | `{ records: [...] }` |
| POST | `/api/diet/records` | `{ meal_type, food_name, calories?, protein_grams?, carbs_grams?, fat_grams?, portion_description?, recorded_at? }` | `{ record }` |
| DELETE | `/api/diet/records/:id` | — | `{ success: true }` |
| GET | `/api/diet/summary` | `?start=YYYY-MM-DD&end=YYYY-MM-DD` | `{ dailyBreakdown: [...], totals: {...} }` |

### 6.4 AI 分析 API

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| POST | `/api/ai/training-analysis` | `{ lang?: 'zh'\|'en'\|'es' }` (默认 en) | `{ analysis, generatedAt }` |
| POST | `/api/ai/diet-recommendation` | `{ lang?: 'zh'\|'en'\|'es' }` (默认 en) | `{ recommendation, generatedAt }` |
| GET | `/api/ai/history` | `?type=training\|diet` | `{ analyses: [...] }` |

### 6.5 个人资料 API

| 方法 | 路径 | 请求体 | 响应 |
|------|------|--------|------|
| GET | `/api/auth/profile/stats` | — | `{ totalTrainingSessions, totalDietRecords }` |
| PUT | `/api/auth/profile` | `{ name?, age?, height_cm?, weight_kg?, fitness_goal? }` | `{ user }` |

### 6.6 通用规范

- **认证**: 除注册/登录外，所有接口需要 `Authorization: Bearer <token>` Header
- **错误格式**: `{ error: "错误描述" }`, HTTP 状态码 400/401/404/500
- **数据库连接**: 使用 Supabase PgBouncer 连接池，`statement_cache_size=0` 避免 42P05 错误
- **NUMERIC 处理**: PostgreSQL NUMERIC 类型返回字符串，前端使用 `Number()` 转换

---

## 7. 非功能性需求

### 7.1 性能

| 指标 | 目标 |
|------|------|
| 首屏加载 (FCP) | < 1.5s (Vercel CDN) |
| API 响应 (P95) | < 300ms (不含 AI 接口) |
| AI 分析响应 | < 15s (DeepSeek API) |
| 图表渲染 | < 500ms |
| 骨架屏显示 | 数据请求立即展示 |

### 7.2 安全

| 要求 | 实现 |
|------|------|
| 密码加密 | bcryptjs (salt rounds: 10) |
| 接口鉴权 | JWT token + authMiddleware |
| SQL 注入防护 | Prisma ORM 参数化查询 |
| XSS 防护 | React 默认转义 + Markdown 渲染 sanitize |
| CORS | 生产环境限制 origin |
| SSL | 数据库连接强制 SSL (`rejectUnauthorized: false`) |

### 7.3 兼容性

| 平台 | 要求 |
|------|------|
| iOS Safari | 16.4+ (PWA + 100dvh 支持) |
| Android Chrome | 90+ |
| 桌面浏览器 | Chrome / Edge / Firefox / Safari 最新版 |
| 响应式 | 320px ~ 1920px，移动优先布局 |

### 7.4 可用性

| 要求 | 实现 |
|------|------|
| 离线提示 | 网络断开时 API 请求失败提示 |
| 空状态引导 | 无数据时显示操作入口 |
| 错误恢复 | 表单提交失败保留输入内容 |
| 加载反馈 | 骨架屏 + Spinner 双重反馈 |
| 安全区域 | 适配刘海屏顶部 + 底部 Home Indicator |

---

## 8. 规划功能 (待实现)

> 以下功能来自 [feature-roadmap.md](./feature-roadmap.md)，按优先级分层排列。

### 8.1 P0 — 核心体验补全

| 功能 | 价值 | 难度 | 状态 |
|------|------|------|------|
| 数据可视化图表 | ⭐⭐⭐⭐⭐ | ⭐⭐ | ✅ 已实现 |
| 体重与体测追踪 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 🔲 UI 已设计 |
| 每日营养目标与进度 | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🔲 待开发 |
| 水分摄入追踪 | ⭐⭐⭐ | ⭐⭐ | 🔲 待开发 |

#### 体重与体测追踪 (下一优先级)

- **数据模型**: 新增 `body_measurements` 表 (weight_kg, body_fat_pct, muscle_mass_kg, waist_cm, measured_at)
- **API**: `GET/POST /api/body/measurements`
- **UI**: 体测页 Hero 卡片 + 体重趋势折线图 (带目标线) + 体脂趋势 + Dashboard 嵌入卡片
- **AI 集成**: 体测趋势数据注入 AI 分析上下文
- **设计稿**: 见 [ui-ux-design.html](../ui-ux-design.html) 第 7 节

#### 每日营养目标与进度

- **算法**: Mifflin-St Jeor 公式计算 BMR → TDEE → 目标卡路里
- **宏量分配**: 蛋白质 1.6-2.2g/kg、脂肪 0.8-1g/kg、碳水补余
- **UI**: ProgressRing 改为动态目标 + "今日剩余"展示
- **前置条件**: 用户需补充性别和活动水平字段

### 8.2 P1 — 智能化增强

| 功能 | 价值 | 难度 | 状态 |
|------|------|------|------|
| AI 对话式助手 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🔲 待开发 |
| AI 生成训练计划 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 🔲 待开发 |
| 食物图片识别 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 🔲 待开发 |
| 常见食物数据库 | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🔲 待开发 |

### 8.3 P2 — 体验优化

| 功能 | 价值 | 难度 | 状态 |
|------|------|------|------|
| 训练计时器与引导 | ⭐⭐⭐⭐ | ⭐⭐⭐ | 🔲 待开发 |
| 习惯打卡与成就系统 | ⭐⭐⭐ | ⭐⭐⭐ | 🔲 待开发 |
| 数据导出与报告 | ⭐⭐⭐ | ⭐⭐ | 🔲 待开发 |
| 通知与提醒 | ⭐⭐⭐ | ⭐⭐⭐⭐ | 🔲 待开发 |

### 8.4 P3 — 社交与生态扩展

| 功能 | 价值 | 难度 | 状态 |
|------|------|------|------|
| 训练计划市场 | ⭐⭐ | ⭐⭐⭐ | 🔲 待开发 |
| 好友与排行榜 | ⭐⭐ | ⭐⭐⭐⭐ | 🔲 待开发 |
| 微信小程序 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 🔲 待开发 |

---

## 9. 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| v1.2 | 2026-08-12 | 新增「我的」页面（资料编辑 + 统计 + 退出登录），底部 Tab 从 4 个增至 5 个，Icon 风格调整（参照设计图：房子/闪电/餐盘+爱心/星星+装饰点/人形），国际化新增 profile 模块 28 个翻译键，后端新增 `/auth/profile` 与 `/auth/profile/stats` |
| v1.1 | 2026-08-12 | AI 分析模块新增多语言支持：前端传 `lang` 参数，后端注入语言指令到 system prompt |
| v1.0 | 2026-08-12 | 初始 PRD，覆盖全部已实现功能 |

---

## 10. 相关文档

| 文档 | 说明 |
|------|------|
| [frontend-implementation.md](./frontend-implementation.md) | 前端实现细节 |
| [backend-implementation.md](./backend-implementation.md) | 后端实现细节 |
| [feature-roadmap.md](./feature-roadmap.md) | 功能规划与扩展建议 |
| [DEPLOY.md](./DEPLOY.md) | 部署指南 |
| [issue-42p05-prisma-pgbouncer.md](./issue-42p05-prisma-pgbouncer.md) | Prisma + PgBouncer 故障记录 |
| [../ui-ux-design.html](../ui-ux-design.html) | UI/UX 设计系统与页面原型 |
