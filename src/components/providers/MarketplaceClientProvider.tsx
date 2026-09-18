import { useEffect, useState } from "react";
import { useMarketplaceClient } from "@/hooks/useMarketplaceClient";
import { MarketplaceContext } from "./MarketplaceContext";
import type {
  ApplicationContext,
  PagesContext,
} from "@sitecore-marketplace-sdk/client";

export function MarketplaceClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { client, isInitialized, isLoading, error } = useMarketplaceClient();
  const [appContext, setAppContext] = useState<ApplicationContext | null>(null);
  const [pagesContext, setPagesContext] = useState<PagesContext | null>(null);

  // Application context — available in every extension point
  useEffect(() => {
    if (!isInitialized || !client) return;
    let cancelled = false;

    client
      .query("application.context")
      .then((res) => {
        if (!cancelled) setAppContext(res.data!);
      })
      .catch((err) =>
        console.error("[Preflight] application.context failed:", err)
      );

    return () => {
      cancelled = true;
    };
  }, [client, isInitialized]);

  // Pages context — only available in Page Builder extension points
  useEffect(() => {
    if (!isInitialized || !client) return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    client
      .query("pages.context", {
        subscribe: true,
        onSuccess: (res) => {
          if (!cancelled) setPagesContext(res.data);
        },
      })
      .then(({ data, unsubscribe: unsub }) => {
        if (cancelled) return;
        setPagesContext(data!);
        unsubscribe = unsub;
      })
      .catch((err) => {
        console.warn(
          "[Preflight] pages.context unavailable:",
          err?.message ?? err
        );
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [client, isInitialized]);

  return (
    <MarketplaceContext.Provider
      value={{
        client,
        appContext,
        pagesContext,
        isInitialized,
        isLoading,
        error,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}