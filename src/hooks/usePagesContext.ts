import { useMarketplace } from "@/components/providers/MarketplaceContext";

export function usePagesContext() {
  const { pagesContext, isInitialized } = useMarketplace();

  const pageId = (pagesContext as any)?.pageInfo?.id ?? null;
  const itemPath = (pagesContext as any)?.pageInfo?.path ?? "";
  const route = (pagesContext as any)?.pageInfo?.route ?? "";
  const siteName = (pagesContext as any)?.siteInfo?.name ?? "";
  const language =
    (pagesContext as any)?.siteInfo?.language ??
    (pagesContext as any)?.pageInfo?.language ??
    "en";

  return {
    pagesContext,
    pageId,
    itemPath,
    route,
    siteName,
    language,
    isReady:
      isInitialized && !!pagesContext && !!pageId && !!siteName,
  };
}