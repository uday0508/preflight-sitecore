import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SiteHealthSummary as SummaryType } from "@/lib/preflight/types";

interface Props {
  summary?: SummaryType;
  isLoading?: boolean;
}

export function SiteHealthSummary({ summary, isLoading }: Props) {
  if (isLoading || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Preflight — Site Health</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Scanning…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Preflight — Site Health</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Blockers" value={summary.blockers} tone="destructive" />
        <Row label="Warnings" value={summary.warnings} tone="warning" />
        <Row label="Unknown" value={summary.unknown} tone="muted" />
        <Separator />
        <Row label="Passing" value={summary.passedChecks} tone="default" />
        <Row label="Pages scanned" value={summary.pagesScanned} tone="muted" />
        <p className="pt-1 text-[10px] text-muted-foreground">
          Last scan: {new Date(summary.lastScan).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
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
    <div className="flex justify-between px-1 py-0.5">
      <span>{label}</span>
      <span className={`font-bold ${toneClass}`}>{value}</span>
    </div>
  );
}