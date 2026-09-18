import { useMarketplace } from "@/components/providers/MarketplaceContext";
import { SiteHealthSummary } from "@/components/preflight/SiteHealthSummary";
import { Skeleton } from "@/components/ui/skeleton";
import type { SiteHealthSummary as SummaryType } from "@/lib/preflight/types";

export default function DashboardWidget() {
  const { isInitialized } = useMarketplace();

  if (!isInitialized) {
    return (
      <div className="p-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Aggregated scan results are not yet wired — show empty summary.
  const summary: SummaryType = {
    blockers: 0,
    warnings: 0,
    unknown: 0,
    pagesScanned: 0,
    totalChecks: 0,
    passedChecks: 0,
    lastScan: new Date().toISOString(),
  };

  return (
    <div className="p-4">
      <SiteHealthSummary summary={summary} />
    </div>
  );
}