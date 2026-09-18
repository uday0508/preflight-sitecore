const DEBUG =
  (import.meta as any).env?.VITE_PREFLIGHT_DEBUG === "1" ||
  (import.meta as any).env?.DEV === true;

const PREFIX = "[Preflight]";

export const diag = {
  enabled: DEBUG,

  group(label: string) {
    if (DEBUG) console.group(`${PREFIX} ${label}`);
  },

  groupEnd() {
    if (DEBUG) console.groupEnd();
  },

  log(label: string, data?: any) {
    if (!DEBUG) return;
    if (data === undefined) console.log(`${PREFIX} ${label}`);
    else console.log(`${PREFIX} ${label}`, data);
  },

  table(label: string, rows: any[]) {
    if (!DEBUG) return;
    console.log(`${PREFIX} ${label}`);
    if (console.table) console.table(rows);
    else console.log(rows);
  },

  warn(label: string, data?: any) {
    if (!DEBUG) return;
    console.warn(`${PREFIX} ${label}`, data ?? "");
  },

  error(label: string, data?: any) {
    console.error(`${PREFIX} ${label}`, data ?? "");
  },
};

/**
 * Dumps everything we need to understand why a check produced its result.
 * Logs to console only when DEBUG is on.
 */
export function dumpPageContext(pagesContext: any) {
  if (!diag.enabled || !pagesContext) return;

  diag.group("pages.context received");
  diag.log("page name:", pagesContext?.pageInfo?.name);
  diag.log("page id:", pagesContext?.pageInfo?.id);
  diag.log("page path:", pagesContext?.pageInfo?.path);
  diag.log("site name:", pagesContext?.siteInfo?.name);
  diag.log("language:", pagesContext?.siteInfo?.language);

  const pd = pagesContext?.pageInfo?.presentationDetails;
  if (typeof pd === "string") {
    diag.log("presentationDetails length:", pd.length);
    try {
      const parsed = JSON.parse(pd);
      const renderings =
        parsed?.devices?.flatMap((d: any) => d.renderings ?? []) ?? [];
      diag.log("total renderings:", renderings.length);

      const personalized = renderings.filter((r: any) => r.personalization);
      diag.log("personalized renderings:", personalized.length);

      diag.table(
        "personalized summary",
        personalized.map((r: any) => {
          const rules = r.personalization?.ruleSet?.rules ?? [];
          return {
            instanceId: r.instanceId?.slice(0, 8),
            placeholder: r.placeholderKey,
            dataSource: r.dataSource,
            ruleCount: rules.length,
            variantIds: rules
              .map((rule: any) => {
                const m = rule?.conditions?.match(/VariantName="([^"]+)"/);
                return m ? m[1].slice(0, 8) : null;
              })
              .filter(Boolean)
              .join(", "),
          };
        })
      );

      diag.group("full personalization rules");
      for (const r of personalized) {
        diag.log(`rendering ${r.instanceId?.slice(0, 8)} (${r.placeholderKey})`);
        for (const rule of r.personalization?.ruleSet?.rules ?? []) {
          diag.log("  rule:", {
            uniqueId: rule.uniqueId,
            name: rule.name,
            conditions: rule.conditions,
            actions: rule.actions,
          });
        }
      }
      diag.groupEnd();
    } catch (err) {
      diag.error("failed to parse presentationDetails", err);
    }
  }

  diag.groupEnd();
}

export function dumpResolvedNames(
  requested: string[],
  resolved: Map<string, string | null>
) {
  if (!diag.enabled) return;
  diag.group("name resolution");
  diag.table(
    "resolved GUIDs",
    requested.map((g) => ({
      guid: g.slice(0, 12),
      resolved: resolved.get(g) ?? "(not found)",
    }))
  );
  diag.groupEnd();
}

export function dumpCheckResult(checkId: string, result: any) {
  if (!diag.enabled) return;
  diag.log(`check result ${checkId}:`, {
    severity: result.severity,
    message: result.message,
    itemCount: result.items?.length ?? 0,
    items: result.items,
  });
}

