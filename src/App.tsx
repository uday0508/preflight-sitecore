import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MarketplaceClientProvider } from "@/components/providers/MarketplaceClientProvider";
import DashboardWidget from "@/routes/DashboardWidget";
import PagesContextPanel from "@/routes/PagesContextPanel";
import CustomField from "@/routes/CustomField";

export default function App() {
  return (
    <MarketplaceClientProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/dashboard-widget" element={<DashboardWidget />} />
          <Route path="/pages-context-panel" element={<PagesContextPanel />} />
          <Route path="/custom-field" element={<CustomField />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </MarketplaceClientProvider>
  );
}