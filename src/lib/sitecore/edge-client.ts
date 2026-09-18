import type { ClientSDK } from "@sitecore-marketplace-sdk/client";

/**
 * Queries the Preview API via the Marketplace SDK for layout and
 * personalization data.
 *
 * NOTE: This returns data only for PUBLISHED content.
 * If the page has never been published, variantIds will be empty.
 *
 * routePath must be the site-relative path (e.g. "/health-drink"),
 * NOT the Sitecore item path (e.g. "/sitecore/content/VitaFlow/...").
 */
export async function queryPreviewLayout(
  client: ClientSDK,
  sitecoreContextId: string,
  siteName: string,
  routePath: string,
  language: string
): Promise<{ layout: any; personalization: any; error: string | null }> {
  const { data } = await client.mutate("xmc.preview.graphql", {
    params: {
      query: { sitecoreContextId },
      body: {
        query: `
          query GetLayout($siteName: String!, $routePath: String!, $language: String!) {
            layout(site: $siteName, routePath: $routePath, language: $language) {
              item {
                rendered
                personalization {
                  variantIds
                }
              }
            }
          }
        `,
        variables: { siteName, routePath, language },
      },
    },
  });

  const payload = data as any;
  const errors = payload?.data?.errors ?? payload?.errors ?? null;

  if (Array.isArray(errors) && errors.length > 0) {
    return {
      layout: null,
      personalization: null,
      error: errors.map((e: any) => e.message).join("; "),
    };
  }

  const item = payload?.data?.data?.layout?.item;
  if (!item) {
    return {
      layout: null,
      personalization: null,
      error: "No layout returned for this route",
    };
  }

  let layout: any = null;
  try {
    layout = item.rendered
      ? typeof item.rendered === "string"
        ? JSON.parse(item.rendered)
        : item.rendered
      : null;
  } catch {
    layout = null;
  }

  return {
    layout,
    personalization: item.personalization ?? null,
    error: null,
  };
}