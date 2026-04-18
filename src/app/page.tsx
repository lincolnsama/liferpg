"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import TeammateSidebar from "@/components/teammate-sidebar";
import XpBar from "@/components/xp-bar";
import {
  COSMETICS_UPDATED_EVENT,
  FRAME_RING_CLASS,
  loadCosmetics,
  THEME_LABEL,
  type CosmeticsState
} from "@/lib/cosmetics";
import { CLASS_ICON, CLASS_LABEL, loadUserProfile, RACE_META, UserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase-browser";
import { cn, getLevelFromXp, getLevelProgress } from "@/lib/utils";
import {
  deriveTaskExploreUiState,
  focusCountdownProgress,
  getTaskMode,
  isFocusCountdownRunning
} from "@/lib/task-rewards";
import type { Profile, Task } from "@/types/db";

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [homeTick, setHomeTick] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [cosmetics, setCosmetics] = useState<CosmeticsState>(() => loadCosmetics());

  const syncCosmetics = useCallback(() => setCosmetics(loadCosmetics()), []);

  useEffect(() => {
    setUserProfile(loadUserProfile());
    syncCosmetics();
    window.addEventListener(COSMETICS_UPDATED_EVENT, syncCosmetics);
    return () => window.removeEventListener(COSMETICS_UPDATED_EVENT, syncCosmetics);
  }, [syncCosmetics]);

  useEffect(() => {
    const id = window.setInterval(() => setHomeTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const lastLoad = localStorage.getItem("lastMorningLoad");
    const lastSeal = localStorage.getItem("lastSealDate");
    const today = new Date().toDateString();
    const hour = new Date().getHours();
    if (lastSeal && lastLoad !== today && hour > 4) {
      router.push("/morning-load");
      return;
    }
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, profession, xp, crystals")
        .eq("id", user.id)
        .single();

      const [{ data: taskData }, { data: openData }] = await Promise.all([
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_completed", true)
          .order("completed_at", { ascending: false })
          .limit(5),
        supabase
          .from("tasks")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_completed", false)
          .order("created_at", { ascending: false })
          .limit(12)
      ]);

      setProfile(profileData as Profile);
      const nextTasks = (taskData as Task[]) ?? [];
      setRecentTasks(nextTasks);
      setOpenTasks((openData as Task[]) ?? []);

      const raw = localStorage.getItem("life-rpg-recent-completed");
      if (!raw) return;
      const lastCompleted = JSON.parse(raw) as { id?: string; completedAt?: string };
      if (!lastCompleted.id || !lastCompleted.completedAt) return;
      const matched = nextTasks.some((task) => task.id === lastCompleted.id);
      const ageMs = Date.now() - new Date(lastCompleted.completedAt).getTime();
      if (matched && ageMs <= 3000) {
        setHighlightedTaskId(lastCompleted.id);
        setTimeout(() => setHighlightedTaskId(null), 3000 - ageMs);
      }
    };

    void fetchData();
  }, [supabase]);

  const themeSwatch = useMemo(() => {
    const id = cosmetics.equippedThemeId;
    if (id === "theme-forest") return "from-emerald-400 to-teal-700";
    if (id === "theme-samurai") return "from-red-500 to-rose-900";
    if (id === "theme-mage") return "from-violet-400 to-fuchsia-800";
    return "from-cyan-400 to-blue-700";
  }, [cosmetics.equippedThemeId]);

  if (!profile) {
    return (
      <AppShell>
        <div className="card">加载中...</div>
      </AppShell>
    );
  }

  const level = getLevelFromXp(profile.xp);
  const progress = getLevelProgress(profile.xp);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="card md:col-span-2 xl:col-span-4">
              <p className="text-sm text-slate-400">冒险者档案</p>
              {userProfile ? (
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div
                      className={cn(
                        "flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-lg font-bold text-slate-100",
                        FRAME_RING_CLASS[cosmetics.equippedFrameId] ?? FRAME_RING_CLASS["frame-none"]
                      )}
                      title="当前头像框"
                    >
                      {userProfile.nickname.slice(0, 1).toUpperCase()}
                    </div>
                    <div
                      className={cn("h-2 w-16 rounded-full bg-gradient-to-r", themeSwatch)}
                      title={`当前主题：${THEME_LABEL[cosmetics.equippedThemeId] ?? cosmetics.equippedThemeId}`}
                    />
                    <p className="text-center text-[10px] text-slate-500">
                      {THEME_LABEL[cosmetics.equippedThemeId] ?? "主题"}
                    </p>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md border border-cyan-700/50 bg-cyan-500/10 px-2 py-1 text-cyan-200">
                      {userProfile.nickname}
                    </span>
                    <span className="rounded-md border border-slate-700 px-2 py-1 text-slate-200">
                      {RACE_META[userProfile.race].icon} {RACE_META[userProfile.race].name}
                    </span>
                    <span className="rounded-md border border-slate-700 px-2 py-1 text-slate-200">
                      主职业 {CLASS_ICON[userProfile.primaryClass]} {CLASS_LABEL[userProfile.primaryClass]}
                    </span>
                    <span className="rounded-md border border-slate-700 px-2 py-1 text-slate-200">
                      副职业 {CLASS_ICON[userProfile.secondaryClass]} {CLASS_LABEL[userProfile.secondaryClass]}
                    </span>
                <Link href="/shop" className="text-xs text-cyan-400 hover:text-cyan-300">
                  装备商店 →
                </Link>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-400">未完成角色创建</p>
              )}
            </div>
            <div className="card">
              <p className="text-sm text-slate-400">等级</p>
              <p className="mt-2 text-3xl font-semibold">Lv.{level}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-400">当前职业</p>
              <p className="mt-2 text-xl font-semibold">{profile.profession ?? "未选择"}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-400">晶石</p>
              <p className="mt-2 text-3xl font-semibold text-cyan-400">{profile.crystals}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-400">进度</p>
              <div className="mt-3">
                <XpBar progress={progress} xp={profile.xp} />
              </div>
            </div>
          </section>

          <section className="card mt-6 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900/80">
            <h2 className="text-lg font-semibold text-amber-100">睡前仪式</h2>
            <p className="mt-2 text-sm text-slate-300">点燃篝火，回顾战绩，封存一句今日感悟。</p>
            <Link
              href="/night-save"
              className="mt-3 inline-block rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-amber-400"
            >
              准备休息 →
            </Link>
          </section>

          {userProfile?.skillTreeProgress?.lastUnlock && (
            <section className="card mt-6 border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-slate-900/80">
              <h2 className="mb-2 text-lg font-semibold text-amber-100">最近解锁技能</h2>
              <p className="text-sm text-slate-200">
                <span className="font-medium text-cyan-200">
                  {userProfile.skillTreeProgress.lastUnlock.profession}
                </span>
                ：{userProfile.skillTreeProgress.lastUnlock.nodeName}（第{" "}
                {userProfile.skillTreeProgress.lastUnlock.tier} 层）
              </p>
              <p className="mt-2 text-xs text-slate-400">继续完成同职业任务，更快点亮整条技能树。</p>
              <Link
                href="/skills"
                className="mt-3 inline-block text-sm text-cyan-400 hover:text-cyan-300"
              >
                查看技能树 →
              </Link>
            </section>
          )}

          {openTasks.length > 0 && (
            <section className="card mt-6">
              <h2 className="mb-4 text-lg font-semibold">活跃任务</h2>
              <ul className="space-y-3">
                {openTasks.map((task) => {
                  void homeTick;
                  const mode = getTaskMode(task);
                  const ex = deriveTaskExploreUiState(task);
                  const running = isFocusCountdownRunning(task);
                  const bar = running ? focusCountdownProgress(task, Date.now()) : 0;
                  const claimable = ex === "ready" || ex === "coma";
                  const isLog = mode === "log";
                  return (
                    <li
                      key={task.id}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-3"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-100">{task.title}</p>
                          <p className="text-xs text-slate-500">
                            {task.profession} · {task.difficulty}
                            {isLog ? " · 事后记录" : ""}
                            {running ? " · 专注进行中" : ""}
                          </p>
                          {running && (
                            <div className="mt-2 max-w-md">
                              <div className="mb-1 flex justify-between text-[10px] text-amber-200/90">
                                <span>专注进度</span>
                                <span>{Math.round(bar * 100)}%</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-amber-600 to-rose-500 transition-all duration-500"
                                  style={{ width: `${bar * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                        {claimable && (
                          <Link
                            href={`/tasks#task-${task.id}`}
                            className={cn(
                              "shrink-0 rounded-lg px-4 py-2 text-center text-sm font-semibold transition",
                              isLog
                                ? "animate-pulse bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-yellow-300"
                                : "bg-cyan-600 text-white hover:bg-cyan-500"
                            )}
                          >
                            {isLog ? "点击领取奖励" : "去任务页结算"}
                          </Link>
                        )}
                        {!claimable && running && (
                          <Link
                            href={`/tasks#task-${task.id}`}
                            className="shrink-0 rounded-lg border border-amber-600/60 px-3 py-1.5 text-xs text-amber-100 hover:border-amber-500"
                          >
                            打开专注画面 →
                          </Link>
                        )}
                        {!claimable && !running && (
                          <Link
                            href={`/tasks#task-${task.id}`}
                            className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
                          >
                            继续探索 →
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="card mt-6">
            <h2 className="mb-4 text-lg font-semibold">最近完成任务</h2>
            {recentTasks.length === 0 ? (
              <p className="text-sm text-slate-400">还没有完成任务，去任务页开始吧。</p>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {recentTasks.map((task) => (
                    <motion.li
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: -24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 16 }}
                      transition={{ duration: 0.35 }}
                      className={`flex items-center justify-between rounded-lg border bg-slate-900 px-3 py-2 ${
                        highlightedTaskId === task.id
                          ? "border-amber-400 shadow-lg shadow-amber-500/10"
                          : "border-slate-800"
                      }`}
                    >
                      <div>
                        <span className="text-sm">{task.title}</span>
                        {!!task.profession_bonus_applied && (
                          <span className="ml-2 rounded-full border border-cyan-600/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                            职业加成
                          </span>
                        )}
                        {!!task.early_complete && (
                          <span className="ml-2 rounded-full border border-cyan-600/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                            提前完成
                          </span>
                        )}
                        {task.task_mode === "log" && (
                          <span className="ml-2 rounded-full border border-emerald-600/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                            事后记录
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-cyan-400">
                        +{task.reward} 晶石
                        {typeof task.xp_reward === "number" ? ` · +${task.xp_reward} XP` : ""}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </section>
        </div>
        {userProfile ? (
          <TeammateSidebar race={userProfile.race} userNickname={userProfile.nickname} />
        ) : null}
      </div>
    </AppShell>
  );
}
