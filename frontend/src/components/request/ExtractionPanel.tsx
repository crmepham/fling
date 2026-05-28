import { Plus, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ResponseExtraction } from '../../types/api'

interface Props {
  extractions: ResponseExtraction[]
  onChange: (extractions: ResponseExtraction[]) => void
  hasActiveEnv: boolean
}

export function ExtractionPanel({ extractions, onChange, hasActiveEnv }: Props) {
  function addRule() {
    onChange([...extractions, { source: 'body', path: '', variableKey: '' }])
  }

  function updateRule(index: number, patch: Partial<ResponseExtraction>) {
    onChange(extractions.map((r, i) => i === index ? { ...r, ...patch } : r))
  }

  function removeRule(index: number) {
    onChange(extractions.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto min-h-0">
        {!hasActiveEnv && (
          <div className="mx-4 mt-3 px-3 py-2 rounded bg-overlay border border-border text-xs text-subtle">
            Select an active environment — extracted values will be written to its variables.
          </div>
        )}

        {extractions.length > 0 && (
          <div className="grid grid-cols-[120px_1fr_16px_1fr_28px] gap-2 px-4 pt-3 pb-1 items-center">
            <span className="text-[10px] font-medium text-subtle uppercase tracking-wider">Source</span>
            <span className="text-[10px] font-medium text-subtle uppercase tracking-wider">Path / Header</span>
            <span />
            <span className="text-[10px] font-medium text-subtle uppercase tracking-wider">Variable</span>
            <span />
          </div>
        )}

        <div className="px-4 pb-3 space-y-1.5">
          {extractions.map((rule, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_16px_1fr_28px] gap-2 items-center">
              <select
                value={rule.source}
                onChange={(e) => updateRule(i, { source: e.target.value as 'body' | 'header' })}
                className={cn(
                  'h-7 px-2 rounded bg-base border border-border',
                  'text-xs text-text outline-none focus:ring-1 focus:ring-accent focus:ring-inset cursor-pointer',
                )}
              >
                <option value="body">Body</option>
                <option value="header">Header</option>
              </select>

              <input
                value={rule.path}
                onChange={(e) => updateRule(i, { path: e.target.value })}
                placeholder={rule.source === 'body' ? 'data.token' : 'X-Auth-Token'}
                className={cn(
                  'h-7 px-2 rounded bg-base border border-border',
                  'text-xs font-mono text-text placeholder:text-subtle',
                  'outline-none focus:ring-1 focus:ring-accent focus:ring-inset',
                )}
              />

              <ArrowRight size={12} className="text-subtle mx-auto" />

              <input
                value={rule.variableKey}
                onChange={(e) => updateRule(i, { variableKey: e.target.value })}
                placeholder="token"
                className={cn(
                  'h-7 px-2 rounded bg-base border border-border',
                  'text-xs font-mono text-text placeholder:text-subtle',
                  'outline-none focus:ring-1 focus:ring-accent focus:ring-inset',
                )}
              />

              <button
                type="button"
                onClick={() => removeRule(i)}
                className="w-7 h-7 flex items-center justify-center text-subtle hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {extractions.length === 0 && (
            <p className="py-6 text-xs text-subtle text-center">
              No extraction rules. Add one to capture response values into environment variables.
            </p>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-border px-4 py-3">
        <button
          onClick={addRule}
          className={cn(
            'flex items-center gap-1.5 h-7 px-3 rounded text-xs',
            'text-subtle hover:text-text hover:bg-overlay border border-border transition-colors cursor-pointer',
          )}
        >
          <Plus size={11} />
          Add rule
        </button>
      </div>
    </div>
  )
}
