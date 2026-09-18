import { cn } from "@/lib/utils";
import type { VariantDisplay } from "@/lib/preflight/types";

export function VariantRow({ variant }: { variant: VariantDisplay }) {
  const isHidden = variant.outcome.toLowerCase().includes("hidden");
  const isSame = variant.outcome.toLowerCase().includes("same as default");

  return (
    <div
      className={cn(
        "rounded-md border bg-white px-3 py-2",
        variant.isDefault && "bg-slate-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span
              className={cn(
                "text-xs font-semibold",
                variant.isDefault ? "text-slate-600" : "text-slate-900"
              )}
            >
              {variant.label}
            </span>
            <span className="text-[11px] text-slate-500">
              {variant.audience}
            </span>
          </div>

          {variant.condition && (
            <div className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-400">
              {variant.condition}
            </div>
          )}

          <div
            className={cn(
              "mt-1 text-xs",
              isHidden
                ? "text-slate-500 italic"
                : isSame
                  ? "text-slate-500"
                  : "text-slate-700"
            )}
          >
            {isHidden ? "Hides this component" : `Sees: ${variant.outcome}`}
          </div>
        </div>
      </div>
    </div>
  );
}