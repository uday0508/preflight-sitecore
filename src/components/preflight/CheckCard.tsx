import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SeverityBadge } from "./SeverityBadge";
import type { PreflightResult } from "@/lib/preflight/types";

export function CheckCard({ result }: { result: PreflightResult }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{result.label}</CardTitle>
          <SeverityBadge severity={result.severity} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{result.message}</p>
        {result.items.length > 0 && (
          <ul className="mt-2 space-y-1">
            {result.items.map((item) => (
              <li key={item.id} className="text-xs">
                <span className="font-medium">{item.name}:</span>{" "}
                <span className="text-muted-foreground">
                  {item.detail}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}