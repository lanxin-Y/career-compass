import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'career-compass-provider'
const ProviderContext = createContext(null)

export function ProviderProvider({ children }) {
  const [provider, setProviderState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved === 'deepseek' ? 'deepseek' : 'claude'
    } catch {
      return 'claude'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, provider)
    } catch {
      // ignore storage failures
    }
  }, [provider])

  const value = useMemo(
    () => ({
      provider,
      setProvider: (next) => {
        if (next === 'claude' || next === 'deepseek') setProviderState(next)
      },
    }),
    [provider],
  )

  return (
    <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>
  )
}

export function useProvider() {
  const ctx = useContext(ProviderContext)
  if (!ctx) throw new Error('useProvider must be used within ProviderProvider')
  return ctx
}
