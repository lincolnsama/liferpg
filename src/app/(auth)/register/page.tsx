"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // profile 由数据库触发器自动创建
      setMessage("注册成功，正在跳转登录页...");
      setTimeout(() => {
        router.push("/login");
        router.refresh();
      }, 700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "注册失败，请稍后重试";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <h1 className="mb-2 text-xl font-semibold">创建账号</h1>
        <p className="mb-5 text-sm text-slate-400">开启你的人生升级之旅</p>

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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少6位）"
            className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-400 outline-none ring-cyan-500 focus:ring"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}
          {message && <p className="text-xs text-emerald-400">{message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {isSubmitting ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          已有账号？
          <Link href="/login" className="ml-1 text-cyan-400 hover:text-cyan-300">
            去登录
          </Link>
        </p>
      </div>
    </main>
  );
}
