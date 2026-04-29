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

  useEffect(() => {
    const load = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase.from("profiles").select("profession").eq("id", user.id).single();
      setCurrent((data?.profession as Profession | null) ?? null);
    };

    void load();
  }, [supabase]);

  const updateProfession = async (profession: Profession) => {
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("profiles").update({ profession }).eq("id", user.id);
    if (!error) {
      setCurrent(profession);
      setMessage(`职业已切换为 ${profession}`);
    }
  };

  return (
    <AppShell>
      <MvpPageHeader title="职业" description="职业决定任务的成长方向，与技能树联动；可随时切换。" />
      <section className="card">
        <h2 className="mb-4 text-base font-semibold text-slate-200">选择主职业</h2>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PROFESSIONS.map((profession) => (
            <button
              key={profession.value}
              onClick={() => updateProfession(profession.value)}
              className={`rounded-lg border p-4 text-left transition ${
                current === profession.value
                  ? "border-cyan-500 bg-cyan-500/10"
                  : "border-slate-800 bg-slate-900 hover:border-slate-700"
              }`}
            >
              <p className="text-lg">{profession.emoji}</p>
              <p className="mt-2 font-semibold">{profession.value}</p>
              <p className="mt-1 text-xs text-slate-400">{profession.description}</p>
            </button>
          ))}
        </div>

        {message && <p className="mt-4 text-sm text-emerald-400">{message}</p>}
      </section>
    </AppShell>
  );
}
