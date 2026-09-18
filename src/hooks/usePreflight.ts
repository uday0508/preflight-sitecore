import { useEffect, useState, useCallback } from "react";
import { useMarketplace } from "@/components/providers/MarketplaceContext";
import { runPageChecks, computeVerdict } from "@/lib/preflight/engine";
import { derivePreflightContext } from "@/lib/preflight/context";
import type { PreflightResult, Verdict } from "@/lib/preflight/types";

export function usePreflight() {
  const {
    client,
    appContext,
    pagesContext,
    pageHtml,
    isInitialized,
  } = useMarketplace();

  const [results, setResults] = useState<PreflightResult[]>([]);
  const [verdict, setVerdict] = useState<Verdict>("ready");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trigger, setTrigger] = useState(0);

  const rerun = useCallback(() => setTrigger((n) => n + 1), []);

  const ctx = derivePreflightContext(appContext, pagesContext);

  useEffect(() => {
    if (!client || !isInitialized) return;
    if (!ctx.sitecoreContextId || !ctx.pageId) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await runPageChecks(client, {
          context: ctx,
          pageContext: pagesContext,
          pageHtml,
        });
        if (!cancelled) {
          setResults(res);
          setVerdict(computeVerdict(res));
        }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    client,
    isInitialized,
    ctx.sitecoreContextId,
    ctx.pageId,
    ctx.siteName,
    ctx.language,
    pagesContext,
    pageHtml,
    trigger,
  ]);

  return { results, verdict, loading, error, rerun, isRerunning: loading };
}