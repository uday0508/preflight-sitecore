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