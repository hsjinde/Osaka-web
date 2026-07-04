import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.tsx';
import { TripStateProvider } from './state/store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TripStateProvider>
      <App />
    </TripStateProvider>
  </StrictMode>,
);