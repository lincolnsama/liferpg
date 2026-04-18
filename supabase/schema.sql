create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  profession text check (profession in ('Warrior', 'Mage', 'Explorer', 'Artisan', 'Guardian')),
  nickname text,
  real_job text,
  mbti text,
  constellation text,
  race text,
  primary_class text,
  secondary_class text,
  match_score integer,
  xp integer not null default 0,
  crystals integer not null default 0,
  created_at timestamptz not null default now()
);

-- 兼容已有 profiles 表：增量补齐角色画像字段
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists real_job text;
alter table public.profiles add column if not exists mbti text;
alter table public.profiles add column if not exists constellation text;
alter table public.profiles add column if not exists race text;
alter table public.profiles add column if not exists primary_class text;
alter table public.profiles add column if not exists secondary_class text;
alter table public.profiles add column if not exists match_score integer;

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  profession text not null check (profession in ('Warrior', 'Mage', 'Explorer', 'Artisan', 'Guardian')),
  difficulty text not null check (difficulty in ('Simple', 'Normal', 'Hard')),
  reward integer not null check (reward > 0),
  xp_reward integer not null default 10 check (xp_reward > 0),
  estimated_minutes integer not null default 30 check (estimated_minutes > 0),
  actual_minutes integer,
  profession_bonus_applied boolean not null default false,
  anti_cheat_flag boolean not null default false,
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 兼容已有任务表：增量补齐智能难度字段
alter table public.tasks add column if not exists xp_reward integer not null default 10;
alter table public.tasks add column if not exists estimated_minutes integer not null default 30;
alter table public.tasks add column if not exists actual_minutes integer;
alter table public.tasks add column if not exists profession_bonus_applied boolean not null default false;
alter table public.tasks add column if not exists anti_cheat_flag boolean not null default false;
alter table public.tasks drop constraint if exists tasks_reward_check;
alter table public.tasks add constraint tasks_reward_check check (reward > 0);
alter table public.tasks drop constraint if exists tasks_xp_reward_check;
alter table public.tasks add constraint tasks_xp_reward_check check (xp_reward > 0);

-- 任务模式：专注番茄钟 / 事后记账；探索进度与提前完成标记
alter table public.tasks add column if not exists task_mode text default 'focus'
  check (task_mode is null or task_mode in ('focus', 'log'));
alter table public.tasks add column if not exists focus_ready boolean not null default false;
alter table public.tasks add column if not exists explore_coma boolean not null default false;
alter table public.tasks add column if not exists explore_started_at timestamptz;
alter table public.tasks add column if not exists explore_total_seconds integer;
alter table public.tasks add column if not exists early_complete boolean not null default false;

create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null,
  price integer not null check (price > 0),
  rarity text not null check (rarity in ('Common', 'Rare', 'Epic')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  acquired_at timestamptz not null default now(),
  unique (user_id, item_id)
);

-- 注册成功后自动创建 profile，避免前端漏写导致脏数据
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, profession, xp, crystals)
  values (new.id, null, 0, 0)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 原子兑换：检查余额 -> 扣晶石 -> 发放道具
create or replace function public.redeem_shop_item(p_item_id uuid)
returns table (
  new_crystals integer,
  item_name text,
  total_quantity integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_price integer;
  v_name text;
  v_quantity integer;
  v_crystals integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select price, name into v_price, v_name
  from public.shop_items
  where id = p_item_id;

  if v_price is null then
    raise exception 'Item not found';
  end if;

  select crystals into v_crystals
  from public.profiles
  where id = v_user_id
  for update;

  if v_crystals is null then
    raise exception 'Profile not found';
  end if;

  if v_crystals < v_price then
    raise exception 'Not enough crystals';
  end if;

  update public.profiles
  set crystals = crystals - v_price
  where id = v_user_id
  returning crystals into v_crystals;

  insert into public.user_items (user_id, item_id, quantity)
  values (v_user_id, p_item_id, 1)
  on conflict (user_id, item_id)
  do update set quantity = public.user_items.quantity + 1
  returning quantity into v_quantity;

  return query select v_crystals, v_name, v_quantity;
end;
$$;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.shop_items enable row level security;
alter table public.user_items enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
for update using (auth.uid() = id);

drop policy if exists "Users can read own tasks" on public.tasks;
create policy "Users can read own tasks" on public.tasks
for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own tasks" on public.tasks;
create policy "Users can insert own tasks" on public.tasks
for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own tasks" on public.tasks;
create policy "Users can update own tasks" on public.tasks
for update using (auth.uid() = user_id);

drop policy if exists "Anyone can read shop items" on public.shop_items;
create policy "Anyone can read shop items" on public.shop_items
for select using (true);

drop policy if exists "Users can read own inventory" on public.user_items;
create policy "Users can read own inventory" on public.user_items
for select using (auth.uid() = user_id);

grant execute on function public.redeem_shop_item(uuid) to authenticated;

insert into public.shop_items (name, description, price, rarity)
values
  ('Focus Potion', '专注药剂：今天高效冲刺 90 分钟。', 30, 'Common'),
  ('Insight Scroll', '洞察卷轴：记录一次深度复盘。', 80, 'Rare'),
  ('Phoenix Feather', '凤凰之羽：从失败中重启并行动。', 150, 'Epic')
on conflict (name) do nothing;
