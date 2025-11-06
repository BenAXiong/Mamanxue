import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ServiceWorkerProvider } from './pwa/ServiceWorkerProvider.tsx'
import { ToastProvider } from './components/ToastProvider.tsx'
import { ThemeProvider } from './theme/ThemeProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <ServiceWorkerProvider>
          <App />
        </ServiceWorkerProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>,
)
