import {
  loadDailyMainQuest,
  loadDailyMainQuestProgress,
  type DailyMainQuest,
  type DailyMainQuestProgress
} from "@/lib/daily-main-quest";
import { notifyDailyLoopUpdated } from "@/lib/daily-loop-events";
import { schedulePushDayLoopCache } from "@/lib/batch1-supabase-sync";

export const LAST_MORNING_LOAD_KEY = "lastMorningLoad";
export const LAST_SEAL_DATE_KEY = "lastSealDate";

export function todayDateString(date = new Date()): string {
  return date.toDateString();
}

export function todayYmd(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function isMorningLoadCompleteForToday(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LAST_MORNING_LOAD_KEY) === todayDateString();
}

export function markMorningLoadComplete(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_MORNING_LOAD_KEY, todayDateString());
  notifyDailyLoopUpdated();
  schedulePushDayLoopCache();
}

export function isNightSealCompleteForToday(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LAST_SEAL_DATE_KEY) === todayYmd();
}

/** True if the player has ever completed a night seal (local hint for morning ritual redirect). */
export function hasAnySealDateRecorded(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(localStorage.getItem(LAST_SEAL_DATE_KEY)?.trim());
}

export type DailyLoopSnapshot = {
  morningComplete: boolean;
  nightSealComplete: boolean;
  mainQuest: DailyMainQuest | null;
  mainQuestProgress: DailyMainQuestProgress | null;
};

export function getDailyLoopSnapshot(): DailyLoopSnapshot {
  return {
    morningComplete: isMorningLoadCompleteForToday(),
    nightSealComplete: isNightSealCompleteForToday(),
    mainQuest: loadDailyMainQuest(),
    mainQuestProgress: loadDailyMainQuestProgress()
  };
}