/**
 * One-time introspection: dumps the schema shape of `item` and `search`
 * so we can see exactly which arguments they accept.
 */
export async function dumpGraphQLSchema(
  client: any,
  sitecoreContextId: string
): Promise<void> {
  if (!diag.enabled) return;

  diag.group("schema introspection");

  const query = `
    query Introspect {
      itemFields: __type(name: "ItemQuery") {
        fields {
          name
          args { name type { name kind ofType { name kind } } }
        }
      }
      searchFields: __type(name: "SearchQuery") {
        fields {
          name
          args { name type { name kind ofType { name kind } } }
        }
      }
      queryType: __type(name: "Query") {
        fields {
          name
          args { name type { name kind ofType { name kind } } }
        }
      }
    }
  `;

  try {
    const { data } = await client.mutate("xmc.authoring.graphql", {
      params: {
        query: { sitecoreContextId },
        body: { query },
      },
    });

    const payload = data as any;
    const errors = payload?.data?.errors ?? payload?.errors ?? null;

    if (Array.isArray(errors) && errors.length > 0) {
      diag.error(
        "introspection errors",
        errors.map((e: any) => e.message)
      );
      diag.groupEnd();
      return;
    }

    const q = payload?.data?.data?.queryType;
    if (q?.fields) {
      const itemField = q.fields.find((f: any) => f.name === "item");
      const searchField = q.fields.find((f: any) => f.name === "search");

      diag.log("query.item field:", itemField);
      diag.log("query.search field:", searchField);

      if (itemField?.args) {
        diag.table(
          "item() arguments",
          itemField.args.map((a: any) => ({
            name: a.name,
            type: a.type?.name ?? a.type?.ofType?.name ?? a.type?.kind,
          }))
        );
      }

      if (searchField?.args) {
        diag.table(
          "search() arguments",
          searchField.args.map((a: any) => ({
            name: a.name,
            type: a.type?.name ?? a.type?.ofType?.name ?? a.type?.kind,
          }))
        );
      }
    }

    diag.groupEnd();
  } catch (err) {
    diag.error("introspection failed", err);
    diag.groupEnd();
  }
}

/**
 * Dumps the raw Query type schema directly to console.
 * Uses inline __type introspection.
 */
export async function dumpQuerySchema(
  client: any,
  sitecoreContextId: string
): Promise<void> {
  if (!diag.enabled) return;

  diag.group("query schema raw dump");

  try {
    const { data } = await client.mutate("xmc.authoring.graphql", {
      params: {
        query: { sitecoreContextId },
        body: {
          query: `
            query QuerySchemaDump {
              __schema {
                queryType {
                  name
                  fields {
                    name
                    args {
                      name
                      type {
                        name
                        kind
                        ofType { name kind }
                      }
                    }
                  }
                }
              }
            }
          `,
        },
      },
    });

    const payload = data as any;
    const errors = payload?.data?.errors ?? payload?.errors ?? null;

    if (Array.isArray(errors) && errors.length > 0) {
      diag.error(
        "schema dump errors",
        errors.map((e: any) => e.message)
      );
      diag.groupEnd();
      return;
    }

    const fields = payload?.data?.data?.__schema?.queryType?.fields ?? [];

    if (fields.length === 0) {
      diag.warn("schema dump returned 0 fields");
      diag.groupEnd();
      return;
    }

    diag.table(
      "available Query fields",
      fields.map((f: any) => ({
        name: f.name,
        args: (f.args ?? []).map((a: any) => a.name).join(", "),
      }))
    );

    // Focus on the fields we care about
    const interesting = fields.filter((f: any) =>
      ["item", "search", "items", "itemsByIds", "itemsByPath"].includes(f.name)
    );

    for (const field of interesting) {
      diag.log(`field: ${field.name}`, {
        args: (field.args ?? []).map((a: any) => ({
          name: a.name,
          type: a.type?.name ?? a.type?.ofType?.name ?? a.type?.kind,
        })),
      });
    }

    diag.groupEnd();
  } catch (err) {
    diag.error("schema dump threw", err);
    diag.groupEnd();
  }
}