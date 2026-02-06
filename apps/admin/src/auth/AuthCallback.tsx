import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Amplify automatically handles the OAuth callback
    // and stores the tokens. Just redirect to the dashboard.
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg text-gray-600">Completing sign in...</p>
    </div>
  );
}
