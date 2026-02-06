import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { configureAmplify } from './auth/cognito';
import { App } from './App';
import './index.css';

configureAmplify();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
