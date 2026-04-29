import type { SupabaseClient } from "@supabase/supabase-js";
import {
  appendAdventureResultToVirtualCharacter,
  buildTextRpgBattleResult,
  type TextRpgBattleRun
} from "@/lib/adventure-system";
import { addGearToStash, clearPendingXpMultiplier, maybeGrantStreakSevenEpicGear, rollHardTaskGearDrop } from "@/lib/gear-inventory";
import { incrementLocalTaskComplete, loadCosmetics } from "@/lib/cosmetics";
import { pushHardTaskCheer, recordTeammateTaskComplete } from "@/lib/ai-teammate";
import { applyTaskXpToSkillTrees, type SkillUnlockEvent } from "@/lib/skill-tree";
import { onTaskAdventureSuccess, onTaskComaFailure } from "@/lib/task-adventure-flow";
import type { Task } from "@/types/db";
import { appendAdventureLog, createDefaultVirtualCharacter } from "@/types/game";
import { insertTaskRewardEvent } from "@/lib/batch1-supabase-sync";
import { maybeAutoMarkMainQuestProgressFromTaskTitle } from "@/lib/daily-main-quest";
import { loadUserProfile, saveUserProfile, type UserProfile } from "@/lib/user-profile";

export type ExecuteTaskCompletionArgs = {
  supabase: SupabaseClient;
  profile: { id: string; xp: number; crystals: number };
  task: Task;
  userProfile: UserProfile | null;
  comaMode: boolean;
  finalCrystal: number;
  finalXp: number;
  actualMinutes: number;
  estimatedMinutes: number;
  applyProfessionBonus: boolean;
  isCheatWarning: boolean;
  exploreEndHp: number | null;
  exploreSeedSuffix: string;
  completedTodayCount: number;
  todayKey: string;
};

export type ExecuteTaskCompletionResult = {
  completedAt: string;
  nextXp: number;
  nextCrystals: number;
  nextProfile: UserProfile | null;
  newUnlocks: SkillUnlockEvent[];
  settlement: TextRpgBattleRun["settlement"] | null;
  settlementTurns: number;
  adventureMeta: {
    monsterName?: string;
    location?: string;
    highlights: string[];
    result: "victory" | "retreat";
    drops: string[];
  };
  equipmentAcquiredIds: string[];
};

