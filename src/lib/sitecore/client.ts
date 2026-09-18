import { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { XMC } from "@sitecore-marketplace-sdk/xmc";

let clientInstance: ClientSDK | undefined;

export async function getMarketplaceClient(): Promise<ClientSDK> {
  if (clientInstance) return clientInstance;
  clientInstance = await ClientSDK.init({
    target: window.parent,
    modules: [XMC],
  });
  return clientInstance;
}

export function getCachedClient(): ClientSDK | undefined {
  return clientInstance;
}