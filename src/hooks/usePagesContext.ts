import { useMarketplace } from "@/components/providers/MarketplaceContext";

export function usePagesContext() {
  const { pagesContext, isInitialized } = useMarketplace();
  return { pagesContext, isReady: isInitialized && !!pagesContext };
}