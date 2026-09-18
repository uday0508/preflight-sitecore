import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { diag } from "./diagnostics";

export interface VariantMapping {
  variantId: string;
  variantName: string;
  audienceName: string;
  conditionSummary: string;
}

const CDP_DIRECT_BASE = "https://api-sg-cdpp.sitecorecloud.io";
const CDP_PROXY_BASE = "/api/cdp";

export async function resolveVariantMappings(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string
): Promise<Map<string, VariantMapping>> {
  const params = new URLSearchParams({
    flowType: "component,embedded",
    limit: "1000",
    offset: "0",
    expand: "true",
    search: pageId.replace(/-/g, ""),
  });

  const query = params.toString();

  // Path 1 — proxy (dev)
  const proxyResult = await tryFetch(
    `${CDP_PROXY_BASE}/v3/flowDefinitions/?${query}`,
    "proxy"
  );
  if (proxyResult) return buildMap(proxyResult);

  // Path 2 — direct (production, only if CORS allows)
  const directResult = await tryFetch(
    `${CDP_DIRECT_BASE}/v3/flowDefinitions/?${query}`,
    "direct",
    { "x-sitecore-contextid": sitecoreContextId }
  );
  if (directResult) return buildMap(directResult);

  diag.warn(
    "CDP variant resolution unavailable — falling back to generic labels"
  );
  return new Map();
}

async function tryFetch(
  url: string,
  mode: string,
  extraHeaders: Record<string, string> = {}
): Promise<any | null> {
  try {
    diag.log(`CDP fetch [${mode}]`, url);
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", ...extraHeaders },
    });

    if (!response.ok) {
      diag.warn(`CDP [${mode}] returned ${response.status}`);
      return null;
    }

    const payload = await response.json();
    diag.log(`CDP [${mode}] returned ${payload?.items?.length ?? 0} items`);
    return payload;
  } catch (err) {
    diag.warn(`CDP [${mode}] failed`, err);
    return null;
  }
}

function buildMap(payload: any): Map<string, VariantMapping> {
  const result = new Map<string, VariantMapping>();
  const items = payload?.items ?? [];

  for (const flow of items) {
    const splits = flow?.traffic?.splits ?? [];
    for (const split of splits) {
      let variantId: string | null = null;
      try {
        const parsed = JSON.parse(split.template ?? "{}");
        variantId = parsed.variantId ?? null;
      } catch {
        continue;
      }
      if (!variantId) continue;

      result.set(variantId, {
        variantId,
        variantName: split.variantName ?? "Unnamed variant",
        audienceName: split.audienceName ?? split.variantName ?? "Audience",
        conditionSummary: summarizeConditions(split.conditionGroups),
      });
    }
  }

  diag.table(
    "CDP variant mappings",
    Array.from(result.values()).map((v) => ({
      variantId: v.variantId.slice(0, 8),
      name: v.variantName,
      condition: v.conditionSummary,
    }))
  );

  return result;
}

function summarizeConditions(conditionGroups: any[]): string {
  if (!Array.isArray(conditionGroups) || conditionGroups.length === 0) {
    return "Always";
  }

  const parts: string[] = [];
  for (const group of conditionGroups) {
    for (const condition of group?.conditions ?? []) {
      if (condition?.templateId === "utm_value") {
        const type = condition.params?.type ?? "source";
        const value = condition.params?.["UTM value"] ?? "";
        if (value) parts.push(`UTM ${type} = ${value}`);
      } else if (condition?.templateId) {
        parts.push(condition.templateId);
      }
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "Always";
}