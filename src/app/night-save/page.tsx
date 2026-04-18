"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { listDailyLogs, type DailyLog } from "@/lib/daily-log";
import {
  buildDailySeal,
  daysSinceLastSeal,
  recommendationFromWeek,
  romanDayNumber,
  saveDailySeal
} from "@/lib/night-seal";
import { loadUserProfile } from "@/lib/user-profile";

type Step = "review" | "dialogue" | "write" | "seal" | "forecast" | "final";
type CardStyle = "battle" | "cozy" | "minimal";

function raceCompanion(race: string) {
  if (race === "earlybird") return "🐦";
  if (race === "nightowl") return "🦉";
  if (race === "lonewolf") return "🐺";
  return "🧙";
}

function pickDialogue(log: DailyLog | null, streak: number, missingDays: number): string {
  if (missingDays >= 3) {
    return "最近晚上都没见到你，是太忙了吗？我留了你最喜欢的位置...";
  }
  if (!log || log.summary.totalTasks === 0) {
    return "休息也是冒险的一部分，养精蓄锐是为了更好的出征。";
  }
  if (log.summary.totalTasks >= 3) {
    const hard = [...log.adventures].sort((a, b) => b.rewards.xp - a.rewards.xp)[0]?.monsterName ?? "强敌";
    return `今日真是丰收之日！我见证了你的${hard}之战，简直精彩绝伦。连续${streak}天了，你已是名副其实的冒险者。`;
  }
  const title = log.adventures[0]?.taskName ?? "那场战斗";
  return `哪怕只有一场战斗，只要是全力以赴，就值得铭记。今天的${title}完成得很漂亮，我为你骄傲。`;
}

function playSealSound() {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const ding = ctx.createOscillator();
  const gain = ctx.createGain();
  ding.type = "sine";
  ding.frequency.value = 1400;
  ding.connect(gain);
  gain.connect(ctx.destination);
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  ding.start(now);
  ding.stop(now + 0.38);
}

function playPageRustle() {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.16, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buffer;
  src.connect(gain);
  gain.connect(ctx.destination);
  gain.gain.value = 0.08;
  src.start();
}

