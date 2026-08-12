# IronAI 前端实现文档

> 本文档详细说明 IronAI 客户端（`client/`）的架构设计、目录结构、核心模块实现细节与关键技术决策，供团队成员快速熟悉前端代码库。

## 目录

- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [入口与路由](#入口与路由)
- [状态管理与 Hooks](#状态管理与-hooks)
- [API 层](#api-层)
- [页面组件](#页面组件)
- [国际化（i18n）](#国际化i18n)
- [样式方案](#样式方案)
- [PWA 配置](#pwa-配置)
- [类型定义](#类型定义)
- [单元测试](#单元测试)
- [构建配置](#构建配置)
- [开发命令](#开发命令)

---

## 技术栈

| 类别 | 选型 | 版本 |
|------|------|------|
| 框架 | React | 19.2 |
| 构建工具 | Vite | 8.x |
| 语言 | TypeScript | 6.0 |
| 路由 | react-router-dom | 7.18 |
| HTTP 客户端 | axios | 1.18 |
| 国际化 | i18next + react-i18next | 26.x / 17.x |
| Markdown 渲染 | react-markdown | 10.1 |
| 测试框架 | Vitest | 4.x |
| 测试工具 | @testing-library/react | 16.3 |
| 包管理 | pnpm（本地）/ npm（Vercel 构建） | — |

---

## 目录结构

```
client/
├── public/                  # 静态资源
│   ├── manifest.json        # PWA 清单
│   ├── apple-touch-icon.png # iOS 主屏图标
│   ├── icon-192.png         # PWA 图标 192x192
│   ├── icon-512.png         # PWA 图标 512x512
│   ├── app-icon.svg         # 应用图标 SVG
│   ├── icons.svg            # 图标集合 SVG
│   └── favicon.svg          # 浏览器标签页图标
├── src/
│   ├── api/
│   │   └── index.ts         # axios 实例与拦截器
│   ├── assets/              # 静态图片资源
│   ├── components/
│   │   ├── Layout.tsx       # 应用主布局（Navbar + Outlet）
│   │   ├── Navbar.tsx       # 底部 Tab 导航
│   │   ├── ProtectedRoute.tsx # 路由守卫
│   │   ├── LanguageSwitcher.tsx # 语言切换按钮
│   │   └── Skeleton.tsx     # 骨架屏组件（Dashboard/Training/Diet）
│   ├── hooks/
│   │   ├── useAuth.tsx      # 认证 Context Hook
│   │   ├── useDiet.ts       # 饮食数据 Hook
│   │   ├── useTraining.ts   # 训练数据 Hook
│   │   └── *.test.ts(x)     # Hook 单元测试
│   ├── i18n/
│   │   ├── index.ts         # i18next 配置
│   │   ├── en.json          # 英文语言包
│   │   └── zh.json          # 中文语言包
│   ├── pages/
│   │   ├── LoginPage.tsx        # 登录页
│   │   ├── RegisterPage.tsx     # 注册页
│   │   ├── DashboardPage.tsx    # 仪表盘
│   │   ├── TrainingPage.tsx     # 训练管理
│   │   ├── DietPage.tsx         # 饮食追踪
│   │   ├── AIAnalysisPage.tsx   # AI 分析
│   │   └── *.test.tsx           # 页面单元测试
│   ├── test/
│   │   └── setup.ts         # Vitest 测试 setup
│   ├── types/
│   │   └── index.ts         # 全局类型定义
│   ├── App.tsx              # 根组件（路由配置）
│   ├── App.css              # App 级样式（保留占位）
│   ├── index.css            # 全局样式（主题、组件、布局）
│   └── main.tsx             # 应用入口
├── index.html               # HTML 模板（含 PWA meta 标签）
├── vite.config.ts           # Vite 构建配置
├── vitest.config.ts         # Vitest 测试配置
├── eslint.config.js         # ESLint 配置（扁平化格式）
├── .oxlintrc.json           # oxlint 配置（备用 linter）
├── tsconfig.json            # TypeScript 根配置（项目引用）
├── tsconfig.app.json        # 应用代码 TS 配置（src/）
└── tsconfig.node.json       # Node 端 TS 配置（vite.config.ts）
```

---

## 入口与路由

### 应用入口 [main.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/main.tsx)

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'        // 初始化国际化
import './index.css'   // 全局样式
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

**关键点**：
- 使用 React 19 的 `createRoot` API
- 启用 `StrictMode` 以便开发环境检测副作用问题
- 在入口处加载 i18n 配置，确保所有组件渲染时 `t()` 函数可用

### 路由配置 [App.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/App.tsx)

采用 `react-router-dom` v7 的声明式路由，分为**公开路由**与**受保护路由**两类：

```typescript
<AuthProvider>
  <BrowserRouter>
    <LanguageSwitcher />
    <Routes>
      {/* 公开路由 — 未登录可访问 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 受保护路由 — 套上 Layout 与 ProtectedRoute */}
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/training" element={<TrainingPage />} />
        <Route path="/diet" element={<DietPage />} />
        <Route path="/ai-analysis" element={<AIAnalysisPage />} />
      </Route>

      {/* 通配重定向 */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  </BrowserRouter>
</AuthProvider>
```

**设计要点**：
- `AuthProvider` 在最外层包裹整个应用，确保任何组件都能访问认证状态
- 受保护路由通过嵌套 `<Route element={...}>` 结构，使 `Layout` 内的子路由共享同一导航栏
- `Layout` 使用 `<Outlet />` 渲染子路由对应的页面组件
- 未匹配路径统一重定向到 `/dashboard`，由 `ProtectedRoute` 决定最终去向

### 路由守卫 [ProtectedRoute.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/components/ProtectedRoute.tsx)

```typescript
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;

  return children;
}
```

- `loading` 期间显示 Loading 提示，避免初次刷新时闪烁登录页
- 未登录用户被重定向到 `/login`
- 登录后用户可正常访问受保护页面

---

## 状态管理与 Hooks

项目采用 **React Context + 自定义 Hooks** 的轻量状态管理方案，未引入 Redux 等外部状态库。

### 1. 认证 Hook — [useAuth.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/hooks/useAuth.tsx)

通过 `Context + Provider` 模式在全局共享认证状态。

**Context 契约**：
```typescript
interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  loading: boolean;
}
```

**核心逻辑**：
- **初始化**：`useEffect` 检查 `localStorage` 中的 token，若存在则调用 `GET /auth/me` 获取用户信息；token 无效时自动清除
- **登录**：`POST /auth/login` → 存储 token → 设置 user
- **注册**：`POST /auth/register` → 存储 token → 设置 user
- **登出**：清除 token 与 user 状态
- **loading 状态**：初始为 `true`，在用户信息加载完成后置为 `false`，供 `ProtectedRoute` 判断

### 2. 饮食 Hook — [useDiet.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/hooks/useDiet.ts)

管理饮食记录的增删改查与汇总统计。

**返回值**：
```typescript
{
  records: DietRecord[];           // 当日饮食记录
  selectedDate: string;            // 当前选中日期 YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  summary: DietSummary | null;     // 周汇总
  dailyBreakdown: DailyBreakdown[];// 每日营养分解
  loading: boolean;
  error: string;
  fetchRecords: (date?: string) => Promise<void>;
  fetchSummary: (start: string, end: string) => Promise<void>;
  addRecord: (data) => Promise<DietRecord>;
  deleteRecord: (id: number) => Promise<void>;
}
```

**关键设计**：
- `selectedDate` 作为状态，变化时自动触发 `fetchRecords`（通过 `useEffect` 依赖）
- 挂载时自动获取最近 7 天的汇总数据
- `addRecord` / `deleteRecord` 采用**乐观更新**策略：先更新本地 state，API 失败时由调用方处理错误

### 3. 训练 Hook — [useTraining.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/hooks/useTraining.ts)

管理训练计划、练习与会话记录。

**返回值**：
```typescript
{
  programs: TrainingProgram[];
  loading: boolean;
  error: string;
  fetchPrograms: () => Promise<void>;
  fetchProgram: (id: number) => Promise<TrainingProgram | null>;
  createProgram: (data) => Promise<TrainingProgram>;
  deleteProgram: (id: number) => Promise<void>;
  addExercise: (programId: number, data) => Promise<Exercise>;
  deleteExercise: (exerciseId: number) => Promise<void>;
  logSession: (data) => Promise<Session>;
}
```

**设计要点**：
- `fetchPrograms` 用 `useCallback` 包裹，避免 `useEffect` 依赖告警
- `createProgram` 成功后**前置插入**新计划到列表（`[newProgram, ...prev]`），符合"最新优先"的 UX 期望
- `fetchProgram` 用于获取单个计划详情（含 exercises），供模态框展示

---

## API 层

### axios 实例 — [api/index.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/api/index.ts)

```typescript
const apiClient = axios.create({
    baseURL: '/api'
})

// 请求拦截器：自动注入 JWT
apiClient.interceptors.request.use(config => {
    const token = localStorage.getItem('token')
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// 响应拦截器：401 自动登出
apiClient.interceptors.response.use(res => res, error => {
    if (error.response?.status === 401) {
        localStorage.removeItem('token')
        window.location.href = '/login'
    }
    return Promise.reject(error)
})
```

**关键设计**：
- `baseURL: '/api'` — 开发环境通过 Vite proxy 转发到 `http://localhost:8080`，生产环境通过 Vercel rewrites 转发到 Serverless Function
- **请求拦截器**：每次请求自动从 `localStorage` 读取 token 并注入 `Authorization` 头
- **响应拦截器**：捕获 401 状态码，自动清除 token 并跳转登录页，避免过期 token 残留
- 错误向上抛出，由各调用方（Hook 或页面）自行处理错误提示

---

## 页面组件

### 1. 登录页 [LoginPage.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/LoginPage.tsx)

- 表单字段：email + password
- 客户端校验：非空检查
- 调用 `useAuth().login()`，成功后 `navigate('/dashboard')`
- 错误提示通过 `alert-error` 样式展示

### 2. 注册页 [RegisterPage.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/RegisterPage.tsx)

- 表单字段：name + email + password + fitness_goal（下拉）+ age/height/weight（可选数字）
- 客户端校验：
  - 必填字段：email、password、name
  - 密码长度 ≥ 6
  - email 必须包含 `@`
- 健身目标枚举：`general` / `lose_weight` / `build_muscle` / `endurance`

### 3. 仪表盘 [DashboardPage.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/DashboardPage.tsx)

聚合展示用户当日核心数据。

**数据加载**：使用 `Promise.all` 并发请求三个接口
```typescript
const [programsRes, sessionsRes, dietRes] = await Promise.all([
  apiClient.get('/training/programs'),
  apiClient.get('/training/sessions', { params: { limit: 5 } }),
  apiClient.get('/diet/records', { params: { date: today } }),
]);
```

**关键组件**：
- `ProgressRing` — SVG 环形进度条，展示今日卡路里占目标比例（目标 2200 kcal）
- `stats-grid` — 三张统计卡（今日卡路里、训练计划数、最近会话数）
- `quick-actions` — 四个快捷入口卡片
- `session-list` — 最近 5 次训练会话列表

**数值处理**：因 PostgreSQL NUMERIC 类型可能返回字符串，使用 `Number(r.calories || 0)` 防御性转换：
```typescript
const todayCalories = dietRes.data.records.reduce(
  (sum: number, r: any) => sum + Number(r.calories || 0),
  0
);
```

### 4. 训练页 [TrainingPage.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/TrainingPage.tsx)

功能最复杂的页面，包含四个模态框：
- **创建计划模态**：名称、描述、难度、目标肌群
- **计划详情模态**：展示练习列表，支持添加/删除练习
- **记录会话模态**：选择计划（可选）、时长、感知强度（1-10）、备注
- **会话历史模态**：展示最近 20 次训练记录

**难点处理**：
- 添加/删除练习后，通过 `fetchProgram(id)` 重新获取详情以刷新 exercises 列表
- 删除操作通过原生 `confirm()` 二次确认（已国际化文案）
- `loadSessions` 采用动态 `import('../api')` 以避免重复导入

### 5. 饮食页 [DietPage.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/DietPage.tsx)

- **日期导航**：前/后一天按钮 + 原生日期选择器 + "今天"快捷按钮
- **宏量营养素栏**：展示当日总卡路里、蛋白质、碳水、脂肪（2×2 网格）
- **餐类分组**：按 breakfast/lunch/dinner/snack 分组展示
- **添加食物模态**：餐类、食物名、分量、卡路里、蛋白质、碳水、脂肪
- **周汇总**：展示最近 7 天每日卡路里与宏量分布，计算周均值与总蛋白质

**数值防御**：所有来自后端的数值字段都通过 `Number()` 转换，避免 NUMERIC 字符串导致 `toFixed` 报错：
```typescript
<span className="macro-value">{Number(todayTotals.protein).toFixed(1)}g</span>
```

### 6. AI 分析页 [AIAnalysisPage.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/AIAnalysisPage.tsx)

- **两种分析模式**：
  - 训练分析 → `POST /ai/training-analysis` → 返回 `analysis` 字段
  - 饮食建议 → `POST /ai/diet-recommendation` → 返回 `recommendation` 字段
- **加载状态**：spinner + 文案提示"可能需要 10-30 秒"
- **结果渲染**：使用 `react-markdown` 渲染 AI 返回的 Markdown 文本
- **历史记录模态**：`GET /ai/history` 获取历史分析列表，点击可重新查看
- **错误处理**：502 状态码特殊提示"AI 服务不可用"（指向 DeepSeek API key 配置问题）

---

## 国际化（i18n）

### 配置 — [i18n/index.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/i18n/index.ts)

```typescript
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'zh'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nLang',
      caches: ['localStorage'],
    },
  });
```

**设计要点**：
- 支持**中文（zh）**与**英文（en）**两种语言
- **语言检测顺序**：先查 `localStorage` 的 `i18nLang` 键，其次浏览器语言
- 用户切换语言后写入 `localStorage`，刷新后保持选择
- `interpolation.escapeValue: false` — React 已自动转义，无需 i18next 二次处理

### 语言包结构

[zh.json](file:///d:/学习/全栈/projects/web端/IronAI/client/src/i18n/zh.json) 与 [en.json](file:///d:/学习/全栈/projects/web端/IronAI/client/src/i18n/en.json) 结构完全对称，按模块组织：

```json
{
  "nav": { "home": "首页", "train": "训练", "diet": "饮食", "ai": "AI" },
  "auth": { "login": {...}, "register": {...} },
  "goals": { "weight_loss": "...", "build_muscle": "...", ... },
  "dashboard": { "greeting": "你好，{{name}}！", ... },
  "training": {...},
  "diet": {...},
  "ai": {...},
  "common": { "logout": "...", "delete": "...", ... }
}
```

**插值示例**：`t('dashboard.greeting', { name: user.name })` → "你好，张三！"

### 语言切换器 [LanguageSwitcher.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/components/LanguageSwitcher.tsx)

固定在右上角的浮动按钮，点击在中英文之间切换：
- 当前是中文 → 显示 "EN"（点击切英文）
- 当前是英文 → 显示 "中"（点击切中文）

---

## 样式方案

采用**原生 CSS + CSS 变量**的方案，未使用 CSS-in-JS 或预处理器。

### 全局样式 — [index.css](file:///d:/学习/全栈/projects/web端/IronAI/client/src/index.css)

#### CSS 变量主题

```css
:root {
  /* 品牌色 — 翡翠绿 */
  --primary: #10b981;
  --primary-hover: #059669;
  --primary-light: #ecfdf5;
  --primary-soft: rgba(16, 185, 129, 0.1);

  /* 中性色 */
  --bg: #f8fafc;
  --surface: #ffffff;
  --border: #e2e8f0;

  /* 文本色 */
  --text: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;

  /* 语义色 */
  --danger: #ef4444;
  --warning: #f59e0b;
  --info: #3b82f6;

  /* 圆角 */
  --radius-sm: 10px;
  --radius: 16px;
  --radius-lg: 20px;
  --radius-xl: 24px;
  --radius-full: 999px;

  /* 阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.12);
  --shadow-brand: 0 4px 14px rgba(16, 185, 129, 0.3);
}
```

#### 布局策略 — 移动优先

```css
.main-content {
  max-width: 480px;          /* 限制最大宽度，模拟移动端体验 */
  margin: 0 auto;
  padding: 24px 20px calc(100px + env(safe-area-inset-bottom));
}

.navbar {
  position: fixed;
  bottom: 0;                 /* 底部固定 Tab 导航 */
  max-width: 480px;
  height: calc(68px + env(safe-area-inset-bottom));
}
```

- **max-width: 480px** — 即使在桌面端也保持移动端宽度，居中展示
- **底部 Tab 导航** — 模拟原生 App 的导航模式
- **env(safe-area-inset-bottom)** — 适配 iPhone 等设备的底部安全区域

#### 骨架屏 — [Skeleton.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/components/Skeleton.tsx)

为 Dashboard、Training、Diet 三个页面分别提供布局一致的骨架屏，加载时展示：

```css
.skeleton {
  background: linear-gradient(90deg,
    var(--surface-hover) 0%,
    var(--border) 50%,
    var(--surface-hover) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

骨架屏的 DOM 结构与真实页面保持一致，避免加载完成后布局跳动。

#### 模态框 — 底部抽屉式

```css
.modal-overlay {
  align-items: flex-end;            /* 从底部弹出 */
}

.modal {
  border-radius: 24px 24px 0 0;     /* 顶部圆角 */
  animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  max-height: 85vh;
  overflow-y: auto;
}

.modal-header::before {
  /* 顶部抓手装饰 */
  content: '';
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
}
```

#### 响应式断点

```css
@media (min-width: 768px) {
  .main-content { padding-top: 40px; }
  .ai-actions { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 480px) {
  .form-row { flex-direction: column; }  /* 窄屏表单字段堆叠 */
  .quick-actions { grid-template-columns: 1fr 1fr; }
}
```

---

## PWA 配置

使应用可"添加到主屏幕"，在 iOS Safari 上实现全屏原生 App 体验。

### manifest.json — [public/manifest.json](file:///d:/学习/全栈/projects/web端/IronAI/client/public/manifest.json)

```json
{
  "name": "IronAI — Workout & Diet AI Coach",
  "short_name": "IronAI",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0f172a",
  "theme_color": "#10b981",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
    { "src": "/app-icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

### HTML meta 标签 — [index.html](file:///d:/学习/全栈/projects/web端/IronAI/client/index.html)

```html
<!-- PWA Manifest -->
<link rel="manifest" href="/manifest.json" />

<!-- iOS PWA：全屏模式 + 主屏幕图标 -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="IronAI" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

<!-- 主题色 -->
<meta name="theme-color" content="#10b981" />

<!-- 视口 — 禁用缩放，适配刘海屏 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

**关键点**：
- `viewport-fit=cover` + `env(safe-area-inset-*)` 配合处理 iPhone 刘海与底部 Home Indicator
- `apple-mobile-web-app-status-bar-style: black-translucent` — 状态栏透明，内容延伸到状态栏下方
- 提供 192/512 PNG + SVG 三种尺寸图标，覆盖各平台需求

---

## 类型定义

### 全局类型 — [types/index.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/types/index.ts)

```typescript
export interface RegisterData {
    email: string
    password: string
    name: string
    age?: number
    height_cm?: number
    weight_kg?: number
    fitness_goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general'
}

export interface User {
    id: number
    email: string
    name: string
    age?: number
    height_cm?: number
    weight_kg?: number
    fitness_goal?: 'lose_weight' | 'build_muscle' | 'endurance' | 'general'
}

export interface TrainingProgram {
    id: number
    user_id: number
    name: string
    description: string
    difficulty: 'beginner' | 'intermediate' | 'advanced'
    target_muscle_group: string
    exercises: Exercise[]
}

export interface Exercise {
    id: number
    program_id: number
    name: string
    sets: number
    reps: number
    weight_kg: number
    rest_seconds: number
}

export interface DietRecord {
    id: number;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    food_name: string;
    calories: number;
    protein_grams: number;
    carbs_grams: number;
    fat_grams: number;
    portion_description?: string;
    recorded_at: string;
}

export interface AIAnalysis {
    id: number;
    analysis_type: 'training' | 'diet';
    response_text: string;
    created_at: string;
}
```

**设计要点**：
- 字段命名与后端 Prisma schema 的 snake_case 保持一致，避免前后端字段映射
- 联合字面量类型（如 `meal_type`、`difficulty`、`fitness_goal`）提供编译期校验
- 可选字段统一使用 `?` 标注，与后端 nullable 列对应

---

## 单元测试

### 测试框架

- **Vitest** — Vite 原生测试框架，零配置集成
- **@testing-library/react** — 组件测试工具库
- **@testing-library/user-event** — 模拟真实用户交互
- **jsdom** — 浏览器环境模拟

### 测试配置 — [vitest.config.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/vitest.config.ts)

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,                    // 启用全局 API（describe/it/expect）
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,                       // 测试不处理 CSS
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'src/test/'],
    },
  },
})
```

### 测试 Setup — [test/setup.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/test/setup.ts)

```typescript
import '@testing-library/jest-dom/vitest'  // jest-dom 断言扩展
import '../i18n'                            // 初始化 i18n（测试中 t() 可用）

beforeEach(() => {
  localStorage.clear()                      // 每个用例前清理 localStorage
})
```

### TypeScript 配置 — [tsconfig.app.json](file:///d:/学习/全栈/projects/web端/IronAI/client/tsconfig.app.json)

```json
{
  "compilerOptions": {
    "types": ["vite/client", "vitest/globals"]
  }
}
```

> ⚠️ `vitest/globals` 必须加入 `types`，否则 `beforeEach`、`describe` 等全局 API 会被 TS 报为 `Cannot find name`。

### 测试覆盖

| 测试文件 | 覆盖内容 |
|---------|---------|
| [useAuth.test.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/hooks/useAuth.test.tsx) | 登录、注册、登出、token 持久化、加载状态 |
| [useDiet.test.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/hooks/useDiet.test.ts) | 记录获取、添加、删除、日期切换、错误处理、NUMERIC 字符串兼容 |
| [useTraining.test.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/src/hooks/useTraining.test.ts) | 计划 CRUD、练习管理、会话记录 |
| [DashboardPage.test.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/DashboardPage.test.tsx) | 加载骨架、统计卡、快捷操作、会话列表、API 错误 |
| [DietPage.test.tsx](file:///d:/学习/全栈/projects/web端/IronAI/client/src/pages/DietPage.test.tsx) | 记录展示、宏量统计、空状态、添加食物表单、删除确认 |

### 测试约定

- **Mock API**：通过 `vi.mock('../api', ...)` 替换 axios 实例，避免真实网络请求
- **Mock Hook**：页面测试中 mock 掉自定义 Hook（如 `useDiet`），聚焦 UI 层逻辑
- **i18n 初始化**：setup 文件中导入 i18n，确保 `t()` 在测试中返回真实文案
- **NUMERIC 兼容测试**：专门编写用例验证后端返回字符串数值时的渲染正确性

---

## 构建配置

### Vite 配置 — [vite.config.ts](file:///d:/学习/全栈/projects/web端/IronAI/client/vite.config.ts)

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',   // 开发环境代理到后端
    },
  },
})
```

- **开发代理**：`/api/*` 请求转发到 `http://localhost:8080`（Express 后端），前后端独立运行
- **生产部署**：依赖 `vercel.json` 的 rewrites 规则将 `/api/*` 路由到 Serverless Function

### TypeScript 配置

项目采用 **项目引用（Project References）** 模式：

- [tsconfig.json](file:///d:/学习/全栈/projects/web端/IronAI/client/tsconfig.json) — 根配置，仅引用两个子配置
- [tsconfig.app.json](file:///d:/学习/全栈/projects/web端/IronAI/client/tsconfig.app.json) — 应用代码（src/）
- [tsconfig.node.json](file:///d:/学习/全栈/projects/web端/IronAI/client/tsconfig.node.json) — Node 端代码（vite.config.ts）

**严格模式要点**：
- `noUnusedLocals: true` — 未使用的局部变量报错（注意：`_` 前缀只对参数有效，对局部变量无效）
- `noUnusedParameters: true` — 未使用的参数报错（`_` 前缀可跳过）
- `verbatimModuleSyntax: true` — 强制 type-only 导入使用 `import type`
- `erasableSyntaxOnly: true` — 禁止运行时不可擦除的 TS 语法

---

## 开发命令

### 本地开发（pnpm 工作区）

```bash
# 在项目根目录
pnpm install                  # 安装所有工作区依赖
pnpm dev:client               # 启动前端开发服务器（5173 端口）
pnpm dev:server               # 启动后端开发服务器（8080 端口）
pnpm build:client             # 构建前端生产包
```

### 在 client 目录直接操作

```bash
cd client
npm install                   # 安装依赖
npm run dev                   # 开发服务器
npm run build                 # 构建（tsc -b && vite build）
npm run test                  # 运行单元测试
npm run test:watch            # 监听模式测试
npm run test:coverage         # 生成覆盖率报告
npm run lint                  # ESLint 检查
```

### Vercel 构建

Vercel 使用 `vercel.json` 中的 npm 命令（不使用 pnpm，避免构建环境兼容性问题）：

```json
{
  "buildCommand": "cd client && npm run build",
  "installCommand": "cd server && npm install --no-audit --no-fund && cd ../client && npm install --no-audit --no-fund"
}
```

> ⚠️ 根 `package.json` 中**不要**保留 `vercel-build` 脚本，否则 Vercel 会优先执行该脚本（pnpm install），触发 `ERR_INVALID_THIS` 兼容性错误。

---

## 关键技术决策总结

| 决策点 | 选择 | 原因 |
|--------|------|------|
| 状态管理 | Context + Hooks | 业务规模不大，无需 Redux 的复杂度；Context 足以共享认证状态 |
| 样式方案 | 原生 CSS + CSS 变量 | 避免 CSS-in-JS 运行时开销，CSS 变量提供主题能力，构建产物更小 |
| 布局策略 | 移动优先（max-width 480px） | 定位 C 端移动用户，桌面端居中展示移动宽度即可 |
| 导航模式 | 底部 Tab 栏 | 符合移动 App 操作习惯，单手可达 |
| 模态框 | 底部抽屉式 | 移动端更自然的交互方式，支持下滑关闭手势的视觉暗示 |
| 加载状态 | 骨架屏 | 比空白 spinner 体验更好，减少布局跳动 |
| 国际化 | i18next | React 生态成熟方案，支持语言检测与持久化 |
| 数值处理 | `Number()` 防御性转换 | PostgreSQL NUMERIC 类型默认返回字符串，避免 `toFixed` 报错 |
| PWA | manifest + meta 标签 | 无需 Service Worker 即可"添加到主屏幕"，满足 iOS 用户需求 |
| 测试 | Vitest + Testing Library | Vite 原生集成，零配置；Testing Library 聚焦用户行为而非实现细节 |
