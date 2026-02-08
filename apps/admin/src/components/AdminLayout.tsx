import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { Header } from '@fooder/shared-ui';
import { PageContainer } from '@fooder/shared-ui';
import { Button } from '@fooder/shared-ui';

export function AdminLayout() {
  const { user, signOutUser } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        title="Fooder Admin"
        rightContent={
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.displayName ?? user?.email}</span>
            <Button variant="secondary" onClick={signOutUser}>Sign out</Button>
          </div>
        }
      />
      <nav className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex gap-6">
            <NavLink to="/" end className={({ isActive }) => `py-3 text-sm font-medium border-b-2 ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Dashboard
            </NavLink>
            <NavLink to="/menu-items" className={({ isActive }) => `py-3 text-sm font-medium border-b-2 ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Menu Items
            </NavLink>
            <NavLink to="/schedules" className={({ isActive }) => `py-3 text-sm font-medium border-b-2 ${isActive ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              Schedules
            </NavLink>
          </div>
        </div>
      </nav>
      <PageContainer>
        <Outlet />
      </PageContainer>
    </div>
  );
}
