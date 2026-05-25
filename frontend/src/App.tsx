import { useState, useEffect, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Tooltip from '@radix-ui/react-tooltip'
import { TopBar } from './components/layout/TopBar'
import { Sidebar } from './components/layout/Sidebar'
import { RequestPanel } from './components/request/RequestPanel'
import { RightPanel } from './components/request/RightPanel'
import { ResponsePanel } from './components/response/ResponsePanel'
import { LoginPage } from './components/auth/LoginPage'
import { ToastProvider } from './lib/toast'
import { api, setOnUnauthorized } from './lib/apiClient'
import { resolveVars } from './lib/variables'
import { useEnvironments, useEnvironmentDetail } from './hooks/useEnvironments'
import { useCollections } from './hooks/useCollections'
import type { HttpMethod, KeyValue, ExecuteResponse, SavedRequest, AuthConfig } from './types/api'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRow(overrides: Partial<KeyValue> = {}): KeyValue {
  return { id: crypto.randomUUID(), key: '', value: '', enabled: true, ...overrides }
}

// Create the React Query client once outside the component so it isn't
// recreated on every render. It manages the cache for all useQuery/useMutation calls.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, staleTime: 30_000 },
  },
})

// ─── Helpers for history loading ─────────────────────────────────────────────

const HTTP_STATUS_TEXT: Record<number, string> = {
  200: 'OK', 201: 'Created', 204: 'No Content',
  301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict',
  422: 'Unprocessable Entity', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout',
}

