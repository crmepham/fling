import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

const METHOD_COLORS: Record<string, string> = {
  GET:    'text-method-get',
  POST:   'text-method-post',
  PUT:    'text-method-put',
  PATCH:  'text-method-patch',
  DELETE: 'text-method-delete',
}

interface RequestOption {
  id: string
  name: string
  method: string
  collectionName: string
}

interface Props {
  preRequestId: string | null
  successCodes: number[]
  availableRequests: RequestOption[]
  currentRequestId?: string
  onPreRequestChange: (id: string | null) => void
  onSuccessCodesChange: (codes: number[]) => void
}

export function PreRequestPanel({
  preRequestId,
  successCodes,
  availableRequests,
  currentRequestId,
  onPreRequestChange,
  onSuccessCodesChange,
}: Props) {
  const [codeInput, setCodeInput] = useState('')
  const [codeInputError, setCodeInputError] = useState(false)
  const codeInputRef = useRef<HTMLInputElement>(null)

  const options = availableRequests.filter((r) => r.id !== currentRequestId)
  const selected = options.find((r) => r.id === preRequestId) ?? null

  // Group by collection
  const grouped = options.reduce<Record<string, RequestOption[]>>((acc, r) => {
    const key = r.collectionName
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  function commitCodeInput() {
    const raw = codeInput.trim()
    if (!raw) return
    const num = parseInt(raw, 10)
    if (isNaN(num) || num < 100 || num > 599) {
      setCodeInputError(true)
      return
    }
    if (!successCodes.includes(num)) {
      onSuccessCodesChange([...successCodes, num])
    }
    setCodeInput('')
    setCodeInputError(false)
  }

  function removeCode(code: number) {
    onSuccessCodesChange(successCodes.filter((c) => c !== code))
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
      {/* Request selector */}
      <div className="space-y-2">
        <label className="text-[10px] font-medium text-subtle uppercase tracking-wider">
          Pre-request
        </label>
        <p className="text-xs text-subtle">
          This request runs first. The main request only sends if it returns a success code.
        </p>
        <div className="flex items-center gap-2">
          <select
            value={preRequestId ?? ''}
            onChange={(e) => onPreRequestChange(e.target.value || null)}
            className={cn(
              'flex-1 h-7 px-2 rounded bg-base border border-border',
              'text-xs text-text outline-none focus:ring-1 focus:ring-accent focus:ring-inset cursor-pointer',
            )}
          >
            <option value="">None</option>
            {Object.entries(grouped).map(([collectionName, reqs]) => (
              <optgroup key={collectionName} label={collectionName}>
                {reqs.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.method} {r.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selected && (
            <button
              onClick={() => onPreRequestChange(null)}
              title="Clear pre-request"
              className="p-1 text-subtle hover:text-red-400 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {selected && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-overlay border border-border">
            <span className={cn('font-mono font-semibold shrink-0 text-[10px]', METHOD_COLORS[selected.method] ?? 'text-subtle')}>{selected.method}</span>
            <span className="text-xs text-text truncate">{selected.name}</span>
            <span className="ml-auto text-[10px] text-subtle truncate">{selected.collectionName}</span>
          </div>
        )}
      </div>

      {/* Success codes */}
      {selected && (
        <div className="space-y-2">
          <label className="text-[10px] font-medium text-subtle uppercase tracking-wider">
            Success codes
          </label>
          <p className="text-xs text-subtle">
            The main request runs only if the pre-request responds with one of these status codes.
          </p>

          <div
            className={cn(
              'flex flex-wrap gap-1.5 min-h-[32px] px-2 py-1.5 rounded bg-base border cursor-text',
              codeInputError ? 'border-red-500' : 'border-border focus-within:border-accent',
            )}
            onClick={() => codeInputRef.current?.focus()}
          >
            {successCodes.map((code) => (
              <span
                key={code}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-overlay border border-border text-xs font-mono text-text"
              >
                {code}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeCode(code) }}
                  className="text-subtle hover:text-red-400 transition-colors"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            <input
              ref={codeInputRef}
              value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value); setCodeInputError(false) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitCodeInput() }
                if (e.key === 'Backspace' && !codeInput && successCodes.length > 0) {
                  onSuccessCodesChange(successCodes.slice(0, -1))
                }
              }}
              onBlur={commitCodeInput}
              placeholder={successCodes.length === 0 ? 'e.g. 200' : ''}
              maxLength={3}
              className="flex-1 min-w-[48px] bg-transparent text-xs font-mono text-text placeholder:text-subtle outline-none"
            />
          </div>
          {codeInputError && (
            <p className="text-xs text-red-400">Enter a valid HTTP status code (100–599)</p>
          )}
        </div>
      )}

      {!selected && (
        <p className="py-4 text-xs text-subtle text-center">
          No pre-request configured.
        </p>
      )}
    </div>
  )
}
