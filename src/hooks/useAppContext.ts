import { useMarketplace } from "@/components/providers/MarketplaceContext";

export function useAppContext() {
  const { appContext, isInitialized } = useMarketplace();
  return { appContext, isReady: isInitialized && !!appContext };
}