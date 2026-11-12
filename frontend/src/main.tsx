import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from '@/contexts/AuthContext'
import { PeriodProvider } from '@/contexts/PeriodContext'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/400-italic.css'
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import './index.css'

async function enableMocking() {
  if (import.meta.env.VITE_API_MOCK !== 'true') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

void enableMocking().catch(console.warn).then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <PeriodProvider>
                <App />
              </PeriodProvider>
            </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
})
