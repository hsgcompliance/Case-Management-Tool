import { Routes, Route, Navigate } from "react-router-dom";
import { AuthGuard } from "@/components/AuthGuard";
import { BottomNav } from "@/components/BottomNav";
import { LoginPage } from "@/pages/LoginPage";
import { CustomersPage } from "@/pages/CustomersPage";
import { CustomerDetailPage } from "@/pages/CustomerDetailPage";
import { NewCustomerPage } from "@/pages/NewCustomerPage";
import { LogActivityPage } from "@/pages/LogActivityPage";
import { ActivityFeedPage } from "@/pages/ActivityFeedPage";
import { SettingsPage } from "@/pages/SettingsPage";

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full">
      {children}
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <AuthGuard>
            <AppShell>
              <Routes>
                <Route index element={<CustomersPage />} />
                <Route path="customers/new" element={<NewCustomerPage />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="log" element={<LogActivityPage />} />
                <Route path="feed" element={<ActivityFeedPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </AuthGuard>
        }
      />
    </Routes>
  );
}
