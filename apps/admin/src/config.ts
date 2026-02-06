export const config = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
    userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
    domain: import.meta.env.VITE_COGNITO_DOMAIN ?? '',
    redirectSignIn: import.meta.env.VITE_COGNITO_REDIRECT_SIGN_IN ?? `${window.location.origin}/auth/callback`,
    redirectSignOut: import.meta.env.VITE_COGNITO_REDIRECT_SIGN_OUT ?? `${window.location.origin}/login`,
  },
} as const;
