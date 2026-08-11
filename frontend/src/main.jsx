import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import { StatsProvider } from './context/StatsContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import NewAnalysis from './pages/NewAnalysis'
import AnalysisResult from './pages/AnalysisResult'
import DeepDive from './pages/DeepDive'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StatsProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/new" element={<NewAnalysis />} />
            <Route path="/analysis/:id" element={<AnalysisResult />} />
            <Route path="/deep-dive/:id" element={<DeepDive />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StatsProvider>
  </StrictMode>,
)
