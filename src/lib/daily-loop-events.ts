export const DAILY_LOOP_UPDATED_EVENT = "life-rpg-daily-loop-updated";

export function notifyDailyLoopUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DAILY_LOOP_UPDATED_EVENT));
}
