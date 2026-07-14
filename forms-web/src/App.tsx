import { Routes, Route, Link, Navigate } from "react-router-dom";
import CheckoutPage from "@/pages/CheckoutPage";
import StatusPage from "@/pages/StatusPage";
import CustomerPrefillPage from "@/pages/CustomerPrefillPage";
import InvoicePage from "@/pages/InvoicePage";
import RenderPage from "@/pages/RenderPage";
import RenderFormPage from "@/pages/RenderFormPage";
import LoginPage from "@/pages/LoginPage";
import StaffHomePage from "@/pages/StaffHomePage";
import PurchasesPage from "@/pages/PurchasesPage";
import CheckoutLandingPage from "@/pages/CheckoutLandingPage";
import ReturnLandingPage from "@/pages/ReturnLandingPage";
import IntakeFormsPage from "@/pages/IntakeFormsPage";
import AllFormsPage from "@/pages/AllFormsPage";
import WebhookEventsPage from "@/pages/WebhookEventsPage";
import AdminFormsPage from "@/pages/AdminFormsPage";
import SubmissionManagerPage from "@/pages/SubmissionManagerPage";
import { AuthGuard } from "@/components/AuthGuard";
import { StaffLayout } from "@/components/StaffLayout";
import { FormShell } from "@/components/ui";

function NoSession() {
  return (
    <FormShell title="No active form" subtitle="Open a form using the secure link from your case manager or a QR code.">
      <div className="text-center">
        <Link to="/staff" className="text-sm font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-500">
          Staff sign-in →
        </Link>
      </div>
    </FormShell>
  );
}

export default function App() {
  return (
    <Routes>
      {/* Customer token routes — public, no auth. */}
      <Route path="/checkout/:token" element={<CheckoutPage />} />
      <Route path="/status/:token" element={<StatusPage />} />
      <Route path="/customer-prefill/:token" element={<CustomerPrefillPage />} />
      <Route path="/invoice/:token" element={<InvoicePage />} />
      <Route path="/render/:workflowId/:token" element={<RenderPage />} />
      {/* Render engine — customer-facing, token-gated, for org-access-only forms. */}
      <Route path="/f/:token" element={<RenderFormPage />} />

      {/* Staff side — authenticated. Top-tab workspace. */}
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/staff"
        element={
          <AuthGuard>
            <StaffLayout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="purchases" replace />} />
        <Route path="purchases" element={<PurchasesPage />} />
        {/* Direct-link landing pages (bookmarkable). */}
        <Route path="checkout" element={<CheckoutLandingPage />} />
        <Route path="return" element={<ReturnLandingPage />} />
        <Route path="intake" element={<IntakeFormsPage />} />
        <Route path="forms" element={<AllFormsPage />} />
        <Route path="submissions" element={<SubmissionManagerPage />} />
        <Route path="webhooks" element={<WebhookEventsPage />} />
        <Route path="admin" element={<AdminFormsPage />} />
        <Route path="activity" element={<StaffHomePage />} />
      </Route>

      <Route path="*" element={<NoSession />} />
    </Routes>
  );
}
