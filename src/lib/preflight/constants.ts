export const CHECK_IDS = {
  DYNAMIC_PLACEHOLDERS: "dynamic-placeholder-consistency",
  PAGE_PERSONALIZATION: "page-personalization-validity",
  TRACKING: "analytics-tracking-config",
  RENDER_DRIFT: "render-drift",
  COMPONENT_PERSONALIZATION: "component-personalization-integrity",
} as const;

export const SEVERITY_WEIGHTS = {
  BLOCKER: 100,
  WARNING: 10,
  INFO: 1,
  PASS: 0,
} as const;

export const CHECK_LABELS: Record<string, string> = {
  [CHECK_IDS.DYNAMIC_PLACEHOLDERS]: "Dynamic placeholder settings",
  [CHECK_IDS.PAGE_PERSONALIZATION]: "Page personalization",
  [CHECK_IDS.TRACKING]: "Analytics tracking",
  [CHECK_IDS.RENDER_DRIFT]: "Render / delivery sync",
  [CHECK_IDS.COMPONENT_PERSONALIZATION]: "Component personalization",
};