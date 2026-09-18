export interface ParsedAction {
  type: "datasource" | "rendering" | "parameters" | "hide" | "unknown";
  targetId: string | null;
  targetName: string | null;
  detail: string;
  rawActionId: string | null;
}

export interface ParsedVariant {
  id: string;
  name: string;
  isDefault: boolean;
  audienceHint: string | null;
  actions: ParsedAction[];
  rawActions: any[];
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
  "{6879B56F-9B0C-4B8F-9E6E-A12FCEBB71B0}": "hide",
  "{F5C9C8D3-2EE6-4A3B-9C21-5E3B1A1C8F4E}": "hide",
};

const PLACEHOLDER_FRIENDLY_NAMES: Record<string, string> = {
  "headless-main": "Main content",
  "headless-header": "Header",
  "headless-footer": "Footer",
  "headless-sidebar": "Sidebar",
};

const KNOWN_CONDITION_TYPES: Record<string, string> = {
  "{4888ABBB-F17D-4485-B14B-842413F88732}": "Everyone (default)",
};

export function extractVariantIdFromConditions(
  conditionsXml: string
): string | null {
  const match = conditionsXml?.match(/VariantName="([^"]+)"/);
  return match ? match[1] : null;
}

export function extractAudienceHint(conditionsXml: string): string | null {
  if (!conditionsXml) return null;
  for (const [guid, friendly] of Object.entries(KNOWN_CONDITION_TYPES)) {
    if (conditionsXml.includes(guid)) return friendly;
  }
  return null;
}

function parseActions(actions: any[]): ParsedAction[] {
  if (!Array.isArray(actions)) return [];

  return actions.map((a: any) => {
    const rawActionId = a?.id ?? null;
    const type = rawActionId
      ? ACTION_TYPES[rawActionId] ?? "unknown"
      : "unknown";

    if (type === "datasource") {
      const ds = a?.dataSource ?? null;
      return {
        type: "datasource",
        targetId: ds,
        targetName: null,
        detail: ds ? readableDatasource(ds) : "Different content",
        rawActionId,
      };
    }
    if (type === "rendering") {
      return {
        type: "rendering",
        targetId: a?.renderingItem ?? null,
        targetName: null,
        detail: "Different component",
        rawActionId,
      };
    }
    if (type === "parameters") {
      return {
        type: "parameters",
        targetId: null,
        targetName: null,
        detail: "Style variant",
        rawActionId,
      };
    }
    if (type === "hide") {
      return {
        type: "hide",
        targetId: null,
        targetName: null,
        detail: "Hidden",
        rawActionId,
      };
    }
    return {
      type: "unknown",
      targetId: null,
      targetName: null,
      detail: `Unmapped action ${
        rawActionId ? rawActionId.slice(0, 8) : "unknown"
      }`,
      rawActionId,
    };
  });
}

export function readablePlaceholder(key: string): string {
  if (!key) return "Unknown placeholder";
  const base = key.replace(/-\d+$/, "").replace(/\/[^/]+$/, "");
  return (
    PLACEHOLDER_FRIENDLY_NAMES[base] ?? PLACEHOLDER_FRIENDLY_NAMES[key] ?? key
  );
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
            const variantId = extractVariantIdFromConditions(
              rule?.conditions ?? ""
            );
            const isDefault = rule?.uniqueId === DEFAULT_VARIANT_UID;
            const rawActions = Array.isArray(rule?.actions)
              ? rule.actions
              : [];
            return {
              id: variantId ?? rule?.uniqueId ?? "unknown",
              name: rule?.name ?? variantId ?? "Unnamed variant",
              isDefault,
              audienceHint: extractAudienceHint(rule?.conditions ?? ""),
              actions: parseActions(rawActions),
              rawActions,
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