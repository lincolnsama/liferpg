"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/app-shell";
import CelebrationOverlay from "@/components/celebration-overlay";
import XpBar from "@/components/xp-bar";
import { PROFESSIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase-browser";
import { getLevelFromXp, getLevelProgress } from "@/lib/utils";
import {
  DIFFICULTY_CRYSTAL_REWARD,
  DIFFICULTY_ESTIMATED_MINUTES,
  DIFFICULTY_XP_REWARD,
  Difficulty,
  Profession,
  Task,
  type TaskMode
} from "@/types/db";
import {
  computeFinalTaskRewards,
  deriveTaskExploreUiState,
  focusCountdownProgress,
  getLogTaskCountToday,
  getTaskMode,
  incrementLogTaskCountToday,
  isFocusCountdownRunning,
} from "@/lib/task-rewards";
import { executeTaskCompletion } from "@/lib/execute-task-completion";
import {
  CLASS_TO_PROFESSION,
  computeTaskMultiplier,
  loadUserProfile,
  PROFESSION_TO_CLASS,
  RACE_META,
  saveUserProfile,
  UserProfile
} from "@/lib/user-profile";
import AdventureSettlementModal from "@/components/adventure-settlement-modal";
import TaskAdventureBriefingModal from "@/components/task-adventure-briefing-modal";
import TaskExploreOverlay from "@/components/task-explore-overlay";
import { applyAdventureFleePenalty, type TextRpgBattleRun } from "@/lib/adventure-system";
import { useAdventure } from "@/hooks/useAdventure";
import {
  buildTaskBriefing,
  clearExpiredTaskAdventureCooldown,
  exploreDurationSeconds,
  isTaskExploreBlocked,
  onTaskComaFailure
} from "@/lib/task-adventure-flow";
import { appendAdventureLog, createDefaultVirtualCharacter } from "@/types/game";
import {
  accessoryHasCoffeeCharm,
  armorReadingReduction,
  getEffectiveInt,
  isFirstTaskOfDay,
  markFirstTaskOfDay
} from "@/lib/gear-inventory";
import { adjustStudyDifficultyByInt, studyCompletionXpMultiplier } from "@/lib/task-intelligence";
import { loadCosmetics } from "@/lib/cosmetics";
import { setSkillUnlockFlash } from "@/lib/skill-tree";
import {
  appendTaskCompletion,
  computeCheckInXpMultiplier,
  detectCheckInType,
  registerCheckInStreak,
  type TaskCompletionCheckIn
} from "@/lib/task-checkin";
import { appendDailyAdventureLog, appendDailyCheckIn, sealTodayJournal } from "@/lib/daily-log";
import { processTaskForLongTerm } from "@/lib/long-term-quests";

type ProfileState = {
  id: string;
  xp: number;
  crystals: number;
  profession: Profession | null;
};

type BurstState = {
  x: number;
  y: number;
  key: number;
};

type RewardToastState = {
  xp: number;
  crystals: number;
  key: number;
};

type PendingCheckInState = {
  task: Task;
  completedAt: string;
  mode: "focus" | "log";
  actualDuration: number;
  crystals: number;
  baseXP: number;
  raceBonusTags: string[];
  leveledUp: boolean;
  unlockedSkills: string[];
  equipmentAcquiredIds: string[];
  adventureMeta: {
    monsterName?: string;
    location?: string;
    highlights: string[];
    result: "victory" | "retreat";
    drops: string[];
  };
  nextProfile: UserProfile | null;
  nextProfileXp: number;
};

const DIFFICULTY_ORDER: Difficulty[] = ["Simple", "Normal", "Hard"];

const LOG_DURATION_CHOICES = [5, 15, 30, 60, 90] as const;
const MAX_LOG_TASKS_PER_DAY = 3;

const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; color: string; icon: string; descColor: string }
> = {
  Simple: {
    label: "简单任务",
    color: "bg-emerald-500/20 border-emerald-500 text-emerald-300",
    icon: "🌱",
    descColor: "text-emerald-300"
  },
  Normal: {
    label: "中等任务",
    color: "bg-amber-500/20 border-amber-500 text-amber-300",
    icon: "💪",
    descColor: "text-amber-300"
  },
  Hard: {
    label: "困难任务",
    color: "bg-red-500/20 border-red-500 text-red-300",
    icon: "🔥",
    descColor: "text-red-300"
  }
};

const SIMPLE_KEYWORDS = ["喝水", "刷牙", "洗脸", "整理", "早睡", "起床", "吃药", "记账"];
const NORMAL_KEYWORDS = ["阅读", "运动", "健身", "学习", "工作", "写作", "会议", "洗澡", "做饭"];
const HARD_KEYWORDS = [
  "项目",
  "演讲",
  "社交",
  "突破",
  "挑战",
  "报告",
  "论文",
  "面试",
  "谈判",
  "马拉松",
  "断舍离",
  "早起"
];

const QUICK_TASKS: Record<Profession, string[]> = {
  Warrior: ["晨跑5公里", "完成今日待办清单", "冷水澡", "深度工作90分钟", "早睡"],
  Mage: ["阅读30页", "学习新技能1小时", "写日记/复盘", "听播客/公开课", "冥想"],
  Explorer: [
    "尝试新餐厅/食谱",
    "认识一个新朋友",
    "去没去过的地方",
    "学习一个新单词（外语）",
    "完成一次社交突破"
  ],
  Artisan: ["完成一个创意作品", "优化现有工作流程", "分享知识/教导他人"],
  Guardian: ["健身/瑜伽", "给父母打电话", "整理房间/断舍离"]
};

