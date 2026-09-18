import { useMarketplace } from "@/components/providers/MarketplaceContext";
import { usePreflight } from "@/hooks/usePreflight";
import { PagePreflightPanel } from "@/components/preflight/PagePreflightPanel";
import { ErrorBoundary } from "@/components/preflight/ErrorBoundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function PagesContextPanel() {
  const { pagesContext, isInitialized, error: sdkError } = useMarketplace();
  const { results, loading, error, rerun, isRerunning } = usePreflight();

  if (sdkError) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertDescription>{sdkError.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isInitialized || loading) {
    return (
      <div className="p-4">
        <Skeleton className="h-96 w-full" />
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

  const pageName =
    (pagesContext as any)?.pageInfo?.name ?? "Current page";

  return (
    <ErrorBoundary>
      <PagePreflightPanel
        results={results}
        pageName={pageName}
        onRerun={rerun}
        isRerunning={isRerunning}
      />
    </ErrorBoundary>
  );
}