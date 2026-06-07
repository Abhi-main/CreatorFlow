import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import LoadingSpinner from "./components/shared/LoadingSpinner";
import { useAuth } from "./context/AuthContext";
import { useSocket } from "./hooks/useSocket";

const ProtectedLayout = lazy(() => import("./components/layout/ProtectedLayout"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CalendarPage = lazy(() => import("./pages/Calendar"));
const SchedulePage = lazy(() => import("./pages/SchedulePage"));
const AnalyticsPage = lazy(() => import("./pages/AnalyticsPage"));
const PostHistory = lazy(() => import("./pages/PostHistory"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const NewCampaign = lazy(() => import("./pages/NewCampaign"));
const Hashtags = lazy(() => import("./pages/Hashtags"));
const NewHashtag = lazy(() => import("./pages/NewHashtag"));
const AdminPanel = lazy(() => import("./pages/admin/AdminPanel"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

export default function App() {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  useSocket();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const connected = params.get('connected');
    const count = params.get('count');
    const error = params.get('error');

    if (connected === 'facebook' && count) {
      toast.success(`Connected! ${count} account(s) linked successfully.`);
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage({ type: 'META_CONNECTED', count }, '*');
        window.close();
      }
    }

    if (error) {
      const messages = {
        facebook_denied: 'Facebook connection was cancelled.',
        facebook_failed: 'Facebook connection failed. Please try again.',
        invalid_state: 'Session expired. Please try connecting again.',
      };
      toast.error(messages[error] || 'Connection failed.');
      if (window.opener && !window.opener.closed) {
        window.close();
      }
    }

    if (connected || error) {
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      url.searchParams.delete('count');
      url.searchParams.delete('error');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }, [location.search]);

  if (loading) {
    return <LoadingSpinner label="Restoring your session..." />;
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" replace /> : <RegisterPage />} />

        <Route
          element={
            <ProtectedRoute>
              <ProtectedLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/posts" element={<PostHistory />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<NewCampaign />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/hashtags" element={<Hashtags />} />
          <Route path="/hashtags/new" element={<NewHashtag />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
