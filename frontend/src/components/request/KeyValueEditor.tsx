import { useRef } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { hasVariables, parseSegments } from '../../lib/variables'
import { VarColoredInput } from './VarColoredInput'
import type { KeyValue } from '../../types/api'

interface Props {
  rows: KeyValue[]
  onChange: (rows: KeyValue[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  envVariables?: Record<string, string>
}

export function KeyValueEditor({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value', envVariables = {} }: Props) {
  const pendingFocusId = useRef<string | null>(null)
  const keyInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  function addRow() {
    const id = crypto.randomUUID()
    pendingFocusId.current = id
    onChange([...rows, { id, key: '', value: '', enabled: true }])
  }

  function updateRow(id: string, patch: Partial<KeyValue>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    const next = rows.filter((r) => r.id !== id)
    onChange(next.length > 0 ? next : [{ id: crypto.randomUUID(), key: '', value: '', enabled: true }])
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="grid grid-cols-[16px_1fr_1fr_28px] gap-2 px-3 py-1.5 border-b border-border">
        <div />
        <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">{keyPlaceholder}</span>
        <span className="text-[11px] font-medium text-subtle uppercase tracking-wider">{valuePlaceholder}</span>
        <div />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {rows.map((row) => {
          const valueHasVars = row.value.trim() !== '' && hasVariables(row.value)
          const segments = valueHasVars ? parseSegments(row.value, envVariables) : []

          return (
            <div
              key={row.id}
              className={cn(
                'grid grid-cols-[16px_1fr_1fr_28px] gap-2 px-3 py-1 items-start',
                'border-b border-border/50 group',
                !row.enabled && 'opacity-40',
              )}
            >
              {/* Enabled toggle */}
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
                className="w-3.5 h-3.5 mt-1 accent-accent cursor-pointer"
              />

              {/* Key */}
              <VarColoredInput
                ref={(el) => {
                  keyInputRefs.current[row.id] = el
                  if (el && pendingFocusId.current === row.id) {
                    el.focus()
                    pendingFocusId.current = null
                  }
                }}
                value={row.key}
                onChange={(val) => updateRow(row.id, { key: val })}
                placeholder={keyPlaceholder}
                envVariables={envVariables}
                className={cn(
                  'w-full bg-transparent text-xs font-mono outline-none py-0.5',
                  'border-b border-transparent focus:border-accent transition-colors',
                )}
              />

              {/* Value + preview */}
              <div>
                <VarColoredInput
                  value={row.value}
                  onChange={(val) => updateRow(row.id, { value: val })}
                  placeholder={valuePlaceholder}
                  envVariables={envVariables}
                  className={cn(
                    'w-full bg-transparent text-xs font-mono outline-none py-0.5',
                    'border-b border-transparent focus:border-accent transition-colors',
                  )}
                />
                {valueHasVars && (
                  <p className="text-[10px] font-mono truncate mt-0.5">
                    {segments.map((seg, i) => (
                      <span
                        key={i}
                        className={
                          seg.type === 'resolved' ? 'text-accent' :
                          seg.type === 'unresolved' ? 'text-amber-400' :
                          'text-subtle'
                        }
                      >{seg.text}</span>
                    ))}
                  </p>
                )}
              </div>

              {/* Delete */}
              <button
                onClick={() => removeRow(row.id)}
                className="mt-0.5 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-overlay text-subtle hover:text-text transition-all"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )
        })}
      </div>

      {/* Add row */}
      <div className="p-2 border-t border-border">
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted hover:text-text rounded hover:bg-overlay transition-colors"
        >
          <Plus size={12} />
          Add row
        </button>
      </div>
    </div>
  )
}
