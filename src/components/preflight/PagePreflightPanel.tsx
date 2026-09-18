import { CheckList } from "./CheckList";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { PreflightResult } from "@/lib/preflight/types";

interface Props {
  results: PreflightResult[];
  pageName: string;
  onRerun?: () => void;
  isRerunning?: boolean;
}

export function PagePreflightPanel({
  results,
  pageName,
  onRerun,
  isRerunning,
}: Props) {
  const blockers = results.filter((r) => r.severity === "BLOCKER").length;
  const warnings = results.filter((r) => r.severity === "WARNING").length;
  const unknown = results.filter((r) => r.severity === "UNKNOWN").length;
  const passes = results.filter((r) => r.severity === "PASS").length;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Preflight</h2>
          <p className="text-xs text-muted-foreground">
            {pageName} — {passes}/{results.length} checks passing
            {unknown > 0 && ` (${unknown} unknown)`}
          </p>
        </div>
        {onRerun && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRerun}
            disabled={isRerunning}
          >
            {isRerunning ? "Running…" : "Re-run"}
          </Button>
        )}
      </header>

      <div className="grid grid-cols-4 gap-2">
        <Stat label="Blockers" value={blockers} tone="destructive" />
        <Stat label="Warnings" value={warnings} tone="warning" />
        <Stat label="Unknown" value={unknown} tone="muted" />
        <Stat label="Passing" value={passes} tone="default" />
      </div>

      {results.length === 0 ? (
        <Alert>
          <AlertDescription>
            No checks have run yet. Select a page or re-run to start.
          </AlertDescription>
        </Alert>
      ) : (
        <CheckList results={results} />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "destructive" | "warning" | "default" | "muted";
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-amber-600"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border p-2 text-center">
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}