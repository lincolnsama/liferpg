"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  CLASS_ICON,
  CLASS_LABEL,
  type ClassKey,
  constellationFromMonthDay,
  RACE_META,
  type Race,
  saveUserProfile,
  type UserProfile
} from "@/lib/user-profile";

const JOB_OPTIONS = [
  "学生",
  "职场新人",
  "中层管理",
  "自由职业",
  "博士在读",
  "创业者",
  "其他"
] as const;

const LIFE_STAGE_OPTIONS = [
  "学生阶段",
  "初入职场",
  "职业上升期",
  "转型探索期",
  "自由职业/创业",
  "恢复与重建期",
  "其他"
] as const;

const EDUCATION_OPTIONS = [
  "暂不填写",
  "高中/中专",
  "大专",
  "本科",
  "硕士",
  "博士",
  "其他"
] as const;

const MBTI_OPTIONS = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
  "我不知道"
] as const;

type Goal =
  | "health"
  | "skills"
  | "network"
  | "project"
  | "explore";

type Rhythm1 = "early" | "morning" | "afternoon" | "night";
type Rhythm2 = "solo" | "music" | "cafe" | "team" | "multitask";

type FirstMainQuest =
  | "health-reset"
  | "career-growth"
  | "study-breakthrough"
  | "relationship-repair"
  | "life-rebuild"
  | "creative-project";

const classOrder: ClassKey[] = ["warrior", "mage", "explorer", "artisan", "guardian"];

const baseWeights = {
  warrior: 0,
  mage: 0,
  explorer: 0,
  artisan: 0,
  guardian: 0
};

const GOAL_LABEL: Record<Goal, string> = {
  health: "养成健康习惯",
  skills: "提升专业技能/学术",
  network: "拓展人脉资源",
  project: "完成特定项目/创业",
  explore: "探索职业/人生可能"
};

const FIRST_MAIN_QUEST_OPTIONS: Array<{ value: FirstMainQuest; label: string; desc: string }> = [
  {
    value: "health-reset",
    label: "健康恢复",
    desc: "先把身体、睡眠、运动和饮食拉回可持续状态。"
  },
  {
    value: "career-growth",
    label: "职业成长",
    desc: "积累作品、能力和机会，让现实职业线继续升级。"
  },
  {
    value: "study-breakthrough",
    label: "学习突破",
    desc: "攻克一门技能、考试、论文或长期学习项目。"
  },
  {
    value: "relationship-repair",
    label: "关系修复",
    desc: "重新经营重要关系、沟通边界和支持网络。"
  },
  {
    value: "life-rebuild",
    label: "生活重建",
    desc: "整理环境、财务、作息和基本生活秩序。"
  },
  {
    value: "creative-project",
    label: "创造项目",
    desc: "把一个作品、产品、内容或想法真正做出来。"
  }
];

const stepTitles = ["序章", "出身", "主线", "角色卡"];

function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate();
}

