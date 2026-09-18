import { VerdictBanner } from "./VerdictBanner";
import { CheckRow } from "./CheckRow";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PreflightResult, Verdict, Severity } from "@/lib/preflight/types";

const SEVERITY_ORDER: Record<Severity, number> = {
  BLOCKER: 0,
  WARNING: 1,
  UNKNOWN: 2,
  INFO: 3,
  PASS: 4,
};

interface Props {
  results: PreflightResult[];
  verdict: Verdict;
  pageName: string;
  onRerun?: () => void;
  isRerunning?: boolean;
}

export function PagePreflightPanel({
  results,
  verdict,
  pageName,
  onRerun,
  isRerunning,
}: Props) {
  const flagCount = results.filter(
    (r) => r.severity === "BLOCKER" || r.severity === "WARNING"
  ).length;

  const sorted = [...results].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-slate-50 p-4">
      <VerdictBanner
        verdict={verdict}
        pageName={pageName}
        flagCount={flagCount}
        onRerun={onRerun}
        isRerunning={isRerunning}
      />

      <div className="rounded-lg border bg-white px-3">
        {sorted.map((result) => (
          <CheckRow key={result.checkId} result={result} />
        ))}
      </div>

      {results.length === 0 && (
        <Alert>
          <AlertDescription>
            No checks have run yet.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}