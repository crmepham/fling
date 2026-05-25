import { useState, useEffect } from 'react'
import { cn } from '../../lib/utils'
import { useEnvironmentDetail, useBulkUpdateVariables } from '../../hooks/useEnvironments'
import type { KeyValue } from '../../types/api'

const VAR_RE = /\{\{(\w+)\}\}/g

function extractVarNames(strings: string[]): string[] {
  const seen = new Set<string>()
  for (const s of strings) {
    for (const m of s.matchAll(new RegExp(VAR_RE.source, 'g'))) {
      seen.add(m[1])
    }
  }
  return Array.from(seen)
}

interface Props {
  selectedEnvId: string
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: string
  envVariables: Record<string, string>
  onVarChange: (name: string, value: string) => void
}

export function VariablesPanel({ selectedEnvId, url, params, headers, body, envVariables, onVarChange }: Props) {
  const hasEnv = selectedEnvId !== 'none'
  const { data: envDetail } = useEnvironmentDetail(hasEnv ? selectedEnvId : null)
  const bulkUpdate = useBulkUpdateVariables()

  const varNames = extractVarNames([
    url,
    ...params.flatMap((p) => [p.key, p.value]),
    ...headers.flatMap((h) => [h.key, h.value]),
    body,
  ])

  const [localValues, setLocalValues] = useState<Record<string, string>>({})

  // Sync localValues from envVariables whenever they diverge.
  // This handles: env switch, new variables, and external updates (e.g. modal save).
  // Does NOT call onVarChange, so it never creates overrides — no infinite loop.
  useEffect(() => {
    setLocalValues((prev) => {
      const next: Record<string, string> = {}
      let changed = false
      for (const name of varNames) {
        const envVal = envVariables[name] ?? ''
        if (prev[name] !== envVal) {
          next[name] = envVal
          changed = true
        } else {
          next[name] = prev[name] ?? ''
        }
      }
      return changed ? next : prev
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envVariables, varNames.join(','), selectedEnvId])

  if (varNames.length === 0) return null

  async function saveVariable(name: string, value: string) {
    if (!hasEnv || !envDetail) return
    const others = envDetail.variables.filter((v) => v.key !== name)
    const existing = envDetail.variables.find((v) => v.key === name)
    await bulkUpdate.mutateAsync({
      id: selectedEnvId,
      variables: [
        ...others.map((v) => ({ id: v.id, key: v.key, value: v.value ?? '', isSecret: v.isSecret })),
        { id: existing?.id ?? '', key: name, value, isSecret: existing?.isSecret ?? false },
      ],
    })
  }

  return (
    <div className="w-52 shrink-0 border-l border-border flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-border shrink-0">
        <span className="text-[10px] font-semibold text-subtle uppercase tracking-widest">
          Variables
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {varNames.map((name) => {
          const resolved = name in envVariables
          return (
            <div key={name} className="px-3 py-2.5 border-b border-border/50">
              <p className={cn(
                'text-[10px] font-mono font-semibold mb-1.5 truncate',
                resolved ? 'text-accent' : 'text-amber-400',
              )}>
                {`{{${name}}}`}
              </p>

              {hasEnv ? (
                <input
                  value={localValues[name] ?? ''}
                  onChange={(e) => {
                    setLocalValues((prev) => ({ ...prev, [name]: e.target.value }))
                    onVarChange(name, e.target.value)
                  }}
                  onBlur={(e) => saveVariable(name, e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                  placeholder="not set"
                  className={cn(
                    'w-full bg-transparent text-xs font-mono text-text',
                    'placeholder:text-subtle outline-none py-0.5',
                    'border-b border-transparent focus:border-accent transition-colors',
                  )}
                />
              ) : (
                <p className="text-[11px] text-subtle italic">Select an environment</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
