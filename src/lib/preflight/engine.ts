import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  checkDynamicPlaceholders,
  checkPagePersonalization,
  checkTrackingConfig,
  checkRenderDrift,
  checkComponentPersonalization,
} from "./checks";
import { dumpPageContext, diag } from "./diagnostics";
import type { PreflightResult, SiteHealthSummary, Verdict } from "./types";
import type { PreflightContext } from "./context";

export interface RunChecksOptions {
  context: PreflightContext;
  pageContext: any;
  pageHtml: string | null;
}

export async function runPageChecks(
  client: ClientSDK,
  opts: RunChecksOptions
): Promise<PreflightResult[]> {
  const { context, pageContext, pageHtml } = opts;

  diag.group("Preflight run");
  diag.log("starting checks", context);
  dumpPageContext(pageContext);

  const sitecoreContextId = context.sitecoreContextId!;
  const pageId = context.pageId!;
  const siteName = context.siteName ?? "";
  const language = context.language ?? "en";

  const tasks = [
    async () => checkDynamicPlaceholders(pageContext),
    () =>
      checkPagePersonalization(
        client,
        sitecoreContextId,
        pageContext,
        pageHtml,
        context
      ),
    () =>
      checkTrackingConfig(client, sitecoreContextId, pageId, siteName, language),
    () =>
      checkRenderDrift(client, sitecoreContextId, pageId, siteName, language),
    async () => checkComponentPersonalization(pageContext),
  ];

  const results = await Promise.allSettled(tasks.map((fn) => fn()));

  const resolved = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    diag.error(`check ${i} failed`, r.reason);
    return {
      checkId: `check-${i}`,
      label: "Check failed",
      severity: "UNKNOWN" as const,
      message: "This check could not complete",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: new Date().toISOString(),
    };
  });

  diag.log(
    "all checks complete",
    resolved.map((r) => ({
      id: r.checkId,
      severity: r.severity,
      message: r.message,
    }))
  );
  diag.groupEnd();

  return resolved;
}

export function computeVerdict(results: PreflightResult[]): Verdict {
  if (results.some((r) => r.severity === "BLOCKER")) return "blocked";
  if (results.some((r) => r.severity === "WARNING")) return "attention";
  return "ready";
}

export function aggregateResults(
  results: PreflightResult[]
): SiteHealthSummary {
  return {
    blockers: results.filter((r) => r.severity === "BLOCKER").length,
    warnings: results.filter((r) => r.severity === "WARNING").length,
    unknown: results.filter((r) => r.severity === "UNKNOWN").length,
    pagesScanned: 1,
    totalChecks: results.length,
    passedChecks: results.filter((r) => r.severity === "PASS").length,
    lastScan: new Date().toISOString(),
  };
}