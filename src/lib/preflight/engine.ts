import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import {
  checkDynamicPlaceholders,
  checkPagePersonalization,
  checkTrackingConfig,
  checkRenderDrift,
  checkComponentPersonalization,
} from "./checks";
import type { PreflightResult, SiteHealthSummary } from "./types";

export interface RunChecksOptions {
  sitecoreContextId: string;
  pageId: string;
  siteName: string;
  language: string;
  pageContext: any;
}

export async function runPageChecks(
  client: ClientSDK,
  opts: RunChecksOptions
): Promise<PreflightResult[]> {
  const { sitecoreContextId, pageId, siteName, language, pageContext } = opts;

  const tasks = [
    // Synchronous — parse from pageContext
    async () => checkDynamicPlaceholders(pageContext),
    async () => checkPagePersonalization(pageContext),
    // Async — query Authoring API
    () => checkTrackingConfig(client, sitecoreContextId, pageId, siteName, language),
    () => checkRenderDrift(client, sitecoreContextId, pageId, siteName, language),
    // Synchronous — parse from pageContext
    async () => checkComponentPersonalization(pageContext),
  ];

  const results = await Promise.allSettled(tasks.map((fn) => fn()));

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      checkId: `check-${i}`,
      label: "Check failed to run",
      severity: "UNKNOWN" as const,
      message: r.reason instanceof Error ? r.reason.message : "Unknown error",
      items: [],
      checkContext: { pageId, site: siteName, language },
      ranAt: new Date().toISOString(),
    };
  });
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