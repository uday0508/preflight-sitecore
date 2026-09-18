/**
 * Parser for Sitecore's presentationDetails JSON string.
 * Also provides human-readable formatting helpers for marketer-facing output.
 */

export interface ParsedAction {
  type: "datasource" | "rendering" | "parameters" | "hide" | "unknown";
  targetId: string | null;
  targetName: string | null; // populated later by resolver
  detail: string;
}

export interface ParsedVariant {
  id: string;
  name: string;
  isDefault: boolean;
  audienceHint: string | null;
  actions: ParsedAction[];
}

export interface ParsedRendering {
  renderingId: string;
  instanceId: string;
  placeholderKey: string;
  dataSource: string | null;
  parameters: Record<string, string>;
  variants: ParsedVariant[];
  isPersonalized: boolean;
}

export interface ParsedPresentation {
  renderings: ParsedRendering[];
  placeholderKeys: string[];
  parseError: string | null;
}

const DEFAULT_VARIANT_UID = "{00000000-0000-0000-0000-000000000000}";

const ACTION_TYPES: Record<string, ParsedAction["type"]> = {
  "{0F3C6BEC-E56B-4875-93D7-2846A75881D2}": "datasource",
  "{7B578B65-BD2F-4C7C-9A24-DAE3E98B4F23}": "rendering",
  "{525C7B5A-8FD2-4B99-89F6-4F3F6D23BB02}": "parameters",
  "{B4A4B7B4-5B4B-4B4B-9B4B-4B4B4B4B4B4B}": "hide",
};

const PLACEHOLDER_FRIENDLY_NAMES: Record<string, string> = {
  "headless-main": "Main content",
  "headless-header": "Header",
  "headless-footer": "Footer",
  "headless-sidebar": "Sidebar",
};

function extractAudienceHint(conditionsXml: string): string | null {
  if (!conditionsXml) return null;

  const conditionMap: Record<string, string> = {
    "{8E7426A4-12ED-4C44-8625-E7191860E726}": "Campaign visitors",
    "{4888ABBB-F17D-4485-B14B-842413F88732}": "Default (everyone)",
    "{F7EBB0F4-A3DC-4C95-9C79-1D1F420B3C6B}": "Returning customers",
    "{4A23B384-130A-400D-AB99-FB7210D3A71E}": "Event registrants",
  };

  for (const [guid, friendly] of Object.entries(conditionMap)) {
    if (conditionsXml.includes(guid)) return friendly;
  }

  const variantMatch = conditionsXml.match(/VariantName="([^"]+)"/);
  if (variantMatch) return `Audience: ${variantMatch[1].slice(0, 8)}`;

  const uidMatch = conditionsXml.match(/condition uid="([^"]+)"/);
  if (uidMatch) return `Rule ${uidMatch[1].slice(0, 8)}`;

  return null;
}

function extractVariantNameFromConditions(conditionsXml: string): string | null {
  const match = conditionsXml?.match(/VariantName="([^"]+)"/);
  return match ? match[1] : null;
}

function parseActions(actions: any[]): ParsedAction[] {
  if (!Array.isArray(actions)) return [];

  return actions.map((a: any) => {
    const type = ACTION_TYPES[a?.id] ?? "unknown";

    if (type === "datasource") {
      const ds = a?.dataSource ?? null;
      return {
        type: "datasource",
        targetId: ds,
        targetName: null,
        detail: ds ? `Swap content to ${readableDatasource(ds)}` : "Swap content",
      };
    }

    if (type === "rendering") {
      const rid = a?.renderingItem ?? null;
      return {
        type: "rendering",
        targetId: rid,
        targetName: null,
        detail: rid
          ? `Swap component (rendering ${rid.slice(0, 8)})`
          : "Swap component",
      };
    }

    if (type === "parameters") {
      return {
        type: "parameters",
        targetId: null,
        targetName: null,
        detail: "Adjust component styling",
      };
    }

    if (type === "hide") {
      return {
        type: "hide",
        targetId: null,
        targetName: null,
        detail: "Hide this component for the audience",
      };
    }

    return {
      type: "unknown",
      targetId: a?.id ?? null,
      targetName: null,
      detail: "Unrecognized action",
    };
  });
}

export function readablePlaceholder(key: string): string {
  if (!key) return "Unknown placeholder";
  const base = key.replace(/-\d+$/, "").replace(/\/[^/]+$/, "");
  return PLACEHOLDER_FRIENDLY_NAMES[base] ?? PLACEHOLDER_FRIENDLY_NAMES[key] ?? key;
}

export function readableDatasource(ds: string | null): string {
  if (!ds) return "no datasource";
  if (ds.startsWith("local:/Data/")) return ds.replace("local:/Data/", "");
  if (ds.startsWith("local:")) return ds.replace("local:", "");
  if (/^[0-9a-f]{8}-/i.test(ds)) return `item ${ds.slice(0, 8)}`;
  return ds;
}

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
              audienceHint: extractAudienceHint(rule?.conditions ?? ""),
              actions: parseActions(rule?.actions ?? []),
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

export function isDynamicPlaceholder(key: string): boolean {
  return /_\{[0-9A-F-]{36}\}$/i.test(key) || /-\d+$/.test(key);
}