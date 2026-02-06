import { useAuth } from '../auth/AuthProvider';

export function Dashboard() {
  const { user, signOutUser } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Fooder Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.displayName ?? user?.email}
            </span>
            <button
              onClick={signOutUser}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-300"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h2 className="text-xl font-semibold text-gray-800">Dashboard</h2>
        <p className="mt-2 text-gray-600">
          Welcome back, {user?.displayName ?? 'Admin'}!
        </p>
      </main>
    </div>
  );
}
