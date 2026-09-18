export type Severity = "BLOCKER" | "WARNING" | "INFO" | "PASS";

export interface CheckItem {
  id: string;
  name: string;
  detail: string;
  path?: string;
}

export interface PreflightResult {
  checkId: string;
  label: string;
  severity: Severity;
  message: string;
  items: CheckItem[];
  checkContext: {
    pageId?: string;
    site?: string;
    language?: string;
  };
  ranAt: string;
}

export interface SiteHealthSummary {
  blockers: number;
  warnings: number;
  pagesScanned: number;
  totalChecks: number;
  passedChecks: number;
  lastScan: string;
}