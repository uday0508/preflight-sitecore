import { useMarketplace } from "@/components/providers/MarketplaceContext";

export function useAppContext() {
  const { appContext, isInitialized } = useMarketplace();

  const sitecoreContextId =
    (appContext as any)?.resourceAccess?.[0]?.context?.preview ??
    (appContext as any)?.resourceAccess?.[0]?.context?.live ??
    null;

  return {
    appContext,
    sitecoreContextId,
    isReady: isInitialized && !!appContext && !!sitecoreContextId,
  };
}