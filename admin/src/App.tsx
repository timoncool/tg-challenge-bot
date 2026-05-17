import { Routes, Route, Navigate } from "react-router-dom";
import { Center, Loader } from "@mantine/core";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { AiSettingsPage } from "@/pages/AiSettingsPage";
import { AiTestPage } from "@/pages/AiTestPage";
import { PromptsPage } from "@/pages/PromptsPage";
import { CommunityPage } from "@/pages/CommunityPage";
import { TriggersPage } from "@/pages/TriggersPage";
import { KvExplorerPage } from "@/pages/KvExplorerPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { StatsPage } from "@/pages/StatsPage";
import { MessagesPage } from "@/pages/MessagesPage";
import { AuditPage } from "@/pages/AuditPage";

export function App() {
  const { loading, authenticated } = useAuth();

  if (loading) {
    return (
      <Center mih="100vh">
        <Loader color="yellow" />
      </Center>
    );
  }

  if (!authenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/community/:chatId" element={<CommunityPage />} />
        <Route path="/triggers" element={<TriggersPage />} />
        <Route path="/ai-settings" element={<AiSettingsPage />} />
        <Route path="/ai-test" element={<AiTestPage />} />
        <Route path="/prompts" element={<PromptsPage />} />
        <Route path="/kv" element={<KvExplorerPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/audit" element={<AuditPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}
