"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import TeammateSidebar from "@/components/teammate-sidebar";
import XpBar from "@/components/xp-bar";
import {
  loadDailyMainQuest,
  loadDailyMainQuestProgress,
  type DailyMainQuest,
  type DailyMainQuestProgress
} from "@/lib/daily-main-quest";
import { DAILY_LOOP_UPDATED_EVENT } from "@/lib/daily-loop-events";
import { hydrateDayLoopFromServerCache } from "@/lib/batch1-supabase-sync";
import {
  hasAnySealDateRecorded,
  isMorningLoadCompleteForToday,
  isNightSealCompleteForToday
} from "@/lib/daily-loop-state";
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

type CommandCenterNext = {
  headline: string;
  subline: string;
  href: string;
  cta: string;
};

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [openTasks, setOpenTasks] = useState<Task[]>([]);
  const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
  const [homeTick, setHomeTick] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [dailyMainQuest, setDailyMainQuest] = useState<DailyMainQuest | null>(null);
  const [dailyMainQuestProgress, setDailyMainQuestProgress] = useState<DailyMainQuestProgress | null>(null);
  const [cosmetics, setCosmetics] = useState<CosmeticsState>(() => loadCosmetics());

  const syncCosmetics = useCallback(() => setCosmetics(loadCosmetics()), []);
  const syncLoopContext = useCallback(() => {
    setDailyMainQuest(loadDailyMainQuest());
    setDailyMainQuestProgress(loadDailyMainQuestProgress());
  }, []);

  useEffect(() => {
    setUserProfile(loadUserProfile());
    syncLoopContext();
    syncCosmetics();
    window.addEventListener(COSMETICS_UPDATED_EVENT, syncCosmetics);
    const onFocus = () => syncLoopContext();
    const onLoop = () => syncLoopContext();
    window.addEventListener("focus", onFocus);
    window.addEventListener(DAILY_LOOP_UPDATED_EVENT, onLoop);
    return () => {
      window.removeEventListener(COSMETICS_UPDATED_EVENT, syncCosmetics);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(DAILY_LOOP_UPDATED_EVENT, onLoop);
    };
  }, [syncCosmetics, syncLoopContext]);

  useEffect(() => {
    const id = window.setInterval(() => setHomeTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hasAnySealDateRecorded() && !isMorningLoadCompleteForToday() && hour > 4) {
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
        .select("id, profession, xp, crystals, day_loop_cache")
        .eq("id", user.id)
        .single();

      hydrateDayLoopFromServerCache(
        (profileData as { day_loop_cache?: unknown } | null)?.day_loop_cache ?? null
      );

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
      syncLoopContext();

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
  }, [supabase, syncLoopContext]);

  const themeSwatch = useMemo(() => {
    const id = cosmetics.equippedThemeId;
    if (id === "theme-forest") return "from-emerald-400 to-teal-700";
    if (id === "theme-samurai") return "from-red-500 to-rose-900";
    if (id === "theme-mage") return "from-violet-400 to-fuchsia-800";
    return "from-cyan-400 to-blue-700";
  }, [cosmetics.equippedThemeId]);

  const morningLoadedToday = typeof window !== "undefined" && isMorningLoadCompleteForToday();
  const nightSavedToday = typeof window !== "undefined" && isNightSealCompleteForToday();
  const mainQuestLocked = Boolean(dailyMainQuest);
  const mainQuestAdvanced = dailyMainQuestProgress?.progressed ?? false;

  const commandNext = useMemo((): CommandCenterNext => {
    void homeTick;
    if (!morningLoadedToday) {
      return {
        headline: "先完成晨间仪式",
        subline: "报到、回顾昨日与今日氛围，再锁定今日主线章节。",
        href: "/morning-load",
        cta: "开始晨间加载"
      };
    }
    if (!dailyMainQuest) {
      return {
        headline: "锁定今日主线",
        subline: "为今天选一个章节方向，任务与夜间复盘都会围绕它展开。",
        href: "/morning-load?pickMain=1",
        cta: "补选今日主线"
      };
    }
    const claimFirst = openTasks.find((task) => {
      const ex = deriveTaskExploreUiState(task);
      return ex === "ready" || ex === "coma";
    });
    if (claimFirst) {
      const isLog = getTaskMode(claimFirst) === "log";
      const short =
        claimFirst.title.length > 40 ? `${claimFirst.title.slice(0, 40)}…` : claimFirst.title;
      return {
        headline: isLog ? "有任务可领取奖励" : "有任务待结算",
        subline: short,
        href: `/tasks#task-${claimFirst.id}`,
        cta: isLog ? "领取奖励" : "去结算"
      };
    }
    const focusFirst = openTasks.find((t) => isFocusCountdownRunning(t));
    if (focusFirst) {
      const short = focusFirst.title.length > 40 ? `${focusFirst.title.slice(0, 40)}…` : focusFirst.title;
      return {
        headline: "专注进行中",
        subline: short,
        href: `/tasks#task-${focusFirst.id}`,
        cta: "回到任务 / 专注"
      };
    }
    if (openTasks.length > 0) {
      return {
        headline: "继续今日任务",
        subline: `还有 ${openTasks.length} 个进行中的副本，挑一个推进即可。`,
        href: "/tasks",
        cta: "打开任务页"
      };
    }
    if (dailyMainQuest && !mainQuestAdvanced) {
      const obj =
        dailyMainQuest.objective.length > 72
          ? `${dailyMainQuest.objective.slice(0, 72)}…`
          : dailyMainQuest.objective;
      return {
        headline: "为今日主线创建一条任务",
        subline: `${dailyMainQuest.title} — ${obj}`,
        href: "/tasks?mode=quick",
        cta: "快捷创建主线任务"
      };
    }
    if (!nightSavedToday) {
      return {
        headline: "夜间封存，合上今日之书",
        subline: "休整也可以封存：一句真实感受就足够。",
        href: "/night-save",
        cta: "去夜间存档"
      };
    }
    return {
      headline: "今日循环已闭合",
      subline: "明天晨间再来报到，或现在浏览任务与成长记录。",
      href: "/tasks",
      cta: "浏览任务"
    };
  }, [
    morningLoadedToday,
    nightSavedToday,
    dailyMainQuest,
    mainQuestAdvanced,
    openTasks,
    homeTick
  ]);

  if (!profile) {
    return (
      <AppShell>
        <div className="card">加载中...</div>
      </AppShell>
    );
  }

  const level = getLevelFromXp(profile.xp);
  const progress = getLevelProgress(profile.xp);
  void homeTick;
  const greetingName = userProfile?.nickname?.trim() || "冒险者";
  const openPreview = openTasks.slice(0, 3);
  const openOverflow = Math.max(0, openTasks.length - openPreview.length);
  const recentPreview = recentTasks.slice(0, 2);

  return (
    <AppShell>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 space-y-6">
          <section className="card border-cyan-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/40">
            <p className="text-xs font-medium uppercase tracking-wide text-cyan-400/90">每日指挥中心</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-50 sm:text-3xl">
              {greetingName}，{commandNext.headline}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">{commandNext.subline}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={commandNext.href}
                className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400"
              >
                {commandNext.cta}
              </Link>
              <Link
                href="/tasks"
                className="text-sm text-slate-500 underline-offset-4 hover:text-slate-300 hover:underline"
              >
                任务页
              </Link>
              {!nightSavedToday && commandNext.href !== "/night-save" && (
                <Link
                  href="/night-save"
                  className="text-sm text-amber-200/90 underline-offset-4 hover:text-amber-100 hover:underline"
                >
                  夜间封存
                </Link>
              )}
            </div>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-700/60 pt-4 text-xs">
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  morningLoadedToday ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-200"
                )}
              >
                晨间 {morningLoadedToday ? "✓" : "待"}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  mainQuestLocked ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-200"
                )}
              >
                主线 {mainQuestLocked ? "✓" : "待"}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  mainQuestAdvanced ? "border-emerald-500/40 text-emerald-300" : "border-slate-600 text-slate-400"
                )}
              >
                推进 {mainQuestAdvanced ? "✓" : "·"}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  nightSavedToday ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-200"
                )}
              >
                夜间 {nightSavedToday ? "✓" : "待"}
              </span>
            </div>
          </section>

          <section className="card py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {userProfile ? (
                  <>
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-base font-bold text-slate-100",
                        FRAME_RING_CLASS[cosmetics.equippedFrameId] ?? FRAME_RING_CLASS["frame-none"]
                      )}
                      title="头像"
                    >
                      {userProfile.nickname.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{userProfile.nickname}</p>
                      <p className="truncate text-xs text-slate-500">
                        {RACE_META[userProfile.race].icon} {RACE_META[userProfile.race].name} · 主{" "}
                        {CLASS_ICON[userProfile.primaryClass]} {CLASS_LABEL[userProfile.primaryClass]}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-slate-400">未完成角色创建</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm lg:justify-end">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">等级</p>
                  <p className="font-semibold text-slate-100">Lv.{level}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">晶石</p>
                  <p className="font-semibold text-cyan-400">{profile.crystals}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">登记职业</p>
                  <p className="max-w-[10rem] truncate font-medium text-slate-200">{profile.profession ?? "—"}</p>
                </div>
                <div className="hidden h-8 w-px bg-slate-700 sm:block" aria-hidden />
                <div className="min-w-[8rem] flex-1 sm:min-w-[12rem]">
                  <div className={cn("mb-1 h-1 rounded-full bg-gradient-to-r opacity-80", themeSwatch)} title="主题" />
                  <XpBar progress={progress} xp={profile.xp} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-800 pt-3 text-xs text-slate-500">
              <span title={THEME_LABEL[cosmetics.equippedThemeId] ?? ""}>
                主题 {THEME_LABEL[cosmetics.equippedThemeId] ?? "—"}
              </span>
              <Link href="/shop" className="text-cyan-500/90 hover:text-cyan-400">
                商店
              </Link>
              <Link href="/skills" className="text-cyan-500/90 hover:text-cyan-400">
                技能
              </Link>
              <Link href="/stats" className="text-cyan-500/90 hover:text-cyan-400">
                统计
              </Link>
            </div>
          </section>

          {dailyMainQuest && (
            <section className="rounded-xl border border-amber-500/25 bg-slate-900/60 px-4 py-3">
              <p className="text-xs text-amber-200/80">今日主线</p>
              <p className="mt-1 text-sm font-medium text-amber-100">{dailyMainQuest.title}</p>
              <p className="mt-0.5 text-xs text-slate-400">{dailyMainQuest.objective}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <Link href="/tasks?mode=quick" className="text-cyan-400 hover:text-cyan-300">
                  快捷创建任务
                </Link>
                <span className="text-slate-600">·</span>
                <Link href="/morning-load?pickMain=1" className="text-slate-500 hover:text-slate-300">
                  改选主线
                </Link>
              </div>
            </section>
          )}

          {userProfile?.skillTreeProgress?.lastUnlock && (
            <section className="rounded-xl border border-slate-700/80 bg-slate-900/40 px-4 py-3 text-sm text-slate-300">
              <span className="text-cyan-400/90">最近解锁</span>{" "}
              {userProfile.skillTreeProgress.lastUnlock.profession} ·{" "}
              {userProfile.skillTreeProgress.lastUnlock.nodeName}{" "}
              <Link href="/skills" className="ml-2 text-xs text-cyan-500 hover:text-cyan-400">
                技能树 →
              </Link>
            </section>
          )}

          {openTasks.length > 0 && (
            <section className="card">
              <div className="mb-3 flex items-end justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-100">进行中的任务</h2>
                <Link href="/tasks" className="text-xs text-cyan-500 hover:text-cyan-400">
                  全部 {openTasks.length} 个 →
                </Link>
              </div>
              <ul className="space-y-2">
                {openPreview.map((task) => {
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
                      className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2.5"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-100">{task.title}</p>
                          <p className="text-xs text-slate-500">
                            {task.profession} · {task.difficulty}
                            {isLog ? " · 事后记录" : ""}
                            {running ? " · 专注中" : ""}
                          </p>
                          {running && (
                            <div className="mt-2 max-w-md">
                              <div className="mb-1 flex justify-between text-[10px] text-amber-200/90">
                                <span>专注</span>
                                <span>{Math.round(bar * 100)}%</span>
                              </div>
                              <div className="h-1 overflow-hidden rounded-full bg-slate-800">
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
                              "shrink-0 rounded-lg px-3 py-1.5 text-center text-xs font-semibold transition",
                              isLog
                                ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 hover:from-amber-400 hover:to-yellow-300"
                                : "bg-cyan-600 text-white hover:bg-cyan-500"
                            )}
                          >
                            {isLog ? "领奖" : "结算"}
                          </Link>
                        )}
                        {!claimable && running && (
                          <Link
                            href={`/tasks#task-${task.id}`}
                            className="shrink-0 rounded-lg border border-amber-600/50 px-2.5 py-1 text-xs text-amber-100"
                          >
                            继续 →
                          </Link>
                        )}
                        {!claimable && !running && (
                          <Link
                            href={`/tasks#task-${task.id}`}
                            className="shrink-0 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-400"
                          >
                            打开 →
                          </Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {openOverflow > 0 && (
                <p className="mt-2 text-center text-xs text-slate-500">还有 {openOverflow} 个任务在任务页</p>
              )}
            </section>
          )}

          <section className="card">
            <div className="mb-3 flex items-end justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-100">最近完成</h2>
              <Link href="/tasks" className="text-xs text-slate-500 hover:text-slate-300">
                任务页 →
              </Link>
            </div>
            {recentTasks.length === 0 ? (
              <p className="text-sm text-slate-500">今天还没有结算记录，从指挥中心上方开始即可。</p>
            ) : (
              <ul className="space-y-2">
                <AnimatePresence initial={false}>
                  {recentPreview.map((task) => (
                    <motion.li
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: -12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 12 }}
                      transition={{ duration: 0.25 }}
                      className={`flex items-center justify-between rounded-lg border bg-slate-900/90 px-3 py-2 ${
                        highlightedTaskId === task.id
                          ? "border-amber-400/80 shadow-md shadow-amber-500/10"
                          : "border-slate-800"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <span className="text-sm text-slate-200">{task.title}</span>
                      </div>
                      <span className="shrink-0 text-xs text-cyan-400">
                        +{task.reward}
                        {typeof task.xp_reward === "number" ? ` / +${task.xp_reward} XP` : ""}
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
