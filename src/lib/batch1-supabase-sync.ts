import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyLog } from "@/lib/daily-log";
import { createClient } from "@/lib/supabase-browser";
import {
  DAILY_MAIN_QUEST_KEY,
  DAILY_MAIN_QUEST_PROGRESS_KEY,
  loadDailyMainQuest,
  loadDailyMainQuestProgress,
  type DailyMainQuest,
  type DailyMainQuestProgress
} from "@/lib/daily-main-quest";
import { notifyDailyLoopUpdated } from "@/lib/daily-loop-events";

const LS_MORNING = "lastMorningLoad";
const LS_SEAL = "lastSealDate";

export type DayLoopServerCache = {
  ymd: string;
  morningComplete: boolean;
  lastSealYmd: string | null;
  dailyMainQuest: DailyMainQuest | null;
  dailyMainProgress: DailyMainQuestProgress | null;
  updatedAt: number;
};

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function schedulePushDayLoopCache(): void {
  if (typeof window === "undefined") return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushDayLoopCacheToServer();
  }, 500);
}

export async function pushDayLoopCacheToServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const supabase = createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return;

  const ymd = new Date().toISOString().slice(0, 10);
  const morningComplete =
    typeof window !== "undefined" && localStorage.getItem(LS_MORNING) === new Date().toDateString();
  const lastSealYmd = localStorage.getItem(LS_SEAL)?.trim() ?? null;
  const dailyMainQuest = loadDailyMainQuest();
  const dailyMainProgress = loadDailyMainQuestProgress();

  const cache: DayLoopServerCache = {
    ymd,
    morningComplete,
    lastSealYmd,
    dailyMainQuest,
    dailyMainProgress,
    updatedAt: Date.now()
  };

  await supabase.from("profiles").update({ day_loop_cache: cache }).eq("id", user.id);
}

/** 新设备或本地空时，用服务端缓存补齐今日主线（不覆盖已有本地同日元数据）。 */
export function hydrateDayLoopFromServerCache(cache: unknown): void {
  if (typeof window === "undefined" || !cache || typeof cache !== "object") return;
  const c = cache as Partial<DayLoopServerCache>;
  const ymd = new Date().toISOString().slice(0, 10);
  if (c.ymd !== ymd) return;

  if (c.dailyMainQuest?.title && c.dailyMainQuest.ymd === ymd) {
    const raw = localStorage.getItem(DAILY_MAIN_QUEST_KEY);
    if (!raw) {
      localStorage.setItem(DAILY_MAIN_QUEST_KEY, JSON.stringify(c.dailyMainQuest));
    }
  }
  if (c.dailyMainProgress?.ymd === ymd && typeof c.dailyMainProgress.progressed === "boolean") {
    const raw = localStorage.getItem(DAILY_MAIN_QUEST_PROGRESS_KEY);
    if (!raw) {
      localStorage.setItem(DAILY_MAIN_QUEST_PROGRESS_KEY, JSON.stringify(c.dailyMainProgress));
    }
  }
  notifyDailyLoopUpdated();
}

export async function insertTaskRewardEvent(
  supabase: SupabaseClient,
  params: {
    userId: string;
    taskId: string;
    xpDelta: number;
    crystalsDelta: number;
    meta?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from("reward_events").insert({
    user_id: params.userId,
    source_type: "task_completion",
    source_id: params.taskId,
    xp_delta: params.xpDelta,
    crystals_delta: params.crystalsDelta,
    meta: params.meta ?? {}
  });
}

export async function upsertDailyLogServer(
  supabase: SupabaseClient,
  userId: string,
  log: DailyLog,
  seal: {
    date: string;
    quote: string;
    summary: { tasksCompleted: number; totalXP: number; totalCrystals: number; topMonster: string };
    streak: number;
  }
): Promise<void> {
  const row = {
    user_id: userId,
    log_date: log.date,
    payload: log as unknown as Record<string, unknown>,
    seal_snapshot: seal as unknown as Record<string, unknown>,
    sealed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("daily_logs").upsert(row, { onConflict: "user_id,log_date" });
  if (error) {
    console.warn("[batch1] daily_logs upsert:", error.message);
  }
}
