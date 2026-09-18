import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { useEffect, useState, useCallback, useRef } from "react";
import { getMarketplaceClient, getCachedClient } from "@/lib/sitecore/client";

export interface MarketplaceClientState {
  client: ClientSDK | null;
  error: Error | null;
  isLoading: boolean;
  isInitialized: boolean;
}

export function useMarketplaceClient(): MarketplaceClientState {
  const [state, setState] = useState<MarketplaceClientState>({
    client: getCachedClient() ?? null,
    error: null,
    isLoading: !getCachedClient(),
    isInitialized: !!getCachedClient(),
  });

  const isInitializing = useRef(false);

  const initialize = useCallback(async (attempt = 1): Promise<void> => {
    if (isInitializing.current || getCachedClient()) return;
    isInitializing.current = true;
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const client = await getMarketplaceClient();
      setState({
        client,
        error: null,
        isLoading: false,
        isInitialized: true,
      });
    } catch (error) {
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1000));
        return initialize(attempt + 1);
      }
      setState({
        client: null,
        error:
          error instanceof Error ? error : new Error("SDK init failed"),
        isLoading: false,
        isInitialized: false,
      });
    } finally {
      isInitializing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!getCachedClient() && !isInitializing.current) initialize();
  }, [initialize]);

  return state;
}