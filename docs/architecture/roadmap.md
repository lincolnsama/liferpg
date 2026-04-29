# Life RPG Architecture Roadmap

## 当前判断

现有项目已经具备网页 MVP 的基础：Next.js 14、React、TypeScript、Tailwind 和 Supabase。Supabase 当前承担认证、`profiles`、`tasks`、`shop_items`、`user_items` 等核心表；浏览器本地存储仍承担角色画像、虚拟角色、晨间/夜间状态、技能闪光、长期任务、周常、日志迁移、收藏、队友状态和若干计数器。

下一阶段架构目标不是一次性重写，而是明确数据真相来源：凡是影响跨设备体验、长期成长、奖励结算和生活记录的数据，应进入 Supabase；只影响当前设备、临时草稿或 UI 体验的数据，可以留在 localStorage/sessionStorage。

## 领域模型

### 角色档案

角色档案是用户身份和长期成长的根：

- `profile`: 用户昵称、现实职业、MBTI、星座、节律/种族、主副职业、XP、晶石、创建时间。
- `character_stats`: STR、INT、AGI、CHA、CON、HP/MP、派生战斗力。
- `character_equipment`: 已装备武器、防具、饰品。
- `character_inventory`: 背包物品、数量、来源、获得时间。

现状：`supabase/schema.sql` 的 `profiles` 已有部分档案字段、XP 和晶石；`src/lib/user-profile.ts` 的 `UserProfile` 与 `src/types/db.ts` 的 `VirtualCharacter` 仍主要保存在 `localStorage.userProfile`。

迁移建议：先扩展 `profiles` 或新增 `character_profiles`，把 `userProfile` 中会跨设备使用的字段迁移到 Supabase。虚拟角色属性、装备和背包可以拆表，也可以先用 `jsonb` 过渡；只要结算逻辑能稳定读写同一来源即可。

### 任务

任务是每日行动的核心：

- `tasks`: 标题、职业、难度、任务模式、预计/实际分钟、是否完成、完成时间、专注状态。
- `task_sessions`: 专注开始、暂停、完成、提前完成、昏迷/失败、实际耗时。
- `task_completion_records`: 打卡文本、图片/语音元信息、检查类型、完成倍率、任务快照。

现状：`tasks` 表已覆盖大部分基础字段，并包含 `task_mode`、`focus_ready`、`explore_coma`、`explore_started_at`、`explore_total_seconds`、`early_complete`。但 `src/lib/task-checkin.ts` 的完成记录和连续打卡仍在 localStorage。

迁移建议：保留 `tasks` 作为主表，新增 `task_sessions` 与 `task_completion_records`。任务完成结算必须通过服务层原子写入任务状态、奖励流水、技能进度和日志事件。

### 技能

技能是职业成长的可视化：

- `skill_progress`: 用户、职业、累计 XP、已解锁节点、最近解锁时间。
- `skill_unlock_events`: 解锁节点、来源任务、解锁说明、创建时间。

现状：`src/lib/skill-tree.ts` 根据本地 `UserProfile.skillTrees` 累积职业 XP，`sessionStorage` 只负责短暂的解锁闪光。

迁移建议：把累计 XP 和解锁节点迁移到 Supabase；`sessionStorage.skill-unlock-flash` 继续保留为当前浏览器动画状态。

### 日志

日志是每日故事和长期回看的基础：

- `daily_logs`: 日期、完成任务数、总 XP、总晶石、能量/状态、今日主线、复盘文本、封存时间。
- `journal_entries`: 手动日记、感谢、困难、明日伏笔、自由文本。
- `adventure_events`: 任务战报、掉落、升级、失败、撤退、特殊事件。
- `milestones`: 用户手动或系统识别的重要节点。

现状：`src/lib/daily-log.ts`、`src/lib/night-seal.ts` 和 `src/app/night-save/page.tsx` 已经有丰富日志逻辑，但主要依赖 localStorage 派生或本地迁移键。

迁移建议：先建立 `daily_logs` 和 `adventure_events`。夜间存档写入 `daily_logs`，任务完成写入 `adventure_events`。手动里程碑可以作为第二批迁移。

### 奖励

奖励需要可追溯，避免只改余额：

- `reward_events`: 来源类型、来源 ID、XP、晶石、倍率、掉落、说明、创建时间。
- `currency_ledger`: 晶石收入/支出、余额变更、关联任务/商店/外观。
- `loot_drops`: 掉落物品、稀有度、来源任务、是否已领取。

现状：`profiles.crystals`、`profiles.xp` 是余额；`src/lib/task-rewards.ts` 计算奖励；`src/lib/crystal-spend-log.ts` 在本地记录部分支出；商店兑换通过 `redeem_shop_item` 做原子扣款。

迁移建议：新增奖励流水，任务完成和商店消费都写入流水。余额仍可保留在 `profiles` 作为快速读取字段，但必须能从流水解释来源。

### 成就与收藏

成就和收藏是长期反馈的轻量层：

- `achievements`: 成就定义、触发条件、展示文案。
- `user_achievements`: 用户已解锁成就、解锁来源、时间。
- `cosmetics`: 外观定义。
- `user_cosmetics`: 已拥有和已装备外观。

现状：`src/lib/cosmetics.ts` 的外观、收藏、连续打卡和任务完成计数都在 localStorage。

迁移建议：第一阶段只迁移会影响身份展示和跨设备一致性的已拥有/已装备外观；复杂成就条件后置。

