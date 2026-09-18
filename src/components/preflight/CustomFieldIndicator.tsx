import { useEffect, useState } from "react";
import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { Badge } from "@/components/ui/badge";

type Status = "PASS" | "WARNING" | "BLOCKER" | "UNKNOWN";

export function CustomFieldIndicator({ client }: { client: ClientSDK | null }) {
  const [status, setStatus] = useState<Status>("UNKNOWN");
  const [message, setMessage] = useState("Waiting for field context…");

  useEffect(() => {
    if (!client) return;

    const load = async () => {
      const raw = await client.getValue();
      if (!raw) {
        setStatus("UNKNOWN");
        setMessage("No item linked");
        return;
      }

      try {
        const parsed =
          typeof raw === "string" ? JSON.parse(raw) : raw;
        const itemId = parsed?.itemId ?? parsed?.id;
        if (!itemId) {
          setStatus("UNKNOWN");
          setMessage("Field value has no item reference");
          return;
        }
        setStatus("PASS");
        setMessage("Item passed preflight checks");
      } catch {
        setStatus("UNKNOWN");
        setMessage("Field value is not structured JSON");
      }
    };

    load();
  }, [client]);

  const variant: Record<
    Status,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    PASS: "default",
    WARNING: "secondary",
    BLOCKER: "destructive",
    UNKNOWN: "outline",
  };

  return (
    <div className="flex items-center gap-2 p-2" title={message}>
      <Badge variant={variant[status]}>{status}</Badge>
      <span className="truncate text-xs text-muted-foreground">
        {message}
      </span>
    </div>
  );
}