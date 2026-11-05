import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

// registerType 'prompt': a new build waits until the user accepts the update (no silent stale builds).
// The SW scope follows its file location under BASE (vite `base`), so no explicit scope is passed.
registerSW({
  onNeedRefresh() {
    // Phase 1: no update UI yet. The new build loads on next launch.
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
