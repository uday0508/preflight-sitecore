/**
 * Builds a deep link to the Sitecore Pages personalization panel
 * for a specific page. Uses the same URL shape the Pages editor
 * uses internally when opening the Personalize tab.
 *
 * Example URL:
 *   https://pages.sitecorecloud.io/personalization
 *     ?sc_itemid=431cae67-1645-4d65-a57b-c794638f7108
 *     &sc_lang=en
 *     &sc_site=starterkit
 *     &organization=org_NX2CTeF32dHRDNDq
 *     &tenantName=biztechnosyc333-bizstarterk8ff7-dev96b0
 *     &sc_version=1
 */

export interface PersonalizeUrlContext {
  pageId: string | null;
  language: string | null;
  siteName: string | null;
  version: number | string | null;
  organizationId: string | null;
  tenantName: string | null;
}

const BASE = "https://pages.sitecorecloud.io/personalization";

export function buildPersonalizeUrl(
  ctx: PersonalizeUrlContext
): string | null {
  if (!ctx.pageId || !ctx.siteName) return null;

  const params = new URLSearchParams();
  params.set("sc_itemid", ctx.pageId);
  if (ctx.language) params.set("sc_lang", ctx.language);
  params.set("sc_site", ctx.siteName);
  if (ctx.organizationId) params.set("organization", ctx.organizationId);
  if (ctx.tenantName) params.set("tenantName", ctx.tenantName);
  if (ctx.version != null) params.set("sc_version", String(ctx.version));

  return `${BASE}?${params.toString()}`;
}