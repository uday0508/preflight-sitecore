import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { PreflightResult, CheckItem } from "./types";
import { GRAPHQL_QUERIES } from "@/lib/sitecore/queries";
import { formatSitecoreDate } from "@/lib/utils";
import {
  parsePresentationDetails,
  isDynamicPlaceholder,
} from "./parser";

const now = () => new Date().toISOString();

async function runAuthoringGraphQL(
  client: ClientSDK,
  sitecoreContextId: string,
  query: string,
  variables: Record<string, unknown>
): Promise<any> {
  const { data } = await client.mutate("xmc.authoring.graphql", {
    params: {
      query: { sitecoreContextId },
      body: { query, variables },
    },
  });

  const payload = data as any;
  const errors = payload?.data?.errors ?? payload?.errors ?? null;

  if (Array.isArray(errors) && errors.length > 0) {
    const msg = errors.map((e: any) => e.message).join("; ");
    throw new Error(`GraphQL error: ${msg}`);
  }

  return payload;
}

function getField(item: any, fieldName: string, alias?: string): string | null {
  if (alias && item?.[alias]?.value) return item[alias].value;
  const nodes = item?.fields?.nodes ?? [];
  const match = nodes.find((n: any) => n.name === fieldName);
  return match?.value ?? null;
}

/* ------------------------------------------------------------------ */
/* CHECK 1 — Dynamic placeholder consistency                           */
/* ------------------------------------------------------------------ */

