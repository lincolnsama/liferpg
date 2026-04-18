"use client";

import { motion } from "framer-motion";
import { useRef, useState } from "react";
import type { TextRpgBattleRun } from "@/lib/adventure-system";
import type { TaskCompletionCheckIn } from "@/lib/task-checkin";

type Props = {
  open: boolean;
  settlement: TextRpgBattleRun["settlement"] | null;
  turnsMeta: number;
  baseXp: number;
  onSubmitCheckIn: (payload?: Omit<TaskCompletionCheckIn, "checkInType">) => void;
  onClose: () => void;
};

const QUICK_TAGS = ["#晨间打卡", "#突破自我", "#完成任务", "#心得分享"] as const;

async function compressImageToDataUrl(file: File): Promise<string> {
  const rawUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片加载失败"));
      img.src = rawUrl;
    });
    const scale = image.width > 800 ? 800 / image.width : 1;
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 初始化失败");
    ctx.drawImage(image, 0, 0, width, height);
    let q = 0.7;
    let data = canvas.toDataURL("image/jpeg", q);
    while (data.length / 1024 > 200 && q > 0.35) {
      q -= 0.1;
      data = canvas.toDataURL("image/jpeg", q);
    }
    return data;
  } finally {
    URL.revokeObjectURL(rawUrl);
  }
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("音频编码失败"));
    reader.readAsDataURL(blob);
  });
}

