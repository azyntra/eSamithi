import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles.css'
import { AuthProvider, useAuth } from './auth'
import { ToastProvider } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Samithis from './pages/Samithis'
import SamithiDetail from './pages/SamithiDetail'
import Reports from './pages/Reports'
import Broadcasts from './pages/Broadcasts'
import Operations from './pages/Operations'
import Sessions from './pages/Sessions'
import Audit from './pages/Audit'

// Apply persisted theme before first paint
document.documentElement.dataset.theme = localStorage.getItem('esamithi-theme') || 'light'

function Gate(): React.ReactElement {
  const { status } = useAuth()
  if (status === 'loading') {
    return <div className="login-wrap"><div className="spin"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg></div></div>
  }
  if (status === 'out') return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="samithis" element={<Samithis />} />
        <Route path="samithis/:slug" element={<SamithiDetail />} />
        <Route path="reports" element={<Reports />} />
        <Route path="broadcasts" element={<Broadcasts />} />
        <Route path="operations" element={<Operations />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="audit" element={<Audit />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ToastProvider>
        <AuthProvider>
          <Gate />
        </AuthProvider>
      </ToastProvider>
    </HashRouter>
  </React.StrictMode>
)
