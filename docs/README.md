# IronAI 文档

本目录包含 IronAI 项目的指导文档和参考资料。文档随项目演进持续更新，反映当前代码库的实际状态。

## 📖 文档索引

| 文档 | 说明 | 状态 |
|------|------|------|
| [frontend-implementation.md](./frontend-implementation.md) | 前端实现文档 — 客户端架构、目录结构、Hooks、路由、i18n、PWA、测试等实现细节 | ✅ 最新 |
| [backend-implementation.md](./backend-implementation.md) | 后端实现文档 — Express 架构、Prisma ORM、控制器、AI 服务、Vercel 部署等实现细节 | ✅ 最新 |
| [feature-roadmap.md](./feature-roadmap.md) | 功能规划 — 未来可扩展的功能方向、优先级分层、技术实现建议 | ✅ 最新 |
| [DEPLOY.md](./DEPLOY.md) | 部署指南 — Vercel + Supabase 部署流程、环境变量配置、常见问题排查 | ✅ 最新 |
| [issue-42p05-prisma-pgbouncer.md](./issue-42p05-prisma-pgbouncer.md) | 故障记录 — Prisma + PgBouncer `42P05 prepared statement` 冲突的根因分析与修复 | ✅ 故障归档 |
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | 项目计划 — 完整的产品设计、技术架构、功能模块规划（初版学习计划） | 📜 历史文档 |
| [prisma-migration-plan.md](./prisma-migration-plan.md) | Prisma 迁移方案 — 从 pg (node-postgres) 迁移到 Prisma ORM 的实施记录 | ✅ 已完成 |

## 🚀 快速开始

1. **了解项目**：从下方项目结构开始，快速掌握代码组织
2. **前端实现**：参考 [frontend-implementation.md](./frontend-implementation.md)
3. **后端实现**：参考 [backend-implementation.md](./backend-implementation.md)
4. **本地开发**：参考 [DEPLOY.md](./DEPLOY.md) 中的"本地开发"章节
5. **部署上线**：参考 [DEPLOY.md](./DEPLOY.md) 中的 Vercel + Supabase 部署步骤

## 📂 项目结构

```
IronAI/
├── api/                      # Vercel Serverless Function 入口
│   └── index.ts              # 导出 Express app 供 Vercel 调用
├── client/                   # React 前端（Vite + TypeScript）
│   ├── public/               # 静态资源（PWA 图标、manifest）
│   ├── src/
│   │   ├── api/              # axios 实例与拦截器
│   │   ├── components/       # Layout、Navbar、ProtectedRoute、LanguageSwitcher、Skeleton
│   │   ├── hooks/            # useAuth、useDiet、useTraining（含 .test 文件）
│   │   ├── i18n/             # 国际化配置与语言包（en.json / zh.json）
│   │   ├── pages/            # 6 个页面（含 .test 文件）
│   │   ├── test/             # Vitest 测试 setup
│   │   ├── types/            # TypeScript 类型定义
│   │   ├── App.tsx           # 路由配置
│   │   ├── index.css         # 全局样式与主题
│   │   └── main.tsx          # 应用入口
│   ├── eslint.config.js      # ESLint 配置
│   ├── .oxlintrc.json        # oxlint 配置
│   ├── vitest.config.ts      # Vitest 测试配置
│   └── vite.config.ts        # Vite 构建配置（含 /api 代理）
├── server/                   # Express 后端（Prisma ORM + Supabase）
│   ├── prisma/
│   │   └── schema.prisma     # Prisma 数据模型定义
│   ├── scripts/
│   │   └── postinstall.js    # 安装后钩子：生成 Prisma Client
│   ├── src/
│   │   ├── config/prisma.ts  # PrismaClient 单例（globalThis 缓存）
│   │   ├── controllers/      # auth / training / diet / ai 控制器
│   │   ├── middleware/auth.ts # JWT 认证中间件
│   │   ├── routes/           # auth / training / diet / ai 路由
│   │   ├── services/deepseek.ts # DeepSeek AI 服务封装
│   │   ├── types/            # Prisma 派生类型与请求体类型
│   │   ├── utils/format.ts   # 日期格式化工具
│   │   ├── app.ts            # Express 应用（共享入口）
│   │   └── index.ts          # 本地开发启动入口
│   └── package.json
├── database/
│   └── schema.sql            # 数据库建表 SQL（PostgreSQL，参考用）
├── docs/                     # 📄 项目文档（本目录）
├── .env.example              # 环境变量模板
├── .npmrc                    # pnpm 配置（shamefully-hoist=true）
├── pnpm-workspace.yaml       # pnpm 工作区配置（client + server）
├── package.json              # 根 package.json（pnpm 工作区脚本）
└── vercel.json               # Vercel 部署配置
```

## 🛠️ 技术栈速览

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 8 + TypeScript 6 + react-router-dom 7 + axios + i18next + Vitest |
| 后端 | Express 5 + Prisma 5.22 + TypeScript 6 + JWT + bcryptjs + DeepSeek AI |
| 数据库 | PostgreSQL 15+（Supabase 海外免费套餐，连接池模式） |
| 部署 | Vercel（前端静态托管 + 后端 Serverless Function） |
| 包管理 | pnpm 工作区（本地）/ npm（Vercel 构建） |

## 📝 文档维护说明

- **新增功能或重构**：同步更新对应的实现文档（frontend/backend-implementation.md）
- **部署配置变更**：更新 DEPLOY.md
- **历史文档**：PROJECT_PLAN.md 保留项目初版学习计划作为历史参考，不再随代码演进更新
- **迁移记录**：prisma-migration-plan.md 记录已完成的迁移过程，供未来参考
