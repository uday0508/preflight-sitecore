import { createContext, useContext } from "react";
import type {
  ClientSDK,
  ApplicationContext,
  PagesContext,
} from "@sitecore-marketplace-sdk/client";

export interface MarketplaceContextValue {
  client: ClientSDK | null;
  appContext: ApplicationContext | null;
  pagesContext: PagesContext | null;
  pageHtml: string | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
}

export const MarketplaceContext = createContext<MarketplaceContextValue>({
  client: null,
  appContext: null,
  pagesContext: null,
  pageHtml: null,
  isInitialized: false,
  isLoading: true,
  error: null,
});

export function useMarketplace() {
  return useContext(MarketplaceContext);
}