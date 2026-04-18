export type TaskCheckInType = "text" | "image" | "voice" | "mixed";

export type TaskCompletionCheckIn = {
  text?: string;
  images?: string[];
  voice?: string;
  checkInType: TaskCheckInType;
};

export type TaskCompletionRecord = {
  taskId: string;
  completedAt: string;
  mode: "focus" | "log";
  actualDuration: number;
  rewards: {
    crystals: number;
    baseXP: number;
    bonusXP: number;
  };
  checkIn?: TaskCompletionCheckIn;
};

const TASK_COMPLETION_KEY = "life-rpg-task-completions";
const CHECKIN_STREAK_KEY = "life-rpg-checkin-streak";

export function computeCheckInXpMultiplier(payload: TaskCompletionCheckIn): number {
  const hasText = !!payload.text?.trim();
  const hasImages = !!payload.images?.length;
  const hasVoice = !!payload.voice;
  const count = Number(hasText) + Number(hasImages) + Number(hasVoice);
  if (count <= 0) return 1;
  if (count === 3) return 1.5;
  return 1.2;
}

export function detectCheckInType(payload: Omit<TaskCompletionCheckIn, "checkInType">): TaskCheckInType {
  const hasText = !!payload.text?.trim();
  const hasImages = !!payload.images?.length;
  const hasVoice = !!payload.voice;
  const count = Number(hasText) + Number(hasImages) + Number(hasVoice);
  if (count >= 2) return "mixed";
  if (hasText) return "text";
  if (hasImages) return "image";
  if (hasVoice) return "voice";
  return "text";
}

export function appendTaskCompletion(record: TaskCompletionRecord): void {
  try {
    const raw = localStorage.getItem(TASK_COMPLETION_KEY);
    const list = raw ? (JSON.parse(raw) as TaskCompletionRecord[]) : [];
    list.unshift(record);
    localStorage.setItem(TASK_COMPLETION_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    // ignore local storage parsing errors
  }
}

export function registerCheckInStreak(completedAtIso: string, didCheckIn: boolean): number {
  if (!didCheckIn) {
    localStorage.setItem(CHECKIN_STREAK_KEY, JSON.stringify({ streak: 0, lastAt: completedAtIso }));
    return 0;
  }
  try {
    const raw = localStorage.getItem(CHECKIN_STREAK_KEY);
    const prev = raw ? (JSON.parse(raw) as { streak?: number; lastAt?: string }) : {};
    const prevStreak = prev.streak ?? 0;
    const lastAt = prev.lastAt ? new Date(prev.lastAt).getTime() : 0;
    const currAt = new Date(completedAtIso).getTime();
    const within48h = currAt - lastAt <= 48 * 3600 * 1000;
    const next = within48h ? prevStreak + 1 : 1;
    localStorage.setItem(CHECKIN_STREAK_KEY, JSON.stringify({ streak: next, lastAt: completedAtIso }));
    return next;
  } catch {
    localStorage.setItem(CHECKIN_STREAK_KEY, JSON.stringify({ streak: 1, lastAt: completedAtIso }));
    return 1;
  }
}
