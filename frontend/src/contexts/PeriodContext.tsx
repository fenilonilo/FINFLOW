import { createContext, useContext, useState, type ReactNode } from 'react'

interface PeriodContextValue {
  year: number
  month: number
  setYear: (y: number) => void
  setMonth: (m: number) => void
  setPeriod: (y: number, m: number) => void
}

const PeriodContext = createContext<PeriodContextValue | null>(null)

export function PeriodProvider({ children }: { children: ReactNode }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  function setPeriod(y: number, m: number) {
    setYear(y)
    setMonth(m)
  }

  return (
    <PeriodContext.Provider value={{ year, month, setYear, setMonth, setPeriod }}>
      {children}
    </PeriodContext.Provider>
  )
}

export function usePeriod() {
  const ctx = useContext(PeriodContext)
  if (!ctx) throw new Error('usePeriod must be used within PeriodProvider')
  return ctx
}
