"use client";

import AppShell from "@/components/app-shell";
import { MvpPageHeader } from "@/components/mvp-page-header";

const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;

const checklist = [
  "你卡在哪一步：注册/登录、创建角色、晨间加载、创建任务、完成任务、夜间封存、日志回看",
  "你点击了什么，页面出现了什么提示或无反应",
  "是否刷新后复现，使用的是手机还是电脑",
  "测试账号邮箱，或大概测试时间"
];

const knownLimits = [
  "首轮 demo 以中文 Web 体验为主，暂不承诺英文界面。",
  "任务、XP、晶石、奖励流水和封存日志会写入 Supabase；部分角色细节、技能树、外观和临时 UI 状态仍保留在本机。",
  "换浏览器或清缓存时，系统会尝试从云端角色档案恢复核心信息，但个别本地装饰状态可能重置。",
  "商店、背包、周常、史诗任务和独立文字冒险属于后置玩法，不是本轮测试重点。"
];

export default function FeedbackPage() {
  return (
    <AppShell>
      <MvpPageHeader
        title="Demo 反馈"
        description="首轮测试只关注一件事：你能否顺畅完成一次现实任务循环，并愿意明天再回来。"
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="card">
          <h2 className="text-base font-semibold text-slate-100">反馈时请尽量包含</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            {checklist.map((item) => (
              <li key={item} className="rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>

          {feedbackUrl ? (
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              打开反馈表
            </a>
          ) : (
            <p className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              当前 demo 未配置外部反馈表。请把以上信息发给测试组织者，或截图说明卡住的位置。
            </p>
          )}
        </section>

        <section className="card">
          <h2 className="text-base font-semibold text-slate-100">本轮已知限制</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            {knownLimits.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
