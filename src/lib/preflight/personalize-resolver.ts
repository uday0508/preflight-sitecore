import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { diag } from "./diagnostics";

export interface VariantMapping {
  variantId: string;
  variantName: string;
  audienceName: string;
  conditionSummary: string;
}

export async function resolveVariantMappings(
  client: ClientSDK,
  sitecoreContextId: string,
  pageId: string
): Promise<Map<string, VariantMapping>> {
  const result = new Map<string, VariantMapping>();

  try {
    diag.log(`fetching personalization versions for page ${pageId.slice(0, 8)}`);

    const { data } = await client.query(
      "xmc.agent.personalizationGetPersonalizationVersionsByPage",
      {
        params: {
          query: { sitecoreContextId },
          path: { pageId },
        },
      }
    );

    const payload = data as any;
    const items = payload?.data ?? [];

    diag.log(`Agent API returned ${items.length} personalization versions`);

    for (const item of items) {
      let variantId: string | null = null;
      try {
        const parsed = JSON.parse(item.template ?? "{}");
        variantId = parsed.variantId ?? null;
      } catch {
        continue;
      }

      if (!variantId) continue;

      result.set(variantId, {
        variantId,
        variantName: item.variant_name ?? "Unnamed variant",
        audienceName: item.audience_name ?? item.variant_name ?? "Audience",
        conditionSummary: summarizeConditions(item.condition_groups),
      });
    }

    diag.table(
      "Personalization variant mappings",
      Array.from(result.values()).map((v) => ({
        variantId: v.variantId.slice(0, 8),
        name: v.variantName,
        condition: v.conditionSummary,
      }))
    );

    return result;
  } catch (err) {
    diag.warn("Agent API personalization fetch failed", err);
    return result;
  }
}

function summarizeConditions(conditionGroups: any[]): string {
  if (!Array.isArray(conditionGroups) || conditionGroups.length === 0) {
    return "Always";
  }

  const parts: string[] = [];

  for (const group of conditionGroups) {
    for (const condition of group?.conditions ?? []) {
      const templateId = condition?.templateId;
      const params = condition?.params ?? {};

      if (templateId === "utm_value") {
        const type = params["type"] ?? "source";
        const value = params["UTM value"] ?? "";
        if (value) parts.push(`UTM ${type} = ${value}`);
      } else if (templateId === "new_or_returning_visitor") {
        const type = params["type"] ?? "new";
        parts.push(type === "new" ? "First-time visitors" : "Returning visitors");
      } else if (templateId) {
        parts.push(templateId.replace(/_/g, " "));
      }
    }
  }

  return parts.length > 0 ? parts.join(" · ") : "Always";
}