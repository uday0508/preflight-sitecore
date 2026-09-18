import { CheckCard } from "./CheckCard";
import { Separator } from "@/components/ui/separator";
import type { PreflightResult, Severity } from "@/lib/preflight/types";

const SEVERITY_ORDER: Record<Severity, number> = {
  BLOCKER: 0,
  WARNING: 1,
  INFO: 2,
  PASS: 3,
};

export function CheckList({
  results,
  showEmpty = false,
}: {
  results: PreflightResult[];
  showEmpty?: boolean;
}) {
  const sorted = [...results].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  if (sorted.length === 0 && !showEmpty) return null;

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((result, index) => (
        <div key={result.checkId}>
          <CheckCard result={result} />
          {index < sorted.length - 1 && <Separator className="my-1" />}
        </div>
      ))}
    </div>
  );
}