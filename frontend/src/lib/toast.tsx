import { createContext, useCallback, useContext, useState } from 'react'
import { X, AlertCircle, CheckCircle } from 'lucide-react'
import { cn } from './utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type ToastType = 'error' | 'success'

interface ToastItem {
  id: string
  message: string
  type: ToastType
}

type ShowToast = (message: string, type?: ToastType) => void

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const show = useCallback<ShowToast>((message, type = 'error') => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => dismiss(id), 5000)
  }, [])

  function dismiss(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={show}>
      {children}

      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={cn(
                'flex items-start gap-2.5 px-3 py-2.5 rounded border text-xs pointer-events-auto',
                'animate-in slide-in-from-bottom-2 fade-in duration-200',
                t.type === 'error'
                  ? 'bg-red-950/90 text-red-200 border-red-800/60'
                  : 'bg-green-950/90 text-green-200 border-green-800/60',
              )}
            >
              {t.type === 'error'
                ? <AlertCircle size={13} className="shrink-0 mt-px text-red-400" />
                : <CheckCircle size={13} className="shrink-0 mt-px text-green-400" />
              }
              <span className="flex-1 leading-relaxed">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 mt-px opacity-60 hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}
