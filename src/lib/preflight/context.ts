import type {
  ApplicationContext,
  PagesContext,
} from "@sitecore-marketplace-sdk/client";

export interface PreflightContext {
  sitecoreContextId: string | null;
  pageId: string | null;
  pagePath: string | null;
  pageName: string | null;
  siteName: string | null;
  language: string | null;
  version: number | null;
  organizationId: string | null;
  tenantName: string | null;
}

/**
 * Extracts all context values the app needs in one place so every
 * consumer sees the same data.
 */
export function derivePreflightContext(
  appContext: ApplicationContext | null,
  pagesContext: PagesContext | null
): PreflightContext {
  const resource = (appContext as any)?.resourceAccess?.[0];
  const sitecoreContextId =
    resource?.context?.preview ?? resource?.context?.live ?? null;

  const pageId = (pagesContext as any)?.pageInfo?.id ?? null;
  const pagePath = (pagesContext as any)?.pageInfo?.path ?? null;
  const pageName = (pagesContext as any)?.pageInfo?.name ?? null;
  const version = (pagesContext as any)?.pageInfo?.version ?? null;

  const siteName = (pagesContext as any)?.siteInfo?.name ?? null;
  const language =
    (pagesContext as any)?.siteInfo?.language ??
    (pagesContext as any)?.pageInfo?.language ??
    null;

  const organizationId = (appContext as any)?.organizationId ?? null;

  const tenantName = extractTenantName((appContext as any)?.url ?? "");

  return {
    sitecoreContextId,
    pageId,
    pagePath,
    pageName,
    siteName,
    language,
    version,
    organizationId,
    tenantName,
  };
}

/**
 * The tenant name is not exposed as a top-level field on
 * application.context in all SDK versions. It usually appears
 * in the app URL as a query param.
 */
function extractTenantName(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return (
      parsed.searchParams.get("tenantName") ??
      parsed.searchParams.get("tenant") ??
      null
    );
  } catch {
    return null;
  }
}