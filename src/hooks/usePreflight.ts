import { useEffect, useState, useCallback } from "react";
import { useMarketplace } from "@/components/providers/MarketplaceContext";
import { runPageChecks } from "@/lib/preflight/engine";
import type { PreflightResult } from "@/lib/preflight/types";

function resolveSitecoreContextId(appContext: any): string | null {
  if (!appContext) return null;
  const resource = appContext.resourceAccess?.[0];
  return resource?.context?.preview ?? resource?.context?.live ?? null;
}

function resolvePageId(pagesContext: any): string | null {
  if (!pagesContext) return null;
  return pagesContext?.pageInfo?.id ?? pagesContext?.pageId ?? null;
}

function resolveSiteName(pagesContext: any): string {
  return pagesContext?.siteInfo?.name ?? pagesContext?.siteName ?? "";
}

function resolveLanguage(pagesContext: any): string {
  return pagesContext?.siteInfo?.language ?? pagesContext?.language ?? "en";
}

export function usePreflight() {
  const { client, appContext, pagesContext, isInitialized } = useMarketplace();
  const [results, setResults] = useState<PreflightResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const rerun = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (!client || !appContext || !pagesContext || !isInitialized) return;

    const sitecoreContextId = resolveSitecoreContextId(appContext);
    const pageId = resolvePageId(pagesContext);
    const siteName = resolveSiteName(pagesContext);
    const language = resolveLanguage(pagesContext);

    if (!sitecoreContextId || !pageId) {
      setError(
        `Missing context — sitecoreContextId=${
          sitecoreContextId ?? "null"
        }, pageId=${pageId ?? "null"}`
      );
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await runPageChecks(client, {
          sitecoreContextId,
          pageId,
          siteName,
          language,
        });
        if (!cancelled) setResults(res);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Preflight failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, appContext, pagesContext, isInitialized, trigger]);

  return { results, loading, error, rerun, isRerunning: loading };
}