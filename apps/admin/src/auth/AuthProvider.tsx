import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getCurrentUser,
  signOut,
  fetchAuthSession,
} from 'aws-amplify/auth';
import type { UserProfile } from '@fooder/shared-types';
import { apiClient } from '../api/client';

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signOutUser: async () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      await getCurrentUser();
      const session = await fetchAuthSession();
      if (session.tokens?.idToken) {
        const response = await apiClient.get<{ data: UserProfile }>('/api/me');
        setUser(response.data.data);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function signOutUser() {
    await signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
