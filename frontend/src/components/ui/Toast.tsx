import { useState, useCallback, useEffect } from 'react'
import { X } from 'lucide-react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-accent/30 bg-accent/10 text-accent',
  error: 'border-danger/30 bg-danger/10 text-danger',
  warning: 'border-warning/30 bg-warning/10 text-warning',
  info: 'border-info/30 bg-info/10 text-info',
}

let toastCounter = 0

// Simple imperative toast API
type ToastFn = (message: string, variant?: ToastVariant) => void
let externalToast: ToastFn | null = null

export function toast(message: string, variant: ToastVariant = 'info') {
  if (externalToast) externalToast(message, variant)
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = ++toastCounter
    setToasts((prev) => [...prev, { id, message, variant }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  useEffect(() => {
    externalToast = addToast
    return () => {
      externalToast = null
    }
  }, [addToast])

  const remove = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id))

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-xl transition-all ${variantStyles[t.variant]}`}
        >
          <span>{t.message}</span>
          <button onClick={() => remove(t.id)} className="ml-auto opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
