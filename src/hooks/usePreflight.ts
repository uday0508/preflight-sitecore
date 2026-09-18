import { useEffect, useState, useCallback } from "react";
import { useMarketplace } from "@/components/providers/MarketplaceContext";
import { useAppContext } from "./useAppContext";
import { usePagesContext } from "./usePagesContext";
import { runPageChecks } from "@/lib/preflight/engine";
import type { PreflightResult } from "@/lib/preflight/types";

export function usePreflight() {
  const { client, isInitialized, pagesContext } = useMarketplace();
  const { sitecoreContextId, isReady: appReady } = useAppContext();
  const { pageId, siteName, language, isReady: pagesReady } = usePagesContext();

  const [results, setResults] = useState<PreflightResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const rerun = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    if (!client || !isInitialized || !appReady || !pagesReady) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await runPageChecks(client, {
          sitecoreContextId: sitecoreContextId!,
          pageId: pageId!,
          siteName,
          language,
          pageContext: pagesContext,
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
  }, [
    client,
    isInitialized,
    appReady,
    pagesReady,
    sitecoreContextId,
    pageId,
    siteName,
    language,
    pagesContext,
    trigger,
  ]);

  return { results, loading, error, rerun, isRerunning: loading };
}