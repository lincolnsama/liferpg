"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isQuickLogging, setIsQuickLogging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fillTestAccount = () => {
    setEmail("test@test.com");
    setPassword("123456");
    setError(null);
  };

  const quickLoginTestAccount = async () => {
    setIsQuickLogging(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: "test@test.com",
        password: "123456"
      });

      if (signInError) {
        setError(`测试账号登录失败：${signInError.message}`);
        return;
      }

      router.push("/profession");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "测试账号登录失败，请稍后重试";
      setError(msg);
    } finally {
      setIsQuickLogging(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        return;
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "登录失败，请稍后重试";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-2 text-xl font-semibold">登录 Life RPG</h1>
        <p className="mb-5 text-sm text-slate-400">使用邮箱和密码继续冒险</p>
        <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/70 p-3 text-xs text-slate-300">
          测试账号：test@test.com / 123456
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={fillTestAccount}
              className="rounded-md border border-slate-600 px-2 py-1 text-slate-200 hover:border-slate-500"
            >
              自动填充
            </button>
            <button
              type="button"
              onClick={quickLoginTestAccount}
              disabled={isQuickLogging}
              className="rounded-md bg-blue-600 px-2 py-1 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {isQuickLogging ? "登录中..." : "一键登录测试账号"}
            </button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none ring-cyan-500 focus:ring"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none ring-cyan-500 focus:ring"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isSubmitting ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          还没有账号？
          <Link href="/register" className="ml-1 text-cyan-400 hover:text-cyan-300">
            去注册
          </Link>
        </p>
      </div>
    </main>
  );
}
