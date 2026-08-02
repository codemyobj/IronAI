# IronAI 文档

本目录包含项目的指导文档和参考资料。

## 📖 文档索引

| 文档 | 说明 |
|------|------|
| [DEPLOY.md](./DEPLOY.md) | 部署指南 — Vercel + Supabase 部署流程、环境变量配置、常见问题排查 |
| [PROJECT_PLAN.md](./PROJECT_PLAN.md) | 项目计划 — 完整的产品设计、技术架构、功能模块规划 |
| [prisma-migration-plan.md](./prisma-migration-plan.md) | Prisma 迁移方案 — 从 pg (node-postgres) 迁移到 Prisma ORM 的详细实施计划 |
| [ui-preview.html](./ui-preview.html) | UI 设计预览 — C 端移动端风格的 HTML 原型设计稿 |

## 🚀 快速开始

1. **本地开发**：参考 [PROJECT_PLAN.md](./PROJECT_PLAN.md) 中的技术栈说明
2. **部署上线**：参考 [DEPLOY.md](./DEPLOY.md) 中的 Vercel 部署步骤
3. **数据库迁移**：参考 [prisma-migration-plan.md](./prisma-migration-plan.md) 中的 Prisma ORM 迁移方案

## 📂 项目结构

```
IronAI/
├── api/              # Vercel Serverless Function 入口
├── client/           # React 前端（Vite + TypeScript）
├── server/           # Express 后端（Prisma ORM + Supabase）
│   ├── prisma/       # Prisma Schema
│   └── src/          # 源代码
├── docs/             # 📄 项目文档（本目录）
└── vercel.json       # Vercel 部署配置
```
