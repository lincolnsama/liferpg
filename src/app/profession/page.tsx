"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { MvpPageHeader } from "@/components/mvp-page-header";
import { PROFESSIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase-browser";
import type { Profession } from "@/types/db";

export default function ProfessionPage() {
  const supabase = useMemo(() => createClient(), []);
  const [current, setCurrent] = useState<Profession | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data, error: loadError } = await supabase.from("profiles").select("profession").eq("id", user.id).single();
      if (loadError) {
        setError(`职业档案读取失败：${loadError.message}`);
        return;
      }
      setCurrent((data?.profession as Profession | null) ?? null);
    };

    void load();
  }, [supabase]);

  const updateProfession = async (profession: Profession) => {
    setError(null);
    setMessage(null);
    setIsSaving(true);
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) {
      setError("登录状态已失效，请重新登录后再切换任务职业。");
      setIsSaving(false);
      return;
    }

    const { error } = await supabase.from("profiles").update({ profession }).eq("id", user.id);
    setIsSaving(false);
    if (error) {
      setError(`职业切换失败：${error.message}`);
      return;
    }
    setCurrent(profession);
    setMessage(`任务职业已切换为 ${profession}`);
  };

  return (
    <AppShell>
      <MvpPageHeader
        title="任务职业"
        description="这里决定新任务默认使用哪条成长方向；角色主/副职业来自开局创建，可在技能树里体现长期身份。"
      />
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-slate-200">选择任务职业倾向</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROFESSIONS.map((profession) => (
            <button
              key={profession.value}
              onClick={() => updateProfession(profession.value)}
              disabled={isSaving}
              className={`rounded-lg border p-4 text-left transition ${
                current === profession.value
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className="text-lg">{profession.emoji}</p>
              <p className="mt-2 font-semibold">{profession.value}</p>
              <p className="mt-1 text-xs text-slate-400">{profession.description}</p>
            </button>
          ))}
        </div>

        {message && <p className="mt-4 text-sm text-emerald-400">{message}</p>}
        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}
      </section>
    </AppShell>
  );
}