export async function executeTaskCompletion(
  args: ExecuteTaskCompletionArgs
): Promise<ExecuteTaskCompletionResult> {
  const {
    supabase,
    profile,
    task,
    userProfile,
    comaMode,
    finalCrystal,
    finalXp,
    actualMinutes,
    estimatedMinutes,
    applyProfessionBonus,
    isCheatWarning,
    exploreEndHp,
    exploreSeedSuffix,
    completedTodayCount,
    todayKey
  } = args;

  const completedAt = new Date().toISOString();
  const nextXp = profile.xp + finalXp;
  const nextCrystals = profile.crystals + finalCrystal;

  const { error: taskUpdateError } = await supabase
    .from("tasks")
    .update({
      is_completed: true,
      completed_at: completedAt,
      reward: finalCrystal,
      xp_reward: finalXp,
      estimated_minutes: estimatedMinutes,
      actual_minutes: actualMinutes,
      profession_bonus_applied: applyProfessionBonus,
      anti_cheat_flag: isCheatWarning,
      early_complete: !!(task.early_complete && !comaMode)
    })
    .eq("id", task.id);

  if (taskUpdateError) {
    await supabase
      .from("tasks")
      .update({ is_completed: true, completed_at: completedAt, reward: finalCrystal })
      .eq("id", task.id);
  }

  await supabase
    .from("profiles")
    .update({
      xp: nextXp,
      crystals: nextCrystals
    })
    .eq("id", profile.id);

  try {
    await insertTaskRewardEvent(supabase, {
      userId: profile.id,
      taskId: task.id,
      xpDelta: finalXp,
      crystalsDelta: finalCrystal,
      meta: {
        title: task.title,
        difficulty: task.difficulty,
        profession: task.profession,
        comaMode,
        taskTrack: task.task_track ?? null
      }
    });
  } catch (e) {
    console.warn("[batch1] reward_events insert failed", e);
  }

  localStorage.setItem(
    "life-rpg-recent-completed",
    JSON.stringify({
      id: task.id,
      completedAt,
      antiCheat: isCheatWarning
    })
  );
  localStorage.setItem(`life-rpg-daily-count-${todayKey}`, String(completedTodayCount + 1));

  maybeAutoMarkMainQuestProgressFromTaskTitle(task.title);

  incrementLocalTaskComplete();

  if (task.difficulty === "Hard") {
    pushHardTaskCheer(task.title);
  }
  recordTeammateTaskComplete();

  const baseProfile = userProfile ?? loadUserProfile();
  let nextProfile: UserProfile | null = null;
  let newUnlocks: SkillUnlockEvent[] = [];
  let settlement: TextRpgBattleRun["settlement"] | null = null;
  let settlementTurns = 0;
  let adventureMeta: ExecuteTaskCompletionResult["adventureMeta"] = {
    highlights: [],
    result: comaMode ? "retreat" : "victory",
    drops: []
  };
  const equipmentAcquiredIds: string[] = [];

  if (baseProfile) {
    let { profile: prof, newUnlocks: unlocks } = applyTaskXpToSkillTrees(
      baseProfile,
      task.profession,
      finalXp
    );
    newUnlocks = unlocks;
    const vc0 =
      prof.virtualCharacter ??
      createDefaultVirtualCharacter({
        realJob: prof.realJob,
        race: prof.race,
        primaryClass: prof.primaryClass,
        secondaryClass: prof.secondaryClass
      });
    const vcForBattle = (() => {
      const v = { ...vc0 };
      if (!comaMode && exploreEndHp != null) {
        v.hp = Math.max(1, exploreEndHp);
      }
      return v;
    })();

    if (comaMode) {
      const summary = `【昏迷结算】你带着伤势完成登记：「${task.title}」（${task.difficulty}）。仅获半额奖励：${finalCrystal} 晶石、${finalXp} XP。`;
      const vcFinal = appendAdventureLog(vc0, {
        kind: "adventure_chronicle",
        message: summary,
        meta: { taskId: task.id, difficulty: task.difficulty, coma: true }
      });
      prof = { ...prof, virtualCharacter: vcFinal };
      prof = onTaskComaFailure(prof);
      adventureMeta.highlights = ["战术撤离", "队友救援"];
    } else {
      const battleRun = buildTextRpgBattleResult({
        virtualCharacter: vcForBattle,
        task,
        actualMinutes,
        finalCrystal,
        finalXp,
        seedSuffix: exploreSeedSuffix || task.id
      });
      const adv = {
        virtualCharacter: battleRun.virtualCharacter,
        chronicle: battleRun.chronicle,
        meta: battleRun.meta
      };
      let vcFinal = appendAdventureResultToVirtualCharacter(adv);
      prof = { ...prof, virtualCharacter: vcFinal };
      prof = onTaskAdventureSuccess(prof);
      settlement = battleRun.settlement;
      settlementTurns = Number(battleRun.meta.turns ?? 0);
      adventureMeta = {
        monsterName:
          typeof battleRun.meta.monster === "string" ? (battleRun.meta.monster as string) : undefined,
        location: typeof battleRun.meta.scene === "string" ? (battleRun.meta.scene as string) : undefined,
        highlights: [
          settlementTurns >= 8 ? "持久鏖战" : "速战速决",
          settlement.damageTaken <= 8 ? "近乎无伤" : "硬扛伤害",
          task.early_complete ? "提前完成" : "按计划推进"
        ],
        result: "victory",
        drops: settlement.loot && settlement.loot !== "（无额外掉落）" ? [settlement.loot] : []
      };
    }

    if (task.difficulty === "Hard") {
      const dropId = rollHardTaskGearDrop();
      if (dropId) {
        prof = addGearToStash(prof, dropId, 1);
        equipmentAcquiredIds.push(dropId);
      }
    }
    prof = maybeGrantStreakSevenEpicGear(prof, loadCosmetics().checkInStreak);
    if ((baseProfile.pendingXpMultiplier ?? 1) > 1) {
      prof = clearPendingXpMultiplier(prof);
    }
    saveUserProfile(prof);
    nextProfile = prof;
  }

  return {
    completedAt,
    nextXp,
    nextCrystals,
    nextProfile,
    newUnlocks,
    settlement,
    settlementTurns,
    adventureMeta,
    equipmentAcquiredIds
  };
}
