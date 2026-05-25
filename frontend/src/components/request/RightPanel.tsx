import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '../../lib/utils'
import { resolveVars } from '../../lib/variables'
import { useEnvironmentDetail, useBulkUpdateVariables } from '../../hooks/useEnvironments'
import { VarColoredInput } from './VarColoredInput'
import type { KeyValue, AuthConfig } from '../../types/api'

// ─── cURL builder ─────────────────────────────────────────────────────────────

const VAR_RE = /\{\{(\w+)\}\}/g

function buildCurl(
  method: string,
  url: string,
  params: KeyValue[],
  headers: KeyValue[],
  body: string,
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT',
  envVariables: Record<string, string>,
  auth?: AuthConfig,
  collectionAuth?: AuthConfig | null,
): string {
  const r = (s: string) => resolveVars(s, envVariables)
  const base = r(url.split('?')[0])
  const activeParams = params.filter((p) => p.enabled && p.key.trim() !== '')
  const qs = activeParams
    .map((p) => `${encodeURIComponent(r(p.key))}=${encodeURIComponent(r(p.value))}`)
    .join('&')
  const fullUrl = qs ? `${base}?${qs}` : base

  const lines: string[] = [`curl -X ${method} '${fullUrl}'`]

  const activeHeaders = headers.filter((h) => h.enabled && h.key.trim() !== '')
  const hasManualAuth = activeHeaders.some((h) => h.key.toLowerCase() === 'authorization')

  // Resolve effective auth — inherit falls back to collection auth
  const effectiveAuth = auth?.type === 'inherit' ? collectionAuth : auth
  if (effectiveAuth?.type === 'basic' && effectiveAuth.enabled && !hasManualAuth) {
    const token = btoa(`${r(effectiveAuth.username)}:${r(effectiveAuth.password)}`)
    lines.push(`  -H 'Authorization: Basic ${token}'`)
  }

  // Auto content-type for body (only if not already set)
  const hasContentType = activeHeaders.some((h) => h.key.toLowerCase() === 'content-type')
  if (!hasContentType && body && bodyType === 'JSON') {
    lines.push(`  -H 'Content-Type: application/json'`)
  } else if (!hasContentType && body && bodyType === 'FORM') {
    lines.push(`  -H 'Content-Type: application/x-www-form-urlencoded'`)
  }

  for (const h of activeHeaders) {
    lines.push(`  -H '${r(h.key)}: ${r(h.value)}'`)
  }

  if (body && bodyType !== 'NONE') {
    const escaped = r(body).replace(/'/g, `'\\''`)
    lines.push(`  -d '${escaped}'`)
  }

  return lines.join(' \\\n')
}

// ─── Variables tab ────────────────────────────────────────────────────────────

function extractVarNames(strings: string[]): string[] {
  const seen = new Set<string>()
  for (const s of strings) {
    for (const m of s.matchAll(new RegExp(VAR_RE.source, 'g'))) seen.add(m[1])
  }
  return Array.from(seen)
}

interface VariablesTabProps {
  selectedEnvId: string
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: string
  auth: AuthConfig
  envVariables: Record<string, string>
  onVarChange: (name: string, value: string) => void
}

function VariablesTab({ selectedEnvId, url, params, headers, body, auth, envVariables, onVarChange }: VariablesTabProps) {
  const hasEnv = selectedEnvId !== 'none'
  const { data: envDetail } = useEnvironmentDetail(hasEnv ? selectedEnvId : null)
  const bulkUpdate = useBulkUpdateVariables()

  const varNames = extractVarNames([
    url,
    ...params.flatMap((p) => [p.key, p.value]),
    ...headers.flatMap((h) => [h.key, h.value]),
    body,
    auth.type === 'basic' ? auth.username : '',
    auth.type === 'basic' ? auth.password : '',
  ])

  if (varNames.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-xs text-subtle text-center">No variables in use</p>
      </div>
    )
  }

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
              <VarColoredInput
                value={envVariables[name] ?? ''}
                onChange={(val) => onVarChange(name, val)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                onBlur={(e) => saveVariable(name, e.currentTarget.value)}
                placeholder="not set"
                envVariables={envVariables}
                className={cn(
                  'w-full bg-transparent text-xs font-mono outline-none py-0.5',
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
  )
}

// ─── cURL tab ─────────────────────────────────────────────────────────────────

interface CurlTabProps {
  method: string
  url: string
  params: KeyValue[]
  headers: KeyValue[]
  body: string
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
  envVariables: Record<string, string>
  auth?: AuthConfig
  collectionAuth?: AuthConfig | null
}

function CurlTab({ method, url, params, headers, body, bodyType, envVariables, auth, collectionAuth }: CurlTabProps) {
  const [copied, setCopied] = useState(false)
  const curl = buildCurl(method, url, params, headers, body, bodyType, envVariables, auth, collectionAuth)

  function handleCopy() {
    navigator.clipboard.writeText(curl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 flex justify-end px-2 py-1.5 border-b border-border">
        <button
          onClick={handleCopy}
          title="Copy to clipboard"
          className={cn(
            'flex items-center gap-1.5 h-6 px-2 rounded text-[10px] transition-colors',
            copied
              ? 'text-green-400 bg-green-400/10'
              : 'text-subtle hover:text-text hover:bg-overlay',
          )}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-3 text-[11px] font-mono text-text leading-relaxed whitespace-pre-wrap break-all">
        {curl}
      </pre>
    </div>
  )
}

// ─── RightPanel ───────────────────────────────────────────────────────────────

type Tab = 'variables' | 'curl'

interface Props extends VariablesTabProps {
  method: string
  bodyType: 'NONE' | 'JSON' | 'FORM' | 'TEXT'
  auth: AuthConfig
  collectionAuth?: AuthConfig | null
}

export function RightPanel({ method, url, params, headers, body, bodyType, auth, collectionAuth, selectedEnvId, envVariables, onVarChange }: Props) {
  const [tab, setTab] = useState<Tab>('variables')

  return (
    <div className="w-52 shrink-0 border-l border-border flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-border">
        {(['variables', 'curl'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 py-2 text-[10px] font-semibold uppercase tracking-widest transition-colors',
              tab === t
                ? 'text-text border-b-2 border-accent -mb-px'
                : 'text-subtle hover:text-muted',
            )}
          >
            {t === 'curl' ? 'cURL' : 'Variables'}
          </button>
        ))}
      </div>

      {tab === 'variables' && (
        <VariablesTab
          selectedEnvId={selectedEnvId}
          url={url}
          params={params}
          headers={headers}
          body={body}
          auth={auth}
          envVariables={envVariables}
          onVarChange={onVarChange}
        />
      )}
      {tab === 'curl' && (
        <CurlTab
          method={method}
          url={url}
          params={params}
          headers={headers}
          body={body}
          bodyType={bodyType}
          envVariables={envVariables}
          auth={auth}
          collectionAuth={collectionAuth}
        />
      )}
    </div>
  )
}