function guessBodyType(body?: string | null, headers?: Record<string, string>): 'NONE' | 'JSON' | 'FORM' | 'TEXT' {
  if (!body) return 'NONE'
  const ct = Object.entries(headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? ''
  if (ct.includes('application/json')) return 'JSON'
  if (ct.includes('application/x-www-form-urlencoded')) return 'FORM'
  try { JSON.parse(body); return 'JSON' } catch {}
  return 'TEXT'
}

// ─── AppShell ─────────────────────────────────────────────────────────────────
// All request/response state lives here and is passed down as props.
// Once this grows unwieldy, it's a natural candidate for a Zustand store.

function AppShell({ onLogout }: { onLogout: () => void }) {
  // ── Request state ──────────────────────────────────────────────────────────
  const [method, setMethod] = useState<HttpMethod>('GET')
  const [url, setUrl] = useState('https://')
  const [params, setParams] = useState<KeyValue[]>([makeRow()])
  const [headers, setHeaders] = useState<KeyValue[]>([makeRow()])
  const [body, setBody] = useState('')
  const [bodyType, setBodyType] = useState<'NONE' | 'JSON' | 'FORM' | 'TEXT'>('NONE')
  const [requestTab, setRequestTab] = useState<'params' | 'headers' | 'body' | 'auth'>('params')

  // ── Auth state ─────────────────────────────────────────────────────────────
  const defaultAuth: AuthConfig = { type: 'none', enabled: true, username: '', password: '' }
  const [auth, setAuth] = useState<AuthConfig>(defaultAuth)
  const [savedAuth, setSavedAuth] = useState<AuthConfig>(defaultAuth)

  // ── Active saved request (set when loaded from sidebar) ───────────────────
  const [activeRequest, setActiveRequest] = useState<SavedRequest | null>(null)

  // ── Response state ─────────────────────────────────────────────────────────
  const [response, setResponse] = useState<ExecuteResponse | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [isExecuting, setExecuting] = useState(false)
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body')
  const [sentAt, setSentAt] = useState<Date | null>(null)

  // ── Environment state ──────────────────────────────────────────────────────
  const [selectedEnv, setSelectedEnv] = useState('none')
  const { data: environments = [] } = useEnvironments()
  const { data: collections = [] } = useCollections()

  // ── Collection auth for the active request ─────────────────────────────────
  const collectionAuth = useMemo(() => {
    if (!activeRequest?.collectionId) return null
    return collections.find((c) => c.id === activeRequest.collectionId)?.auth ?? null
  }, [activeRequest, collections])
  const { data: envDetail } = useEnvironmentDetail(selectedEnv === 'none' ? null : selectedEnv)
  const baseEnvVariables = useMemo<Record<string, string>>(
    () => Object.fromEntries(
      (envDetail?.variables ?? []).filter((v) => v.value !== null).map((v) => [v.key, v.value as string])
    ),
    [envDetail]
  )
  const [envOverrides, setEnvOverrides] = useState<Record<string, string>>({})
  const envVariables = useMemo(
    () => ({ ...baseEnvVariables, ...envOverrides }),
    [baseEnvVariables, envOverrides]
  )

  // Auto-select the first environment on initial load
  useEffect(() => {
    if (selectedEnv === 'none' && environments.length > 0) {
      setSelectedEnv(environments[0].id)
    }
  }, [environments, selectedEnv])

  // Clear overrides when environment changes or when server data updates (e.g. modal save)
  useEffect(() => {
    setEnvOverrides({})
  }, [selectedEnv, baseEnvVariables])

  // ── Reset to blank request ─────────────────────────────────────────────────
  function handleNewRequest() {
    setActiveRequest(null)
    setMethod('GET')
    setUrl('https://')
    setParams([makeRow()])
    setHeaders([makeRow()])
    setBody('')
    setBodyType('NONE')
    setAuth(defaultAuth)
    setSavedAuth(defaultAuth)
    setRequestTab('params')
    setResponse(null)
    setExecuteError(null)
  }

  // ── URL ↔ params two-way sync ──────────────────────────────────────────────
  function handleUrlChange(newUrl: string) {
    setUrl(newUrl)
    const qIdx = newUrl.indexOf('?')
    if (qIdx !== -1) {
      const qs = newUrl.slice(qIdx + 1)
      const parsed: KeyValue[] = qs
        .split('&')
        .filter(Boolean)
        .map((part) => {
          const eqIdx = part.indexOf('=')
          return {
            id: crypto.randomUUID(),
            key: eqIdx >= 0 ? part.slice(0, eqIdx) : part,
            value: eqIdx >= 0 ? part.slice(eqIdx + 1) : '',
            enabled: true,
          }
        })
      setParams(parsed.length > 0 ? parsed : [makeRow()])
    }
  }

  function handleParamsChange(newParams: KeyValue[]) {
    setParams(newParams)
    const base = url.split('?')[0]
    const active = newParams.filter((p) => p.enabled && p.key.trim() !== '')
    setUrl(
      active.length > 0
        ? `${base}?${active.map((p) => `${p.key}=${p.value}`).join('&')}`
        : base,
    )
  }

  // ── Method change — clear body when switching to a bodyless method ─────────
  function handleMethodChange(m: HttpMethod) {
    setMethod(m)
    if (m === 'GET' || m === 'DELETE') {
      setBody('')
      setBodyType('NONE')
    }
  }

  // ── Load saved request ─────────────────────────────────────────────────────
  function handleRequestSelect(req: SavedRequest) {
    const bodyless = req.method === 'GET' || req.method === 'DELETE'
    setActiveRequest(req)
    setMethod(req.method)
    setUrl((req.url || 'https://').split('?')[0])
    setParams(req.queryParams.map((p) => ({ ...p, id: crypto.randomUUID() })))
    setHeaders(req.headers.map((h) => ({ ...h, id: crypto.randomUUID() })))
    setBody(bodyless ? '' : (req.body ?? ''))
    setBodyType(bodyless ? 'NONE' : req.bodyType)
    const storedAuth = req.auth ?? defaultAuth
    setAuth(storedAuth)
    setSavedAuth(storedAuth)
    setResponse(null)
  }

  // ── Shared execute logic ───────────────────────────────────────────────────
  async function executeRequest(payload: object) {
    setExecuting(true)
    setExecuteError(null)
    setResponse(null)
    setSentAt(new Date())
    try {
      const res = await fetch('/api/v1/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        let message = `Server error ${res.status}`
        try {
          const body = await res.json()
          if (body?.error?.message) message = body.error.message
        } catch { /* ignore, use default */ }
        throw new Error(message)
      }
      const data: ExecuteResponse = await res.json()
      setResponse(data)
      setResponseTab('body')
      queryClient.refetchQueries({ queryKey: ['history'] })
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setExecuting(false)
    }
  }

  // ── Load and immediately send a saved request ─────────────────────────────
  function handleRequestSend(req: SavedRequest) {
    handleRequestSelect(req)
    const bodyless = req.method === 'GET' || req.method === 'DELETE'
    const activeHeaders = req.headers.filter((h) => h.key.trim() !== '')
    const authHeader = buildAuthHeader()
    const hasManualAuth = activeHeaders.some((h) => h.key.toLowerCase() === 'authorization')
    const mergedHeaders = authHeader && !hasManualAuth ? [authHeader, ...activeHeaders] : activeHeaders
    executeRequest({
      environmentId: selectedEnv === 'none' ? undefined : selectedEnv,
      method: req.method,
      url: req.url,
      queryParams: req.queryParams.filter((p) => p.key.trim() !== ''),
      headers: mergedHeaders,
      body: bodyless ? undefined : (req.body || undefined),
      bodyType: bodyless ? 'NONE' : req.bodyType,
    })
  }

  // ── Load a history item into the form + restore its response ─────────────
  async function handleHistorySelect(id: string) {
    try {
      const detail = await api.getHistory(id)
      const bodyless = detail.method === 'GET' || detail.method === 'DELETE'

      setActiveRequest(null)
      setMethod(detail.method as HttpMethod)
      setUrl((detail.url || 'https://').split('?')[0])
      setParams(
        Object.entries(detail.queryParams ?? {}).map(([key, value]) => ({
          id: crypto.randomUUID(), key, value, enabled: true,
        }))
      )
      setHeaders(
        Object.entries(detail.headers ?? {}).map(([key, value]) => ({
          id: crypto.randomUUID(), key, value, enabled: true,
        }))
      )
      setBody(bodyless ? '' : (detail.body ?? ''))
      setBodyType(bodyless ? 'NONE' : guessBodyType(detail.body, detail.headers))
      setExecuteError(null)

      if (detail.responseStatus != null) {
        const httpStatus = HTTP_STATUS_TEXT[detail.responseStatus] ?? ''
        setResponse({
          historyId: detail.id,
          request: {
            method: detail.method,
            url: detail.url,
            queryParams: detail.queryParams ?? {},
            headers: detail.headers ?? {},
            body: detail.body,
          },
          response: {
            status: detail.responseStatus,
            statusText: httpStatus,
            headers: detail.responseHeaders ?? {},
            body: detail.responseBody,
            durationMs: detail.durationMs ?? 0,
            bodySize: detail.responseBody?.length ?? 0,
          },
        })
        setResponseTab('body')
      } else {
        setResponse(null)
      }
    } catch {
      // non-critical — form still usable
    }
  }

  // ── Send handler ───────────────────────────────────────────────────────────
  function buildAuthHeader(): { key: string; value: string; enabled: boolean } | null {
    const effective = auth.type === 'inherit' ? collectionAuth : auth
    if (!effective || effective.type !== 'basic' || !effective.enabled) return null
    const username = resolveVars(effective.username, envVariables)
    const password = resolveVars(effective.password, envVariables)
    return { key: 'Authorization', value: `Basic ${btoa(`${username}:${password}`)}`, enabled: true }
  }

  function handleSend() {
    if (!url.trim()) return
    const activeHeaders = headers.filter((h) => h.key.trim() !== '').map(({ key, value, enabled }) => ({ key, value, enabled }))
    const authHeader = buildAuthHeader()
    // Auth header is injected unless the user has manually set Authorization in the headers tab
    const hasManualAuth = activeHeaders.some((h) => h.key.toLowerCase() === 'authorization')
    const mergedHeaders = authHeader && !hasManualAuth ? [authHeader, ...activeHeaders] : activeHeaders
    executeRequest({
      environmentId: selectedEnv === 'none' ? undefined : selectedEnv,
      method,
      url,
      queryParams: params
        .filter((p) => p.key.trim() !== '')
        .map(({ key, value, enabled }) => ({ key, value, enabled })),
      headers: mergedHeaders,
      body: body || undefined,
      bodyType,
    })
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-base">
      <TopBar selectedEnv={selectedEnv} onEnvChange={setSelectedEnv} onNewRequest={handleNewRequest} onLogout={onLogout} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activeRequestId={activeRequest?.id}
          envVariables={envVariables}
          onRequestSelect={handleRequestSelect}
          onRequestSend={handleRequestSend}
          onHistorySelect={handleHistorySelect}
        />

        <main className="flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-hidden border-b border-border min-h-0">
            <div className="flex-1 min-w-0 overflow-hidden">
              <RequestPanel
                method={method}
                url={url}
                params={params}
                headers={headers}
                body={body}
                bodyType={bodyType}
                auth={auth}
                savedAuth={savedAuth}
                collectionAuth={collectionAuth}
                activeTab={requestTab}
                activeRequest={activeRequest}
                envVariables={envVariables}
                onMethodChange={handleMethodChange}
                onUrlChange={handleUrlChange}
                onParamsChange={handleParamsChange}
                onHeadersChange={setHeaders}
                onBodyChange={setBody}
                onBodyTypeChange={setBodyType}
                onAuthChange={setAuth}
                onTabChange={setRequestTab}
                onSend={handleSend}
                onSaved={(saved) => { setActiveRequest(saved); setSavedAuth(auth) }}
              />
            </div>
            <RightPanel
              method={method}
              selectedEnvId={selectedEnv}
              url={url}
              params={params}
              headers={headers}
              body={body}
              bodyType={bodyType}
              auth={auth}
              collectionAuth={collectionAuth}
              envVariables={envVariables}
              onVarChange={(name, value) =>
                setEnvOverrides((prev) => ({ ...prev, [name]: value }))
              }
            />
          </div>

          <div className="flex-1 overflow-hidden min-h-0">
            <ResponsePanel
              response={response}
              error={executeError}
              isExecuting={isExecuting}
              activeTab={responseTab}
              onTabChange={setResponseTab}
              sentAt={sentAt}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

// ─── Auth gate ───────────────────────────────────────────────────────────────

function AuthGate() {
  const [authChecked, setAuthChecked] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    setOnUnauthorized(() => setIsAuthenticated(false))
    api.me()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setAuthChecked(true))
  }, [])

  if (!authChecked) return null

  if (!isAuthenticated) {
    return <LoginPage onLogin={() => setIsAuthenticated(true)} />
  }

  return <AppShell onLogout={() => setIsAuthenticated(false)} />
}

// ─── App ─────────────────────────────────────────────────────────────────────
// The default export wraps AuthGate in QueryClientProvider so that all
// useQuery/useMutation hooks work anywhere in the tree.

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={300}>
        <ToastProvider>
          <AuthGate />
        </ToastProvider>
      </Tooltip.Provider>
    </QueryClientProvider>
  )
}