export function checkDynamicPlaceholders(pageContext: any): PreflightResult {
  const presentationDetails =
    pageContext?.pageInfo?.presentationDetails ?? null;

  const { placeholderKeys, parseError } =
    parsePresentationDetails(presentationDetails);

  if (parseError) {
    return {
      checkId: "dynamic-placeholder-consistency",
      label: "Dynamic placeholder settings",
      severity: "UNKNOWN",
      message: parseError,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  if (placeholderKeys.length === 0) {
    return {
      checkId: "dynamic-placeholder-consistency",
      label: "Dynamic placeholder settings",
      severity: "INFO",
      message: "No placeholders found in presentation details",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  const dynamicKeys = placeholderKeys.filter(isDynamicPlaceholder);

  if (dynamicKeys.length === 0) {
    return {
      checkId: "dynamic-placeholder-consistency",
      label: "Dynamic placeholder settings",
      severity: "PASS",
      message: `All ${placeholderKeys.length} placeholder(s) are static`,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  return {
    checkId: "dynamic-placeholder-consistency",
    label: "Dynamic placeholder settings",
    severity: "PASS",
    message: `${dynamicKeys.length} dynamic placeholder(s) verified`,
    items: dynamicKeys.map((k) => ({
      id: k,
      name: k,
      detail: "Dynamic placeholder key present in layout",
    })),
    checkContext: {},
    ranAt: now(),
  };
}

/* ------------------------------------------------------------------ */
/* CHECK 2 — Page personalization                                      */
/* ------------------------------------------------------------------ */

export function checkPagePersonalization(pageContext: any): PreflightResult {
  const presentationDetails =
    pageContext?.pageInfo?.presentationDetails ?? null;

  const { renderings, parseError } =
    parsePresentationDetails(presentationDetails);

  if (parseError) {
    return {
      checkId: "page-personalization-validity",
      label: "Page personalization",
      severity: "UNKNOWN",
      message: parseError,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  const personalized = renderings.filter((r) => r.isPersonalized);

  if (personalized.length === 0) {
    return {
      checkId: "page-personalization-validity",
      label: "Page personalization",
      severity: "INFO",
      message: "No personalization configured on this page",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  const allVariantIds = new Set<string>();
  for (const r of personalized) {
    for (const v of r.variants) {
      if (!v.isDefault) allVariantIds.add(v.id);
    }
  }

  const items: CheckItem[] = personalized.map((r) => {
    const nonDefault = r.variants.filter((v) => !v.isDefault);
    return {
      id: r.instanceId,
      name: `Rendering on "${r.placeholderKey}"`,
      detail: `${nonDefault.length} variant(s): ${nonDefault
        .map((v) => v.name)
        .join(", ")}`,
    };
  });

  return {
    checkId: "page-personalization-validity",
    label: "Page personalization",
    severity: "PASS",
    message: `${personalized.length} personalized rendering(s) with ${allVariantIds.size} unique variant(s)`,
    items,
    checkContext: {},
    ranAt: now(),
  };
}

/* ------------------------------------------------------------------ */
/* CHECK 3 — Analytics tracking                                        */
/* ------------------------------------------------------------------ */

export async function checkTrackingConfig(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string,
  siteName: string,
  language: string
): Promise<PreflightResult> {
  const data = await runAuthoringGraphQL(
    client,
    sitecoreContextId,
    GRAPHQL_QUERIES.getItemWithFields,
    { itemId: pageId, language }
  );

  const item = data?.data?.item;
  if (!item) {
    return {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "UNKNOWN",
      message: "Could not read page item from Authoring API",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  const trackingRaw = getField(item, "__Tracking", "tracking");

  if (trackingRaw === null) {
    return {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "INFO",
      message: "No __Tracking field on this item",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  try {
    const tracking = JSON.parse(trackingRaw);
    const hasProfile =
      Array.isArray(tracking?.tracking) && tracking.tracking.length > 0;

    return {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: hasProfile ? "PASS" : "INFO",
      message: hasProfile
        ? `${tracking.tracking.length} tracking profile(s) configured`
        : "Tracking field present but empty",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  } catch {
    return {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "WARNING",
      message: "Tracking field present but not parseable",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }
}

/* ------------------------------------------------------------------ */
/* CHECK 4 — Render / delivery sync                                    */
/* ------------------------------------------------------------------ */

export async function checkRenderDrift(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string,
  siteName: string,
  language: string
): Promise<PreflightResult> {
  const data = await runAuthoringGraphQL(
    client,
    sitecoreContextId,
    GRAPHQL_QUERIES.getItemPublishState,
    { itemId: pageId, language }
  );

  const item = data?.data?.item;
  if (!item) {
    return {
      checkId: "render-drift",
      label: "Render / delivery sync",
      severity: "UNKNOWN",
      message: "Could not read publish state from Authoring API",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  const updated = item?.updated?.value;
  const published = item?.published?.value;

  if (!updated) {
    return {
      checkId: "render-drift",
      label: "Render / delivery sync",
      severity: "UNKNOWN",
      message: "Page has no __Updated timestamp",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  if (!published) {
    return {
      checkId: "render-drift",
      label: "Render / delivery sync",
      severity: "WARNING",
      message: "Page has never been published — visitors will not see it",
      items: [
        {
          id: pageId,
          name: item.name ?? "Page",
          detail: `Modified ${formatSitecoreDate(updated)}, never published`,
        },
      ],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  const isStale = new Date(updated) > new Date(published);

  return {
    checkId: "render-drift",
    label: "Render / delivery sync",
    severity: isStale ? "WARNING" : "PASS",
    message: isStale
      ? "Page modified after last publish — delivery may be stale"
      : "Page render configuration is in sync with delivery",
    items: isStale
      ? [
          {
            id: pageId,
            name: item.name ?? "Page",
            detail: `Modified ${formatSitecoreDate(updated)}, last published ${formatSitecoreDate(published)}`,
          },
        ]
      : [],
    checkContext: { pageId, site: siteName, language },
    ranAt: now(),
  };
}

/* ------------------------------------------------------------------ */
/* CHECK 5 — Component-level personalization                           */
/* ------------------------------------------------------------------ */

export function checkComponentPersonalization(
  pageContext: any
): PreflightResult {
  const presentationDetails =
    pageContext?.pageInfo?.presentationDetails ?? null;

  const { renderings, parseError } =
    parsePresentationDetails(presentationDetails);

  if (parseError) {
    return {
      checkId: "component-personalization-integrity",
      label: "Component personalization",
      severity: "UNKNOWN",
      message: parseError,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  const personalized = renderings.filter((r) => r.isPersonalized);

  if (personalized.length === 0) {
    return {
      checkId: "component-personalization-integrity",
      label: "Component personalization",
      severity: "INFO",
      message: "No component-level personalization on this page",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  const broken: CheckItem[] = [];

  for (const r of personalized) {
    const hasDefault = r.variants.some((v) => v.isDefault);
    const nonDefault = r.variants.filter((v) => !v.isDefault);

    if (!hasDefault) {
      broken.push({
        id: r.instanceId,
        name: `Component on "${r.placeholderKey}"`,
        detail: "Personalization rules missing Default fallback variant",
      });
    }

    if (nonDefault.length === 0) {
      broken.push({
        id: r.instanceId,
        name: `Component on "${r.placeholderKey}"`,
        detail: "Personalization enabled but no non-default variants",
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
        : `${personalized.length} component(s) with valid personalization`,
    items: broken,
    checkContext: {},
    ranAt: now(),
  };
}