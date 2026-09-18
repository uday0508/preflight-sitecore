import type { ClientSDK } from "@sitecore-marketplace-sdk/client";

/**
 * Resolves Sitecore GUIDs (rendering items, datasources) to display names.
 * Uses the Authoring API. Results are cached for the session.
 */
const nameCache = new Map<string, string | null>();

export async function resolveItemNames(
  client: ClientSDK,
  sitecoreContextId: string,
  guids: string[]
): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const toFetch: string[] = [];

  for (const guid of guids) {
    if (!guid) continue;
    if (nameCache.has(guid)) {
      result.set(guid, nameCache.get(guid)!);
    } else if (!toFetch.includes(guid)) {
      toFetch.push(guid);
    }
  }

  if (toFetch.length === 0) return result;

  // Batch query — one call for all unresolved GUIDs
  const itemQueries = toFetch
    .map(
      (guid, i) =>
        `i${i}: item(where: { itemId: "${guid}", database: "master" }) { itemId name }`
    )
    .join("\n");

  try {
    const { data } = await client.mutate("xmc.authoring.graphql", {
      params: {
        query: { sitecoreContextId },
        body: {
          query: `query ResolveNames { ${itemQueries} }`,
        },
      },
    });

    const payload = data as any;
    const responseData = payload?.data?.data ?? {};

    for (let i = 0; i < toFetch.length; i++) {
      const node = responseData[`i${i}`];
      const name = node?.name ?? null;
      nameCache.set(toFetch[i], name);
      result.set(toFetch[i], name);
    }
  } catch (err) {
    console.warn("[Preflight] Name resolution failed:", err);
    for (const guid of toFetch) {
      nameCache.set(guid, null);
      result.set(guid, null);
    }
  }

  return result;
}