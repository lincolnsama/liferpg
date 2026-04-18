"use client";

import { useCallback } from "react";
import type { Task } from "@/types/db";
import type { VirtualCharacter } from "@/types/game";
import {
  buildTextRpgBattleResult,
  pickAdventureMonster,
  pickAdventureScene,
  type TaskAdventureInput,
  type TextRpgBattleRun
} from "@/lib/adventure-system";

/** 将战报按秒展开为「到该秒为止已揭示的文本」，供全屏探索打字机用 */
export function buildExploreBattleFeed(chronicle: string, totalSec: number): string[] {
  const blocks = chronicle.split("\n\n").filter((b) => b.length > 0);
  if (totalSec < 1) return [];
  if (blocks.length === 0) return Array.from({ length: totalSec }, () => "");
  return Array.from({ length: totalSec }, (_, s) => {
    const idx = Math.min(blocks.length - 1, Math.floor(((s + 1) / totalSec) * blocks.length));
    return blocks.slice(0, idx + 1).join("\n\n");
  });
}

export type AdventurePreview = {
  scene: string;
  monsterName: string;
  monsterHp: number;
  monsterDesc: string;
};

export function previewEncounter(
  task: Pick<Task, "profession" | "difficulty" | "id">,
  seedSuffix: string
): AdventurePreview {
  const scene = pickAdventureScene(task.profession, seedSuffix + task.profession);
  const m = pickAdventureMonster(task.difficulty, seedSuffix + "m");
  return { scene, monsterName: m.name, monsterHp: m.hp, monsterDesc: m.desc };
}

/**
 * 将现实任务映射为文字 RPG：生成事件流、战报与结算摘要（模板拼接，无 AI）。
 */
export function useAdventure() {
  const buildRun = useCallback((input: TaskAdventureInput): TextRpgBattleRun => buildTextRpgBattleResult(input), []);

  const buildCombatPreview = useCallback(
    (input: {
      virtualCharacter: VirtualCharacter;
      task: Task;
      estimatedMinutes: number;
      seedSuffix: string;
    }): TextRpgBattleRun => {
      return buildTextRpgBattleResult({
        virtualCharacter: input.virtualCharacter,
        task: input.task,
        actualMinutes: Math.max(1, input.estimatedMinutes),
        finalCrystal: 0,
        finalXp: 0,
        mode: "combat-only",
        seedSuffix: input.seedSuffix
      });
    },
    []
  );

  const buildExploreFeed = useCallback((chronicle: string, totalSec: number) => buildExploreBattleFeed(chronicle, totalSec), []);

  const preview = useCallback(
    (task: Pick<Task, "profession" | "difficulty" | "id">, seedSuffix: string) => previewEncounter(task, seedSuffix),
    []
  );

  return { buildRun, buildCombatPreview, buildExploreFeed, previewEncounter: preview };
}
