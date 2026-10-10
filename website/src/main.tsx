import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import { startLanguage } from './i18n';
import './styles/style.css';
import './styles/booth-flow.css';

// Pick the language (saved choice or the phone's language) before the first draw,
// so Burmese and Vietnamese visitors never see a flash of English.
void startLanguage().finally(() => {
  createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>);
});
