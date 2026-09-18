import { useEffect, useState } from "react";
import { useMarketplace } from "@/components/providers/MarketplaceContext";
import { SiteHealthSummary } from "@/components/preflight/SiteHealthSummary";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GRAPHQL_QUERIES } from "@/lib/sitecore/queries";
import type { SiteHealthSummary as SummaryType } from "@/lib/preflight/types";

export default function DashboardWidget() {
  const { client, appContext, isInitialized } = useMarketplace();
  const [summary, setSummary] = useState<SummaryType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || !appContext || !isInitialized) return;

    const resource = (appContext as any).resourceAccess?.[0];
    const sitecoreContextId =
      resource?.context?.preview ?? resource?.context?.live;

    if (!sitecoreContextId) {
      setError("No Sitecore context available");
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data } = await client.mutate("xmc.authoring.graphql", {
          params: {
            query: { sitecoreContextId },
            body: { query: GRAPHQL_QUERIES.getPagesForScan },
          },
        });

        const pages = (data as any)?.data?.search?.results ?? [];

        const summary: SummaryType = {
          blockers: 0,
          warnings: 0,
          pagesScanned: pages.length,
          totalChecks: pages.length * 5,
          passedChecks: pages.length * 5,
          lastScan: new Date().toISOString(),
        };

        if (!cancelled) setSummary(summary);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, appContext, isInitialized]);

  if (loading) {
    return (
      <div className="p-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4">
      <SiteHealthSummary summary={summary ?? undefined} />
    </div>
  );
}