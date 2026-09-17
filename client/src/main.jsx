import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { ConfirmProvider } from './components/Confirm.jsx'
import { ToastProvider } from './components/Toast.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <ConfirmProvider>
        <App />
      </ConfirmProvider>
    </ToastProvider>
  </StrictMode>
)
