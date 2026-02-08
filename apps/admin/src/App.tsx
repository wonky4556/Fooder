import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { AuthCallback } from './auth/AuthCallback';
import { AdminLayout } from './components/AdminLayout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { MenuItems } from './pages/MenuItems';
import { MenuItemForm } from './pages/MenuItemForm';
import { Schedules } from './pages/Schedules';
import { ScheduleForm } from './pages/ScheduleForm';
import { ScheduleDetail } from './pages/ScheduleDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 1 },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/menu-items" element={<MenuItems />} />
              <Route path="/menu-items/new" element={<MenuItemForm />} />
              <Route path="/menu-items/:id/edit" element={<MenuItemForm />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/schedules/new" element={<ScheduleForm />} />
              <Route path="/schedules/:id" element={<ScheduleDetail />} />
              <Route path="/schedules/:id/edit" element={<ScheduleForm />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
