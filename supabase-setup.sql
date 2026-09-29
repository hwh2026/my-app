-- ============================================================
-- 《历史通关棋》Supabase 数据库初始化脚本
-- 使用方法：
--   1. 打开 supabase.com 控制台 → 你的项目 → 左侧 "SQL Editor"
--   2. 新建查询，把本文件全部内容粘贴进去，点 Run
-- ============================================================

-- ---------- 房间表：存一局游戏的完整状态 ----------
create table if not exists public.rooms (
  code       text primary key,          -- 4~6 位房间号
  state      jsonb not null,            -- 整局游戏状态（含棋盘/玩家/题目等）
  version    bigint not null default 0, -- 乐观锁版本号，防并发写冲突
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- 抢答表：原子判定"谁第一个抢到" ----------
-- 主键 (room_code, round_id) 保证同一轮只有第一个插入的人成功，
-- 其他人会收到唯一键冲突错误，从而天然实现"先到先得"。
create table if not exists public.buzzes (
  room_code  text not null,
  round_id   text not null,             -- 每道题的唯一 id
  player_id  text not null,
  created_at timestamptz not null default now(),
  primary key (room_code, round_id)
);

-- ---------- 自动更新 updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists rooms_touch on public.rooms;
create trigger rooms_touch
  before update on public.rooms
  for each row execute function public.touch_updated_at();

-- ---------- 开放行级安全（家庭游戏，房间号即"密码"） ----------
alter table public.rooms  enable row level security;
alter table public.buzzes enable row level security;

drop policy if exists rooms_all  on public.rooms;
drop policy if exists buzzes_all on public.buzzes;

create policy rooms_all  on public.rooms
  for all using (true) with check (true);

create policy buzzes_all on public.buzzes
  for all using (true) with check (true);

-- ---------- 清理超过 48 小时未活动的房间（可选，省空间） ----------
-- create extension if not exists pg_cron;  -- 免费版若支持 pg_cron 可启用
-- 若无法启用 pg_cron，可忽略此段，免费额度对家庭游戏绰绰有余。
