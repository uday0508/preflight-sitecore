import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { SiteHealthSummary as SummaryType } from "@/lib/preflight/types";

interface Props {
  summary?: SummaryType;
  onDrillDown?: (filter: "BLOCKER" | "WARNING" | "ALL") => void;
  isLoading?: boolean;
}

export function SiteHealthSummary({ summary, onDrillDown, isLoading }: Props) {
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
        <Row
          label="Blockers"
          value={summary.blockers}
          tone="destructive"
          onClick={() => onDrillDown?.("BLOCKER")}
        />
        <Row
          label="Warnings"
          value={summary.warnings}
          tone="warning"
          onClick={() => onDrillDown?.("WARNING")}
        />
        <Separator />
        <Row label="Passing" value={summary.passedChecks} tone="default" />
        <Row
          label="Pages scanned"
          value={summary.pagesScanned}
          tone="muted"
        />
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
  onClick,
}: {
  label: string;
  value: number;
  tone: "destructive" | "warning" | "default" | "muted";
  onClick?: () => void;
}) {
  const toneClass =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
      ? "text-amber-600"
      : tone === "muted"
      ? "text-muted-foreground"
      : "text-foreground";

  const content = (
    <>
      <span>{label}</span>
      <span className={`font-bold ${toneClass}`}>{value}</span>
    </>
  );

  if (onClick && value > 0) {
    return (
      <button
        onClick={onClick}
        className="flex w-full justify-between rounded px-1 py-0.5 hover:bg-accent"
      >
        {content}
      </button>
    );
  }

  return <div className="flex justify-between px-1 py-0.5">{content}</div>;
}