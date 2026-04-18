import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Apple,
  Award,
  BookMarked,
  BookOpen,
  Brain,
  Compass,
  Dumbbell,
  Flower2,
  Globe2,
  Image as ImageIcon,
  MapPin,
  Moon,
  Palette,
  PenLine,
  PenTool,
  Plane,
  ScanEye,
  Shield,
  Sparkles,
  Sun,
  Swords,
  Target,
  Users,
  Zap
} from "lucide-react";
import type { Profession } from "@/types/db";
import type { ClassKey, UserProfile } from "@/lib/user-profile";
import { PROFESSION_TO_CLASS } from "@/lib/user-profile";
import { defaultSkillTreeProgress, type SkillTreeProgress } from "@/types/skill-progress";

export type { SkillTreeProgress };

/** 各职业累计 XP 阈值（达到第 i 项则解锁第 i+1 个节点） */
export const SKILL_XP_THRESHOLDS = [50, 150, 320, 560, 900] as const;

export type SkillNodeDef = {
  id: string;
  name: string;
  Icon: LucideIcon;
};

export type SkillTreeDef = {
  profession: Profession;
  title: string;
  subtitle: string;
  nodes: SkillNodeDef[];
};

export const SKILL_TREES: SkillTreeDef[] = [
  {
    profession: "Warrior",
    title: "Warrior · 执行力",
    subtitle: "早起 · 速决 · 抗压",
    nodes: [
      { id: "w1", name: "早起", Icon: Sun },
      { id: "w2", name: "速决", Icon: Zap },
      { id: "w3", name: "抗压", Icon: Shield },
      { id: "w4", name: "惯性强化", Icon: Target },
      { id: "w5", name: "破壁行动", Icon: Swords }
    ]
  },
  {
    profession: "Mage",
    title: "Mage · 认知",
    subtitle: "阅读 · 写作 · 深度思考",
    nodes: [
      { id: "m1", name: "阅读", Icon: BookOpen },
      { id: "m2", name: "写作", Icon: PenLine },
      { id: "m3", name: "深度思考", Icon: Brain },
      { id: "m4", name: "知识体系", Icon: BookMarked },
      { id: "m5", name: "智者之心", Icon: Sparkles }
    ]
  },
  {
    profession: "Explorer",
    title: "Explorer · 探索",
    subtitle: "社交 · 新体验 · 旅行",
    nodes: [
      { id: "e1", name: "社交", Icon: Users },
      { id: "e2", name: "新体验", Icon: Compass },
      { id: "e3", name: "旅行", Icon: Plane },
      { id: "e4", name: "边界拓展", Icon: MapPin },
      { id: "e5", name: "世界公民", Icon: Globe2 }
    ]
  },
  {
    profession: "Artisan",
    title: "Artisan · 创造",
    subtitle: "专注 · 审美 · 作品",
    nodes: [
      { id: "a1", name: "专注", Icon: ScanEye },
      { id: "a2", name: "审美", Icon: Palette },
      { id: "a3", name: "作品", Icon: ImageIcon },
      { id: "a4", name: "心流", Icon: PenTool },
      { id: "a5", name: "杰作", Icon: Award }
    ]
  },
  {
    profession: "Guardian",
    title: "Guardian · 健康",
    subtitle: "运动 · 饮食 · 冥想",
    nodes: [
      { id: "g1", name: "运动", Icon: Dumbbell },
      { id: "g2", name: "饮食", Icon: Apple },
      { id: "g3", name: "冥想", Icon: Flower2 },
      { id: "g4", name: "节律守护", Icon: Activity },
      { id: "g5", name: "身心合一", Icon: Moon }
    ]
  }
];

export function ensureSkillTreeProgress(profile: UserProfile): UserProfile {
  if (!profile.skillTreeProgress) {
    return { ...profile, skillTreeProgress: defaultSkillTreeProgress() };
  }
  return profile;
}

function tierFromXp(xp: number): number {
  let t = 0;
  for (let i = 0; i < SKILL_XP_THRESHOLDS.length; i++) {
    if (xp >= SKILL_XP_THRESHOLDS[i]) t = i + 1;
  }
  return t;
}

export type SkillUnlockEvent = {
  profession: Profession;
  nodeIndex: number;
  nodeId: string;
  nodeName: string;
};

/**
 * 完成任务后：按职业累计 XP；主职业与该任务职业一致时，计入该职业树的进度 ×1.5
 */
export function applyTaskXpToSkillTrees(
  profile: UserProfile,
  taskProfession: Profession,
  taskFinalXp: number
): { profile: UserProfile; newUnlocks: SkillUnlockEvent[] } {
  const ensured = ensureSkillTreeProgress(profile);
  const progress = { ...ensured.skillTreeProgress! };
  progress.professionXp = { ...progress.professionXp };
  progress.unlockedTier = { ...progress.unlockedTier };

  const primaryClass: ClassKey = ensured.primaryClass;
  const isPrimaryTree = PROFESSION_TO_CLASS[taskProfession] === primaryClass;
  const effectiveXp = Math.round(taskFinalXp * (isPrimaryTree ? 1.5 : 1));

  progress.professionXp[taskProfession] += effectiveXp;

  const oldTier = progress.unlockedTier[taskProfession];
  const newTier = tierFromXp(progress.professionXp[taskProfession]);
  const newUnlocks: SkillUnlockEvent[] = [];

  if (newTier > oldTier) {
    const tree = SKILL_TREES.find((t) => t.profession === taskProfession);
    for (let tier = oldTier + 1; tier <= newTier; tier++) {
      const node = tree?.nodes[tier - 1];
      if (node) {
        newUnlocks.push({
          profession: taskProfession,
          nodeIndex: tier - 1,
          nodeId: node.id,
          nodeName: node.name
        });
      }
    }
    progress.unlockedTier[taskProfession] = newTier;
    const last = newUnlocks[newUnlocks.length - 1];
    if (last) {
      progress.lastUnlock = {
        profession: last.profession,
        nodeId: last.nodeId,
        nodeName: last.nodeName,
        tier: newTier,
        at: Date.now()
      };
    }
  }

  return {
    profile: { ...ensured, skillTreeProgress: progress },
    newUnlocks
  };
}

/** 供技能页播放解锁动画 */
export function setSkillUnlockFlash(newUnlocks: SkillUnlockEvent[]) {
  if (typeof window === "undefined" || newUnlocks.length === 0) return;
  const last = newUnlocks[newUnlocks.length - 1];
  sessionStorage.setItem(
    "skill-unlock-flash",
    JSON.stringify({
      profession: last.profession,
      nodeIndex: last.nodeIndex,
      nodeId: last.nodeId,
      nodeName: last.nodeName,
      at: Date.now()
    })
  );
}

export function playSkillUnlockDing() {
  const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
  osc.start(t0);
  osc.stop(t0 + 0.15);
}
