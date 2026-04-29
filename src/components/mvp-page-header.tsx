import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type MvpPageHeaderProps = {
  title: string;
  description?: string;
  className?: string;
  /** 右侧操作区（按钮、链接等） */
  actions?: ReactNode;
};

export function MvpPageHeader({ title, description, className, actions }: MvpPageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="mvp-page-title">{title}</h1>
        {description ? <p className="mvp-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
