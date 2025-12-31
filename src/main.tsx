import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { BrowserRouter } from 'react-router-dom';


import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { ThemeProvider } from "./components/theme-provider.tsx"

import "./main.css"
import "./styles/theme.css"
import "./index.css"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <ThemeProvider storageKey="easyfood-theme">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </ErrorBoundary>
)
