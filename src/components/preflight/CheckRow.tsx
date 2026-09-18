import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PreflightResult, Severity } from "@/lib/preflight/types";
import { VariantRow } from "./VariantRow";

const SEVERITY_ICON: Record<Severity, string> = {
  BLOCKER: "✕",
  WARNING: "!",
  INFO: "i",
  PASS: "✓",
  UNKNOWN: "?",
};

const SEVERITY_STYLE: Record<Severity, { icon: string; text: string }> = {
  BLOCKER: { icon: "bg-red-100 text-red-700", text: "text-red-700" },
  WARNING: { icon: "bg-amber-100 text-amber-700", text: "text-amber-700" },
  INFO: { icon: "bg-slate-100 text-slate-600", text: "text-slate-600" },
  PASS: { icon: "bg-emerald-100 text-emerald-700", text: "text-emerald-700" },
  UNKNOWN: { icon: "bg-slate-100 text-slate-500", text: "text-slate-500" },
};

const CHECK_LABELS: Record<string, string> = {
  "dynamic-placeholder-consistency": "Dynamic placeholders",
  "page-personalization-validity": "Page personalization",
  "analytics-tracking-config": "Analytics tracking",
  "render-drift": "Publish status",
  "component-personalization-integrity": "Personalization safety",
};

const PERSONALIZATION_CHECK_ID = "page-personalization-validity";

export function CheckRow({ result }: { result: PreflightResult }) {
  const [expanded, setExpanded] = useState(false);
  const style = SEVERITY_STYLE[result.severity];
  const label = CHECK_LABELS[result.checkId] ?? result.label;
  const isPersonalization = result.checkId === PERSONALIZATION_CHECK_ID;
  const hasDetail = result.items.length > 0;

  return (
    <div className="border-b last:border-b-0">
      <button
        onClick={() => hasDetail && setExpanded((v) => !v)}
        className={cn(
          "flex w-full items-start gap-3 px-1 py-3 text-left",
          hasDetail && "hover:bg-slate-50 cursor-pointer"
        )}
        disabled={!hasDetail}
      >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
            style.icon
          )}
        >
          {SEVERITY_ICON[result.severity]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-900">
              {label}
            </span>
            {hasDetail && (
              <span className="text-xs text-slate-400">
                {expanded ? "▾" : "▸"}
              </span>
            )}
          </div>
          <p className={cn("mt-0.5 text-xs", style.text)}>{result.message}</p>
        </div>
      </button>

      {expanded && hasDetail && (
        <div className="space-y-3 pb-3 pl-8 pr-1">
          {isPersonalization
            ? result.items.map((item) => {
                const editUrl = item.variants?.find(
                  (v) => v.personalizeUrl
                )?.personalizeUrl;

                return (
                  <div
                    key={item.id}
                    className="rounded-md border border-slate-200 bg-slate-50/50 p-2"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-slate-700">
                        {item.name}
                      </div>
                      {editUrl && (
                        <a
                          href={editUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Edit →
                        </a>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {item.variants?.map((v, i) => (
                        <VariantRow key={i} variant={v} />
                      ))}
                    </div>
                  </div>
                );
              })
            : result.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border bg-white px-3 py-2"
                >
                  <div className="text-xs font-medium text-slate-700">
                    {item.name}
                  </div>
                  {item.detail && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {item.detail}
                    </div>
                  )}
                </div>
              ))}
        </div>
      )}
    </div>
  );
}