function generateImageCard(params: {
  style: CardStyle;
  quote: string;
  day: number;
  level: number;
  date: string;
  xp: number;
  crystals: number;
  monster: string;
  selectedImage?: string;
}): string {
  const c = document.createElement("canvas");
  c.width = 750;
  c.height = 1334;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const g = ctx.createLinearGradient(0, 0, 750, 1334);
  if (params.style === "battle") {
    g.addColorStop(0, "#0f172a");
    g.addColorStop(1, "#1e293b");
  } else if (params.style === "cozy") {
    g.addColorStop(0, "#1f2937");
    g.addColorStop(1, "#78350f");
  } else {
    g.addColorStop(0, "#0f172a");
    g.addColorStop(1, "#334155");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 88px serif";
  ctx.fillText(`Lv.${params.level}`, 250, 260);
  ctx.fillStyle = "#94a3b8";
  ctx.font = "28px sans-serif";
  ctx.fillText(`Life RPG · 第${params.day}日 · ${params.date}`, 120, 320);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(80, 390, 590, 290);
  ctx.fillStyle = "#e2e8f0";
  ctx.font = "30px sans-serif";
  ctx.fillText(`击败怪物：${params.monster}`, 110, 460);
  ctx.fillText(`获得经验：+${params.xp} XP`, 110, 530);
  ctx.fillText(`积累财富：${params.crystals} 晶石`, 110, 600);
  ctx.fillStyle = "#fde68a";
  ctx.font = "italic 42px serif";
  ctx.fillText(`"${params.quote.slice(0, 22)}${params.quote.length > 22 ? "..." : ""}"`, 90, 820);
  if (params.selectedImage) {
    const img = new Image();
    img.src = params.selectedImage;
  }
  return c.toDataURL("image/png");
}

export default function NightSavePage() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [today, setToday] = useState<DailyLog | null>(null);
  const [step, setStep] = useState<Step>("review");
  const [typed, setTyped] = useState("");
  const [quote, setQuote] = useState("");
  const [dialogue, setDialogue] = useState("");
  const [canLeave, setCanLeave] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dayNum, setDayNum] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [shareStyle, setShareStyle] = useState<CardStyle>("battle");
  const [shareUrl, setShareUrl] = useState("");
  const [customQuote, setCustomQuote] = useState("");
  const typeTimer = useRef<number | null>(null);
  const [companion, setCompanion] = useState("🧙");

  useEffect(() => {
    const profile = loadUserProfile();
    const race = profile?.race ?? "ambient";
    setCompanion(raceCompanion(race));
  }, []);

  useEffect(() => {
    void listDailyLogs().then((x) => {
      setLogs(x);
      const d = new Date().toISOString().slice(0, 10);
      const t = x.find((l) => l.date === d) ?? null;
      setToday(t);
      const streak = Number(localStorage.getItem("currentStreak") ?? "0");
      const nextDay = streak > 0 ? streak + 1 : x.length + 1;
      setDayNum(nextDay);
      const line = pickDialogue(t, nextDay, daysSinceLastSeal(d));
      setDialogue(line);
      setCustomQuote("");
    });
  }, []);

  useEffect(() => {
    history.pushState(null, "", location.href);
    const onPop = () => {
      if (!canLeave) {
        history.pushState(null, "", location.href);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [canLeave]);

  useEffect(() => {
    if (step !== "dialogue") return;
    setTyped("");
    let idx = 0;
    typeTimer.current = window.setInterval(() => {
      idx += 1;
      setTyped(dialogue.slice(0, idx));
      if (idx >= dialogue.length && typeTimer.current) {
        window.clearInterval(typeTimer.current);
        typeTimer.current = null;
      }
    }, 36);
    const go = window.setTimeout(() => setStep("write"), 2200);
    return () => {
      if (typeTimer.current) window.clearInterval(typeTimer.current);
      window.clearTimeout(go);
    };
  }, [step, dialogue]);

  const topCards = useMemo(() => {
    if (!today) return [];
    return [...today.adventures].sort((a, b) => b.rewards.xp - a.rewards.xp).slice(0, 3);
  }, [today]);

  const powerGain = useMemo(() => {
    if (!today) return 0;
    const s = today.snapshot.stats;
    return Math.round(s.str + s.int + s.agi + s.cha + s.con);
  }, [today]);

  const doSeal = async () => {
    if (!today || quote.trim().length < 1) return;
    playSealSound();
    playPageRustle();
    setStep("seal");
    const seal = buildDailySeal(today, quote.trim());
    await saveDailySeal(seal);
    setSaved(true);
    setTimeout(() => setStep("forecast"), 3000);
  };

  const makeLockscreen = () => {
    const c = document.createElement("canvas");
    c.width = 750;
    c.height = 1334;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 750, 1334);
    g.addColorStop(0, "#0f172a");
    g.addColorStop(1, "#1e293b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#f59e0b";
    ctx.font = "bold 56px serif";
    ctx.fillText("明日首役", 240, 260);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "40px sans-serif";
    const rec = recommendationFromWeek(logs);
    ctx.fillText(rec.slice(0, 18), 90, 500);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "26px sans-serif";
    ctx.fillText(`Life RPG - 第${romanDayNumber(dayNum + 1)}日`, 190, 1140);
    const url = c.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `LifeRPG-Lock-${dayNum + 1}.png`;
    a.click();
  };

  const generateShareCard = () => {
    const t = today;
    if (!t) return;
    const best = topCards[0];
    const url = generateImageCard({
      style: shareStyle,
      quote: customQuote.trim() || quote.trim() || "明日会更好",
      day: dayNum,
      level: t.snapshot.level,
      date: t.date,
      xp: t.summary.totalXP,
      crystals: t.summary.totalCrystals,
      monster: best?.monsterName ?? "营地休整"
    });
    setShareUrl(url);
  };

  const canSeal = quote.trim().length >= 1 && quote.trim().length <= 50;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0f172a] to-[#1e293b] text-slate-100">
      <div className="absolute bottom-16 left-1/2 z-10 -translate-x-1/2">
        <div className="h-20 w-20 animate-pulse rounded-full bg-amber-500/80 shadow-[0_0_60px_20px_rgba(245,158,11,0.35)]" />
      </div>
      <div className="absolute bottom-24 left-16 z-10 text-8xl">{companion}</div>
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2.4, repeat: Infinity }}
        className="absolute bottom-24 right-16 z-10 rounded-xl border border-amber-400/40 bg-slate-900/40 px-8 py-10 shadow-[0_0_40px_rgba(251,191,36,0.25)]"
      >
        <p className="text-xl text-amber-200">人生之书</p>
      </motion.div>

      <div className="relative z-20 mx-auto max-w-6xl px-4 py-8">
        <div className="mb-3 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">篝火封存</h1>
          <button
            type="button"
            onClick={() => {
              setCanLeave(true);
              location.href = "/";
            }}
            className="rounded border border-slate-600 px-3 py-1 text-xs text-slate-300"
          >
            我还想再做一个任务
          </button>
        </div>

        {step === "review" && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-700 bg-slate-900/55 p-4">
              <p>今日出征：{today?.summary.totalTasks ?? 0} 场</p>
              <p>斩获：{today?.summary.totalXP ?? 0} 经验 | {today?.summary.totalCrystals ?? 0} 晶石</p>
              <p>战力变化：+{powerGain} 点</p>
            </div>
            <div className="relative min-h-28">
              <AnimatePresence>
                {topCards.map((c, idx) => (
                  <motion.div
                    key={c.taskId}
                    initial={{ x: -380 + idx * 120, y: 60, opacity: 0 }}
                    animate={{ x: 420, y: -40 + idx * 6, opacity: 1 }}
                    transition={{ duration: 1.2 + idx * 0.2 }}
                    className="absolute rounded-lg border border-amber-600/40 bg-slate-900/80 px-3 py-2 text-xs"
                  >
                    {c.taskName} · +{c.rewards.xp}XP
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <button type="button" onClick={() => setStep("dialogue")} className="rounded bg-amber-500 px-4 py-2 text-slate-900">
              点燃篝火
            </button>
          </div>
        )}

        {step === "dialogue" && (
          <div className="max-w-xl rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <p className="text-lg">{typed}</p>
          </div>
        )}

        {step === "write" && (
          <div className="max-w-xl rounded-xl border border-amber-700/50 bg-slate-900/75 p-4">
            <p className="mb-2 text-amber-200">来，在书中留下今日的一笔吧。哪怕只有一句话。</p>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value.slice(0, 50))}
              placeholder="今日感悟...（必填）"
              className="h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-lg [font-family:'Ma_Shan_Zheng',cursive]"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {["今日无愧于心", "突破了一个难关", "平静而充实", "明天会更好"].map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => setQuote(x)}
                  className="rounded-full border border-slate-600 px-2 py-1 text-xs"
                >
                  {x}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void doSeal()}
              disabled={!canSeal}
              className={`mt-4 rounded px-4 py-2 ${canSeal ? "bg-amber-400 text-slate-900" : "bg-slate-700 text-slate-500"}`}
            >
              封入书中
            </button>
          </div>
        )}

        {step === "seal" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-amber-600/50 bg-slate-900/70 p-5 text-center">
            <p className="text-2xl text-amber-200">第 {romanDayNumber(dayNum)} 日 已封存</p>
            <p className="mt-2 text-sm text-slate-300">明日此时，我仍在这里等你。愿星光指引你的梦境。</p>
            <p className="mt-3 text-xs text-slate-500">勿扰模式已开启（23:00-07:00无通知）</p>
          </motion.div>
        )}

        {step === "forecast" && (
          <div className="max-w-xl space-y-3 rounded-xl border border-cyan-700/50 bg-slate-900/70 p-4">
            <p className="text-cyan-200">明日此时，建议出征：</p>
            <p>{recommendationFromWeek(logs)}</p>
            <div className="flex gap-2">
              <button type="button" onClick={makeLockscreen} className="rounded bg-cyan-600 px-3 py-2 text-sm">
                保存锁屏图 PNG
              </button>
              <button type="button" onClick={() => setPreviewOpen(true)} className="rounded border border-slate-600 px-3 py-2 text-sm">
                生成分享卡片
              </button>
              <button
                type="button"
                onClick={() => {
                  setCanLeave(true);
                  setStep("final");
                }}
                className="rounded border border-slate-600 px-3 py-2 text-sm"
              >
                今夜 quietly
              </button>
            </div>
          </div>
        )}

        {step === "final" && (
          <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
            <p>篝火已熄，夜色安宁。你可以返回主页。</p>
            <Link href="/" className="mt-2 inline-block rounded bg-amber-500 px-3 py-1.5 text-slate-900">
              返回主页
            </Link>
          </div>
        )}
      </div>

      <AnimatePresence>
        {previewOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-950 p-4">
              <h3 className="text-lg font-semibold">今日冒险者证书</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <select
                    value={shareStyle}
                    onChange={(e) => setShareStyle(e.target.value as CardStyle)}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                  >
                    <option value="battle">⚔️ 荣耀战报</option>
                    <option value="cozy">🔥 篝火日记</option>
                    <option value="minimal">📊 极简数据</option>
                  </select>
                  <input
                    value={customQuote}
                    onChange={(e) => setCustomQuote(e.target.value)}
                    placeholder="今日金句（可编辑）"
                    className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
                  />
                  <button type="button" onClick={generateShareCard} className="rounded bg-cyan-600 px-3 py-2 text-sm">
                    生成卡片
                  </button>
                  {shareUrl && (
                    <a href={shareUrl} download={`LifeRPG-Day${dayNum}.png`} className="inline-block rounded border border-amber-500 px-3 py-2 text-sm text-amber-200">
                      下载 PNG
                    </a>
                  )}
                </div>
                <div className="rounded border border-slate-800 p-2">
                  {shareUrl ? (
                    <img src={shareUrl} alt="share-preview" className="mx-auto max-h-[420px] rounded" />
                  ) : (
                    <p className="text-sm text-slate-500">点击生成卡片查看预览</p>
                  )}
                </div>
              </div>
              <button type="button" onClick={() => setPreviewOpen(false)} className="mt-3 rounded border border-slate-700 px-3 py-1 text-sm">
                关闭
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!saved && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-slate-500">
          进入此页面后需完成封存，或点击「我还想再做一个任务」返回主页
        </div>
      )}
    </div>
  );
}
