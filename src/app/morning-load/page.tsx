"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Dices, Sparkles, Sword } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { loadDailyMainQuest, MAIN_QUEST_OPTIONS, saveDailyMainQuest } from "@/lib/daily-main-quest";
import { isMorningLoadCompleteForToday, markMorningLoadComplete } from "@/lib/daily-loop-state";
import { loadUserProfile, type UserProfile } from "@/lib/user-profile";

type YesterdaySeal = {
  date: string;
  quote: string;
  summary?: {
    tasksCompleted: number;
    totalXP: number;
    topMonster: string;
  };
  streak?: number;
};

type TodayFortune = {
  type: "great" | "good" | "normal" | "challenge";
  title: string;
  description: string;
  bonus: string;
};

const STEP_DURATION = [2000, 3000, 2500, 3000, 1000];

function yesterdayYmd() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

function generateFortune(): TodayFortune {
  const fortunes: TodayFortune[] = [
    {
      type: "great",
      title: "大吉",
      description: "星辰排列异常有利，今日首战奖励翻倍！",
      bonus: "首个任务 XP × 2"
    },
    {
      type: "good",
      title: "中吉",
      description: "微风带来好运，随机属性临时提升。",
      bonus: "随机属性 +2（持续今日）"
    },
    {
      type: "normal",
      title: "平吉",
      description: "平稳的一天，适合稳扎稳打。",
      bonus: "完成任意任务额外 +5 晶石"
    },
    {
      type: "challenge",
      title: "挑战",
      description: "命运之轮指向试炼，困难即机遇。",
      bonus: "困难任务奖励 +50%，但视觉难度 +1 级"
    }
  ];
  return fortunes[Math.floor(Math.random() * fortunes.length)] as TodayFortune;
}

function raceInfo(profile: UserProfile | null, hour: number) {
  const race = profile?.race ?? "ambient";
  if (race === "earlybird") {
    return hour < 8
      ? {
          title: "晨型人加成启动",
          desc: "清晨的雾气中充满了魔力，你的专注力+20%。",
          color: "from-orange-400 to-yellow-300"
        }
      : { title: "晨型人时刻", desc: "建议优先处理最重要任务。", color: "from-blue-400 to-orange-300" };
  }
  if (race === "nightowl") {
    return hour > 19
      ? { title: "夜行者觉醒", desc: "夜幕降临，晚间任务奖励上升。", color: "from-purple-600 to-indigo-800" }
      : { title: "夜行者早起", desc: "今天也很勇敢地开始了。", color: "from-indigo-400 to-purple-300" };
  }
  if (race === "lonewolf")
    return { title: "独行侠特性", desc: "今日个人任务收益更佳。", color: "from-gray-400 to-slate-300" };
  if (race === "socialite")
    return { title: "社交蝴蝶", desc: "社交互动类任务更容易爆发。", color: "from-pink-400 to-rose-300" };
  return { title: "平衡状态", desc: "稳步推进，万事可成。", color: "from-cyan-400 to-sky-300" };
}

