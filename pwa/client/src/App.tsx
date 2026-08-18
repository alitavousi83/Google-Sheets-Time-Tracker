import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useAppStore } from './stores/appStore';
import { useTimerStore } from './stores/timerStore';
import { processSyncQueue } from './lib/offline';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import TimeTracker from './pages/TimeTracker';
import DailySchedule from './pages/DailySchedule';
import TasksPage from './pages/TasksPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CalendarPage from './pages/CalendarPage';
import ActivitiesPage from './pages/ActivitiesPage';
import SettingsPage from './pages/SettingsPage';
import ToastContainer from './components/ToastContainer';
import LoadingScreen from './components/LoadingScreen';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export default function App() {
  const { init, user, loading } = useAuthStore();
  const fetchActivities = useAppStore((s) => s.fetchActivities);
  const fetchSettings = useAppStore((s) => s.fetchSettings);
  const fetchTimer = useTimerStore((s) => s.fetchTimer);

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (user) {
      fetchActivities();
      fetchSettings();
      fetchTimer();
    }
  }, [user, fetchActivities, fetchSettings, fetchTimer]);

  useEffect(() => {
    const sync = () => {
      if (navigator.onLine) {
        processSyncQueue(async (method, path, body) => {
          await fetch(`/api${path}`, {
            method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
            body: body ? JSON.stringify(body) : undefined,
          });
        });
      }
    };
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <>
      <Routes>
        <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/tracker" element={<TimeTracker />} />
                  <Route path="/schedule" element={<DailySchedule />} />
                  <Route path="/tasks" element={<TasksPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/activities" element={<ActivitiesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      <ToastContainer />
    </>
  );
}
