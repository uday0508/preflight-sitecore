import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { PreflightResult, CheckItem } from "./types";
import { GRAPHQL_QUERIES } from "@/lib/sitecore/queries";
import { formatSitecoreDate } from "@/lib/utils";
import {
  parsePresentationDetails,
  isDynamicPlaceholder,
  readablePlaceholder,
  readableDatasource,
} from "./parser";
import { resolveItemNames } from "./resolver";

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
      label: "Dynamic placeholders",
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
      label: "Dynamic placeholders",
      severity: "INFO",
      message: "This page has no placeholders yet",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  const dynamicKeys = placeholderKeys.filter(isDynamicPlaceholder);

  if (dynamicKeys.length === 0) {
    return {
      checkId: "dynamic-placeholder-consistency",
      label: "Dynamic placeholders",
      severity: "PASS",
      message: `${placeholderKeys.length} placeholders, all standard layout`,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  return {
    checkId: "dynamic-placeholder-consistency",
    label: "Dynamic placeholders",
    severity: "PASS",
    message: `${dynamicKeys.length} dynamic placeholder${
      dynamicKeys.length === 1 ? "" : "s"
    } ready for personalization`,
    items: dynamicKeys.map((k) => ({
      id: k,
      name: readablePlaceholder(k),
      detail: "Ready to hold different content per visitor",
    })),
    checkContext: {},
    ranAt: now(),
  };
}

/* ------------------------------------------------------------------ */
/* CHECK 2 — Page personalization                                      */
/* ------------------------------------------------------------------ */

export async function checkPagePersonalization(
  client: ClientSDK,
  sitecoreContextId: string,
  pageContext: any
): Promise<PreflightResult> {
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
      message: "Every visitor sees the same content on this page",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  // Collect all GUIDs referenced in actions so we can resolve them
  const guidsToResolve = new Set<string>();
  for (const r of personalized) {
    for (const v of r.variants) {
      for (const a of v.actions) {
        if (a.targetId && /^[0-9a-f-]{36}$/i.test(a.targetId)) {
          guidsToResolve.add(a.targetId);
        } else if (a.targetId && /^[0-9a-f]{8}-/i.test(a.targetId)) {
          guidsToResolve.add(a.targetId);
        }
      }
    }
  }

  let nameMap = new Map<string, string | null>();
  if (guidsToResolve.size > 0) {
    nameMap = await resolveItemNames(
      client,
      sitecoreContextId,
      Array.from(guidsToResolve)
    );
  }

  const items: CheckItem[] = [];
  const audiences = new Set<string>();

  for (const r of personalized) {
    const phName = readablePlaceholder(r.placeholderKey);
    const currentDs = readableDatasource(r.dataSource);
    const hasDefault = r.variants.some((v) => v.isDefault);
    const nonDefault = r.variants.filter((v) => !v.isDefault);

    if (nonDefault.length === 0) continue;

    const lines: string[] = [];

    for (const v of nonDefault) {
      const audience = v.audienceHint ?? "Targeted visitors";
      audiences.add(audience);

      // Summarize actions into marketer language
      const actionSummaries: string[] = [];
      for (const a of v.actions) {
        if (a.type === "hide") {
          actionSummaries.push("Hides this component");
        } else if (a.type === "datasource") {
          const resolved = a.targetId ? nameMap.get(a.targetId) : null;
          const name =
            resolved ??
            (a.targetId ? readableDatasource(a.targetId) : "different content");
          actionSummaries.push(`Shows "${name}"`);
        } else if (a.type === "rendering") {
          const resolved = a.targetId ? nameMap.get(a.targetId) : null;
          const name =
            resolved ??
            (a.targetId ? `component ${a.targetId.slice(0, 8)}` : "different component");
          actionSummaries.push(`Swaps to "${name}"`);
        } else if (a.type === "parameters") {
          actionSummaries.push("Adjusts styling");
        }
      }

      const actionText =
        actionSummaries.length > 0
          ? actionSummaries.join(" · ")
          : "No visible change";

      lines.push(`${audience} → ${actionText}`);
    }

    if (!hasDefault) {
      lines.unshift(
        "⚠ No default — visitors who don't match see a blank space"
      );
    }

    items.push({
      id: r.instanceId,
      name: `${phName}: ${currentDs}`,
      detail: lines.join("\n"),
    });
  }

  const audienceText =
    audiences.size === 1
      ? "1 audience targeted"
      : `${audiences.size} audiences targeted`;

  return {
    checkId: "page-personalization-validity",
    label: "Page personalization",
    severity: "PASS",
    message: `${items.length} component${
      items.length === 1 ? "" : "s"
    } personalized, ${audienceText}`,
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
      message: "Could not read this page from Sitecore",
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
      message: "No page-specific tracking profile — site defaults will apply",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  try {
    const tracking = JSON.parse(trackingRaw);
    const profiles = tracking?.tracking ?? [];

    if (profiles.length === 0) {
      return {
        checkId: "analytics-tracking-config",
        label: "Analytics tracking",
        severity: "INFO",
        message: "Tracking is on but no profiles attached to this page",
        items: [],
        checkContext: { pageId, site: siteName, language },
        ranAt: now(),
      };
    }

    return {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "PASS",
      message: `${profiles.length} tracking profile${
        profiles.length === 1 ? "" : "s"
      } will capture visitor activity`,
      items: profiles.map((p: any, i: number) => ({
        id: p?.id ?? `profile-${i}`,
        name: p?.name ?? `Profile ${i + 1}`,
        detail: "Events from this page flow into this profile",
      })),
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  } catch {
    return {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "WARNING",
      message:
        "Tracking data is present but unreadable — analytics may not capture this page",
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
      label: "Publish status",
      severity: "UNKNOWN",
      message: "Could not read publish status from Sitecore",
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
      label: "Publish status",
      severity: "UNKNOWN",
      message: "This page has no edit history",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  if (!published) {
    return {
      checkId: "render-drift",
      label: "Publish status",
      severity: "WARNING",
      message:
        "This page has never been published — visitors cannot see it yet",
      items: [
        {
          id: pageId,
          name: item.name ?? "Page",
          detail: `Last edited ${formatSitecoreDate(updated)}, never published`,
        },
      ],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  const isStale = new Date(updated) > new Date(published);

  if (isStale) {
    return {
      checkId: "render-drift",
      label: "Publish status",
      severity: "WARNING",
      message:
        "Edits since last publish — visitors still see the older version",
      items: [
        {
          id: pageId,
          name: item.name ?? "Page",
          detail: `Edited ${formatSitecoreDate(updated)}, last published ${formatSitecoreDate(published)}`,
        },
      ],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
  }

  return {
    checkId: "render-drift",
    label: "Publish status",
    severity: "PASS",
    message: `Live version is up to date (published ${formatSitecoreDate(published)})`,
    items: [],
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
      label: "Personalization safety",
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
      label: "Personalization safety",
      severity: "INFO",
      message: "No personalization to verify on this page",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  const issues: CheckItem[] = [];

  for (const r of personalized) {
    const phName = readablePlaceholder(r.placeholderKey);
    const dsName = readableDatasource(r.dataSource);
    const hasDefault = r.variants.some((v) => v.isDefault);
    const nonDefault = r.variants.filter((v) => !v.isDefault);

    if (!hasDefault) {
      issues.push({
        id: `${r.instanceId}-no-default`,
        name: `${phName}: ${dsName}`,
        detail:
          "Visitors who don't match any rule will see a blank space — add a default variant",
      });
    }

    if (nonDefault.length === 0) {
      issues.push({
        id: `${r.instanceId}-no-variants`,
        name: `${phName}: ${dsName}`,
        detail:
          "Personalization is on but no targeted variants exist — no one will see different content",
      });
    }
  }

  if (issues.length === 0) {
    return {
      checkId: "component-personalization-integrity",
      label: "Personalization safety",
      severity: "PASS",
      message: `All ${personalized.length} personalized component${
        personalized.length === 1 ? "" : "s"
      } have a safe default`,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
  }

  return {
    checkId: "component-personalization-integrity",
    label: "Personalization safety",
    severity: "BLOCKER",
    message: `${issues.length} issue${
      issues.length === 1 ? "" : "s"
    } — visitors may see blank or wrong content`,
    items: issues,
    checkContext: {},
    ranAt: now(),
  };
}