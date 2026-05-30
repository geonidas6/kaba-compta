"use client";

import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/lib/auth";

import Landing from "@/spa-pages/Landing";
import PublicProfile from "@/spa-pages/PublicProfile";
import AuthPage from "@/spa-pages/AuthPage";
import Dashboard from "@/spa-pages/Dashboard";
import AssistantDashboard from "@/spa-pages/AssistantDashboard";
import Missions from "@/spa-pages/Missions";
import MissionCreate from "@/spa-pages/MissionCreate";
import MissionDetail from "@/spa-pages/MissionDetail";
import Messages from "@/spa-pages/Messages";
import Profile from "@/spa-pages/Profile";
import Forum from "@/spa-pages/Forum";
import ForumNewQuestion from "@/spa-pages/ForumNewQuestion";
import ForumQuestionDetail from "@/spa-pages/ForumQuestionDetail";
import Notifications from "@/spa-pages/Notifications";
import AppLayout from "@/components/AppLayout";
import AdminLayout from "@/components/AdminLayout";
import AdminDashboard from "@/spa-pages/admin/AdminDashboard";
import AdminUsers from "@/spa-pages/admin/AdminUsers";
import AdminKyc from "@/spa-pages/admin/AdminKyc";
import AdminMissions from "@/spa-pages/admin/AdminMissions";
import AdminBroadcast from "@/spa-pages/admin/AdminBroadcast";
import AdminUserDetail from "@/spa-pages/admin/AdminUserDetail";
import AdminAuditLogs from "@/spa-pages/admin/AdminAuditLogs";
import AdminSettings from "@/spa-pages/admin/AdminSettings";
import AdminForumReports from "@/spa-pages/admin/AdminForumReports";
import AdminForumQuestionDetail from "@/spa-pages/admin/AdminForumQuestionDetail";

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center text-[#6C6C6C]">
        Chargement...
      </div>
    );
  if (!user) return <Navigate to="/auth" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Landing />;
  if (user.role === "admin") return <Navigate to="/admin/dashboard" replace />;
  return <Navigate to={user.role === "assistant" ? "/app/assistant" : "/app/dashboard"} replace />;
}

export default function AppRoot() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route
              path="/app"
              element={
                <Protected>
                  <AppLayout />
                </Protected>
              }
            >
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="assistant" element={<AssistantDashboard />} />
              <Route path="missions" element={<Missions />} />
              <Route path="missions/create" element={<MissionCreate />} />
              <Route path="missions/:id" element={<MissionDetail />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="forum" element={<Forum />} />
              <Route path="forum/new" element={<ForumNewQuestion />} />
              <Route path="forum/:id" element={<ForumQuestionDetail />} />
              <Route path="profile" element={<Profile />} />
            </Route>
            <Route
              path="/admin"
              element={
                <Protected role="admin">
                  <AdminLayout />
                </Protected>
              }
            >
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:id" element={<AdminUserDetail />} />
              <Route path="kyc" element={<AdminKyc />} />
              <Route path="missions" element={<AdminMissions />} />
              <Route path="forum-reports" element={<AdminForumReports />} />
              <Route path="forum-questions/:id" element={<AdminForumQuestionDetail />} />
              <Route path="audit" element={<AdminAuditLogs />} />
              <Route path="broadcast" element={<AdminBroadcast />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            <Route path="/u/:userId" element={<PublicProfile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}