export default function MorningLoadPage() {
  const router = useRouter();
  const [pickMainOnly, setPickMainOnly] = useState(false);
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [yesterday, setYesterday] = useState<YesterdaySeal | null>(null);
  const [fortune, setFortune] = useState<TodayFortune | null>(null);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [selectedMainQuestId, setSelectedMainQuestId] = useState(MAIN_QUEST_OPTIONS[0]?.id ?? "health-reset");

  useLayoutEffect(() => {
    const pick =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("pickMain") === "1";
    setPickMainOnly(pick);

    if (isMorningLoadCompleteForToday() && !pick) {
      router.replace("/");
      return;
    }
    setProfile(loadUserProfile());
    if (pick && isMorningLoadCompleteForToday()) {
      const mq = loadDailyMainQuest();
      if (mq?.id) setSelectedMainQuestId(mq.id);
      setShowQuickCreate(true);
      setStep(STEP_DURATION.length - 1);
      setYesterday(null);
      setFortune(null);
      return;
    }
    try {
      const y = JSON.parse(localStorage.getItem(`seal_${yesterdayYmd()}`) ?? "null") as YesterdaySeal | null;
      setYesterday(y);
    } catch {
      setYesterday(null);
    }
    setFortune(generateFortune());
  }, [router]);

  useEffect(() => {
    if (pickMainOnly && isMorningLoadCompleteForToday()) return;
    if (step >= STEP_DURATION.length - 1) {
      setShowQuickCreate(true);
      markMorningLoadComplete();
      return;
    }
    const id = window.setTimeout(() => setStep((s) => s + 1), STEP_DURATION[step]);
    return () => window.clearTimeout(id);
  }, [step, pickMainOnly]);

  const currentHour = new Date().getHours();
  const race = raceInfo(profile, currentHour);
  const selectedMainQuest = useMemo(
    () => MAIN_QUEST_OPTIONS.find((opt) => opt.id === selectedMainQuestId) ?? MAIN_QUEST_OPTIONS[0],
    [selectedMainQuestId]
  );

  const persistMorningSelection = (nextPath: string) => {
    if (fortune) localStorage.setItem("todayFortune", JSON.stringify(fortune));
    if (selectedMainQuest) saveDailyMainQuest(selectedMainQuest);
    markMorningLoadComplete();
    router.push(nextPath);
  };

  const persistPickMainOnly = (nextPath: string) => {
    if (selectedMainQuest) saveDailyMainQuest(selectedMainQuest);
    router.push(nextPath);
  };

  const acceptFortune = () => {
    persistMorningSelection("/tasks?mode=quick");
  };

  if (pickMainOnly && isMorningLoadCompleteForToday()) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-slate-900 p-6 text-white">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-sm text-slate-500 transition-colors hover:text-slate-300"
        >
          ← 回营地
        </button>
        <div className="mx-auto mt-10 max-w-3xl space-y-6 text-center">
          <h1 className="text-2xl font-semibold text-amber-100">补选今日主线</h1>
          <p className="text-sm text-slate-400">晨间已报到过，这里只补登今日章节方向，不会影响晨间完成状态。</p>
          <div className="grid gap-3 text-left md:grid-cols-2">
            {MAIN_QUEST_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedMainQuestId(option.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  selectedMainQuestId === option.id
                    ? "border-amber-400 bg-amber-500/10"
                    : "border-slate-700/70 bg-slate-900/60 hover:border-slate-500"
                }`}
              >
                <p className="text-sm font-semibold text-amber-100">{option.title}</p>
                <p className="mt-1 text-xs text-slate-400">{option.objective}</p>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => persistPickMainOnly("/tasks?mode=quick")}
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl"
            >
              锁定并去任务页
            </button>
            <button
              type="button"
              onClick={() => persistPickMainOnly("/")}
              className="rounded-full border border-slate-600 px-6 py-3 text-sm text-slate-300 hover:border-slate-400"
            >
              锁定后回营地
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900 text-white">
      <AnimatePresence>
        {step === 0 && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 2 }}
            className="absolute inset-0 z-50 bg-black"
          />
        )}
      </AnimatePresence>
      <div
        className={`absolute inset-0 bg-gradient-to-b ${
          currentHour < 6 || currentHour > 20 ? "from-slate-900 via-purple-900 to-slate-900" : "from-slate-800 via-orange-900/20 to-slate-900"
        }`}
      />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-6">
        {step === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
            <div className="mx-auto mb-8 h-32 w-32 animate-pulse rounded-full bg-gradient-to-r from-orange-400 to-yellow-300 opacity-50 blur-3xl" />
            <h1 className="bg-gradient-to-r from-orange-200 to-yellow-200 bg-clip-text text-3xl font-serif text-transparent">正在苏醒...</h1>
            <p className="mt-4 text-slate-400">读取昨日存档</p>
          </motion.div>
        )}

        {step >= 1 && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="max-w-md text-center">
            <span className="mb-6 inline-block rounded-full border border-slate-600 bg-slate-800/50 p-4">
              <BookOpen className="h-8 w-8 text-amber-400" />
            </span>
            <h2 className="mb-4 text-2xl font-serif text-amber-100">欢迎回来，{profile?.nickname ?? "冒险者"}</h2>
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-6 backdrop-blur">
              <p className="mb-4 text-slate-300">
                昨日你
                {yesterday?.summary?.tasksCompleted
                  ? `击败了 ${yesterday.summary.tasksCompleted} 只怪物`
                  : "在营地休整了一天"}
                {yesterday?.streak ? `，已连续封存 ${yesterday.streak} 日。` : "。"}
              </p>
              {yesterday?.quote && (
                <div className="rounded-lg border-l-4 border-amber-500 bg-slate-900/50 p-4">
                  <p className="font-serif italic text-amber-200/80">&ldquo;{yesterday.quote}&rdquo;</p>
                  <p className="mt-2 text-xs text-slate-500">— 昨日封存的记忆</p>
                </div>
              )}
              {yesterday?.summary?.topMonster && (
                <div className="mt-4 flex items-center gap-2 text-sm text-slate-400">
                  <Sword className="h-4 w-4 text-red-400" />
                  <span>最激烈一战：{yesterday.summary.topMonster}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {step >= 2 && (
          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 text-center">
            <div className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-gradient-to-r px-6 py-3 ${race.color}`}>
              <Sparkles className="h-5 w-5 text-white" />
              <span className="font-bold text-white">{race.title}</span>
            </div>
            <p className="mx-auto mt-4 max-w-sm text-slate-300">{race.desc}</p>
          </motion.div>
        )}

        {step >= 3 && fortune && (
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="mt-8 text-center">
            <div className="group relative cursor-pointer" onClick={acceptFortune}>
              <div
                className={`absolute inset-0 rounded-2xl blur transition-opacity group-hover:opacity-75 ${
                  fortune.type === "great"
                    ? "bg-gradient-to-r from-yellow-400 to-amber-600 opacity-50"
                    : fortune.type === "challenge"
                      ? "bg-gradient-to-r from-red-500 to-purple-600 opacity-50"
                      : "bg-gradient-to-r from-blue-400 to-indigo-500 opacity-40"
                }`}
              />
              <div className="relative min-w-[280px] rounded-2xl border border-slate-700 bg-slate-900 p-6">
                <div className="mb-3 flex items-center justify-center gap-2">
                  <Dices className="h-5 w-5 text-slate-400" />
                  <span className="text-sm text-slate-400">今日运势</span>
                </div>
                <h3
                  className={`mb-2 text-3xl font-bold ${
                    fortune.type === "great"
                      ? "text-yellow-400"
                      : fortune.type === "challenge"
                        ? "text-red-400"
                        : "text-blue-400"
                  }`}
                >
                  {fortune.title}
                </h3>
                <p className="text-sm text-slate-300">{fortune.description}</p>
                <div className="mt-4 rounded-full border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300">
                  效果：{fortune.bonus}
                </div>
                <p className="mt-4 animate-pulse text-xs text-slate-500">点击接受命运，或无视它，自己掌控</p>
              </div>
            </div>
          </motion.div>
        )}

        {showQuickCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-12 w-full max-w-3xl space-y-4 text-center">
            <p className="text-sm text-slate-300">今日首役前，先锁定你的主线。</p>
            <div className="grid gap-3 md:grid-cols-2">
              {MAIN_QUEST_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSelectedMainQuestId(option.id)}
                  className={`rounded-xl border p-4 text-left transition ${
                    selectedMainQuestId === option.id
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-slate-700/70 bg-slate-900/60 hover:border-slate-500"
                  }`}
                >
                  <p className="text-sm font-semibold text-amber-100">{option.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{option.objective}</p>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                onClick={acceptFortune}
                className="group relative rounded-full bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Sword className="h-5 w-5" />
                  锁定主线并去任务页
                </span>
              </button>
              <button
                onClick={() => persistMorningSelection("/")}
                className="rounded-full border border-slate-600 px-6 py-3 text-sm text-slate-300 transition-colors hover:border-slate-400 hover:text-slate-100"
              >
                锁定主线，先回营地
              </button>
            </div>
          </motion.div>
        )}

        {step < 4 && (
          <button
            onClick={() => {
              markMorningLoadComplete();
              router.push("/");
            }}
            className="absolute bottom-8 right-8 text-sm text-slate-600 transition-colors hover:text-slate-400"
          >
            跳过仪式 →
          </button>
        )}
      </div>
    </div>
  );
}
