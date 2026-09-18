export type Severity = "BLOCKER" | "WARNING" | "INFO" | "PASS" | "UNKNOWN";

export type Verdict = "ready" | "attention" | "blocked";

export interface VariantDisplay {
  label: string;
  audience: string;
  outcome: string;
  isDefault: boolean;
  personalizeUrl: string | null;
  condition?: string;
}

export interface CheckItem {
  id: string;
  name: string;
  detail: string;
  variants?: VariantDisplay[];
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
  unknown: number;
  pagesScanned: number;
  totalChecks: number;
  passedChecks: number;
  lastScan: string;
}