function toOptionalNumber(value: string): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [lifeStage, setLifeStage] = useState<(typeof LIFE_STAGE_OPTIONS)[number]>("学生阶段");
  const [realJob, setRealJob] = useState<(typeof JOB_OPTIONS)[number]>("学生");
  const [education, setEducation] = useState<(typeof EDUCATION_OPTIONS)[number]>("暂不填写");
  const [mbti, setMbti] = useState<(typeof MBTI_OPTIONS)[number]>("我不知道");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [rhythm1, setRhythm1] = useState<Rhythm1>("morning");
  const [rhythm2, setRhythm2] = useState<Rhythm2>("music");
  const [goal, setGoal] = useState<Goal>("skills");
  const [currentChallenge, setCurrentChallenge] = useState("");
  const [desiredSelf, setDesiredSelf] = useState("");
  const [firstMainQuest, setFirstMainQuest] = useState<FirstMainQuest>("study-breakthrough");
  const [manualMode, setManualMode] = useState(false);
  const [manualPrimary, setManualPrimary] = useState<ClassKey>("mage");
  const [manualSecondary, setManualSecondary] = useState<ClassKey>("explorer");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const days = useMemo(() => daysInMonth(month), [month]);

  const race: Race = useMemo(() => {
    if (rhythm1 === "early") return "earlybird";
    if (rhythm1 === "night") return "nightowl";
    if (rhythm2 === "solo") return "lonewolf";
    if (rhythm2 === "team") return "socialite";
    if (rhythm2 === "multitask") return "multitasker";
    return "ambient";
  }, [rhythm1, rhythm2]);

  const result = useMemo(() => {
    const weights = { ...baseWeights };

    if (mbti !== "我不知道") {
      if (mbti.includes("E")) weights.warrior += 10;
      if (mbti.includes("T")) weights.mage += 10;
      if (mbti.includes("P")) weights.explorer += 10;
      if (mbti.includes("F")) weights.artisan += 10;
    }

    if (realJob === "中层管理") weights.warrior += 10;
    if (realJob === "博士在读" || realJob === "学生") weights.mage += 15;
    if (realJob === "自由职业") {
      weights.explorer += 10;
      weights.artisan += 10;
    }
    if (realJob === "学生" || realJob === "职场新人") weights.guardian += 5;

    if (education === "硕士" || education === "博士") weights.mage += 10;
    if (lifeStage === "恢复与重建期") weights.guardian += 15;
    if (lifeStage === "转型探索期") weights.explorer += 15;
    if (lifeStage === "自由职业/创业") weights.artisan += 10;

    if (goal === "health") weights.guardian += 30;
    if (goal === "skills") weights.mage += 30;
    if (goal === "network") {
      weights.warrior += 15;
      weights.explorer += 15;
    }
    if (goal === "project") weights.artisan += 30;
    if (goal === "explore") weights.explorer += 40;

    const ranked = classOrder
      .map((k) => ({ key: k, score: weights[k] }))
      .sort((a, b) => b.score - a.score);

    const top1 = ranked[0];
    const top2 = ranked[1];
    const confidence = Math.min(98, 55 + (top1.score - top2.score) * 4 + top1.score);

    return {
      weights,
      primary: top1.key,
      secondary: top2.key,
      confidence,
      dualBalance: top1.score - top2.score < 5
    };
  }, [education, goal, lifeStage, mbti, realJob]);

  const finalPrimary = manualMode ? manualPrimary : result.primary;
  const finalSecondary = manualMode ? manualSecondary : result.secondary;
  const safeDay = Math.min(day, days);
  const constellation = constellationFromMonthDay(month, safeDay);
  const selectedFirstMainQuest = FIRST_MAIN_QUEST_OPTIONS.find((q) => q.value === firstMainQuest)!;

  const handleFinish = async () => {
    if (!nickname.trim()) return;
    setSaveError(null);
    setIsSaving(true);
    const height = toOptionalNumber(heightCm);
    const weight = toOptionalNumber(weightKg);

    const payload: UserProfile = {
      nickname: nickname.trim(),
      realJob,
      mbti,
      birthMonth: month,
      birthDay: safeDay,
      constellation,
      lifeStage,
      education: education === "暂不填写" ? undefined : education,
      heightCm: height,
      weightKg: weight,
      currentChallenge: currentChallenge.trim() || undefined,
      desiredSelf: desiredSelf.trim() || undefined,
      firstMainQuest,
      race,
      primaryClass: finalPrimary,
      secondaryClass: finalSecondary,
      matchScore: result.confidence,
      createdAt: Date.now()
    };

    saveUserProfile(payload);

    try {
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("profiles")
          .update({
            nickname: payload.nickname,
            real_job: payload.realJob,
            mbti: payload.mbti,
            constellation: payload.constellation,
            race: payload.race,
            primary_class: payload.primaryClass,
            secondary_class: payload.secondaryClass,
            match_score: payload.matchScore
          })
          .eq("id", user.id);

        await supabase
          .from("profiles")
          .update({
            birth_month: payload.birthMonth,
            birth_day: payload.birthDay,
            life_stage: payload.lifeStage,
            education: payload.education ?? null,
            height_cm: payload.heightCm ?? null,
            weight_kg: payload.weightKg ?? null,
            current_challenge: payload.currentChallenge ?? null,
            desired_self: payload.desiredSelf ?? null,
            first_main_quest: payload.firstMainQuest
          })
          .eq("id", user.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "画像同步失败，请稍后重试";
      setSaveError(msg);
      setIsSaving(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#1e293b_0,#020617_45%,#020617_100%)] px-4 py-8 text-slate-100 md:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-8 rounded-3xl border border-amber-500/20 bg-slate-950/70 p-5 shadow-2xl shadow-cyan-950/30">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300/80">Life RPG Character Creation</p>
          <h1 className="mt-3 text-3xl font-serif text-amber-100 md:text-5xl">新的存档正在写入</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            你醒来在现实世界的某个节点。过去无法读档，但从今天开始，记录员会帮你把行动、恢复和成长写成一段可继续的冒险。
          </p>
        </div>

        <div className="mb-6 grid grid-cols-4 gap-2">
          {stepTitles.map((title, idx) => {
            const n = idx + 1;
            return (
              <button
                key={title}
                type="button"
                onClick={() => setStep(n)}
                className={`rounded-xl border px-3 py-3 text-left text-xs transition ${
                  step >= n
                    ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-100"
                    : "border-slate-800 bg-slate-900/60 text-slate-500"
                }`}
              >
                <span className="block text-[10px] uppercase tracking-[0.2em]">Step {n}</span>
                <span className="mt-1 block text-sm font-semibold">{title}</span>
              </button>
            );
          })}
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl md:p-7">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-amber-300">序章：现实锚点</p>
                <h2 className="mt-1 text-2xl font-semibold">记录员需要知道你从哪里开始。</h2>
                <p className="mt-2 text-sm text-slate-400">
                  这些信息用于生日仪式、阶段回顾和任务建议。MBTI、星座和身体数据不会被当作评价或强标签。
                </p>
              </div>

              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="你的冒险者称号"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-400"
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm text-slate-300">人生阶段</p>
                  <div className="flex flex-wrap gap-2">
                    {LIFE_STAGE_OPTIONS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setLifeStage(item)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          lifeStage === item
                            ? "border-amber-400 bg-amber-400/10 text-amber-200"
                            : "border-slate-700 text-slate-300"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm text-slate-300">现实职业</p>
                  <div className="flex flex-wrap gap-2">
                    {JOB_OPTIONS.map((j) => (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setRealJob(j)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          realJob === j
                            ? "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                            : "border-slate-700 text-slate-300"
                        }`}
                      >
                        {j}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">学历（可选）</span>
                  <select
                    value={education}
                    onChange={(e) => setEducation(e.target.value as (typeof EDUCATION_OPTIONS)[number])}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"
                  >
                    {EDUCATION_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">MBTI（可选）</span>
                  <select
                    value={mbti}
                    onChange={(e) => setMbti(e.target.value as (typeof MBTI_OPTIONS)[number])}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"
                  >
                    {MBTI_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">出生月份</span>
                  <select
                    value={month}
                    onChange={(e) => {
                      const nextMonth = Number(e.target.value);
                      setMonth(nextMonth);
                      setDay((d) => Math.min(d, daysInMonth(nextMonth)));
                    }}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}月
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">出生日期</span>
                  <select
                    value={safeDay}
                    onChange={(e) => setDay(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"
                  >
                    {Array.from({ length: days }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}日
                      </option>
                    ))}
                  </select>
                </label>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">
                  星座已推导为 <span className="font-semibold">{constellation}</span>
                  <p className="mt-1 text-xs text-amber-100/70">仅用于叙事和生日仪式，不决定你的命运。</p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-amber-300">第二幕：出身与节律</p>
                <h2 className="mt-1 text-2xl font-semibold">你的行动方式会生成初始背景。</h2>
                <p className="mt-2 text-sm text-slate-400">
                  身高体重是可选健康档案，只用于健康主线和长期变化回顾，可以直接跳过。
                </p>
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-300">你通常在什么时段最有创造力？</p>
                <div className="space-y-2 text-sm">
                  {[
                    ["early", "清晨5-8点（晨型人特征）"],
                    ["morning", "上午9-12点（标准型）"],
                    ["afternoon", "下午14-18点（午后型）"],
                    ["night", "深夜19-24点（夜行者特征）"]
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <input
                        type="radio"
                        checked={rhythm1 === value}
                        onChange={() => setRhythm1(value as Rhythm1)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm text-slate-300">完成重要任务时，你更擅长？</p>
                <div className="space-y-2 text-sm">
                  {[
                    ["solo", "独自安静专注（独行侠特征）"],
                    ["music", "有背景音乐/白噪音（环境型）"],
                    ["cafe", "在咖啡厅/公共空间（氛围型）"],
                    ["team", "团队协作讨论（社交蝴蝶特征）"],
                    ["multitask", "同时推进多件事（多线程处理器特征）"]
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                      <input
                        type="radio"
                        checked={rhythm2 === value}
                        onChange={() => setRhythm2(value as Rhythm2)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">身高 cm（可选）</span>
                  <input
                    inputMode="decimal"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="例如 175"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">体重 kg（可选）</span>
                  <input
                    inputMode="decimal"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="例如 68"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-cyan-700/40 bg-slate-950/60 p-4">
                <p className="text-sm text-cyan-200">
                  {RACE_META[race].icon} 记录员推测你的初始背景是{" "}
                  <span className="font-semibold">{RACE_META[race].name}</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">{RACE_META[race].desc}</p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-amber-300">第三幕：第一章主线</p>
                <h2 className="mt-1 text-2xl font-semibold">这一章，你最想改变什么？</h2>
                <p className="mt-2 text-sm text-slate-400">
                  这里会影响职业推荐、任务建议和第一阶段成长叙事。可以写得很具体，也可以只留下方向。
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {Object.entries(GOAL_LABEL).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setGoal(value as Goal)}
                    className={`rounded-xl border p-3 text-left text-sm ${
                      goal === value
                        ? "border-cyan-500 bg-cyan-500/10 text-cyan-100"
                        : "border-slate-800 bg-slate-950/40 text-slate-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">当前最大的困境（可选）</span>
                  <textarea
                    value={currentChallenge}
                    onChange={(e) => setCurrentChallenge(e.target.value)}
                    placeholder="例如：作息混乱、论文推进困难、职业方向不清晰..."
                    rows={4}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">想成为怎样的人（可选）</span>
                  <textarea
                    value={desiredSelf}
                    onChange={(e) => setDesiredSelf(e.target.value)}
                    placeholder="例如：稳定、健康、有作品、敢表达、能照顾自己..."
                    rows={4}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-500"
                  />
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm text-slate-300">选择你的第一章主线</p>
                <div className="grid gap-2 md:grid-cols-2">
                  {FIRST_MAIN_QUEST_OPTIONS.map((quest) => (
                    <button
                      key={quest.value}
                      type="button"
                      onClick={() => setFirstMainQuest(quest.value)}
                      className={`rounded-xl border p-3 text-left ${
                        firstMainQuest === quest.value
                          ? "border-amber-400 bg-amber-400/10 text-amber-100"
                          : "border-slate-800 bg-slate-950/40 text-slate-300"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{quest.label}</span>
                      <span className="mt-1 block text-xs text-slate-400">{quest.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-amber-300">终章：角色卡确认</p>
                <h2 className="mt-1 text-2xl font-semibold">记录员已经整理出你的冒险者档案。</h2>
                <p className="mt-2 text-sm text-slate-400">
                  你可以接受推荐，也可以手动调整主副职业。所有推荐都只是起点，不是命运。
                </p>
              </div>

              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-cyan-700/40 bg-slate-950/60 p-5"
                >
                  <h3 className="text-xl font-semibold text-amber-100">{nickname.trim() || "未命名冒险者"}</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    {lifeStage} · {realJob} · {education === "暂不填写" ? "学历未记录" : education} · {constellation}
                  </p>
                  <p className="mt-2 text-sm text-cyan-200">
                    {RACE_META[race].icon} {RACE_META[race].name}：{RACE_META[race].desc}
                  </p>
                  <p className="mt-2 text-sm">
                    主职业：{CLASS_ICON[finalPrimary]} {CLASS_LABEL[finalPrimary]} ｜ 副职业：
                    {CLASS_ICON[finalSecondary]} {CLASS_LABEL[finalSecondary]}
                  </p>
                  <p className="mt-1 text-sm text-amber-300">匹配度 {result.confidence}%</p>
                  <p className="mt-2 text-xs text-slate-300">
                    基于你是 {mbti}，当前目标为“
                    {GOAL_LABEL[goal]}
                    ”，推荐 {CLASS_LABEL[result.primary]} 作为主职业。
                  </p>
                  <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                    <p className="text-sm font-semibold text-amber-100">第一章主线：{selectedFirstMainQuest.label}</p>
                    <p className="mt-1 text-xs text-amber-100/80">{selectedFirstMainQuest.desc}</p>
                    {desiredSelf.trim() && (
                      <p className="mt-2 text-xs text-slate-300">想成为的人：{desiredSelf.trim()}</p>
                    )}
                  </div>

                  {result.dualBalance && (
                    <p className="mt-1 text-xs text-fuchsia-300">主副职业权重接近，属于双职业平衡型。</p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setManualMode(false)}
                      className="rounded-md border border-emerald-600/60 px-3 py-1 text-xs text-emerald-300"
                    >
                      接受推荐
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualMode((v) => !v)}
                      className="rounded-md border border-slate-600 px-3 py-1 text-xs text-slate-300"
                    >
                      手动调整
                    </button>
                  </div>

                  {manualMode && (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <select
                        value={manualPrimary}
                        onChange={(e) => setManualPrimary(e.target.value as ClassKey)}
                        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                      >
                        {classOrder.map((c) => (
                          <option key={c} value={c}>
                            主职业：{CLASS_LABEL[c]}
                          </option>
                        ))}
                      </select>
                      <select
                        value={manualSecondary}
                        onChange={(e) => setManualSecondary(e.target.value as ClassKey)}
                        className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm"
                      >
                        {classOrder.map((c) => (
                          <option key={c} value={c}>
                            副职业：{CLASS_LABEL[c]}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className={`rounded-lg border border-slate-700 px-3 py-2 text-sm ${step === 1 ? "invisible" : ""}`}
            >
              上一步
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                disabled={step === 1 && !nickname.trim()}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                下一步
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={!nickname.trim() || isSaving}
                className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {isSaving ? "保存中..." : "开始冒险"}
              </button>
            )}
          </div>
          {saveError && <p className="mt-3 text-sm text-red-400">{saveError}</p>}
        </section>
      </div>
    </main>
  );
}
