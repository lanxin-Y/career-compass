import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { ProviderProvider } from './context/ProviderContext'
import { StatsProvider } from './context/StatsContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewAnalysis from './pages/NewAnalysis'
import NewProject from './pages/NewProject'
import AnalysisResult from './pages/AnalysisResult'
import DeepDive from './pages/DeepDive'

function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('unlocked') === 'true',
  )

  if (!unlocked) {
    return <Login onUnlock={() => setUnlocked(true)} />
  }

  return (
    <ProviderProvider>
      <StatsProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/new" element={<NewAnalysis />} />
              <Route path="/new-project" element={<NewProject />} />
              <Route path="/analysis/:id" element={<AnalysisResult />} />
              <Route path="/deep-dive/:id" element={<DeepDive />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </StatsProvider>
    </ProviderProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
