"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { loadUserProfile, RACE_META, UserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase-browser";

export default function Topbar() {
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    setUserProfile(loadUserProfile());
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-slate-100 md:text-2xl">人生 RPG</h1>
        {userProfile && (
          <p className="mt-1 text-xs text-slate-300 md:text-sm">
            {userProfile.nickname} · {RACE_META[userProfile.race].icon} {RACE_META[userProfile.race].name}
          </p>
        )}
      </div>
      <button
        onClick={logout}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white md:text-sm"
      >
        退出登录
      </button>
    </div>
  );
}