export default function TasksPage() {
  const adventure = useAdventure();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [profession, setProfession] = useState<Profession>("Warrior");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [burst, setBurst] = useState<BurstState | null>(null);
  const [rewardToast, setRewardToast] = useState<RewardToastState | null>(null);
  const [exitingTaskIds, setExitingTaskIds] = useState<string[]>([]);
  const [crystalAnimKey, setCrystalAnimKey] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [difficultyOffset, setDifficultyOffset] = useState(0);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [pendingBriefing, setPendingBriefing] = useState<ReturnType<typeof buildTaskBriefing> | null>(null);
  const [pendingInsert, setPendingInsert] = useState<{
    insertPayload: Record<string, unknown>;
    todayYmd: string;
    estimatedMinutes: number;
  } | null>(null);
  const [exploreSession, setExploreSession] = useState<{
    task: Task;
    briefing: ReturnType<typeof buildTaskBriefing>;
    exploreFeed: string[];
    totalBattleTurns: number;
    maxHp: number;
    initialHp: number;
    totalSec: number;
    combatEndHp: number;
    damageTakenPreview: number;
  } | null>(null);
  const exploreHpRef = useRef<number | null>(null);
  const exploreSeedSuffixRef = useRef<string>("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [lastSettlement, setLastSettlement] = useState<TextRpgBattleRun["settlement"] | null>(null);
  const [lastSettlementTurns, setLastSettlementTurns] = useState(0);
  const [pendingCheckIn, setPendingCheckIn] = useState<PendingCheckInState | null>(null);
  const [createMode, setCreateMode] = useState<TaskMode>("focus");
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logChosenMinutes, setLogChosenMinutes] = useState<number>(15);
  const [logDraft, setLogDraft] = useState<{
    todayYmd: string;
    estimatedMinutes: number;
    title: string;
    profession: Profession;
    difficulty: Difficulty;
  } | null>(null);
  const [listTick, setListTick] = useState(0);

  const detectDifficulty = (taskTitle: string): Difficulty => {
    const t = taskTitle.trim();
    if (!t) return "Normal";

    const hardMatched = HARD_KEYWORDS.some((k) => t.includes(k));
    const normalMatched = NORMAL_KEYWORDS.some((k) => t.includes(k));
    const simpleMatched = SIMPLE_KEYWORDS.some((k) => t.includes(k));
    const hasEarlyWake = t.includes("早起") && (t.includes("6点前") || t.includes("六点前"));

    if (hardMatched || hasEarlyWake) return "Hard";
    if (simpleMatched) return "Simple";
    if (normalMatched) return "Normal";
    return "Normal";
  };

  const rawRecommended = detectDifficulty(title);
  const effectiveInt = userProfile?.virtualCharacter
    ? getEffectiveInt(userProfile.virtualCharacter)
    : 10;
  const recommendedDifficulty = adjustStudyDifficultyByInt(rawRecommended, title, effectiveInt);
  const effectiveDifficulty = (() => {
    const baseIdx = DIFFICULTY_ORDER.indexOf(recommendedDifficulty);
    const idx = Math.max(0, Math.min(DIFFICULTY_ORDER.length - 1, baseIdx + difficultyOffset));
    return DIFFICULTY_ORDER[idx];
  })();

  const hasProfessionBonus =
    !!userProfile &&
    (userProfile.primaryClass === PROFESSION_TO_CLASS[profession] ||
      userProfile.secondaryClass === PROFESSION_TO_CLASS[profession]);
  const previewCrystalReward = Math.round(
    DIFFICULTY_CRYSTAL_REWARD[effectiveDifficulty] * (hasProfessionBonus ? 1.5 : 1)
  );
  const previewXpBase = Math.round(
    DIFFICULTY_XP_REWARD[effectiveDifficulty] * (hasProfessionBonus ? 1.5 : 1)
  );
  const studyMult = studyCompletionXpMultiplier(title, effectiveInt);
  const pendMult = userProfile?.pendingXpMultiplier ?? 1;
  const previewXpReward = Math.round(previewXpBase * studyMult * pendMult);

  const loadData = useCallback(async () => {
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("id, xp, crystals, profession")
      .eq("id", user.id)
      .single();

    const { data: taskData } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .order("created_at", { ascending: false });

    setProfile(profileData as ProfileState);
    setTasks((taskData as Task[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    const p = loadUserProfile();
    setUserProfile(p);
    if (p) {
      setProfession(CLASS_TO_PROFESSION[p.primaryClass]);
    }
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "quick") return;
    setCreateMode("focus");
    setActionNotice("晨间仪式已就绪：直接创建今日首个任务吧。");
    setTimeout(() => titleInputRef.current?.focus(), 80);
  }, []);

  const [hashHighlightId, setHashHighlightId] = useState<string | null>(null);
  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash.startsWith("#task-")) return;
    const id = hash.slice("#task-".length);
    if (!id) return;
    setHashHighlightId(id);
    requestAnimationFrame(() => {
      document.getElementById(`task-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const t = window.setTimeout(() => setHashHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [tasks]);

  useEffect(() => {
    const id = window.setInterval(() => setListTick((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const openExploreForTask = useCallback(
    async (task: Task, briefingOverride?: ReturnType<typeof buildTaskBriefing>) => {
      let prof = userProfile ?? loadUserProfile();
      if (prof) {
        const cleared = clearExpiredTaskAdventureCooldown(prof);
        if (cleared !== prof) {
          saveUserProfile(cleared);
          setUserProfile(cleared);
          prof = cleared;
        }
      }
      const block = isTaskExploreBlocked(prof);
      if (block.blocked) {
        setActionError(block.message ?? "暂时无法开始冒险");
        return;
      }
      const briefing =
        briefingOverride ??
        buildTaskBriefing({
          title: task.title,
          profession: task.profession,
          difficulty: task.difficulty
        });
      const base = prof ?? loadUserProfile();
      const vc =
        base?.virtualCharacter ??
        createDefaultVirtualCharacter({
          realJob: base?.realJob ?? "",
          race: base?.race ?? "ambient",
          primaryClass: base?.primaryClass ?? "warrior",
          secondaryClass: base?.secondaryClass ?? "warrior"
        });
      const est = task.estimated_minutes ?? DIFFICULTY_ESTIMATED_MINUTES[task.difficulty];
      const totalSec = exploreDurationSeconds(est);
      const totalBattleTurns = Math.max(1, Math.floor(est / 5));
      const preview = adventure.buildCombatPreview({
        virtualCharacter: vc,
        task,
        estimatedMinutes: est,
        seedSuffix: briefing.seed
      });
      const exploreFeed = adventure.buildExploreFeed(preview.chronicle, totalSec);
      exploreSeedSuffixRef.current = briefing.seed;
      setExploreSession({
        task,
        briefing,
        exploreFeed,
        totalBattleTurns,
        maxHp: vc.maxHp,
        initialHp: Math.max(1, vc.hp),
        totalSec,
        combatEndHp: Math.max(1, preview.virtualCharacter.hp),
        damageTakenPreview: preview.settlement.damageTaken
      });
      await supabase
        .from("tasks")
        .update({
          explore_started_at: new Date().toISOString(),
          explore_total_seconds: totalSec
        })
        .eq("id", task.id);
    },
    [userProfile, adventure, supabase]
  );

  const submitTaskForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setActionError(null);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const todayYmd = new Date().toISOString().slice(0, 10);
    let estimatedMinutes = DIFFICULTY_ESTIMATED_MINUTES[effectiveDifficulty];
    const vp = userProfile?.virtualCharacter;
    if (vp && /阅读/.test(title) && armorReadingReduction(vp) > 0) {
      estimatedMinutes = Math.max(5, estimatedMinutes - armorReadingReduction(vp));
    }
    if (userProfile && vp && isFirstTaskOfDay(userProfile, todayYmd) && accessoryHasCoffeeCharm(vp)) {
      const f = vp.equipment.accessory?.effects.firstDailyMinuteFactor ?? 0.5;
      estimatedMinutes = Math.max(5, Math.round(estimatedMinutes * f));
    }

    if (createMode === "log") {
      if (getLogTaskCountToday(todayYmd) >= MAX_LOG_TASKS_PER_DAY) {
        setActionError(`今日「记录已完成」已达 ${MAX_LOG_TASKS_PER_DAY} 次上限，请改用「开始专注」或明日再记。`);
        return;
      }
      setLogChosenMinutes(15);
      setLogDraft({
        todayYmd,
        estimatedMinutes,
        title: title.trim(),
        profession,
        difficulty: effectiveDifficulty
      });
      setLogModalOpen(true);
      return;
    }

    let prof = userProfile ?? loadUserProfile();
    if (prof) {
      const cleared = clearExpiredTaskAdventureCooldown(prof);
      if (cleared !== prof) {
        saveUserProfile(cleared);
        setUserProfile(cleared);
        prof = cleared;
      }
    }
    const block = isTaskExploreBlocked(prof);
    if (block.blocked) {
      setActionError(block.message ?? "暂时无法开始冒险");
      return;
    }

    const insertPayload = {
      user_id: user.id,
      title: title.trim(),
      profession,
      difficulty: effectiveDifficulty,
      reward: DIFFICULTY_CRYSTAL_REWARD[effectiveDifficulty],
      xp_reward: DIFFICULTY_XP_REWARD[effectiveDifficulty],
      estimated_minutes: estimatedMinutes,
      profession_bonus_applied: false,
      anti_cheat_flag: false,
      is_completed: false,
      task_mode: "focus" as const,
      focus_ready: false,
      explore_coma: false,
      early_complete: false
    };

    const briefing = buildTaskBriefing({
      title: title.trim(),
      profession,
      difficulty: effectiveDifficulty
    });
    setPendingBriefing(briefing);
    setPendingInsert({ insertPayload, todayYmd, estimatedMinutes });
    setBriefingOpen(true);
  };

  const confirmLogTaskCreate = async () => {
    if (!logDraft) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;
    const todayYmd = logDraft.todayYmd;
    if (getLogTaskCountToday(todayYmd) >= MAX_LOG_TASKS_PER_DAY) {
      setActionError(`今日「记录已完成」已达 ${MAX_LOG_TASKS_PER_DAY} 次上限。`);
      return;
    }

    const insertPayload = {
      user_id: user.id,
      title: logDraft.title,
      profession: logDraft.profession,
      difficulty: logDraft.difficulty,
      reward: DIFFICULTY_CRYSTAL_REWARD[logDraft.difficulty],
      xp_reward: DIFFICULTY_XP_REWARD[logDraft.difficulty],
      estimated_minutes: logDraft.estimatedMinutes,
      actual_minutes: logChosenMinutes,
      profession_bonus_applied: false,
      anti_cheat_flag: false,
      is_completed: false,
      task_mode: "log" as const,
      focus_ready: false,
      explore_coma: false,
      early_complete: false
    };

    const { error } = await supabase.from("tasks").insert(insertPayload).select("*").maybeSingle();
    if (error) {
      setActionError(error.message ?? "创建失败");
      return;
    }

    incrementLogTaskCountToday(todayYmd);
    const p = loadUserProfile();
    if (p) {
      const marked = markFirstTaskOfDay(p, todayYmd);
      saveUserProfile(marked);
      setUserProfile(marked);
    }
    setTitle("");
    setDifficultyOffset(0);
    setLogModalOpen(false);
    setLogDraft(null);
    setActionNotice("已创建「记录已完成」任务：回首页或在此点击金色按钮领取奖励（事后记录奖励为 0.8 倍）。");
    await loadData();
  };

  const confirmBriefingAndCreate = async (hpMode: "full" | "inherit") => {
    if (!pendingInsert || !pendingBriefing) return;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    let base = userProfile ?? loadUserProfile();
    if (!base) {
      setActionError("缺少本地角色档案，请先完成引导。");
      return;
    }
    let vc =
      base.virtualCharacter ??
      createDefaultVirtualCharacter({
        realJob: base.realJob,
        race: base.race,
        primaryClass: base.primaryClass,
        secondaryClass: base.secondaryClass
      });
    if (hpMode === "full") {
      vc = { ...vc, hp: vc.maxHp, mp: vc.maxMp };
    }
    const nextProf: UserProfile = { ...base, virtualCharacter: vc };
    saveUserProfile(nextProf);
    setUserProfile(nextProf);

    const { insertPayload, todayYmd } = pendingInsert;
    const { data: newTask, error: insertError } = await supabase
      .from("tasks")
      .insert(insertPayload)
      .select("*")
      .maybeSingle();

    if (insertError || !newTask) {
      await supabase.from("tasks").insert(insertPayload as never);
      await loadData();
      setBriefingOpen(false);
      setPendingBriefing(null);
      setPendingInsert(null);
      setTitle("");
      setDifficultyOffset(0);
      const p = loadUserProfile();
      if (p) {
        const marked = markFirstTaskOfDay(p, todayYmd);
        saveUserProfile(marked);
        setUserProfile(marked);
      }
      setActionNotice("任务已创建（未能自动打开探索，请在列表中点击「开始探索」）。");
      return;
    }

    const marked = markFirstTaskOfDay(nextProf, todayYmd);
    saveUserProfile(marked);
    setUserProfile(marked);

    const briefingSnapshot = pendingBriefing;
    setTitle("");
    setDifficultyOffset(0);
    setBriefingOpen(false);
    setPendingInsert(null);
    setPendingBriefing(null);

    await loadData();

    const taskRow = newTask as Task;
    if (briefingSnapshot) {
      void openExploreForTask(taskRow, briefingSnapshot);
    }
  };

  const cancelBriefing = () => {
    setBriefingOpen(false);
    setPendingBriefing(null);
    setPendingInsert(null);
  };

  const handleExploreSuccess = async (finalHp: number) => {
    exploreHpRef.current = finalHp;
    const tid = exploreSession?.task.id;
    setExploreSession(null);
    if (tid) {
      await supabase
        .from("tasks")
        .update({
          focus_ready: true,
          explore_coma: false,
          explore_started_at: null,
          explore_total_seconds: null
        })
        .eq("id", tid);
      await loadData();
    }
    const p = loadUserProfile();
    if (p?.virtualCharacter) {
      const next = { ...p, virtualCharacter: { ...p.virtualCharacter, hp: finalHp } };
      saveUserProfile(next);
      setUserProfile(next);
    }
    setActionNotice("探索完成：BOSS 已倒下。请点击「完成任务」领取奖励。");
  };

  const handleEarlyExploreComplete = async (actualMinutes: number, endHp: number) => {
    const sess = exploreSession;
    if (!sess) return;
    const tid = sess.task.id;
    exploreHpRef.current = endHp;
    exploreSeedSuffixRef.current = sess.briefing.seed;
    setExploreSession(null);
    await supabase
      .from("tasks")
      .update({
        focus_ready: true,
        early_complete: true,
        actual_minutes: actualMinutes,
        explore_started_at: null,
        explore_total_seconds: null,
        explore_coma: false
      })
      .eq("id", tid);
    await loadData();
    const p = loadUserProfile();
    if (p?.virtualCharacter) {
      const next = { ...p, virtualCharacter: { ...p.virtualCharacter, hp: Math.max(1, endHp) } };
      saveUserProfile(next);
      setUserProfile(next);
    }
    setActionNotice("已提前完成探索：请点击「完成任务」领取奖励（结算后显示提前完成徽章）。");
  };

  const handleExploreComa = async () => {
    const tid = exploreSession?.task.id;
    setExploreSession(null);
    if (tid) {
      await supabase.from("tasks").update({ explore_coma: true }).eq("id", tid);
      await loadData();
    }
    const p = loadUserProfile();
    if (p?.virtualCharacter) {
      const rescued = Math.max(1, Math.floor(p.virtualCharacter.maxHp * 0.25));
      const vc2 = appendAdventureLog(p.virtualCharacter, {
        kind: "note",
        message:
          "【任务失败】你在迷宫深处昏迷，被队友拖出阵线。装备多处擦伤（叙事：耐久下降），需以减半奖励结束本次任务。"
      });
      saveUserProfile({ ...p, virtualCharacter: { ...vc2, hp: rescued } });
      setUserProfile(loadUserProfile());
    }
    setActionNotice("任务失败：你在迷宫中昏迷，被队友救出。完成时将只获得约 50% 晶石与经验。");
  };

  const handleAbandonExplore = async () => {
    const sess = exploreSession;
    if (!sess) return;
    const tid = sess.task.id;
    setExploreSession(null);
    try {
      await supabase.from("tasks").delete().eq("id", tid);
    } catch {
      setActionError("放弃任务时删除失败，请稍后在列表中手动处理。");
    }
    const p = loadUserProfile();
    if (p?.virtualCharacter) {
      const fled = applyAdventureFleePenalty(p.virtualCharacter);
      const vc2 = appendAdventureLog(fled, {
        kind: "note",
        message:
          "【放弃任务】你成功撤出迷宫，但装备在狭窄甬道中多处刮擦——叙事上耐久度下降，HP 亦因强行突围而受损。"
      });
      saveUserProfile({ ...p, virtualCharacter: vc2 });
      setUserProfile(loadUserProfile());
    }
    exploreSeedSuffixRef.current = "";
    setActionNotice("已放弃任务：逃跑成功，但装备耐久与生命已付出代价。");
    await loadData();
  };

  const playLevelUpSound = () => {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((note, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = note;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + idx * 0.12;
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  };

  const completeTask = async (task: Task, event: MouseEvent<HTMLButtonElement>) => {
    if (!profile || task.is_completed) return;
    setActionError(null);
    setActionNotice(null);
    const exploreMode = deriveTaskExploreUiState(task);
    if (exploreMode === "pending") {
      setActionError("请先完成探索流程（专注模式需倒计时结束或提前完成）。");
      return;
    }
    const comaMode = exploreMode === "coma";
    const todayKey = new Date().toISOString().slice(0, 10);
    const completedTodayCount = Number(localStorage.getItem(`life-rpg-daily-count-${todayKey}`) ?? "0");
    const dynamicBonus = computeTaskMultiplier(
      userProfile,
      task.profession,
      task.title,
      new Date(),
      completedTodayCount
    );
    const applyProfessionBonus = dynamicBonus.tags.some((tag) => tag.includes("职业"));
    const effInt = userProfile?.virtualCharacter ? getEffectiveInt(userProfile.virtualCharacter) : 10;
    const pend = userProfile?.pendingXpMultiplier ?? 1;
    const studyMult = studyCompletionXpMultiplier(task.title, effInt);
    const estimatedMinutes = task.estimated_minutes ?? DIFFICULTY_ESTIMATED_MINUTES[task.difficulty];
    const mode = getTaskMode(task);
    let actualMinutes: number;
    if (mode === "log") {
      actualMinutes = Math.max(1, task.actual_minutes ?? estimatedMinutes);
    } else if (task.early_complete && task.actual_minutes != null) {
      actualMinutes = Math.max(1, task.actual_minutes);
    } else {
      const elapsedMs = Date.now() - new Date(task.created_at).getTime();
      actualMinutes = Math.max(1, Math.round(elapsedMs / 60000));
      actualMinutes = Math.min(actualMinutes, estimatedMinutes * 4);
    }

    const permanentRecorderMult = userProfile?.checkInMeta?.recorderBadgeUnlocked ? 1.05 : 1;
    const { finalCrystal, finalXp, isCheatWarning } = computeFinalTaskRewards({
      task,
      actualMinutes,
      dynamicMult: dynamicBonus.multiplier,
      comaMode,
      studyMult,
      pendMult: pend * permanentRecorderMult
    });

    if (isCheatWarning) {
      setActionNotice("任务完成太快，已触发防刷机制：奖励减半并标记作弊警告。");
    } else if (dynamicBonus.tags.length > 0) {
      setActionNotice(`已触发加成：${dynamicBonus.tags.join("、")}`);
    }
    if (comaMode) {
      setActionNotice((prev) =>
        prev
          ? `${prev} 昏迷结算：晶石与经验再减半（合计约 50% 基准）。`
          : "昏迷结算：你在迷宫中被救出，仅获得约一半晶石与经验。"
      );
    }
    if (mode === "log") {
      setActionNotice((prev) =>
        prev ? `${prev} 事后记录：奖励已按 0.8 倍折算。` : "事后记录：奖励已按 0.8 倍折算。"
      );
    }

    const nextXp = profile.xp + finalXp;
    const nextCrystals = profile.crystals + finalCrystal;
    const currentLevel = getLevelFromXp(profile.xp);
    const nextLevel = getLevelFromXp(nextXp);
    const rect = event.currentTarget.getBoundingClientRect();
    const key = Date.now();

    setBurst({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      key
    });
    setRewardToast({
      xp: finalXp,
      crystals: finalCrystal,
      key
    });
    setExitingTaskIds((prev) => [...prev, task.id]);
    setShowCelebration(true);
    setProfile({ ...profile, xp: nextXp, crystals: nextCrystals });
    setCrystalAnimKey((prev) => prev + 1);

    if (nextLevel > currentLevel) {
      setShowLevelUp(true);
      playLevelUpSound();
      setTimeout(() => setShowLevelUp(false), 1700);
    }

    setTimeout(() => {
      setTasks((prev) => prev.filter((item) => item.id !== task.id));
      setExitingTaskIds((prev) => prev.filter((id) => id !== task.id));
    }, 420);

    try {
      const result = await executeTaskCompletion({
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
        exploreEndHp: comaMode ? null : exploreHpRef.current,
        exploreSeedSuffix: exploreSeedSuffixRef.current || task.id,
        completedTodayCount,
        todayKey
      });

      const longTerm = processTaskForLongTerm(
        task,
        finalXp,
        Math.max(0, (task.actual_minutes ?? actualMinutes) / 60)
      );
      if (longTerm.bonusXp > 0 || longTerm.bonusCrystals > 0) {
        const xp2 = result.nextXp + longTerm.bonusXp;
        const c2 = result.nextCrystals + longTerm.bonusCrystals;
        setProfile((prev) => (prev ? { ...prev, xp: xp2, crystals: c2 } : prev));
        await supabase
          .from("profiles")
          .update({
            xp: xp2,
            crystals: c2
          })
          .eq("id", profile.id);
        setActionNotice(
          (prev) =>
            [prev, ...longTerm.notices]
              .filter(Boolean)
              .join("；") || `长线奖励：+${longTerm.bonusXp} XP / +${longTerm.bonusCrystals} 晶石`
        );
      }

      exploreHpRef.current = null;
      exploreSeedSuffixRef.current = "";
      if (result.settlement) {
        setLastSettlement(result.settlement);
        setLastSettlementTurns(result.settlementTurns);
      }
      if (result.nextProfile) {
        setSkillUnlockFlash(result.newUnlocks);
        setUserProfile(result.nextProfile);
      }
      setPendingCheckIn({
        task,
        completedAt: result.completedAt,
        mode: getTaskMode(task),
        actualDuration: actualMinutes,
        crystals: finalCrystal,
        baseXP: finalXp,
        raceBonusTags: dynamicBonus.tags.filter((tag) => /晨型人|夜行者|独行侠|社交蝴蝶|多线程/.test(tag)),
        leveledUp: nextLevel > currentLevel,
        unlockedSkills: result.newUnlocks.map((u) => `${u.profession}-${u.nodeName}`),
        equipmentAcquiredIds: result.equipmentAcquiredIds,
        adventureMeta: result.adventureMeta,
        nextProfile: result.nextProfile,
        nextProfileXp: result.nextXp
      });
      void appendDailyAdventureLog({
        completedAt: result.completedAt,
        task,
        actualDuration: actualMinutes,
        finalXp,
        finalCrystals: finalCrystal,
        raceBonusTags: dynamicBonus.tags.filter((tag) => /晨型人|夜行者|独行侠|社交蝴蝶|多线程/.test(tag)),
        levelUp: nextLevel > currentLevel,
        unlockedSkills: result.newUnlocks.map((u) => `${u.profession}-${u.nodeName}`),
        droppedEquipmentIds: result.equipmentAcquiredIds,
        adventureMeta: result.adventureMeta,
        profileAfterCompletion: result.nextProfile,
        profileXpAfterCompletion: result.nextXp
      });
      const remaining = tasks.filter((t) => t.id !== task.id).length;
      if (remaining === 0) {
        setTimeout(() => {
          const yes = window.confirm("今日冒险结束，是否生成日志？");
          if (yes) {
            void sealTodayJournal().then(() =>
              setActionNotice("今日日志已封存，可在「人生日志」页回顾。")
            );
          }
        }, 500);
      }
      setSettlementOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "任务完成失败，请重试";
      setActionError(msg);
      await loadData();
    }

    setTimeout(() => {
      setShowCelebration(false);
      setRewardToast(null);
      setBurst(null);
    }, 1400);
  };

  const handleSubmitCheckIn = async (payload?: Omit<TaskCompletionCheckIn, "checkInType">) => {
    if (!pendingCheckIn || !profile) return;
    const checkInType = payload ? detectCheckInType(payload) : null;
    const checkIn = payload
      ? ({
          ...payload,
          checkInType
        } as TaskCompletionCheckIn)
      : undefined;
    const xpMult = checkIn ? computeCheckInXpMultiplier(checkIn) : 1;
    const bonusXP = Math.max(0, Math.round(pendingCheckIn.baseXP * (xpMult - 1)));

    let unlockedBadge = false;
    if (checkIn) {
      const streak = registerCheckInStreak(pendingCheckIn.completedAt, true);
      if (streak >= 3) {
        const current = userProfile ?? loadUserProfile();
        if (current && !current.checkInMeta?.recorderBadgeUnlocked) {
          const next = {
            ...current,
            checkInMeta: {
              ...current.checkInMeta,
              recorderBadgeUnlocked: true
            }
          };
          saveUserProfile(next);
          setUserProfile(next);
          unlockedBadge = true;
        }
      }
    } else {
      registerCheckInStreak(pendingCheckIn.completedAt, false);
    }

    if (bonusXP > 0) {
      const nextXp = profile.xp + bonusXP;
      setProfile((prev) => (prev ? { ...prev, xp: nextXp } : prev));
      await supabase.from("profiles").update({ xp: nextXp }).eq("id", profile.id);
      setRewardToast({ xp: bonusXP, crystals: 0, key: Date.now() + 100 });
      setTimeout(() => setRewardToast(null), 1200);
    }

    appendTaskCompletion({
      taskId: pendingCheckIn.task.id,
      completedAt: pendingCheckIn.completedAt,
      mode: pendingCheckIn.mode,
      actualDuration: pendingCheckIn.actualDuration,
      rewards: {
        crystals: pendingCheckIn.crystals,
        baseXP: pendingCheckIn.baseXP,
        bonusXP
      },
      checkIn
    });
    void appendDailyCheckIn({
      completedAt: pendingCheckIn.completedAt,
      taskId: pendingCheckIn.task.id,
      checkIn
    });

    if (unlockedBadge) {
      setActionNotice("🎖️ 连续 3 次完成打卡，已解锁「记录者」徽章：后续任务永久 +5% XP。");
    } else if (bonusXP > 0) {
      setActionNotice(`打卡成功：额外获得 +${bonusXP} XP。`);
    }
    setPendingCheckIn(null);
  };

  const applyQuickTask = (taskName: string, taskProfession: Profession) => {
    setTitle(taskName);
    setProfession(taskProfession);
    setDifficultyOffset(0);
  };

  const pickRandomTask = () => {
    const candidates = QUICK_TASKS[profession];
    if (!candidates?.length) return;
    const randomTask = candidates[Math.floor(Math.random() * candidates.length)];
    setTitle(randomTask);
    setDifficultyOffset(0);
  };

  if (!profile) {
    return (
      <AppShell>
        <div className="card">加载中...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <CelebrationOverlay show={showCelebration} />
      <AnimatePresence>
        {briefingOpen && pendingBriefing && (
          <TaskAdventureBriefingModal
            open={briefingOpen}
            briefing={pendingBriefing}
            onCancel={cancelBriefing}
            onConfirm={confirmBriefingAndCreate}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {logModalOpen && logDraft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 12 }}
              className="w-full max-w-md rounded-2xl border border-emerald-700/50 bg-slate-950 px-5 py-6 shadow-xl"
            >
              <p className="text-center text-lg font-semibold text-emerald-100">实际耗时多久？</p>
              <p className="mt-2 text-center text-xs text-slate-400">
                选择本次真实投入时间（分钟）。今日还可记录{" "}
                {Math.max(0, MAX_LOG_TASKS_PER_DAY - getLogTaskCountToday(logDraft.todayYmd))} 次。
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {LOG_DURATION_CHOICES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setLogChosenMinutes(m)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium ${
                      logChosenMinutes === m
                        ? "border-emerald-400 bg-emerald-500/20 text-emerald-100"
                        : "border-slate-600 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    {m} 分
                  </button>
                ))}
              </div>
              <p className="mt-4 text-center text-xs text-amber-200/90">
                事后记录奖励统一 ×0.8；每日最多 {MAX_LOG_TASKS_PER_DAY} 条。
              </p>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setLogModalOpen(false);
                    setLogDraft(null);
                  }}
                  className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void confirmLogTaskCreate()}
                  className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                >
                  创建并待领取
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {exploreSession && (
        <TaskExploreOverlay
          task={exploreSession.task}
          briefing={exploreSession.briefing}
          exploreFeed={exploreSession.exploreFeed}
          totalBattleTurns={exploreSession.totalBattleTurns}
          totalSec={exploreSession.totalSec}
          maxHp={exploreSession.maxHp}
          initialHp={exploreSession.initialHp}
          combatEndHp={exploreSession.combatEndHp}
          damageTakenPreview={exploreSession.damageTakenPreview}
          estimatedMinutes={
            exploreSession.task.estimated_minutes ??
            DIFFICULTY_ESTIMATED_MINUTES[exploreSession.task.difficulty]
          }
          onSuccess={handleExploreSuccess}
          onComa={handleExploreComa}
          onAbandon={handleAbandonExplore}
          onEarlyComplete={handleEarlyExploreComplete}
        />
      )}
      <AdventureSettlementModal
        open={settlementOpen}
        settlement={lastSettlement}
        turnsMeta={lastSettlementTurns}
        baseXp={pendingCheckIn?.baseXP ?? 0}
        onSubmitCheckIn={(payload) => void handleSubmitCheckIn(payload)}
        onClose={() => {
          setSettlementOpen(false);
          setLastSettlement(null);
        }}
      />
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45"
          >
            <motion.div
              initial={{ scale: 0.8, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -8 }}
              className="rounded-2xl border border-amber-300/70 bg-amber-300/20 px-8 py-5 text-center"
            >
              <p className="text-xs tracking-[0.35em] text-amber-100">LEVEL UP!</p>
              <p className="mt-1 text-3xl font-bold text-amber-200">NEW POWER UNLOCKED</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {rewardToast && (
          <motion.div
            key={rewardToast.key}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: -8, scale: 1 }}
            exit={{ opacity: 0, y: -50 }}
            transition={{ duration: 0.95 }}
            className="pointer-events-none fixed left-1/2 top-1/2 z-50 -translate-x-1/2 text-center"
          >
            <p className="text-3xl font-bold text-emerald-300">+{rewardToast.xp} XP</p>
            <p className="text-2xl font-semibold text-cyan-300">+{rewardToast.crystals} 晶石</p>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {burst && (
          <motion.div key={burst.key} className="pointer-events-none fixed inset-0 z-50">
            {Array.from({ length: 18 }).map((_, idx) => {
              const angle = (Math.PI * 2 * idx) / 18;
              const dist = 60 + (idx % 6) * 14;
              return (
                <motion.span
                  key={`${burst.key}-${idx}`}
                  className="absolute h-2 w-2 rounded-full bg-cyan-300"
                  initial={{
                    left: burst.x,
                    top: burst.y,
                    opacity: 1,
                    scale: 1
                  }}
                  animate={{
                    left: burst.x + Math.cos(angle) * dist,
                    top: burst.y + Math.sin(angle) * dist,
                    opacity: 0,
                    scale: 0.2
                  }}
                  transition={{ duration: 0.58, ease: "easeOut" }}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="card mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">任务总览</h2>
          <span className="text-sm text-slate-300">Lv.{getLevelFromXp(profile.xp)}</span>
        </div>
        <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
          <span className="text-sm text-slate-300">晶石</span>
          <motion.span
            key={crystalAnimKey}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.25 }}
            className="text-lg font-semibold text-cyan-300"
          >
            {profile.crystals}
          </motion.span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={profile.xp}
            initial={{ opacity: 0.6, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0.4, y: -5 }}
            transition={{ duration: 0.35 }}
          >
            <XpBar progress={getLevelProgress(profile.xp)} xp={profile.xp} />
          </motion.div>
        </AnimatePresence>
      </section>

      <section className="card mb-6">
        <h2 className="mb-4 text-lg font-semibold">添加任务</h2>
        <p className="mb-4 text-xs text-slate-400">
          选择模式：<span className="text-amber-200/90">开始专注</span>需全屏冒险倒计时；<span className="text-emerald-200/90">记录已完成</span>
          跳过探索，填实际耗时后待领取（每日最多 {MAX_LOG_TASKS_PER_DAY} 条，奖励 ×0.8）。专注模式连续 3 次迷宫昏迷将强制休息。
        </p>

        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setCreateMode("focus")}
            className={`rounded-xl border-2 px-4 py-6 text-left transition ${
              createMode === "focus"
                ? "border-rose-500/70 bg-rose-950/40 shadow-lg shadow-rose-900/20"
                : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
            }`}
          >
            <p className="text-2xl">🔴</p>
            <p className="mt-2 text-base font-semibold text-rose-100">开始专注</p>
            <p className="mt-1 text-xs text-slate-400">番茄钟：全屏冒险，倒计时结束或提前完成后结算</p>
          </button>
          <button
            type="button"
            onClick={() => setCreateMode("log")}
            className={`rounded-xl border-2 px-4 py-6 text-left transition ${
              createMode === "log"
                ? "border-emerald-500/70 bg-emerald-950/40 shadow-lg shadow-emerald-900/20"
                : "border-slate-700 bg-slate-900/60 hover:border-slate-500"
            }`}
          >
            <p className="text-2xl">✅</p>
            <p className="mt-2 text-base font-semibold text-emerald-100">记录已完成</p>
            <p className="mt-1 text-xs text-slate-400">记账：选实际耗时，跳过倒计时，直接待领取</p>
          </button>
        </div>

        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm text-slate-300">快速任务</p>
            <button
              type="button"
              onClick={pickRandomTask}
              className="rounded-md border border-cyan-700/60 px-2 py-1 text-xs text-cyan-300 hover:border-cyan-500"
            >
              随机任务（当前职业）
            </button>
          </div>
          <div className="space-y-2">
            {(Object.keys(QUICK_TASKS) as Profession[]).map((job) => (
              <div key={job} className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-slate-700 px-2 py-0.5 text-xs text-slate-300">
                  {job}
                </span>
                {QUICK_TASKS[job].map((taskName) => (
                  <button
                    key={`${job}-${taskName}`}
                    type="button"
                    onClick={() => applyQuickTask(taskName, job)}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
                  >
                    {taskName}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={submitTaskForm} className="grid gap-3 md:grid-cols-4">
          <input
            ref={titleInputRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="任务名称"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none ring-cyan-500 focus:ring md:col-span-2"
          />

          <select
            value={profession}
            onChange={(e) => setProfession(e.target.value as Profession)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          >
            {PROFESSIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.value}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-end gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
            <button
              type="button"
              onClick={() => setDifficultyOffset((v) => Math.max(v - 1, -2))}
              className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200"
            >
              [-]
            </button>
            <button
              type="button"
              onClick={() => setDifficultyOffset((v) => Math.min(v + 1, 2))}
              className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200"
            >
              [+]
            </button>
          </div>

          <div className="md:col-span-4">
            <div
              className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                DIFFICULTY_META[effectiveDifficulty].color
              }`}
            >
              <span>{DIFFICULTY_META[effectiveDifficulty].icon}</span>
              <span>{DIFFICULTY_META[effectiveDifficulty].label}</span>
            </div>
            <p className={`text-sm ${DIFFICULTY_META[effectiveDifficulty].descColor}`}>
              检测为：{DIFFICULTY_META[effectiveDifficulty].label} {DIFFICULTY_META[effectiveDifficulty].icon}
              ，奖励：{previewCrystalReward}晶石 +{previewXpReward}XP
            </p>
            {userProfile && (
              <p className="mt-1 text-xs text-slate-300">
                种族：{RACE_META[userProfile.race].icon} {RACE_META[userProfile.race].name}（动态加成生效）
              </p>
            )}
            {hasProfessionBonus && (
              <p className="mt-1 text-xs text-cyan-300">已应用职业匹配动态加成</p>
            )}
            {rawRecommended !== recommendedDifficulty && (
              <p className="mt-1 text-xs text-violet-300">
                高智力角色对学习类任务更「挑剔」：已从「简单」上调判定难度（标准更高，完成后 XP 加成更高）。
              </p>
            )}
            {(pendMult > 1 || studyMult > 1) && (
              <p className="mt-1 text-xs text-emerald-300">
                预览 XP 含加成：学识×{studyMult.toFixed(2)}
                {pendMult > 1 ? ` · 药剂×${pendMult.toFixed(2)}` : ""}
              </p>
            )}
            {createMode === "log" && (
              <p className="mt-1 text-xs text-emerald-300/90">
                记账模式结算时再按实际分钟比例计算，并整体 ×0.8。
              </p>
            )}
            {difficultyOffset > 0 && effectiveDifficulty === "Hard" && (
              <p className="mt-1 text-xs text-amber-300">
                确定这是困难任务吗？完成后可获得更多奖励
              </p>
            )}
          </div>

          <button className="rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500 md:col-span-4">
            {createMode === "focus" ? "新增任务（冒险简报）" : "新增任务（记录已完成）"}
          </button>
        </form>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold">任务列表</h2>
        {actionError && <p className="mb-3 text-sm text-red-400">{actionError}</p>}
        {actionNotice && <p className="mb-3 text-sm text-amber-300">{actionNotice}</p>}
        <div className="space-y-3">
          <AnimatePresence>
            {tasks.map((task) => {
              void listTick;
              const exMode = deriveTaskExploreUiState(task);
              const canClaim = exMode === "ready" || exMode === "coma";
              const mode = getTaskMode(task);
              const running = isFocusCountdownRunning(task);
              const bar = running ? focusCountdownProgress(task, Date.now()) : 0;
              const isLog = mode === "log";
              return (
                <motion.div
                  id={`task-${task.id}`}
                  key={task.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 110, transition: { duration: 0.38 } }}
                  className={`flex flex-col gap-2 rounded-lg border bg-slate-900 p-3 md:flex-row md:items-center md:justify-between ${
                    hashHighlightId === task.id
                      ? "border-amber-400 shadow-lg shadow-amber-500/20"
                      : "border-slate-800"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-slate-400">
                      {task.profession} · {task.difficulty} · +{task.reward} 晶石
                      {typeof task.xp_reward === "number" ? ` · +${task.xp_reward} XP` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {isLog && (
                        <span className="rounded-full border border-emerald-600/60 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                          事后记录
                        </span>
                      )}
                      {!!task.early_complete && (
                        <span className="rounded-full border border-cyan-600/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
                          提前完成
                        </span>
                      )}
                      {userProfile &&
                        (userProfile.primaryClass === PROFESSION_TO_CLASS[task.profession] ||
                          userProfile.secondaryClass === PROFESSION_TO_CLASS[task.profession]) && (
                        <span className="rounded-full border border-cyan-600/60 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-300">
                          职业加成
                        </span>
                      )}
                      <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                        预计耗时 {task.estimated_minutes ?? DIFFICULTY_ESTIMATED_MINUTES[task.difficulty]} 分钟
                        {typeof task.actual_minutes === "number" ? ` · 实际填 ${task.actual_minutes} 分` : ""}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          exMode === "pending"
                            ? "border-amber-700/60 bg-amber-500/10 text-amber-200"
                            : exMode === "coma"
                              ? "border-rose-700/60 bg-rose-500/10 text-rose-200"
                              : "border-emerald-700/60 bg-emerald-500/10 text-emerald-200"
                        }`}
                      >
                        {isLog && exMode === "ready" && "待领取奖励"}
                        {!isLog && exMode === "pending" && !running && "迷宫：待探索"}
                        {!isLog && exMode === "pending" && running && "专注进行中"}
                        {!isLog && exMode === "ready" && "迷宫：可结算"}
                        {exMode === "coma" && "迷宫：昏迷结算"}
                      </span>
                      {!!task.anti_cheat_flag && (
                        <span className="rounded-full border border-red-600/60 bg-red-500/10 px-2 py-0.5 text-[10px] text-red-300">
                          作弊警告
                        </span>
                      )}
                    </div>
                    {running && (
                      <div className="mt-3 max-w-md">
                        <div className="mb-1 flex justify-between text-[10px] text-amber-200/90">
                          <span>专注进度</span>
                          <span>{Math.round(bar * 100)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-rose-500 transition-all duration-500"
                            style={{ width: `${bar * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => void openExploreForTask(task)}
                      disabled={
                        task.is_completed ||
                        exitingTaskIds.includes(task.id) ||
                        isLog ||
                        exMode !== "pending" ||
                        !!exploreSession
                      }
                      className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-1.5 text-sm text-amber-100 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      开始探索
                    </button>
                    <button
                      type="button"
                      onClick={(event) => completeTask(task, event)}
                      disabled={task.is_completed || exitingTaskIds.includes(task.id) || !canClaim}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        task.is_completed || exitingTaskIds.includes(task.id)
                          ? "bg-emerald-600/20 text-emerald-300"
                          : !canClaim
                            ? "cursor-not-allowed bg-slate-800 text-slate-500"
                            : isLog
                              ? "animate-pulse bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-900 shadow-lg shadow-amber-500/30 hover:from-amber-400 hover:to-yellow-300"
                              : "bg-cyan-600 text-white hover:bg-cyan-500"
                      }`}
                    >
                      {task.is_completed || exitingTaskIds.includes(task.id)
                        ? "完成中..."
                        : isLog
                          ? "点击领取奖励"
                          : exMode === "coma"
                            ? "完成任务（减半）"
                            : "完成任务"}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {tasks.length === 0 && <p className="text-sm text-slate-400">暂无任务，先创建一个吧。</p>}
        </div>
      </section>
    </AppShell>
  );
}
