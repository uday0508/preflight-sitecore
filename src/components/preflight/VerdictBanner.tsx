import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/preflight/types";

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; sub: string; bg: string; dot: string; text: string }
> = {
  ready: {
    label: "Ready to publish",
    sub: "All checks passing",
    bg: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    text: "text-emerald-900",
  },
  attention: {
    label: "Needs attention",
    sub: "Some checks flagged",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
    text: "text-amber-900",
  },
  blocked: {
    label: "Not ready",
    sub: "Blocking issues found",
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
    text: "text-red-900",
  },
};

export function VerdictBanner({
  verdict,
  pageName,
  flagCount,
  onRerun,
  isRerunning,
}: {
  verdict: Verdict;
  pageName: string;
  flagCount: number;
  onRerun?: () => void;
  isRerunning?: boolean;
}) {
  const config = VERDICT_CONFIG[verdict];

  return (
    <div className={cn("rounded-lg border p-4", config.bg)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-1.5 h-3 w-3 shrink-0 rounded-full",
              config.dot
            )}
          />
          <div className="min-w-0">
            <h2 className={cn("text-base font-semibold", config.text)}>
              {config.label}
            </h2>
            <p className={cn("mt-0.5 text-xs", config.text, "opacity-80")}>
              {pageName}
              {flagCount > 0 && ` · ${flagCount} check${flagCount === 1 ? "" : "s"} flagged`}
            </p>
          </div>
        </div>
        {onRerun && (
          <button
            onClick={onRerun}
            disabled={isRerunning}
            className="shrink-0 rounded-md border border-black/10 bg-white px-3 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50"
          >
            {isRerunning ? "Running…" : "Re-run"}
          </button>
        )}
      </div>
    </div>
  );
}