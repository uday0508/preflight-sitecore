import { useMarketplace } from "@/components/providers/MarketplaceContext";
import { CustomFieldIndicator } from "@/components/preflight/CustomFieldIndicator";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomField() {
  const { client, isInitialized } = useMarketplace();

  if (!isInitialized) {
    return (
      <div className="p-2">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  return <CustomFieldIndicator client={client} />;
}