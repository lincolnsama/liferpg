"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import {
  CLASS_ICON,
  CLASS_LABEL,
  CLASS_TO_PROFESSION,
  ClassKey,
  constellationFromMonthDay,
  RACE_META,
  Race,
  saveUserProfile,
  UserProfile
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

const classOrder: ClassKey[] = ["warrior", "mage", "explorer", "artisan", "guardian"];

const baseWeights = {
  warrior: 0,
  mage: 0,
  explorer: 0,
  artisan: 0,
  guardian: 0
};

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [realJob, setRealJob] = useState<(typeof JOB_OPTIONS)[number]>("学生");
  const [mbti, setMbti] = useState<(typeof MBTI_OPTIONS)[number]>("我不知道");
  const [month, setMonth] = useState(1);
  const [day, setDay] = useState(1);
  const [rhythm1, setRhythm1] = useState<Rhythm1>("morning");
  const [rhythm2, setRhythm2] = useState<Rhythm2>("music");
  const [goal, setGoal] = useState<Goal>("skills");
  const [manualMode, setManualMode] = useState(false);
  const [manualPrimary, setManualPrimary] = useState<ClassKey>("mage");
  const [manualSecondary, setManualSecondary] = useState<ClassKey>("explorer");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
  }, [goal, mbti, realJob]);

  const finalPrimary = manualMode ? manualPrimary : result.primary;
  const finalSecondary = manualMode ? manualSecondary : result.secondary;

  const handleFinish = async () => {
    if (!nickname.trim()) return;
    setSaveError(null);
    setIsSaving(true);
    const constellation = constellationFromMonthDay(month, day);

    const payload: UserProfile = {
      nickname: nickname.trim(),
      realJob,
      mbti,
      constellation,
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
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 md:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex justify-center gap-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full ${step >= i ? "bg-cyan-400" : "bg-slate-700"}`}
            />
          ))}
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 md:p-7">
          {step === 1 && (
            <div className="space-y-4">
              <h1 className="text-2xl font-semibold">你是谁</h1>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="你的冒险者称号"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white placeholder:text-slate-400"
              />
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
              <div className="grid gap-3 md:grid-cols-2">
                <select
                  value={mbti}
                  onChange={(e) => setMbti(e.target.value as (typeof MBTI_OPTIONS)[number])}
                  className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"
                >
                  {MBTI_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={month}
                    onChange={(e) => setMonth(Number(e.target.value))}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"
                  >
                    {Array.from({ length: 12 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}月
                      </option>
                    ))}
                  </select>
                  <select
                    value={day}
                    onChange={(e) => setDay(Number(e.target.value))}
                    className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2"
                  >
                    {Array.from({ length: 31 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}日
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h1 className="text-2xl font-semibold">你的节律</h1>
              <div>
                <p className="mb-2 text-sm text-slate-300">你通常在什么时段最有创造力？</p>
                <div className="space-y-2 text-sm">
                  {[
                    ["early", "清晨5-8点（晨型人特征）"],
                    ["morning", "上午9-12点（标准型）"],
                    ["afternoon", "下午14-18点（午后型）"],
                    ["night", "深夜19-24点（夜行者特征）"]
                  ].map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2">
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
                    <label key={value} className="flex items-center gap-2">
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
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h1 className="text-2xl font-semibold">你的目标</h1>
              <div className="space-y-2 text-sm">
                {[
                  ["health", "养成健康习惯"],
                  ["skills", "提升专业技能/学术"],
                  ["network", "拓展人脉资源"],
                  ["project", "完成特定项目/创业"],
                  ["explore", "探索职业/人生可能"]
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={goal === value}
                      onChange={() => setGoal(value as Goal)}
                    />
                    {label}
                  </label>
                ))}
              </div>

              <AnimatePresence>
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-cyan-700/40 bg-slate-950/60 p-4"
                >
                  <h2 className="text-lg font-semibold">你的角色画像</h2>
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
                    {
                      {
                        health: "养成健康习惯",
                        skills: "提升专业技能/学术",
                        network: "拓展人脉资源",
                        project: "完成特定项目/创业",
                        explore: "探索职业/人生可能"
                      }[goal]
                    }
                    ”，推荐 {CLASS_LABEL[result.primary]} 作为主职业。
                  </p>

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

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(3, s + 1))}
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