### 长期任务

长期任务承接“人生主线”：

- `long_term_quests`: 标题、描述、类型、状态、类别、开始/截止日期、当前阶段。
- `long_term_quest_stages`: 阶段标题、要求、进度、奖励、完成状态。
- `weekly_challenges`: 周 ID、主题、挑战项、进度、奖励领取状态。

现状：`src/types/quests.ts`、`src/lib/long-term-quests.ts` 和 `src/hooks/useLongTermQuests.ts` 已有史诗任务、周常、月度里程碑类型，但存储在 localStorage。

迁移建议：先迁移史诗任务主线和阶段进度，周常挑战在 MVP 后期再接入，避免过早制造任务债务。

## localStorage 到 Supabase 边界

### 必须迁移到 Supabase

- `userProfile` 中的昵称、现实职业、节律/种族、主副职业、角色属性、装备和长期成长字段。
- 任务完成记录、打卡记录、每日任务计数和防刷相关结算状态。
- 每日封存、连续存档、日志、冒险事件和手动里程碑。
- 技能树累计 XP、解锁节点、长期任务和周常进度。
- 晶石收支、奖励流水、掉落、成就和跨设备收藏。

### 可以保留在 localStorage

- 表单草稿、未提交的夜间复盘草稿、最近一次页面选择。
- `lastMorningLoad` 这类只用于本设备提示的 UI hint，但最终是否完成晨间加载应以服务端每日状态为准。
- 外观主题预览、动画开关、折叠状态、已看过的新手提示。
- 离线缓存，但必须能与 Supabase 数据重新同步。

### 可以保留在 sessionStorage

- 技能解锁闪光、一次性庆祝动画、当前页面的临时 overlay 状态。
- 不影响奖励、成长、日志和跨设备一致性的短生命周期状态。

## 迁移顺序

### Migration 1: 角色与每日状态

- 扩展或新增角色档案表，迁移 `userProfile` 核心字段。
- 新增 `daily_states` 或用 `daily_logs` 承载当天晨间状态、今日主线和封存状态。
- 首页、晨间加载、夜间存档从 Supabase 读取今日状态。

### Migration 2: 任务完成与奖励流水

- 新增 `reward_events`、`task_sessions`、`task_completion_records`。
- 将 `executeTaskCompletion` 改为统一服务入口，保证任务状态、XP、晶石、技能、日志事件同源写入。
- 本地最近完成列表只作为缓存，不能成为事实来源。

### Migration 3: 日志、技能和长期成长

- 新增 `daily_logs`、`adventure_events`、`skill_progress`。
- 夜间封存写入 Supabase，日志页从服务端读取。
- 史诗任务和周常迁移前先降低导航权重，避免本地数据和服务端数据并行冲突。

### Migration 4: 收藏、成就和经济补强

- 迁移外观拥有/装备状态。
- 建立成就解锁记录。
- 将晶石支出从本地日志改为服务端 ledger。

## 服务层边界

为了支持网页和未来微信小程序复用，业务规则应从页面组件中逐步下沉：

- `src/types`: 放稳定领域类型，例如角色、任务、奖励、日志、长期任务。
- `src/lib`: 放纯领域逻辑，例如奖励计算、难度判断、技能进度、日志生成。
- `src/server` 或 Next.js route handlers/server actions: 放 Supabase 写入、事务边界和权限校验。
- 页面组件：只负责展示、交互和调用服务层，不直接拼接跨模型写入流程。

关键原则：任务完成、奖励结算、夜间封存这类跨表操作必须由服务层统一执行，不能分散在多个 React 组件中。

## 微信小程序复用策略

未来小程序不应复用 Next.js 页面或 React 组件。更稳妥的复用边界是数据模型、服务接口和领域规则。

### 共享内容

- 领域类型：角色、任务、任务模式、奖励、日志、技能、长期任务、成就。
- 纯函数：难度推荐、奖励计算、技能解锁、日志摘要、等级进度、任务状态机。
- 服务接口契约：获取今日状态、创建任务、开始专注、完成任务、夜间封存、查询成长记录。
- Supabase 数据模型与 RLS 规则。

### 不共享内容

- Next.js 页面组件。
- Tailwind 页面布局。
- Web 专属路由和中间件。
- 浏览器专属 localStorage/sessionStorage 状态。
- Web 专属动效和 canvas 下载逻辑。

### 推荐接口形态

小程序可以通过同一套后端能力访问数据：

- `GET /api/today`: 今日状态、主线、活跃任务、是否已晨间加载/夜间封存。
- `POST /api/tasks`: 创建主线/支线/日常任务。
- `POST /api/tasks/:id/start`: 开始专注或记录任务会话。
- `POST /api/tasks/:id/complete`: 完成任务并返回奖励结果。
- `POST /api/night-save`: 写入夜间封存和日志。
- `GET /api/growth`: 获取 XP、技能、成就、长期任务摘要。

这些接口可以先在 Web 中通过 route handlers 或 server actions 内部使用，等小程序启动时再开放同一契约，而不是重新发明业务规则。

### 小程序准备检查清单

- 核心状态已经不依赖浏览器 localStorage。
- 任务完成结算有单一服务入口。
- Supabase RLS 能覆盖用户隔离。
- 领域类型不引用 React、DOM、Next.js 路由或浏览器 API。
- 今日循环接口能被 Web 和小程序同时调用。
- UI 文案和产品流程已稳定，避免小程序过早跟随实验页面变化。
