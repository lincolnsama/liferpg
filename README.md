# Life RPG (MVP)

一个把现实生活任务游戏化的网页应用（Next.js + Supabase）。

## 技术栈

- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- Framer Motion
- Supabase (Auth + PostgreSQL)
- Vercel 部署兼容

## 本地启动

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
cp .env.example .env.local
```

3. 填写 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. 在 Supabase SQL Editor 运行 `supabase/schema.sql`（含表结构、RLS、注册触发器、商店兑换函数）。

5. 启动开发环境：

```bash
npm run dev
```

## 功能

- 邮箱+密码注册登录
- 注册成功后自动创建 `profiles`（数据库触发器实现）
- 职业选择（5种职业）
- 创建任务（职业、难度、奖励）
- 完成任务获取 XP 与晶石
- Framer Motion 庆祝动画（经验变化 + 彩带）
- 主页显示等级、职业、经验条、晶石、最近任务
- 商店兑换系统（扣晶石 + 发放道具 + 背包展示）
