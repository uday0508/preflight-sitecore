import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { PreflightResult } from "./types";
import { GRAPHQL_QUERIES } from "@/lib/sitecore/queries";

const now = () => new Date().toISOString();

async function runGraphQL(
  client: ClientSDK,
  sitecoreContextId: string,
  query: string,
  variables: Record<string, unknown>
) {
  const { data } = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: { query, variables },
    },
  });
  return data as any;
}

export async function checkDynamicPlaceholders(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string,
  siteName: string,
  language: string
): Promise<PreflightResult> {
  const data = await runGraphQL(
    client,
    sitecoreContextId,
    GRAPHQL_QUERIES.getPageLayout,
    { pageId, language }
  );

  const placeholders = data?.data?.item?.layout?.placeholders ?? [];
  const broken = placeholders.filter((p: any) => p.isDynamic && !p.settingsKey);

  return {
    checkId: "dynamic-placeholder-consistency",
    label: "Dynamic placeholder settings",
    severity: broken.length > 0 ? "BLOCKER" : "PASS",
    message:
      broken.length > 0
        ? `${broken.length} dynamic placeholder(s) missing settings`
        : "All dynamic placeholders have settings",
    items: broken.map((p: any) => ({
      id: p.key,
      name: p.key,
      detail: "Dynamic placeholder has no Placeholder Setting assigned",
    })),
    checkContext: { pageId, site: siteName, language },
    ranAt: now(),
  };
}

export async function checkPagePersonalization(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string,
  siteName: string,
  language: string
): Promise<PreflightResult> {
  const data = await runGraphQL(
    client,
    sitecoreContextId,
    GRAPHQL_QUERIES.getPagePersonalization,
    { pageId, language }
  );

  const personalization = data?.data?.item?.personalization;
  const enabled = personalization?.enabled ?? false;
  const variants = personalization?.variants ?? [];

  let severity: PreflightResult["severity"] = "PASS";
  let message = "Personalization configuration valid";
  const items: PreflightResult["items"] = [];

  if (enabled && variants.length === 0) {
    severity = "WARNING";
    message = "Personalization enabled but no variant rules defined";
  } else if (enabled && variants.some((v: any) => !v.saved)) {
    severity = "BLOCKER";
    message = "Personalization has unsaved variant rules";
    items.push(
      ...variants
        .filter((v: any) => !v.saved)
        .map((v: any) => ({
          id: v.id,
          name: v.name ?? "Unnamed variant",
          detail: "Variant rule is not saved",
        }))
    );
  }

  return {
    checkId: "page-personalization-validity",
    label: "Page personalization",
    severity,
    message,
    items,
    checkContext: { pageId, site: siteName, language },
    ranAt: now(),
  };
}

export async function checkTrackingConfig(
  client: ClientSDK,
  sitecoreContextId: string,
  siteName: string
): Promise<PreflightResult> {
  const { data } = await client.query("xmc.sites.listSites", {
    params: { query: { sitecoreContextId } },
  });

  const sites = (data as any)?.sites ?? [];
  const site = sites.find((s: any) => s.name === siteName);
  const trackingEnabled = site?.enableTracking ?? true;

  return {
    checkId: "analytics-tracking-config",
    label: "Analytics tracking",
    severity: trackingEnabled ? "PASS" : "WARNING",
    message: trackingEnabled
      ? "Site tracking is enabled"
      : "Site tracking is explicitly disabled",
    items: [],
    checkContext: { site: siteName },
    ranAt: now(),
  };
}

export async function checkRenderDrift(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string,
  siteName: string,
  language: string
): Promise<PreflightResult> {
  const data = await runGraphQL(
    client,
    sitecoreContextId,
    GRAPHQL_QUERIES.getPagePublishState,
    { pageId, language }
  );

  const page = data?.data?.item;
  const pageUpdated = page?.updated;
  const lastPublished = page?.published;

  const items: PreflightResult["items"] = [];
  let severity: PreflightResult["severity"] = "PASS";
  let message = "Page render configuration is in sync with delivery";

  if (
    pageUpdated &&
    lastPublished &&
    new Date(pageUpdated) > new Date(lastPublished)
  ) {
    severity = "WARNING";
    message = "Page modified after last publish — delivery may be stale";
    items.push({
      id: pageId,
      name: page?.name ?? "Page",
      detail: `Modified ${pageUpdated}, last published ${lastPublished}`,
    });
  }

  return {
    checkId: "render-drift",
    label: "Render / delivery sync",
    severity,
    message,
    items,
    checkContext: { pageId, site: siteName, language },
    ranAt: now(),
  };
}

export async function checkComponentPersonalization(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string,
  siteName: string,
  language: string
): Promise<PreflightResult> {
  const data = await runGraphQL(
    client,
    sitecoreContextId,
    GRAPHQL_QUERIES.getComponentPersonalization,
    { pageId, language }
  );

  const components = data?.data?.item?.components ?? [];
  const broken: PreflightResult["items"] = [];

  for (const c of components) {
    if (!c.personalized) continue;
    const hasConditions = (c.conditions?.length ?? 0) > 0;
    const hasVariants = (c.variants?.length ?? 0) > 0;
    const rulesSaved = c.rulesSaved ?? true;

    if (!rulesSaved) {
      broken.push({
        id: c.id,
        name: c.name,
        detail: "Personalization rules not saved",
      });
    } else if (!hasConditions && hasVariants) {
      broken.push({
        id: c.id,
        name: c.name,
        detail: "Variants defined but no match conditions",
      });
    }
  }

  return {
    checkId: "component-personalization-integrity",
    label: "Component personalization",
    severity: broken.length > 0 ? "BLOCKER" : "PASS",
    message:
      broken.length > 0
        ? `${broken.length} component(s) with broken personalization`
        : "All component personalization rules are intact",
    items: broken,
    checkContext: { pageId, site: siteName, language },
    ranAt: now(),
  };
}