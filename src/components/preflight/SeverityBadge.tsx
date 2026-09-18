import { Badge } from "@/components/ui/badge";
import type { Severity } from "@/lib/preflight/types";

const VARIANT_MAP: Record<
  Severity,
  "destructive" | "secondary" | "default" | "outline"
> = {
  BLOCKER: "destructive",
  WARNING: "secondary",
  INFO: "outline",
  PASS: "default",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge variant={VARIANT_MAP[severity]}>{severity}</Badge>;
}