export default function AdventureSettlementModal({
  open,
  settlement,
  turnsMeta,
  baseXp,
  onSubmitCheckIn,
  onClose
}: Props) {
  const [tab, setTab] = useState<"text" | "image" | "voice">("text");
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [voice, setVoice] = useState<string>("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const hasText = text.trim().length > 0;
  const hasImage = images.length > 0;
  const hasVoice = !!voice;
  const checkInCount = Number(hasText) + Number(hasImage) + Number(hasVoice);
  const xpMult = checkInCount === 0 ? 1 : checkInCount >= 3 ? 1.5 : 1.2;
  const bonusXp = Math.max(0, Math.round(baseXp * (xpMult - 1)));
  const mm = Math.floor(recordSec / 60);
  const ss = String(recordSec % 60).padStart(2, "0");
  const timerLabel = `${mm}:${ss}`;

  if (!open) return null;

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
  };

  const startRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      recorder.ondataavailable = (evt) => {
        if (evt.data.size > 0) chunksRef.current.push(evt.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        if (voice) URL.revokeObjectURL(voice);
        const url = URL.createObjectURL(blob);
        setVoice(url);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSec(0);
      timerRef.current = window.setInterval(() => {
        setRecordSec((s) => {
          if (s >= 30) {
            stopRecording();
            return 30;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      // ignore permissions issue
    }
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const handleSelectImages = async (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 3);
    const out: string[] = [];
    for (const file of arr) {
      out.push(await compressImageToDataUrl(file));
    }
    setImages(out);
  };

  const applyQuickTag = (tag: string) =>
    setText((prev) => `${prev}${prev.trim().length > 0 ? " " : ""}${tag}`.slice(0, 200));

  const submitAndClose = async () => {
    if (checkInCount <= 0) {
      onSubmitCheckIn(undefined);
      return;
    }
    let persistedVoice: string | undefined;
    if (audioBlob) {
      try {
        persistedVoice = await blobToDataUrl(audioBlob);
      } catch {
        persistedVoice = undefined;
      }
    }
    onSubmitCheckIn({
      text: text.trim() || undefined,
      images: images.length ? images : undefined,
      voice: persistedVoice
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.94, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-emerald-800/50 bg-slate-950 p-6 shadow-2xl"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">冒险结算</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">任务战报已归档</h2>

        {settlement ? (
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
              <dt className="text-slate-500">战斗回合</dt>
              <dd className="text-right font-medium text-slate-200">{turnsMeta} 回合</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
              <dt className="text-slate-500">累计受到伤害</dt>
              <dd className="text-right font-medium text-rose-200">{settlement.damageTaken} HP</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-800 pb-2">
              <dt className="text-slate-500">战利品</dt>
              <dd className="max-w-[60%] text-right text-amber-100">{settlement.loot}</dd>
            </div>
            <div>
              <dt className="text-slate-500">属性成长</dt>
              <dd className="mt-1 text-emerald-200">{settlement.statGrowth}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-4 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
            本次为记账/快速结算，未生成战斗回放。
          </p>
        )}

        <div className="mt-6 rounded-xl border border-cyan-800/40 bg-slate-900/70 p-4">
          <p className="text-sm font-semibold text-cyan-100">记录这次成就（可选）</p>
          <p className="mt-1 text-xs text-cyan-200/80">记录下此刻，额外获得20%经验加成！三种方式都完成可达 50% 上限。</p>
          <div className="mt-3 flex gap-2">
            {[
              { k: "text", label: "📝 文字" },
              { k: "image", label: "📸 照片" },
              { k: "voice", label: "🎙️ 语音" }
            ].map((item) => (
              <button
                key={item.k}
                type="button"
                onClick={() => setTab(item.k as "text" | "image" | "voice")}
                className={`rounded-full border px-3 py-1 text-xs ${
                  tab === item.k
                    ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                    : "border-slate-700 text-slate-300"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === "text" && (
            <div className="mt-3">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 200))}
                placeholder="这次突破的秘诀是... / 此刻的心情..."
                className="h-28 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
              <div className="mt-1 text-right text-xs text-slate-400">{text.length}/200字</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => applyQuickTag(tag)}
                    className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-300"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "image" && (
            <div className="mt-3">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleSelectImages(e.target.files)}
              />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-slate-600 px-3 py-4 text-sm text-slate-300"
              >
                点击选择图片（1-3 张）
              </button>
              <p className="mt-1 text-xs text-slate-500">图片仅存储在本地，不会自动上传</p>
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {images.map((src, idx) => (
                    <div key={src} className="relative overflow-hidden rounded-md border border-slate-700">
                      <img src={src} alt={`checkin-${idx}`} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute right-1 top-1 rounded bg-black/60 px-1 text-xs text-white"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "voice" && (
            <div className="mt-3">
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  className={`h-20 w-20 rounded-full text-white ${recording ? "animate-pulse bg-red-500" : "bg-cyan-600"}`}
                >
                  {recording ? "停止" : "录音"}
                </button>
              </div>
              <p className="mt-2 text-center text-sm text-slate-300">{timerLabel} / 0:30</p>
              {voice && (
                <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900 p-3">
                  <div className="mb-2 flex h-8 items-end gap-1">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-1 animate-pulse rounded bg-cyan-300/90"
                        style={{ height: `${20 + ((i * 7) % 40)}%`, animationDelay: `${i * 30}ms` }}
                      />
                    ))}
                  </div>
                  <audio ref={audioRef} src={voice} controls className="w-full" />
                  <button
                    type="button"
                    onClick={() => {
                      if (voice) URL.revokeObjectURL(voice);
                      setVoice("");
                      setAudioBlob(null);
                      setRecordSec(0);
                    }}
                    className="mt-2 w-full rounded-lg border border-slate-600 py-1.5 text-xs text-slate-200"
                  >
                    重新录制
                  </button>
                  {audioBlob && <p className="mt-1 text-[11px] text-slate-500">格式：webm（MediaRecorder）</p>}
                </div>
              )}
            </div>
          )}
          <p className="mt-4 text-xs text-emerald-300">
            当前加成：x{xpMult.toFixed(2)}，预计额外 +{bonusXp} XP
          </p>
        </div>

        <p className="mt-4 text-xs text-slate-500">以上内容已写入冒险日志（adventureLog），可在「战报」页回顾。</p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onSubmitCheckIn(undefined);
              onClose();
            }}
            className="rounded-lg border border-slate-700 py-2.5 text-sm text-slate-200"
          >
            跳过打卡
          </button>
          <button
            type="button"
            onClick={() => {
              void submitAndClose();
              onClose();
            }}
            className="rounded-lg bg-cyan-600 py-2.5 text-sm font-medium text-white hover:bg-cyan-500"
          >
            保存并领取加成
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
