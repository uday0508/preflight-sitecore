import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { diag, dumpResolvedNames } from "./diagnostics";

const nameCache = new Map<string, string | null>();

/**
 * Resolves Sitecore GUIDs (datasources, renderings, variant items) to
 * display names. Uses multiple strategies because item(where: itemId)
 * is unreliable across databases and item locations.
 *
 * Strategy order:
 *   1. search by ITEM_ID criteria (works if schema supports it)
 *   2. item(where: { itemId, database: "master" })
 *   3. item(where: { itemId, database: "web" })
 */
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

  if (toFetch.length === 0) {
    dumpResolvedNames(guids, result);
    return result;
  }

  diag.log(`resolving ${toFetch.length} item GUIDs`);

  // Strategy 1 — item(where: itemId, database: master)
  const masterQueries = toFetch
    .map(
      (guid, i) =>
        `m${i}: item(where: { itemId: "${guid}", database: "master" }) { itemId name path }`
    )
    .join("\n");

  try {
    const { data } = await client.mutate("xmc.authoring.graphql", {
      params: {
        query: { sitecoreContextId },
        body: {
          query: `query ResolveNamesMaster { ${masterQueries} }`,
        },
      },
    });

    const payload = data as any;
    const errors = payload?.data?.errors ?? payload?.errors ?? null;
    if (Array.isArray(errors) && errors.length > 0) {
      diag.warn(
        "master item query errors",
        errors.map((e: any) => e.message)
      );
    }

    const responseData = payload?.data?.data ?? {};
    const stillMissing: string[] = [];

    for (let i = 0; i < toFetch.length; i++) {
      const node = responseData[`m${i}`];
      const name = node?.name ?? null;
      if (name) {
        nameCache.set(toFetch[i], name);
        result.set(toFetch[i], name);
      } else {
        stillMissing.push(toFetch[i]);
      }
    }

    // Strategy 2 — try search for the ones that didn't resolve
    if (stillMissing.length > 0) {
      diag.log(
        `master lookup returned ${toFetch.length - stillMissing.length} hits, trying search for ${stillMissing.length}`
      );
      await resolveViaSearch(client, sitecoreContextId, stillMissing, result);
    }

    dumpResolvedNames(toFetch, result);
  } catch (err) {
    diag.error("master item resolution failed", err);
    for (const guid of toFetch) {
      nameCache.set(guid, null);
      result.set(guid, null);
    }
  }

  return result;
}

/**
 * Fallback strategy — search by item id criteria.
 */
async function resolveViaSearch(
  client: ClientSDK,
  sitecoreContextId: string,
  guids: string[],
  result: Map<string, string | null>
): Promise<void> {
  // Try a single search to inspect the schema, log the full response
  const probeGuid = guids[0];

  try {
    const { data } = await client.mutate("xmc.authoring.graphql", {
      params: {
        query: { sitecoreContextId },
        body: {
          query: `
            query SearchProbe($guid: String!) {
              search(
                query: {
                  searchStatement: {
                    operator: MUST
                    subStatements: {
                      criteria: [{ criteriaType: ITEM_ID, value: $guid }]
                    }
                  }
                }
                first: 5
              ) {
                results {
                  innerItem {
                    itemId
                    name
                    path
                  }
                }
              }
            }
          `,
          variables: { guid: probeGuid },
        },
      },
    });

    const payload = data as any;
    const errors = payload?.data?.errors ?? payload?.errors ?? null;

    if (Array.isArray(errors) && errors.length > 0) {
      diag.warn(
        "search probe errors — schema may not support ITEM_ID criteria",
        errors.map((e: any) => e.message)
      );
      // Mark all as null so we don't retry forever
      for (const guid of guids) {
        nameCache.set(guid, null);
        result.set(guid, null);
      }
      return;
    }

    const hits = payload?.data?.data?.search?.results ?? [];
    diag.log(`search probe returned ${hits.length} hits`);
    if (hits.length > 0) {
      diag.table("search hits", hits.map((h: any) => h?.innerItem ?? h));
    }


    if (hits.length > 0) {
      // Search returned something for the first guid — build queries for the rest
      const searchQueries = guids
        .map(
          (guid, i) =>
            `s${i}: search(query: { searchStatement: { operator: MUST, subStatements: { criteria: [{ criteriaType: ITEM_ID, value: "${guid}" }] } } }, first: 1) { results { innerItem { itemId name path } } }`
        )
        .join("\n");

      const res = await client.mutate("xmc.authoring.graphql", {
        params: {
          query: { sitecoreContextId },
          body: { query: `query ResolveNamesSearch { ${searchQueries} }` },
        },
      });

      const searchData = (res.data as any)?.data?.data ?? {};
      for (let i = 0; i < guids.length; i++) {
        const node = searchData[`s${i}`];
        const name = node?.results?.[0]?.innerItem?.name ?? null;
        nameCache.set(guids[i], name);
        result.set(guids[i], name);
      }
    } else {
      for (const guid of guids) {
        nameCache.set(guid, null);
        result.set(guid, null);
      }
    }
  } catch (err) {
    diag.error("search probe failed", err);
    for (const guid of guids) {
      nameCache.set(guid, null);
      result.set(guid, null);
    }
  }
}

/**
 * Resolves personalization variant display names.
 * Reuses the same item-name resolution logic.
 */
export async function resolveVariantNames(
  client: ClientSDK,
  sitecoreContextId: string,
  variantIds: string[]
): Promise<Map<string, string | null>> {
  if (variantIds.length === 0) return new Map();

  diag.log(`resolving ${variantIds.length} variant names`);

  // Variant IDs are stored as 32-char hex without dashes in conditions XML.
  // Sitecore stores them with dashes in the item tree.
  const normalized = variantIds.map((id) => normalizeGuid(id));

  const result = await resolveItemNames(client, sitecoreContextId, normalized);

  // Map back from normalized → original
  const out = new Map<string, string | null>();
  for (let i = 0; i < variantIds.length; i++) {
    out.set(variantIds[i], result.get(normalized[i]) ?? null);
  }

  diag.table(
    "variant name resolution",
    variantIds.map((id) => ({
      variantId: id.slice(0, 12),
      resolvedName: out.get(id) ?? "(not found)",
    }))
  );

  return out;
}

/**
 * Sitecore conditions XML strips dashes from GUIDs.
 * The item tree uses dashes. Convert 32-char hex → 8-4-4-4-12.
 */
function normalizeGuid(id: string): string {
  if (!id) return id;
  if (id.includes("-")) return id;
  if (id.length !== 32) return id;
  return (
    id.slice(0, 8) +
    "-" +
    id.slice(8, 12) +
    "-" +
    id.slice(12, 16) +
    "-" +
    id.slice(16, 20) +
    "-" +
    id.slice(20)
  );
}