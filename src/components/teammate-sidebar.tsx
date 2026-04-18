"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Race } from "@/lib/user-profile";
import {
  appendUserQuickReply,
  getTeammateForRace,
  getTeammateLevel,
  loadTeammateMessages,
  maybePushSleepReminder,
  maybePushWorriedMessage,
  recordHomeVisit,
  seedWelcomeIfEmpty,
  TEAMMATE_UPDATED_EVENT,
  type ChatMessage,
  type TeammateMood
} from "@/lib/ai-teammate";
import { cn } from "@/lib/utils";

type Props = {
  race: Race;
  userNickname: string;
};

const QUICK_REPLIES = ["我回来了", "收到", "谢谢队友"];

function moodFromMessages(messages: ChatMessage[], flags: { worriedJustNow: boolean; cheerUntil: number; sleepJustNow: boolean }): TeammateMood {
  const now = Date.now();
  if (now < flags.cheerUntil) return "cheering";
  if (flags.sleepJustNow) return "sleep_reminder";
  if (flags.worriedJustNow) return "worried";
  const last = messages[messages.length - 1];
  if (last?.variant === "worried" && last.role === "teammate") return "worried";
  if (last?.variant === "loot" && now - last.ts < 120_000) return "cheering";
  if (last?.variant === "sleep" && now - last.ts < 180_000) return "sleep_reminder";
  return "normal";
}

export default function TeammateSidebar({ race, userNickname }: Props) {
  const def = useMemo(() => getTeammateForRace(race), [race]);
  const [collapsed, setCollapsed] = useState(false);
  const [expandedChat, setExpandedChat] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadTeammateMessages());
  const [level, setLevel] = useState(() => getTeammateLevel());
  const [worriedJustNow, setWorriedJustNow] = useState(false);
  const [cheerUntil, setCheerUntil] = useState(0);
  const [sleepJustNow, setSleepJustNow] = useState(false);

  const refresh = useCallback(() => {
    setMessages(loadTeammateMessages());
    setLevel(getTeammateLevel());
  }, []);

  useEffect(() => {
    refresh();
    const on = () => {
      refresh();
      const list = loadTeammateMessages();
      const last = list[list.length - 1];
      if (last?.variant === "loot") setCheerUntil(Date.now() + 90_000);
    };
    window.addEventListener(TEAMMATE_UPDATED_EVENT, on);
    return () => window.removeEventListener(TEAMMATE_UPDATED_EVENT, on);
  }, [refresh]);

  useEffect(() => {
    seedWelcomeIfEmpty(def, userNickname);
    const { absentCalendarDays } = recordHomeVisit();
    if (maybePushWorriedMessage(absentCalendarDays)) {
      setWorriedJustNow(true);
      refresh();
    }
    if (maybePushSleepReminder(race)) {
      setSleepJustNow(true);
      refresh();
    }
    refresh();
    const t = window.setTimeout(() => {
      setWorriedJustNow(false);
      setSleepJustNow(false);
    }, 8000);
    // 仅首页挂载时记录访问；避免依赖变化导致重复「回访」判定
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only visit log
  }, []);

  const mood = useMemo(
    () => moodFromMessages(messages, { worriedJustNow, cheerUntil, sleepJustNow }),
    [messages, worriedJustNow, cheerUntil, sleepJustNow]
  );

  const rawPreview = messages.length ? messages[messages.length - 1].body : "点我聊聊";
  const preview = rawPreview.length > 42 ? `${rawPreview.slice(0, 42)}…` : rawPreview;

  const moodLabel =
    mood === "worried"
      ? "担心"
      : mood === "cheering"
        ? "欢呼"
        : mood === "sleep_reminder"
          ? "晚安提醒"
          : "在线";

  return (
    <aside
      className={cn(
        "shrink-0 transition-[width] duration-300 ease-out",
        collapsed ? "w-12 xl:w-14" : "w-full max-w-[min(100%,22rem)] xl:w-80"
      )}
    >
      <div className="sticky top-24 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex w-full items-center justify-between rounded-xl border border-slate-700/80 bg-slate-900/90 px-2 py-2 text-left text-xs text-slate-400 shadow-lg backdrop-blur hover:border-slate-600"
          aria-expanded={!collapsed}
        >
          {!collapsed ? (
            <>
              <span className="font-medium text-slate-200">队友栏</span>
              <span className="text-slate-500">收起</span>
            </>
          ) : (
            <span className="mx-auto text-lg" title="展开队友栏">
              {def.emoji}
            </span>
          )}
        </button>

        {!collapsed && (
          <div className="overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/95 shadow-xl backdrop-blur">
            <button
              type="button"
              onClick={() => setExpandedChat(true)}
              className="flex w-full items-start gap-3 p-3 text-left hover:bg-slate-800/50"
            >
              <div className="relative">
                <div
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br text-2xl ring-2 ring-offset-2 ring-offset-slate-900",
                    def.gradient,
                    mood === "worried" && "ring-rose-500/80 animate-pulse",
                    mood === "cheering" && "ring-amber-400/90",
                    mood === "sleep_reminder" && "ring-indigo-500/80",
                    mood === "normal" && "ring-slate-600"
                  )}
                >
                  {def.emoji}
                </div>
                <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 ring-1 ring-slate-600">
                  Lv.{level}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{def.name}</p>
                <p className="text-[11px] text-slate-500">{def.subtitle}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">状态 · {moodLabel}</p>
                <p className="mt-2 line-clamp-2 rounded-lg bg-slate-800/80 px-2 py-1.5 text-[11px] leading-snug text-slate-300">
                  {preview}
                </p>
                <p className="mt-1 text-[10px] text-cyan-500/90">点按展开对话（模拟 WhatsApp）</p>
              </div>
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {expandedChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="队友对话"
            onClick={() => setExpandedChat(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-700 bg-[#0b141a] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* WhatsApp-like header */}
              <header className="flex items-center gap-3 bg-[#1f2c34] px-3 py-2.5">
                <button
                  type="button"
                  className="rounded-full p-1 text-slate-300 hover:bg-white/10"
                  onClick={() => setExpandedChat(false)}
                  aria-label="关闭"
                >
                  ←
                </button>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-xl", def.gradient)}>
                  {def.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-slate-100">{def.name}</p>
                  <p className="truncate text-xs text-emerald-400/90">
                    在线 · 队友 Lv.{level} · 规则模拟
                  </p>
                </div>
              </header>

              <div
                className="whatsapp-pattern flex-1 space-y-2 overflow-y-auto px-2 py-3"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23182229' fill-opacity='0.35'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                }}
              >
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                  >
                    <div
                      className={cn(
                        "max-w-[88%] rounded-lg px-2.5 py-1.5 text-[13px] leading-snug shadow-sm",
                        m.role === "user" &&
                          "rounded-br-none bg-[#005c4b] text-slate-100 border border-emerald-900/40",
                        m.role === "teammate" &&
                          "rounded-bl-none bg-[#1f2c34] text-slate-100 border border-slate-700/60",
                        m.role === "system" &&
                          "mx-auto max-w-[95%] rounded-lg bg-black/25 px-3 py-1 text-center text-[11px] text-slate-500"
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>

              <footer className="border-t border-slate-800 bg-[#1f2c34] px-2 py-2">
                <p className="mb-2 text-center text-[10px] text-slate-500">快捷回复（无后端）</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_REPLIES.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        appendUserQuickReply(q);
                        refresh();
                        setWorriedJustNow(false);
                      }}
                      className="rounded-full border border-slate-600 bg-slate-800/80 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
