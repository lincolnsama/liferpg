import type { Profession } from "@/types/db";

export type SkillTreeProgress = {
  professionXp: Record<Profession, number>;
  unlockedTier: Record<Profession, number>;
  lastUnlock?: {
    profession: Profession;
    nodeId: string;
    nodeName: string;
    tier: number;
    at: number;
  };
};

const emptyXp = (): Record<Profession, number> => ({
  Warrior: 0,
  Mage: 0,
  Explorer: 0,
  Artisan: 0,
  Guardian: 0
});

const emptyTier = (): Record<Profession, number> => ({
  Warrior: 0,
  Mage: 0,
  Explorer: 0,
  Artisan: 0,
  Guardian: 0
});

export function defaultSkillTreeProgress(): SkillTreeProgress {
  return {
    professionXp: emptyXp(),
    unlockedTier: emptyTier()
  };
}
