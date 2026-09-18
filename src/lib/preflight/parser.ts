/**
 * Parser for Sitecore's presentationDetails JSON string.
 * Handles the real shape returned by pages.context.
 */

export interface ParsedRendering {
  renderingId: string;
  instanceId: string;
  placeholderKey: string;
  dataSource: string | null;
  parameters: Record<string, string>;
  variants: ParsedVariant[];
  isPersonalized: boolean;
}

export interface ParsedVariant {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface ParsedPresentation {
  renderings: ParsedRendering[];
  placeholderKeys: string[];
  parseError: string | null;
}

const DEFAULT_VARIANT_UID = "{00000000-0000-0000-0000-000000000000}";

function extractVariantNameFromConditions(conditionsXml: string): string | null {
  const match = conditionsXml?.match(/VariantName="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Parses presentationDetails JSON string into structured data.
 */
export function parsePresentationDetails(
  presentationDetails: string | null | undefined
): ParsedPresentation {
  if (!presentationDetails) {
    return { renderings: [], placeholderKeys: [], parseError: null };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(presentationDetails);
  } catch {
    return {
      renderings: [],
      placeholderKeys: [],
      parseError: "presentationDetails is not valid JSON",
    };
  }

  const renderings: ParsedRendering[] = [];
  const placeholderSet = new Set<string>();

  for (const device of parsed?.devices ?? []) {
    for (const ph of device.placeholders ?? []) {
      if (ph?.key) placeholderSet.add(ph.key);
    }

    for (const r of device.renderings ?? []) {
      const placeholderKey = r.placeholderKey ?? "";
      if (placeholderKey) placeholderSet.add(placeholderKey);

      const rules = r?.personalization?.ruleSet?.rules ?? [];
      const variants: ParsedVariant[] = Array.isArray(rules)
        ? rules.map((rule: any) => {
            const nameFromConditions = extractVariantNameFromConditions(
              rule?.conditions ?? ""
            );
            const isDefault = rule?.uniqueId === DEFAULT_VARIANT_UID;
            return {
              id: nameFromConditions ?? rule?.uniqueId ?? "unknown",
              name: rule?.name ?? nameFromConditions ?? "Unnamed variant",
              isDefault,
            };
          })
        : [];

      renderings.push({
        renderingId: r.id ?? "",
        instanceId: r.instanceId ?? "",
        placeholderKey,
        dataSource: r.dataSource ?? null,
        parameters: r.parameters ?? {},
        variants,
        isPersonalized: variants.length > 0,
      });
    }
  }

  return {
    renderings,
    placeholderKeys: Array.from(placeholderSet),
    parseError: null,
  };
}

/**
 * Detects dynamic placeholders — keys ending in _{GUID} or -N suffix.
 */
export function isDynamicPlaceholder(key: string): boolean {
  return /_\{[0-9A-F-]{36}\}$/i.test(key) || /-\d+$/.test(key);
}