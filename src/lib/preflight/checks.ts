import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import type { PreflightResult, CheckItem, VariantDisplay } from "./types";
import { GRAPHQL_QUERIES } from "@/lib/sitecore/queries";
import { formatSitecoreDate } from "@/lib/utils";
import {
  parsePresentationDetails,
  isDynamicPlaceholder,
  readablePlaceholder,
  readableDatasource,
} from "./parser";
import { diag, dumpCheckResult } from "./diagnostics";
import { buildPersonalizeUrl } from "./personalize-url";
import type { PreflightContext } from "./context";

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

/**
 * Reads the raw actions and produces a human-readable summary of what
 * this variant changes. Uses rendering parameters (FormId, Styles)
 * and datasource paths that are already meaningful to marketers.
 */
function summarizeOutcome(rawActions: any[]): string {
  if (!Array.isArray(rawActions) || rawActions.length === 0) {
    return "Same as default";
  }

  const parts: string[] = [];

  for (const action of rawActions) {
    const id = action?.id;

    if (
      id === "{B4A4B7B4-5B4B-4B4B-9B4B-4B4B4B4B4B4B}" ||
      id === "{6879B56F-9B0C-4B8F-9E6E-A12FCEBB71B0}" ||
      id === "{F5C9C8D3-2EE6-4A3B-9C21-5E3B1A1C8F4E}"
    ) {
      return "Hidden";
    }

    if (id === "{0F3C6BEC-E56B-4875-93D7-2846A75881D2}") {
      const ds = action?.dataSource;
      if (typeof ds === "string" && ds.startsWith("local:")) {
        const name = ds
          .replace(/^local:\/?\/?Data\//i, "")
          .replace(/^local:\/?/, "");
        parts.push(`content "${name}"`);
      } else if (typeof ds === "string" && /^[0-9a-f-]{36}$/i.test(ds)) {
        parts.push("different content");
      }
    }

    if (id === "{7B578B65-BD2F-4C7C-9A24-DAE3E98B4F23}") {
      parts.push("different component");
    }

    if (id === "{525C7B5A-8FD2-4B99-89F6-4F3F6D23BB02}") {
      const params = action?.renderingParameters ?? {};
      if (params.FormId) {
        parts.push(`form ${String(params.FormId).split("-")[0]}`);
      }
      if (params.Styles) parts.push(`style "${params.Styles}"`);
      if (params.CSSStyles) parts.push(`css "${params.CSSStyles}"`);
    }
  }

  const unique = Array.from(new Set(parts));
  return unique.length > 0 ? unique.join(" · ") : "Same as default";
}

/* ------------------------------------------------------------------ */
/* CHECK 1 — Dynamic placeholders                                      */
/* ------------------------------------------------------------------ */

export function checkDynamicPlaceholders(pageContext: any): PreflightResult {
  const presentationDetails =
    pageContext?.pageInfo?.presentationDetails ?? null;

  const { placeholderKeys, parseError } =
    parsePresentationDetails(presentationDetails);

  if (parseError) {
    const result: PreflightResult = {
      checkId: "dynamic-placeholder-consistency",
      label: "Dynamic placeholders",
      severity: "UNKNOWN",
      message: parseError,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  if (placeholderKeys.length === 0) {
    const result: PreflightResult = {
      checkId: "dynamic-placeholder-consistency",
      label: "Dynamic placeholders",
      severity: "INFO",
      message: "No placeholders on this page",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  const dynamicKeys = placeholderKeys.filter(isDynamicPlaceholder);

  const result: PreflightResult = {
    checkId: "dynamic-placeholder-consistency",
    label: "Dynamic placeholders",
    severity: "PASS",
    message:
      dynamicKeys.length === 0
        ? `${placeholderKeys.length} standard placeholders`
        : `${dynamicKeys.length} dynamic placeholder${
            dynamicKeys.length === 1 ? "" : "s"
          }`,
    items: dynamicKeys.map((k) => ({
      id: k,
      name: readablePlaceholder(k),
      detail: "Ready for personalization",
    })),
    checkContext: {},
    ranAt: now(),
  };
  dumpCheckResult(result.checkId, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* CHECK 2 — Page personalization                                      */
/* ------------------------------------------------------------------ */

export async function checkPagePersonalization(
  client: ClientSDK,
  sitecoreContextId: string,
  pageContext: any,
  pageHtml: string | null,
  context: PreflightContext
): Promise<PreflightResult> {
  const presentationDetails =
    pageContext?.pageInfo?.presentationDetails ?? null;

  const { renderings, parseError } =
    parsePresentationDetails(presentationDetails);

  if (parseError) {
    const result: PreflightResult = {
      checkId: "page-personalization-validity",
      label: "Page personalization",
      severity: "UNKNOWN",
      message: parseError,
      items: [],
      checkContext: { pageId: context.pageId ?? undefined },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  const personalized = renderings.filter((r) => r.isPersonalized);

  if (personalized.length === 0) {
    const result: PreflightResult = {
      checkId: "page-personalization-validity",
      label: "Page personalization",
      severity: "INFO",
      message: "Same content for every visitor",
      items: [],
      checkContext: { pageId: context.pageId ?? undefined },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  // The personalize URL is page-scoped — same for every variant on the page.
  const personalizeUrl = buildPersonalizeUrl({
    pageId: context.pageId,
    language: context.language,
    siteName: context.siteName,
    version: context.version,
    organizationId: context.organizationId,
    tenantName: context.tenantName,
  });

  const items: CheckItem[] = [];
  let totalAudiences = 0;

  for (const r of personalized) {
    const phName = readablePlaceholder(r.placeholderKey);
    const currentDs = readableDatasource(r.dataSource);
    const nonDefault = r.variants.filter((v) => !v.isDefault);
    const defaultVariant = r.variants.find((v) => v.isDefault);

    if (nonDefault.length === 0) continue;

    totalAudiences += nonDefault.length;

    const variantDisplays: VariantDisplay[] = [];

    if (defaultVariant) {
      variantDisplays.push({
        label: "Default",
        audience: "Everyone",
        outcome: currentDs,
        isDefault: true,
        personalizeUrl: null,
      });
    }

    nonDefault.forEach((v, idx) => {
      const letter = String.fromCharCode(65 + idx);
      const outcome = summarizeOutcome(v.rawActions);

      variantDisplays.push({
        label: `Variant ${letter}`,
        audience: v.audienceHint ?? "Targeted visitors",
        outcome,
        isDefault: false,
        personalizeUrl,
      });
    });

    items.push({
      id: r.instanceId,
      name: `${phName} — ${currentDs}`,
      detail: "",
      variants: variantDisplays,
    });
  }

  if (items.length === 0) {
    const result: PreflightResult = {
      checkId: "page-personalization-validity",
      label: "Page personalization",
      severity: "INFO",
      message: "No variants configured on personalized components",
      items: [],
      checkContext: { pageId: context.pageId ?? undefined },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  const audienceText =
    totalAudiences === 1 ? "1 audience" : `${totalAudiences} audiences`;

  const result: PreflightResult = {
    checkId: "page-personalization-validity",
    label: "Page personalization",
    severity: "PASS",
    message: `${items.length} component${
      items.length === 1 ? "" : "s"
    } personalized, ${audienceText}`,
    items,
    checkContext: { pageId: context.pageId ?? undefined },
    ranAt: now(),
  };
  dumpCheckResult(result.checkId, result);
  return result;
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
    const result: PreflightResult = {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "UNKNOWN",
      message: "Could not read this page",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  const trackingRaw = getField(item, "__Tracking", "tracking");

  if (trackingRaw === null) {
    const result: PreflightResult = {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "INFO",
      message: "Site defaults apply",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  try {
    const tracking = JSON.parse(trackingRaw);
    const profiles = tracking?.tracking ?? [];

    const result: PreflightResult = {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: profiles.length > 0 ? "PASS" : "INFO",
      message:
        profiles.length > 0
          ? `${profiles.length} profile${
              profiles.length === 1 ? "" : "s"
            } tracking activity`
          : "No profiles attached",
      items: profiles.map((p: any, i: number) => ({
        id: p?.id ?? `profile-${i}`,
        name: p?.name ?? `Profile ${i + 1}`,
        detail: "Captures visitor activity on this page",
      })),
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  } catch {
    const result: PreflightResult = {
      checkId: "analytics-tracking-config",
      label: "Analytics tracking",
      severity: "WARNING",
      message: "Tracking data unreadable",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }
}

/* ------------------------------------------------------------------ */
/* CHECK 4 — Publish status                                            */
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
    const result: PreflightResult = {
      checkId: "render-drift",
      label: "Publish status",
      severity: "UNKNOWN",
      message: "Could not read publish status",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  const updated = item?.updated?.value;
  const published = item?.published?.value;

  if (!updated) {
    const result: PreflightResult = {
      checkId: "render-drift",
      label: "Publish status",
      severity: "UNKNOWN",
      message: "No edit history",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  if (!published) {
    const result: PreflightResult = {
      checkId: "render-drift",
      label: "Publish status",
      severity: "WARNING",
      message: "Never published — visitors see nothing",
      items: [
        {
          id: pageId,
          name: item.name ?? "Page",
          detail: `Last edited ${formatSitecoreDate(updated)}`,
        },
      ],
      checkContext: { pageId, site: siteName, language },
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  const isStale = new Date(updated) > new Date(published);

  const result: PreflightResult = {
    checkId: "render-drift",
    label: "Publish status",
    severity: isStale ? "WARNING" : "PASS",
    message: isStale
      ? "Edits since last publish"
      : `Up to date — live since ${formatSitecoreDate(published)}`,
    items: isStale
      ? [
          {
            id: pageId,
            name: item.name ?? "Page",
            detail: `Edited ${formatSitecoreDate(updated)}, live since ${formatSitecoreDate(published)}`,
          },
        ]
      : [],
    checkContext: { pageId, site: siteName, language },
    ranAt: now(),
  };
  dumpCheckResult(result.checkId, result);
  return result;
}

/* ------------------------------------------------------------------ */
/* CHECK 5 — Personalization safety                                    */
/* ------------------------------------------------------------------ */

export function checkComponentPersonalization(
  pageContext: any
): PreflightResult {
  const presentationDetails =
    pageContext?.pageInfo?.presentationDetails ?? null;

  const { renderings, parseError } =
    parsePresentationDetails(presentationDetails);

  if (parseError) {
    const result: PreflightResult = {
      checkId: "component-personalization-integrity",
      label: "Personalization safety",
      severity: "UNKNOWN",
      message: parseError,
      items: [],
      checkContext: {},
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
  }

  const personalized = renderings.filter((r) => r.isPersonalized);

  if (personalized.length === 0) {
    const result: PreflightResult = {
      checkId: "component-personalization-integrity",
      label: "Personalization safety",
      severity: "INFO",
      message: "Nothing to verify",
      items: [],
      checkContext: {},
      ranAt: now(),
    };
    dumpCheckResult(result.checkId, result);
    return result;
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
        name: `${phName} — ${dsName}`,
        detail:
          "Visitors who match no rule will see a blank space. Add a default variant.",
      });
    }

    if (nonDefault.length === 0) {
      issues.push({
        id: `${r.instanceId}-no-variants`,
        name: `${phName} — ${dsName}`,
        detail:
          "Personalization is on but no targeted variants exist. No one will see different content.",
      });
    }
  }

  const result: PreflightResult = {
    checkId: "component-personalization-integrity",
    label: "Personalization safety",
    severity: issues.length > 0 ? "BLOCKER" : "PASS",
    message:
      issues.length > 0
        ? `${issues.length} issue${issues.length === 1 ? "" : "s"} found`
        : `All ${personalized.length} component${
            personalized.length === 1 ? "" : "s"
          } safe`,
    items: issues,
    checkContext: {},
    ranAt: now(),
  };
  dumpCheckResult(result.checkId, result);
  return result;
}