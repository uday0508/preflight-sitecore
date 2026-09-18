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
}

export async function runPageChecks(
  client: ClientSDK,
  opts: RunChecksOptions
): Promise<PreflightResult[]> {
  const { sitecoreContextId, pageId, siteName, language } = opts;

  const allChecks = [
    () =>
      checkDynamicPlaceholders(
        client,
        sitecoreContextId,
        pageId,
        siteName,
        language
      ),
    () =>
      checkPagePersonalization(
        client,
        sitecoreContextId,
        pageId,
        siteName,
        language
      ),
    () => checkTrackingConfig(client, sitecoreContextId, siteName),
    () =>
      checkRenderDrift(
        client,
        sitecoreContextId,
        pageId,
        siteName,
        language
      ),
    () =>
      checkComponentPersonalization(
        client,
        sitecoreContextId,
        pageId,
        siteName,
        language
      ),
  ];

  const results = await Promise.allSettled(allChecks.map((fn) => fn()));

  return results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      checkId: `check-${i}`,
      label: "Check failed to run",
      severity: "WARNING" as const,
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
  const blockers = results.filter((r) => r.severity === "BLOCKER").length;
  const warnings = results.filter((r) => r.severity === "WARNING").length;
  const passedChecks = results.filter((r) => r.severity === "PASS").length;

  return {
    blockers,
    warnings,
    pagesScanned: 1,
    totalChecks: results.length,
    passedChecks,
    lastScan: new Date().toISOString(),
  };
}