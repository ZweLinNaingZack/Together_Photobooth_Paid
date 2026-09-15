import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth/AuthProvider';
import { App } from './App';
import './styles/style.css';
import './styles/booth-flow.css';

createRoot(document.getElementById('root')!).render(<StrictMode><AuthProvider><App /></AuthProvider></StrictMode>);
